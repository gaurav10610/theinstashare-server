/*
 * To know whether a user is still connected to signaling rtc or not
 */
function getUserStatus(req, res) {
  try {
    if (global.connectedClients.hasOwnProperty(req.params.name)) {
      res.status(200).send({
        status: true
      });
    } else {
      res.status(200).send({
        status: false
      });
    }
  } catch (e) {
    res.status(200).send({
      status: false
    });
  }
}

/*
 * This will return list of al the active users on the server excluding
 * user itself
 */
function getActiveUsers(req, res) {
  const activeUsersList = Object.keys(global.connectedClients);
  let prefix = req.query.prefix;
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

module.exports = {
  getUserStatus,
  getActiveUsers
};
