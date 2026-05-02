# UG Live Licensing Platform

Node.js backend for:
- app activation + single-device license enforcement
- admin panel for customers/licenses
- one-page informational website

## Run locally

```bash
npm install
copy .env.example .env
npm run seed
npm start
```

Open:
- Website: `http://localhost:8081/`
- Admin: `http://localhost:8081/admin/login`

## API used by app

- `POST /api/activate`
  - body: `{ email, password, deviceId, deviceName }`
- `GET /api/license/status`
  - header: `Authorization: Bearer <token>`
- `POST /api/license/heartbeat`
  - header: `Authorization: Bearer <token>`

## Deploy (Contabo)

```bash
# on server
apt update && apt install -y nginx nodejs npm
mkdir -p /var/www/uglive-licensing
# copy project files here
cd /var/www/uglive-licensing/licensing-platform
npm install --omit=dev
cp .env.example .env
npm run seed
npm install -g pm2
pm2 start server.js --name uglive-licensing
pm2 save
```

Point Nginx for `uglive.io` to `http://127.0.0.1:8081`.
