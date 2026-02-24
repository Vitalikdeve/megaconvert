const { Router } = require('express');

const createBillingRoutes = () => {
  const router = Router();
  return router;
};

module.exports = { createBillingRoutes };
