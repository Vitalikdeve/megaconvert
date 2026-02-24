module.exports = {
  ...require('./posts.controller'),
  ...require('./posts.service'),
  ...require('./posts.repository'),
  ...require('./posts.routes')
};
