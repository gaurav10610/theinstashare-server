const { ServerConstants, MessageConstants } = require('./src/utilities/AppConstants');
const { registerApiEndpoints } = require('./src/api/controllers/web-apis-controller');
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

  if (cluster.isWorker) {

    // logit({
    //   text: 'worker process started with process id: ' + process.pid,
    //   level: ServerConstants.LOG_TYPES.DEBUG
    // });
  }

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

    /**
     * Don't need this api server when running in cluster mode as
     * master server will be exposing same api endpoints
     */
    if (cluster.isMaster) {
      registerApiEndpoints(options);
    }

    let serverPort = cluster.isMaster ? ServerConstants.SOCKET_SERVER_PORT_START_RANGE : process.env.port;

    server.listen(serverPort, () => {
      logit({
        text: 'theinstashare socket server started at port: ' + serverPort,
        level: ServerConstants.LOG_TYPES.DEBUG
      });
    });

    //This block is to achieve sticky session when running in cluster mode
    if (cluster.isWorker) {

      //listning for message event sent by master to catch the connection and resume
      cluster.worker.on('message', (message, connection) => {
        switch (message.type) {

          case ServerConstants.IPC_MESSAGE_TYPES.WORKER_MESSAGE:
            // console.log('Process ' + process.pid + ' received worker message.');
            socketServer.emit('message', message.data);
            break;

          case MessageConstants.USER:
            //console.log('Process ' + process.pid + ' received worker message.');
            if (message.pid !== process.pid) {
              broadcastMessage(message.data);
            }
            break;
          default:
        }
      });
    }

  } catch (e) {
    console.log(e);
    logit({
      text: 'error starting instashare server at port => ' + ServerConstants.EXPRESS_PORT,
      level: ServerConstants.LOG_TYPES.ERROR
    });
  }
}

module.exports = {
  configureSignalingServer
};
