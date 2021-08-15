const cluster = require('cluster');
const cpus = require('os').cpus().length;
const { ServerConstants, StatusConstants, MessageConstants } = require('./src/utilities/AppConstants');
const { parseCmdFlags, readServerCertificates } = require('./src/utilities/app-utils');
const { registerApiEndpoints } = require('./src/api/controllers/web-apis-controller');
const { configureLogger, logit } = require('./src/logger/logger-impl');
const { configureSignalingServer } = require('./server');

/**
 * this will configure master process when server is running in cluster mode
 * 
 * 
 */
async function configureMasterProcess() {

  await configureLogger();

  // This will store all the forked child processes
  const workers = [];

  /*
   * This will keep track of all the clients connected to all
   * the child process socket server
   * example - {
   *   'username' : processIndex(in workers array defined above)
   * }
   * 
   */
  global.connectedClients = {};

  logit({
    text: 'master process started with process id: ' + process.pid,
    level: ServerConstants.LOG_TYPES.DEBUG
  });

  // Server certificate and private key
  const options = await readServerCertificates('./ssl/new/');

  //Registering all the REST endpoints apis
  registerApiEndpoints(options);

  let workerSocketServerPort = ServerConstants.SOCKET_SERVER_PORT_START_RANGE;

  const maxServerProcess = global.cmdFlags.maxServerProcess ? global.cmdFlags.maxServerProcess : cpus;
  logit({
    text: 'max server processes that will be forked: ' + maxServerProcess,
    level: ServerConstants.LOG_TYPES.DEBUG
  });

  // Start forking child processes
  for (let i = 0; i < maxServerProcess; i++) {

    workers.push(cluster.fork({
      port: workerSocketServerPort
    }));

    workers[i].on('disconnect', () => {
      logit({
        text: 'worker ' + workers[i].id + ' has died.',
        level: ServerConstants.LOG_TYPES.DEBUG
      });
    });

    //Handle message from any worker
    workers[i].on('message', (message) => {
      switch (message.type) {

        case MessageConstants.USER:
          if (message.data.connected) {
            // When new user got registered
            global.connectedClients[message.data.username] = i;
          } else {
            // When an user got disconnected
            delete global.connectedClients[message.data.username];
          }

          //Broadcast new user state to all connected users
          if (global.cmdFlags.broadcastNewConnection === 'all') {
            let i = workers.length - 1;
            while (i >= 0) {
              workers[i].send(message);
              i--;
            }
          }
          break;

        case ServerConstants.IPC_MESSAGE_TYPES.WORKER_MESSAGE:
          if (global.connectedClients[message.data.to]) {
            workers[global.connectedClients[message.data.to]].send(message);
          }
          break;
        default:
      }
    });

    /**
     * 
     * increment the port number
     */
    workerSocketServerPort++;

  }
}

//Parse command line flags
parseCmdFlags();

if (global.cmdFlags.cluster && cluster.isMaster) {
  configureMasterProcess();
} else {
  configureSignalingServer();
}