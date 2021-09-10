const { ServerConstants } = require('../../utilities/AppConstants');
const { getUserStatus, getActiveUsers, handleGroupRegistration, getActiveGroupUsers } = require('../impl/service-impl');
const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const https = require('https');
const { logit } = require('../../logger/logger-impl');

/**
 * Register all REST endpoints and start the api server
 * @param options: ssl certificate options for ssl server
 */
function registerApiEndpoints(options) {

  try {
    const app = express();
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({
      extended: true
    }));

    //To resolve CORS related issues
    app.use(function (req, res, next) {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept");
      next();
    });

    /*
     * enquire the status of a user whether he is online or not
     */
    app.get(`${ServerConstants.API_BASE_URL}status/:name`, getUserStatus);

    /*
     * get list of all active users on server excluding user itself
     */
    app.get(`${ServerConstants.API_BASE_URL}active/users`, getActiveUsers);

    app.get(`${ServerConstants.API_BASE_URL}group/users`, getActiveGroupUsers);

    /**
     * handle user registeration in any group
     */
    app.post(`${ServerConstants.API_BASE_URL}group/register`, handleGroupRegistration);

    if (global.cmdFlags.ssl) {

      //Prod mode supporting ssl
      https.createServer(options, app).listen(ServerConstants.EXPRESS_PORT);
    } else {

      //When testing locally
      http.createServer(app).listen(ServerConstants.EXPRESS_PORT);
    }

    logit({
      text: `theinstashare api server started at port: ${ServerConstants.EXPRESS_PORT}`,
      level: ServerConstants.LOG_TYPES.DEBUG
    });

  } catch (error) {
    logit({
      text: 'error while registering api endpoints on express server',
      level: ServerConstants.LOG_TYPES.ERROR
    });
  }
}

module.exports = {
  registerApiEndpoints
};
