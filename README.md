# OGILA TRADERS

Professional demo trading-analysis dashboard designed for a future Deriv integration.

## Included
- Professional responsive dashboard
- Market cards and simulated live-style feed
- Chart and technical-style indicators
- Analysis engine (demo)
- Speed Bot (demo only)
- Risk controls
- Strategy builder UI
- Demo trade history
- Node/Express server
- Placeholder endpoint for Deriv OAuth configuration

## Run locally
1. Install Node.js.
2. Open a terminal in this folder.
3. Run:
   npm install
   npm start
4. Open http://localhost:3000

## Deriv integration
This starter does NOT store Deriv passwords and does not fake authentication.
Before enabling real authentication/trading, create a Deriv OAuth application and configure secure server-side credentials/environment variables. Do not commit client secrets or tokens to GitHub.

Suggested environment variables:
DERIV_CLIENT_ID=your_client_id
DERIV_REDIRECT_URI=https://your-domain.example/callback
SESSION_SECRET=long-random-secret

The UI currently keeps the bot in demo mode. A production Deriv connector should validate OAuth state/PKCE server-side, securely store sessions/tokens, subscribe to authorized WebSocket streams, and require explicit user confirmation before real-money actions.

## Safety
Market signals are informational/educational and do not guarantee profit. Test automation with a demo account and implement server-side risk limits before any live trading.
