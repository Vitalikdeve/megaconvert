# MegaConvert Telegram Bot

Menu-driven support bot for Telegram with:
- support inbox + ticket lifecycle
- account/billing lookup via MegaConvert API
- account linking via one-time code
- 10 in-chat file converters via MegaConvert API jobs
- data vault notes (create/search/delete)
- automation (rules + workflow templates)
- notification engine + daily digest
- analytics, assistant insights, gamification, scenario simulator

## Quick Start
1. Create `.env` from `.env.example`.
2. Install dependencies:
```powershell
cd bot
npm install
```
3. Run:
```powershell
npm start
```

## Deploy to VPS (24/7, Docker)
Example for Ubuntu 22.04/24.04.

1. Install Docker + Compose plugin:
```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
```
Then reconnect to SSH once (`exit` and login again).

2. Upload project to server:
```bash
git clone <YOUR_REPO_URL> megaconvert-bot
cd megaconvert-bot
cp .env.example .env
```
Edit `.env` and set at minimum:
- `TELEGRAM_BOT_TOKEN`
- `INTERNAL_LINK_SECRET`

3. Start bot in background:
```bash
docker compose up -d --build
```

4. Check status:
```bash
docker compose ps
docker compose logs -f --tail=100 bot
```

5. Update later:
```bash
git pull
docker compose up -d --build
```

Notes:
- `restart: unless-stopped` is enabled in `docker-compose.yml`, so bot auto-starts after VPS reboot.
- Bot state is persisted in Docker volume `bot_data` (folder `/app/data` inside container).
- If your website calls `/internal/link/*` from outside, open `INTERNAL_LINK_PORT` in firewall/security group.

## Required ENV
- `TELEGRAM_BOT_TOKEN`
- `INTERNAL_LINK_SECRET`

`TELEGRAM_SUPPORT_CHAT_ID` can be `0` for auto mode:
- bot will bind support inbox to the first private chat that sends `/start`.

## Optional ENV
- `API_BASE_URL` (default: `https://megaconvert-web.vercel.app/api`)
- `INTERNAL_LINK_PORT` (default: `8788`)
- `LINK_CODE_TTL_SEC` (default: `600`)
- `BOT_DATA_FILE` (default: `./data/bot-store.json`)
- `NOTIFICATION_POLL_MS` (default: `15000`)
- `DAILY_TICK_MS` (default: `60000`)
- `BOT_CONVERTER_MAX_MB` (default: `50`)

## Localization
- Auto language detection from Telegram `language_code` on first contact.
- Manual language switch via `/language` command.
- Inline language picker in menu (`🌐 Language` / `🌐 Язык`).
- Supported locales: `en`, `ru`, `es`, `de`, `fr`, `zh`, `ar`, `pt`, `hi`, `ja`, `ko`, `tr`.

## Main Menu Buttons
- `📞 Связаться с поддержкой`
- `👤 Мой аккаунт`
- `💎 Тариф и бенефиты`
- `🎫 Тикеты`
- `🧰 Конвертеры`
- `🗄️ Data Vault`
- `⚙️ Автоматизация`
- `📊 Аналитика`
- `🧠 Ассистент`
- `🏆 Прогресс`
- `🧪 Симулятор`
- `ℹ️ Помощь`
- `🌐 Язык`

## Support Operator Commands (in support chat)
- `/ticketlist`
- `/ticketclose <ticket_id>`
- `/ticketreply <ticket_id> <text>`
- `/reply <telegram_user_id> <text>`
- `/cancelreply`

## User Commands (in private chat)
- `/language` or `/language <code>`
- `/delrule <rule_id>`
- `/togglerule <rule_id> on|off`
- `/runwf <workflow_id>`
- `/delwf <workflow_id>`

## Converters (Top 10)
- `JPG -> PNG` (`jpg-png`)
- `PNG -> JPG` (`png-jpg`)
- `PDF -> JPG` (`pdf-jpg`)
- `JPG -> PDF` (`jpg-pdf`)
- `MP4 -> MP3` (`mp4-mp3`)
- `WAV -> MP3` (`wav-mp3`)
- `MOV -> MP4` (`mov-mp4`)
- `MP4 -> GIF` (`mp4-gif`)
- `RAR -> ZIP` (`rar-zip`)
- `JPG -> WEBP` (`jpg-webp`)

Flow:
1. Open `🧰 Конвертеры` in bot menu.
2. Choose converter.
3. Send file (prefer as Telegram `document` to keep original format).
4. Bot uploads file to API, creates `/jobs` conversion and returns result file.

## Linking Flow (site -> bot)
1. Your website generates a one-time code in account settings.
2. Website/backend registers that code in bot internal API:
```http
POST /internal/link/code/register
x-link-secret: <INTERNAL_LINK_SECRET>
Content-Type: application/json

{
  "code": "A1B2C3D4",
  "app_user_id": "firebase-or-internal-user-id",
  "email": "user@example.com",
  "ttl_sec": 600
}
```
3. User presses `🔗 Связать аккаунт` in Telegram and sends this code.
4. Bot validates code and links Telegram to app account.

This is the recommended website -> bot linking method for account authorization in Telegram.

## Legacy Linking Flow (bot -> site, optional)
If you want the opposite flow (bot generates code and site confirms), keep using:
```http
POST /internal/link/complete
x-link-secret: <INTERNAL_LINK_SECRET>
Content-Type: application/json

{
  "code": "A1B2C3D4",
  "app_user_id": "firebase-or-internal-user-id",
  "email": "user@example.com"
}
```

## Healthcheck
```http
GET /health
```
