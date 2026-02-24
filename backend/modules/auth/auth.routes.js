const { Router } = require('express');

const createAuthRoutes = () => {
  const router = Router();
  return router;
};

module.exports = { createAuthRoutes };
