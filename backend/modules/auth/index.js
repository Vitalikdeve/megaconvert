module.exports = {
  ...require('./auth.controller'),
  ...require('./auth.service'),
  ...require('./auth.repository'),
  ...require('./auth.routes')
};
