# Wheel Strategy Command Center 🎯

A real-time options wheel strategy tracker with live market data, portfolio analytics, and sector allocation.

## Features
- **Live Market Prices** — auto-refreshes from Yahoo Finance every 2 minutes
- **Position Tracking** — CSPs and Covered Calls with P/L calculations
- **Market Clock** — shows market status + your 10:30 AM safe-to-trade rule
- **Summary Dashboard** — portfolio totals, sector allocation chart, tier breakdown
- **Persistent Storage** — positions saved in localStorage (survives refreshes)
- **Color-Coded** — status badges, tier indicators, DTE warnings

## Deploy to Vercel (3 steps)

### Option A: Via GitHub (recommended)
1. Push this folder to a new GitHub repo
2. Go to [vercel.com](https://vercel.com) → "Add New Project"
3. Import your GitHub repo → Vercel auto-detects React → Click Deploy

### Option B: Via Vercel CLI
```bash
npm install -g vercel
cd wheel-tracker-vercel
vercel
```

Follow the prompts. That's it — you'll get a live URL.

## Local Development
```bash
npm install
npm start
```
Opens at http://localhost:3000

## Note on Market Data
Yahoo Finance API may occasionally rate-limit. If prices show "—", click Refresh or wait a moment. Data auto-refreshes every 2 minutes during market hours.
