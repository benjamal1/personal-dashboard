# Personal Dashboard

A minimal, always-on Next.js browser start page with a dark full-screen aesthetic. Features a live clock, local weather (no API key required), a weekly todo tracker, and a Claudex usage panel for tracking Claude + Codex token limits and spend.

> **Note:** This repo is currently tailored to one person's setup (quick links, weather location, monogram, Claudex binary path). It will be generalized for broader use in the future. In the meantime, see the [Personalizing for your system](#personalizing-for-your-system) section below — it covers everything a friend or an LLM like Claude Code can adapt to your machine in a few minutes.

## Stack

- Next.js 14, TypeScript, Tailwind CSS
- No external database — todos persist to `data/todos.json`
- Weather via [open-meteo](https://open-meteo.com/) (free, no API key)
- Claudex usage via the `codexbar` CLI (optional)

## Install dependencies

```bash
npm install
```

## Run locally

Development server (hot reload):

```bash
npm run dev
```

Production build and server:

```bash
npm run build
npm start
```

The app serves on `http://localhost:3000`.

## Environment variables

Create a `.env.local` file at the project root to override defaults:

```env
# Weather — defaults to Cleveland, OH if unset
NEXT_PUBLIC_WEATHER_CITY=Providence
NEXT_PUBLIC_WEATHER_LATITUDE=41.8240
NEXT_PUBLIC_WEATHER_LONGITUDE=-71.4128

# Claudex usage binary — defaults to $HOME/.local/bin/codexbar if unset
CODEXBAR_PATH=/home/youruser/.local/bin/codexbar
```

## systemd service

Save this as `/etc/systemd/system/personal-dashboard.service` (replace `youruser` and the path):

```ini
[Unit]
Description=Personal Dashboard Next.js App
After=network.target

[Service]
Type=simple
User=youruser
Environment=NODE_ENV=production
ExecStart=/bin/bash -lc "cd '/home/youruser/projects/personal dashboard' && npm run build && npm start"
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable personal-dashboard.service
sudo systemctl start personal-dashboard.service
```

---

## Personalizing for your system

This dashboard is built to be used as a personal browser start page. Everything that identifies the original owner is listed below with the file and line where it lives. If you're using Claude Code, you can paste this section into the chat and ask it to adapt the repo for your setup.

### 1. Monogram (top-right home button)

**File:** `app/components/DashboardShell.tsx`  
Search for `"BJ"` and replace it with your own initials.

### 2. Quick links (sidebar)

**File:** `app/components/DashboardShell.tsx`  
Find the `QUICK_LINKS` array near the top. Replace the `href` values and `label` strings with your own bookmarks. The icons come from [lucide-react](https://lucide.dev/) — swap them freely.

### 3. Weather location

**File:** `lib/weather.ts` or `.env.local`  
The weather component uses [open-meteo](https://open-meteo.com/) — no API key needed. Set your city and coordinates either via environment variables (recommended) or by editing the defaults in `lib/weather.ts`:

```ts
export function getConfiguredWeatherLocation(): WeatherLocation {
  return {
    city: process.env.NEXT_PUBLIC_WEATHER_CITY || "Your City",
    latitude: Number(process.env.NEXT_PUBLIC_WEATHER_LATITUDE || YOUR_LAT),
    longitude: Number(process.env.NEXT_PUBLIC_WEATHER_LONGITUDE || YOUR_LON),
  };
}
```

Find coordinates at [latlong.net](https://www.latlong.net/).

### 4. Claudex usage binary path

**File:** `lib/usage.ts` or `.env.local`  
The usage panel calls the `codexbar` CLI to read token usage from Claude and Codex. Set `CODEXBAR_PATH` in `.env.local` to wherever `codexbar` lives on your machine, or it will fall back to `$HOME/.local/bin/codexbar`. If you don't use `codexbar`, the usage panel will show an error state and the rest of the dashboard works fine.

### 5. systemd service

In the service file template above, replace `youruser` and the path with your actual username and project location.

---

> **For LLMs (Claude Code, etc.):** If a user has cloned this repo and asked you to configure it for their system, work through the five items above in order. Ask the user for: their initials, which quick links they want, their city name and coordinates, and whether they have `codexbar` installed and where. Everything else (systemd path, username) you can infer from their environment. All changes are localized to the files listed — no build step is needed beyond `npm install`.
