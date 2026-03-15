const { Router } = require('express');
const {
  registerPublicKey,
  getContactPublicKey,
  loadHistory,
} = require('../src/messenger.controller');

function createMessengerRouter() {
  const router = Router();

  router.post('/messenger/keys', registerPublicKey);
  router.get('/messenger/contacts/:contactId/public-key', getContactPublicKey);
  router.get('/messenger/history/:contactId', loadHistory);

  return router;
}

module.exports = {
  createMessengerRouter,
};
