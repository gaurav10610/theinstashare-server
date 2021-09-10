const fs = require('fs');

function parseCmdFlags() {
  //All command line flags supported by server
  global.cmdFlags = {
    ssl: false,
    broadcastNewConnection: 'all', // values could be 'all' or contacts
    prod: false,
    cluster: false,
    stopAllLogs: false
  };

  //Parsing command line flags
  process.argv.forEach((val, index, array) => {
    if (val.indexOf('--ssl') >= 0) {
      if (val.split('=')[1].toString() === 'true') global.cmdFlags.ssl = true;
    }

    if (val.indexOf('--broadcastNewConnection') >= 0) {
      global.cmdFlags.broadcastNewConnection = val.split('=')[1].toString();
    }

    if (val.indexOf('--prod') >= 0) {
      if (val.split('=')[1].toString() === 'true') global.cmdFlags.prod = true;
    }

    if (val.indexOf('--cluster') >= 0) {
      if (val.split('=')[1].toString() === 'true') global.cmdFlags.cluster = true;
    }

    if (val.indexOf('--stopAllLogs') >= 0) {
      if (val.split('=')[1].toString() === 'true') global.cmdFlags.stopAllLogs = true;
    }

    if (val.indexOf('--maxServerProcess') >= 0) {
      global.cmdFlags['maxServerProcess'] = parseInt(val.split('=')[1].toString());
    }
  });
}

/**
 * this return server certificate and key
 * @param  {[string]} path : path of the directory where certificates are stored
 */
function readServerCertificates(path) {
  return new Promise((resolve, reject) => {
    try {
      resolve({
        key: fs.readFileSync(path + 'private.key', 'utf8'),
        cert: fs.readFileSync(path + 'certificate.crt', 'utf8')
      });
    } catch (error) {
      reject(error);
    }
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

module.exports = {
  parseCmdFlags,
  readServerCertificates,
  sleep
}
