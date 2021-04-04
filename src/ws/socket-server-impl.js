const { ServerConstants, MessageConstants } = require('../utilities/AppConstants');
const { logit } = require('../logger/logger-impl');
const cluster = require('cluster');
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
    text: 'websocket connection initiated for socket id: ' + socket.id,
    level: ServerConstants.LOG_TYPES.DEBUG
  });

  socket.on("error", webSocketError);
  socket.on("message", webSocketMessageReceived);
}

// websocket message received on connection
function webSocketMessageReceived(message) {
  try {
    logit({
      text: 'message on socket | type: ' + message.type + ' | from: ' + message.from + '| to: ' + message.to,
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
            text: message.from + ' got connected with server having process id: ' + process.pid,
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
    text: 'websocket connection error with reason: ' + error,
    level: ServerConstants.LOG_TYPES.ERROR
  });
}

// handling websocket server error event
function webSocketServerError(error) {
  logit({
    text: 'websocket server error with reason: ' + error,
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
    delete global.connectedClients[username];
    broadcastUserState(false, username);
    logit({
      text: username + ' got disconnected with server having process id: ' + process.pid,
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

    // When message has to be multicast
    if (to instanceof Array) {
      async.forEach(to, (recipient, callback) => {
        if (global.connectedClients[recipient]) {
          if (global.socketServer.sockets.sockets[global.connectedClients[recipient].socketId]) {
            global.socketServer.sockets.sockets[global.connectedClients[recipient].socketId].send(message);
          }
        } else {

          // When running in cluster mode then recipient may be
          // connected to some other server child
          if (cluster.isWorker) {
            process.send({
              type: ServerConstants.IPC_MESSAGE_TYPES.WORKER_MESSAGE,
              data: message
            })
          }
        }
      }, (err) => {
        //do nothing here
      });
    } else {

      if (global.connectedClients[to]) {
        if (global.socketServer.sockets.sockets[global.connectedClients[to].socketId]) {
          global.socketServer.sockets.sockets[global.connectedClients[to].socketId].send(message);
        }
      } else {
        if (cluster.isWorker) {
          process.send({
            type: ServerConstants.IPC_MESSAGE_TYPES.WORKER_MESSAGE,
            data: message
          })
        }

      }
    }
  } catch (e) {
    console.log(e);
    logit({
      text: 'error while sending message on socket | from: ' + from + ' | to: ' + to,
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
      //Updating channel identifier in connected clients map with username
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
    delete global.connectedClients[username];
    socket.removeAllListeners('disconnect');
    logit({
      text: username + ' got de-registered from server',
      level: ServerConstants.LOG_TYPES.DEBUG
    });
    broadcastUserState(false, username);
  }
}

function broadcastMessage(message) {
  async.forEach(Object.keys(global.connectedClients), (user, callback) => {
    sendSocketMessage(ServerConstants.RTC_SERVER, user, message);
  }, (err) => {
    //console.log('iterating done');
  });
}

/**
 * This method will send an update to all user about new user connected or disconnected
 * @param  {Boolean} isConnected : flag to distinguish between connect or disconnect event
 * @param  {String}  username    : username of the user connected or disconnected
 */
function broadcastUserState(isConnected, username) {
  //Update all users for newly connected user
  const message = {
    type: MessageConstants.USER,
    connected: isConnected,
    username: username
  };

  if (cluster.isWorker) {
    //Updating master
    process.send({
      type: MessageConstants.USER,
      pid: process.pid,
      data: message
    });
  }

  if (global.cmdFlags.broadcastNewConnection === 'all') {
    broadcastMessage(message);
  }
}

module.exports = {
  configureWebsocketServer,
  broadcastMessage
};
