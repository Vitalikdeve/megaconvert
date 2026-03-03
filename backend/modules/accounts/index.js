module.exports = {
  ...require('./accounts.controller'),
  ...require('./accounts.service'),
  ...require('./accounts.repository'),
  ...require('./accounts.routes')
};
