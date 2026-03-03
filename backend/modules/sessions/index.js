module.exports = {
  ...require('./sessions.controller'),
  ...require('./sessions.service'),
  ...require('./sessions.repository'),
  ...require('./sessions.routes')
};
