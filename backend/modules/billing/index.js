module.exports = {
  ...require('./billing.controller'),
  ...require('./billing.service'),
  ...require('./billing.repository'),
  ...require('./billing.routes')
};
