const cluster = require('cluster');
const cpus = require('os').cpus().length;
const { ServerConstants, MessageConstants } = require('./src/utilities/AppConstants');
const { parseCmdFlags, readServerCertificates } = require('./src/utilities/app-utils');
const { registerApiEndpoints } = require('./src/api/controllers/web-apis-controller');
const { configureLogger, logit } = require('./src/logger/logger-impl');
const { configureSignalingServer } = require('./server');

/**
 * this will configure master process when server is running in cluster mode
 * 
 */
async function configureMasterProcess() {

  await configureLogger();

  // This will store all the forked child processes
  global.workers = [];

  /*
   * This will keep track of all the clients connected to all
   * the child process socket server
   * example - {
   *   'username' : processIndex(in workers array defined above)
   * }
   * 
   */
  global.connectedClients = {};

  /**
   * this will keep track that which user is currently using which group
   * 
   * example - {
   *  'p2p': {
   *    'username': socketId // user's socket connection id 
   *   }
   * }
   */
  global.groupContext = {
    p2p: {},
    group_chat: {}
  };

  logit({
    text: `master process started with process id: ${process.pid}`,
    level: ServerConstants.LOG_TYPES.DEBUG
  });

  // Server certificate and private key
  const options = await readServerCertificates('./ssl/new/');

  //Registering all the REST endpoints apis
  registerApiEndpoints(options);

  let workerSocketServerPort = ServerConstants.SOCKET_SERVER_PORT_START_RANGE;

  const maxServerProcess = global.cmdFlags.maxServerProcess ? global.cmdFlags.maxServerProcess : cpus;
  logit({
    text: `max server processes that will be forked: ${maxServerProcess}`,
    level: ServerConstants.LOG_TYPES.DEBUG
  });

  // Start forking child processes
  for (let i = 0; i < maxServerProcess; i++) {

    global.workers.push(cluster.fork({
      port: workerSocketServerPort
    }));

    global.workers[i].on('disconnect', () => {
      logit({
        text: `worker ${global.workers[i].id} has died`,
        level: ServerConstants.LOG_TYPES.DEBUG
      });
    });

    //Handle message from any worker
    global.workers[i].on('message', (message) => {
      logit({
        text: `received message on master process ${JSON.stringify(message)}`,
        level: ServerConstants.LOG_TYPES.DEBUG
      });
      switch (message.type) {

        case MessageConstants.USER:
          if (message.data.connected) {
            // When new user got registered
            global.connectedClients[message.data.username] = {
              workerId: i
            };
          } else {
            // When an user got disconnected
            const currentGroupName = global.connectedClients[message.data.username][ServerConstants.CURRENT_GROUP];
            delete global.connectedClients[message.data.username];
            if (currentGroupName) {
              delete global.groupContext[currentGroupName][message.data.username]
            }
          }
          break;

        case ServerConstants.IPC_MESSAGE_TYPES.WORKER_MESSAGE:
          if(global.connectedClients[message.data.to]) {
            const recipientServerWorkerId = global.connectedClients[message.data.to].workerId;
            global.workers[recipientServerWorkerId].send(message);
          } else {
            logit({
              text: `unable to send message to ${message.data.to} as there is no connected user with such name`,
              level: ServerConstants.LOG_TYPES.DEBUG
            });
          }
          break;

        case ServerConstants.IPC_MESSAGE_TYPES.BROADCAST_MESSAGE:
          global.workers.forEach(worker => worker.send(message));
          break;

        default:
          //do nothing
      }
    });

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