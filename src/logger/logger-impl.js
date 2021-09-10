const winston = require('winston');
const cluster = require('cluster');
const myFormat = winston.format.printf(({ level, message, label, timestamp
}) => {
  return `{"timestamp":"${timestamp}","processId":"${message.processId}","level":"${level}","message":"${message.text}"}`;
});

function configureLogger() {
  return new Promise((resolve) => {
    try {
      let transports = [];
      //if (global.cmdFlags.prod) {
        let logFileName;
        if (cluster.isMaster) {
          logFileName = 'logs/master-server.log'
        } else {
          logFileName = `logs/${process.env.port}-server.log`
        }
        transports.push(new winston.transports.File({
          filename: logFileName
        }));
      //}
      transports.push(new winston.transports.Console());
      global.logger = winston.createLogger({
        format: winston.format.combine(
          winston.format.timestamp(),
          myFormat
        ),
        level: 'silly',
        transports: transports
      });
    } catch (e) {
      console.log(e);
      resolve();
    }
    resolve();
  });
}

/**
 * This will handle server logging
 * @param message: message to log
 */
function logit(message) {
  try {
    message.processId = process.pid;
    if (!global.cmdFlags.stopAllLogs) {
      if (global.logger) {
        global.logger.log({
          level: message.level,
          message: message
        });
      } else {
        //when fail to configure logger
        console.log(JSON.stringify({
          timestamp: winston.format.timestamp(),
          processId: message.processId,
          level: message.level,
          message: message.text
        }));
      }
    }
  } catch (error) {
    console.log(error);
  }
}

module.exports = {
  logit,
  configureLogger
};
