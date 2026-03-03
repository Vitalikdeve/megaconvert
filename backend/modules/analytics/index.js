module.exports = {
  ...require('./analytics.controller'),
  ...require('./analytics.service'),
  ...require('./analytics.repository'),
  ...require('./analytics.routes')
};
