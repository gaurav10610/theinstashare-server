const { ServerConstants, MessageConstants } = require('../utilities/AppConstants');
const { logit } = require('../logger/logger-impl');
const async = require("async");

/**
 * This will configure websocket server
 * @param webSocketServer: socket server instance
 */
function configureWebsocketServer() {
  global.socketServer.on("error", webSocketServerError);
  global.socketServer.on('connection', webSocketConnection);
}

// new websocket connection has been made
function webSocketConnection(socket) {
  logit({
    text: `websocket connection initiated for socket id: ${socket.id}`,
    level: ServerConstants.LOG_TYPES.DEBUG
  });

  socket.on("error", webSocketError);
  socket.on("message", webSocketMessageReceived);
}

// websocket message received on connection
function webSocketMessageReceived(message) {
  try {
    logit({
      text: `message on socket|type: ${message.type}|from: ${message.from}|to: ${message.to}`,
      level: ServerConstants.LOG_TYPES.DEBUG
    });

    switch (message.type) {

      case MessageConstants.REGISTER:
        registerUser(message.from, this).then(() => {
          const registerMessage = {
            type: MessageConstants.REGISTER,
            success: true,
            username: message.from
          };
          registerSocketDisconnectHandler(this, message.from);
          sendSocketMessage(message.from, message.from, registerMessage);
          broadcastUserState(true, message.from);

          logit({
            text: `${message.from} got connected!`,
            level: ServerConstants.LOG_TYPES.DEBUG
          });
        }).catch(() => {

          //Send unsuccessful registration message
          const registerMessage = {
            type: MessageConstants.REGISTER,
            success: false,
            username: message.from
          };
          sendSocketMessage(message.from, message.from, registerMessage);
        });
        break;

      case MessageConstants.DEREGISTER:
        deRegisterUser(message.from, this);
        break;

      default:
        // don't process incoming message in case user is not registered
        if (global.connectedClients[message.from])
          sendSocketMessage(message.from, message.to, message);
    }
  } catch (error) {
    logit({
      text: 'error while handling message on socket',
      level: ServerConstants.LOG_TYPES.ERROR
    });
    console.log(error);
  }
}

// handling websocket connection error
function webSocketError(error) {
  logit({
    text: `websocket connection error with reason: ${error}`,
    level: ServerConstants.LOG_TYPES.ERROR
  });
}

// handling websocket server error event
function webSocketServerError(error) {
  logit({
    text: `websocket server error with reason: ${error}`,
    level: ServerConstants.ERROR
  });
}

/**
 * this will register the disconnect handler on the provided socket connection
 * @param  socket   :socket client connection
 * @param  username :username of the user
 */
function registerSocketDisconnectHandler(socket, username) {
  //Registering disconnect listener
  socket.on('disconnect', (reason) => {
    const currentAppName = global.connectedClients[username][ServerConstants.CURRENT_GROUP];
    delete global.connectedClients[username];
    if (currentAppName) {
      delete global.groupContext[currentAppName][username]
    }
    broadcastUserState(false, username, currentAppName);
    logit({
      text: `${username} got disconnected!`,
      level: ServerConstants.LOG_TYPES.DEBUG
    });
  }); // Here ends the disconnect handler
}

/**
 * this will send a message on a socket connection registered as 'to' from user
 * registered as 'from'
 * @param  {String} from  :username of the sender
 * @param  {String} to    :username of the recipient
 * @param  {JSON} message :message to be sent
 */
function sendSocketMessage(from, to, message) {

  try {

    // When message has to be multicasted
    if (to instanceof Array) {
      async.forEach(to, (recipient, callback) => {
        if (global.connectedClients[recipient]) {
          const recipientSocketId = global.connectedClients[recipient].socketId
          if (recipientSocketId && global.socketServer.sockets.sockets[recipientSocketId]) {
            global.socketServer.sockets.sockets[recipientSocketId].send(message);
          }
        } else {

          /* 
          * recipient may be connected to some other server process
          *
          **/
          process.send({
            type: ServerConstants.IPC_MESSAGE_TYPES.WORKER_MESSAGE,
            data: message
          })
        }
      }, (err) => {
        //do nothing here
      });
    } else {

      if (global.connectedClients[to]) {
        const recipientSocketId = global.connectedClients[to].socketId
        if (recipientSocketId && global.socketServer.sockets.sockets[recipientSocketId]) {
          global.socketServer.sockets.sockets[recipientSocketId].send(message);
        }
      } else {
        process.send({
          type: ServerConstants.IPC_MESSAGE_TYPES.WORKER_MESSAGE,
          data: message
        })
      }
    }
  } catch (e) {
    console.log(e);
    logit({
      text: `error while sending message on socket|from: ${from}|to: ${to}`,
      level: ServerConstants.LOG_TYPES.ERROR
    });
  }
}

/**
 * This will update the identifier of user's connection in connected clients map
 * @param  username: username of the user
 * @param  socket: socket connection of the user
 */
function registerUser(username, socket) {
  return new Promise((resolve, reject) => {
    if (global.connectedClients[username]) {
      //When there is already an existing user
      reject();
    } else {
      //Updating socket id in connected clients corresponding to username
      global.connectedClients[username] = {
        socketId: socket.id
      };
      resolve();
    }
  });
}

/**
 * This will remove the identifier of user's connection in connected clients map
 * @param  username: username of the user
 * @param  socket: socket connection of the user
 */
function deRegisterUser(username, socket) {
  if (global.connectedClients[username]) {
    const currentGroupName = global.connectedClients[username][ServerConstants.CURRENT_GROUP]
    delete global.connectedClients[username];
    if (currentGroupName) {
      delete global.groupContext[currentGroupName][username];
    }
    socket.removeAllListeners('disconnect');
    logit({
      text: `${username} got de-registered message from client`,
      level: ServerConstants.LOG_TYPES.DEBUG
    });
    broadcastUserState(false, username, currentGroupName);
  }
}

/**
 * This method will send an update to all users about new user connected or disconnected
 * @param  {Boolean} isConnected : flag to distinguish between connect or disconnect event
 * @param  {String}  username    : username of the user connected or disconnected
 * @param {String} currentGroupName: current group of user
 */
function broadcastUserState(isConnected, username, currentGroupName) {
  //Update all users for newly connected user
  const message = {
    type: MessageConstants.USER,
    connected: isConnected,
    username: username
  };

  //broadcast user state to to 
  process.send({
    type: MessageConstants.USER,
    pid: process.pid,
    data: message
  });

  /**
   * broadcast disconnected state
   */
  if (isConnected === false) {
    broadCastMessage(message, currentGroupName)
  }
}

/**
 * broadcast any message via master process to all the clients connected to all the process servers
 * @param {*} message 
 * @param {*} groupName 
 */
function broadCastMessage(message, groupName) {
  process.send({
    type: ServerConstants.IPC_MESSAGE_TYPES.BROADCAST_MESSAGE,
    pid: process.pid,
    data: message,
    groupName: groupName
  });
}

module.exports = {
  configureWebsocketServer
};
