const e = require("express");
const { ServerConstants } = require("../../utilities/AppConstants");
const { logit } = require('../../logger/logger-impl');

/*
 * To know whether a user is still connected to signaling rtc or not
 */
function getUserStatus(req, res) {
  if (global.connectedClients.hasOwnProperty(req.params.name)) {
    res.status(200).send({
      status: true
    });
  } else {
    res.status(200).send({
      status: false
    });
  }
}

/*
 * This will return list of all the active users on the server excluding
 * user itself
 */
function getActiveUsers(req, res) {
  const prefix = req.query.prefix;
  const appName = req.query.appName;
  let activeUsersList;
  if (appName && appName.trim() !== '') {
    activeUsersList = Object.keys(global.applicationsContext[appName]);
  } else {
    activeUsersList = Object.keys(global.connectedClients);
  }

  if (prefix && prefix !== '') {
    let userList = activeUsersList.filter(checkPrefix, prefix);
    res.status(200).send({
      users: userList
    });
  } else {
    res.status(200).send({
      users: activeUsersList
    });
  }
}

function checkPrefix(str) {
  const prefix = String(this);
  return str.length >= prefix.length && str.includes(prefix);
}

/**
 * handle user registeration in any theinstashare application
 * @param {*} req 
 * @param {*} res 
 */
function handleAppRegistration(req, res) {
  const username = req.body.username;
  const applicationName = req.body.applicationName;
  logit({
    text: `received request for application registration for user: ${username} and application: ${applicationName}`,
    level: ServerConstants.LOG_TYPES.DEBUG
  });
  const errors = [];
  if (username && applicationName) {
    if (username in global.connectedClients) {

      if (!Object.values(ServerConstants.APPLICATION_NAMES).includes(applicationName)) {
        errors.push({
          message: 'invalid application name'
        });
      } else {
        global.connectedClients[username][ServerConstants.CURRENT_APPLICATION] = applicationName;
        global.applicationsContext[applicationName][username] = {
          socketId: global.connectedClients[username].socketId
        }

        /**
         * notify appropriate socket server as well
         */
        if (global.connectedClients[username]) {
          global.workers[global.connectedClients[username].workerId].send({
            'applicationName': applicationName,
            'username': username,
            'type': ServerConstants.IPC_MESSAGE_TYPES.APP_REGISTER
          });
        }
        res.status(200).send({
          registered: true
        });
      }
    } else {
      errors.push({
        message: 'user is not registered with server'
      });
    }
  } else {
    errors.push({
      message: 'username and applicationName is required'
    });
  }
  if (errors.length > 0) {
    res.status(422).send({
      errors: errors
    });
  }
}

function getApplicationActiveUsers(req, res) {
  const appName = req.query.appName;
  if (appName && appName.trim() !== '') {
    res.status(200).send(global.applicationsContext[appName]);
  } else {
    res.status(200).send(global.applicationsContext);
  }
}

module.exports = {
  getUserStatus,
  getActiveUsers,
  handleAppRegistration,
  getApplicationActiveUsers
};
