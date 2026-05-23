# Personal Dashboard

Minimal Next.js dashboard that shows the current date and time on a dark full-screen page.

## Install dependencies

```bash
cd "/home/bcjamal/projects/personal dashboard"
npm install
```

## Run locally

Development server:

```bash
npm run dev
```

Production build and server:

```bash
npm run build
npm start
```

The app is configured to serve on `http://localhost:3000`.

## systemd service

Save this as `/etc/systemd/system/personal-dashboard.service`:

```ini
[Unit]
Description=Personal Dashboard Next.js App
After=network.target

[Service]
Type=simple
User=bcjamal
Environment=NODE_ENV=production
ExecStart=/bin/bash -lc "cd '/home/bcjamal/projects/personal dashboard' && npm run build && npm start"
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable personal-dashboard.service
sudo systemctl start personal-dashboard.service
```
