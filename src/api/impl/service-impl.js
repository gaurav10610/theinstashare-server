const e = require("express");
const { ServerConstants, MessageConstants } = require("../../utilities/AppConstants");
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
  const groupName = req.query.groupName;
  let activeUsersList;
  if (groupName && groupName.trim() !== '') {
    activeUsersList = Object.keys(global.groupContext[groupName]);
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
 * handle user registeration in any theinstashare group
 * @param {*} req 
 * @param {*} res 
 */
function handleGroupRegistration(req, res) {
  const username = req.body.username;
  const groupName = req.body.groupName;
  logit({
    text: `received request for group registration for user: ${username} and group: ${groupName}`,
    level: ServerConstants.LOG_TYPES.DEBUG
  });
  const errors = [];
  if (username && groupName) {
    if (username in global.connectedClients) {

      /**
       * validate group name as theinstashare have fixed group names
       * @TODO make it more flexible afterwards
       * 
       */
      if (!Object.values(ServerConstants.THEINSTASHARE_GROUP_NAMES).includes(groupName)) {
        errors.push({
          message: 'invalid group name'
        });
      } else {
        global.connectedClients[username][ServerConstants.CURRENT_GROUP] = groupName;
        global.groupContext[groupName][username] = {
          workerId: global.connectedClients[username].workerId
        }

        /**
         * notify appropriate socket server as well
         */
        if (global.connectedClients[username]) {
          global.workers[global.connectedClients[username].workerId].send({
            'groupName': groupName,
            'username': username,
            'type': ServerConstants.IPC_MESSAGE_TYPES.GROUP_REGISTER
          });
        }

        /**
         * broadcast new user state to all user in appropriate group
         */
        if (global.cmdFlags.broadcastNewConnection === 'all') {
          const message = {
            type: MessageConstants.USER,
            connected: true,
            username: username
          };
          global.workers.forEach(worker => worker.send({
            type: ServerConstants.IPC_MESSAGE_TYPES.BROADCAST_MESSAGE,
            pid: process.pid,
            data: message,
            groupName: groupName
          }));
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
      message: 'username and groupName is required'
    });
  }
  if (errors.length > 0) {
    res.status(422).send({
      errors: errors
    });
  }
}

function getActiveGroupUsers(req, res) {
  const groupName = req.query.groupName;
  if (groupName && groupName.trim() !== '') {
    res.status(200).send(global.groupContext[groupName]);
  } else {
    res.status(200).send(global.groupContext);
  }
}

module.exports = {
  getUserStatus,
  getActiveUsers,
  handleGroupRegistration,
  getActiveGroupUsers
};
