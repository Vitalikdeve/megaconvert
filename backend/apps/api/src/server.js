const express = require('express');

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'backend-api', now: new Date().toISOString() });
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => {
  console.log('[api] listening on :' + port);
});
