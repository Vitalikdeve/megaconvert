# MegaConvert Bot SDK

Minimal SDK for writing MegaConvert bots with encrypted webhook transport.

## Install

```bash
npm install megaconvert-bot-sdk
```

## Usage

```javascript
import { MegaBot } from 'megaconvert-bot-sdk';

const bot = new MegaBot({
  privateKey: process.env.BOT_PRIVATE_KEY,
  serverUrl: 'http://127.0.0.1:8080'
});

bot.on('message', async (msg) => {
  if (msg.text === '/start') {
    await bot.reply(msg.from, 'Welcome to MegaStore support!', {
      buttons: [{ text: 'Catalog', action: 'open_catalog' }]
    });
  }
});

await bot.listen(3000);
```

## Notes

- `privateKey` must be PKCS#8 DER hex from MegaConvert bot dashboard.
- SDK auto-derives `publicKey` and registers webhook via `POST /bots/register`.
- Reply delivery uses `POST /bots/reply`.
