OGILA TRADERS — Professional Dashboard
A trading-dashboard demo terminal with real live market prices, real AI market analysis, and a working strategy/bot builder that simulates trades against live price movement on a demo balance. No real money or real Deriv account is connected yet.
What's actually live now
Prices — Volatility 75, Boom 500 and Crash 500 stream live from Deriv's public WebSocket feed (`wss://ws.derivws.com`, no login required for ticks). % change is relative to the price when the page connected.
AI Analysis — clicking "Analyze market" or the AI orb sends the last ~20 live ticks per market to your server, which calls the real Anthropic API and returns a structured trend/momentum/risk readout. Requires `ANTHROPIC\_API\_KEY` (see below) — without it, the button still works but tells you it's not configured.
Strategy Builder — build a rule (market, direction, stake, take-profit %, stop-loss %) and save it. Saved strategies persist for your browser session (server-side, not shared between users).
Run Demo Bot — runs your active strategy against real live price direction. Each "trade" checks whether the live price actually moved the way your strategy predicted; wins pay out 0.85x stake, losses cost the full stake, against your demo balance. Stops automatically at your take-profit/stop-loss % or if balance hits zero.
Still demo-only / not yet built
No real Deriv account connection (OAuth), no real order placement, no real money. Everything above uses Deriv's public price feed only plus a simulated demo balance.
Strategies are stored server-side per session (in memory) — they reset if the server restarts. Fine for a demo; swap for a database before real users depend on it.
Deploy on Render
Runtime: Node
Branch: main
Build Command: `npm install`
Start Command: `npm start`
Plan: Free for testing
Environment variables
Variable	Required for	Notes
`ANTHROPIC\_API\_KEY`	Real AI Analysis	Get one at console.anthropic.com. Without it, AI Analysis shows a "not configured" message instead of failing.
`SESSION\_SECRET`	Session security	Any random string. Falls back to an insecure default if unset — set this in production.
`DERIV\_CLIENT\_ID`	Future: real Deriv OAuth login	Not used yet — live prices work without it since they use Deriv's public feed.
`DERIV\_REDIRECT\_URI`	Future: real Deriv OAuth login	Not used yet.
Set these under your Render service → Environment.
Next steps if you want real trading
Connecting a real Deriv account for actual trade execution needs OAuth login (`DERIV\_CLIENT\_ID`/`DERIV\_REDIRECT\_URI`), secure token storage, and careful UI warnings before any real-money action — that's a separate, bigger step from what's built here.
