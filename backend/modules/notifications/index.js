module.exports = {
  ...require('./notifications.controller'),
  ...require('./notifications.service'),
  ...require('./notifications.repository'),
  ...require('./notifications.routes')
};
