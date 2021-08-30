const { ServerConstants, MessageConstants } = require('./src/utilities/AppConstants');
const { configureWebsocketServer, broadcastMessage } = require('./src/ws/socket-server-impl');
const http = require('http');
const https = require('https');
const io = require('socket.io');
const cluster = require('cluster');
const { configureLogger, logit } = require('./src/logger/logger-impl');
const { readServerCertificates } = require('./src/utilities/app-utils');

/**
 * this will instantiate a single instance of server
 */
async function configureSignalingServer() {

  await configureLogger();

  /**
   * server instance for socket server
   * 
   */
  let server;

  /*
   * This will keep track of all the webrtc peer connections and the data channels
   * {'socket.id':{connection: peerConnection, channel : dataChannel}}
   */
  global.connectedClients = {};

  /**
   * this will keep track that which user is currently using which app
   * 
   * example - {
   *  'p2p': {
   *    'username': socketId // user's socket connection id 
   *   }
   * }
   */
  global.applicationsContext = {
    p2p: {},
    group_chat: {}
  };

  // Server certificate and private key
  const options = await readServerCertificates('./ssl/new/');

  try {

    if (global.cmdFlags.ssl) {

      //Prod mode supporting ssl
      server = https.createServer(options);
    } else {

      //When testing locally
      server = http.createServer();
    }

    //Socket.io server listening with http or https server
    global.socketServer = io(server);

    // Setup websocket server
    configureWebsocketServer();

    server.listen(process.env.port, () => {
      logit({
        text: `theinstashare socket server started at port: ${process.env.port}`,
        level: ServerConstants.LOG_TYPES.DEBUG
      });
    });

    //listening for message event sent by master to catch the connection and resume
    cluster.worker.on('message', (message, connection) => {
      switch (message.type) {

        case ServerConstants.IPC_MESSAGE_TYPES.WORKER_MESSAGE:
          // console.log('Process ' + process.pid + ' received worker message.');
          socketServer.emit('message', message.data);
          break;

        case ServerConstants.IPC_MESSAGE_TYPES.APP_REGISTER:
          const applicationName = message.applicationName;
          const username = message.username;
          global.connectedClients[username][ServerConstants.CURRENT_APPLICATION] = applicationName;
          global.applicationsContext[applicationName][username] = {
            socketId: global.connectedClients[username].socketId
          }
          logit({
            text: `${username} is registered as user for application ${applicationName}`,
            level: ServerConstants.LOG_TYPES.DEBUG
          });
          break;
        default:
      }
    });

  } catch (e) {
    console.log(e);
    logit({
      text: `error starting instashare server at port => ${ServerConstants.EXPRESS_PORT}`,
      level: ServerConstants.LOG_TYPES.ERROR
    });
  }
}

module.exports = {
  configureSignalingServer
};
