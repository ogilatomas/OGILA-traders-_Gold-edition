const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'ogila-demo-session-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: process.env.NODE_ENV === 'production', httpOnly: true, sameSite: 'lax' }
}));

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'OGILA TRADERS', mode: 'demo' }));
app.get('/api/config', (req, res) => res.json({
  derivConfigured: Boolean(process.env.DERIV_CLIENT_ID),
  aiConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
  mode: 'demo'
}));

// --- AI Analysis -----------------------------------------------------------
// Takes recent price ticks for the visible markets and asks Claude for a
// short structured trend/momentum/risk readout. Requires ANTHROPIC_API_KEY
// to be set in the environment (Render dashboard -> Environment).
const analyzeLimiter = { lastCall: 0 };

app.post('/api/analyze', async (req, res) => {
  const now = Date.now();
  if (now - analyzeLimiter.lastCall < 4000) {
    return res.status(429).json({ error: 'Please wait a few seconds between analyses.' });
  }
  analyzeLimiter.lastCall = now;

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({
      fallback: true,
      trend: 'UNAVAILABLE',
      momentum: 'N/A',
      risk: 'N/A',
      summary: 'AI Analysis is not connected yet. Set ANTHROPIC_API_KEY in your Render environment variables to enable live analysis.'
    });
  }

  const { markets } = req.body || {};
  if (!markets || typeof markets !== 'object') {
    return res.status(400).json({ error: 'Missing market data.' });
  }

  try {
    const prompt = `You are a market-structure analyst for a DEMO trading dashboard (no real trades, synthetic indices only).
Given this recent tick data (JSON, most recent price last), respond with ONLY a JSON object, no prose, no markdown fences, in this exact shape:
{"trend":"UPTREND|DOWNTREND|RANGE","momentum":"Weak|Moderate|Strong","risk":"Low|Medium|High","score":<0-100 integer>,"summary":"<one or two plain sentences, no financial advice, demo context>"}

Tick data:
${JSON.stringify(markets)}`;

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      console.error('Anthropic API error:', apiRes.status, errText);
      return res.status(502).json({ error: 'AI analysis service returned an error.' });
    }

    const data = await apiRes.json();
    const raw = (data.content || []).map(b => b.text || '').join('').trim();
    const cleaned = raw.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse AI response as JSON:', raw);
      return res.status(502).json({ error: 'AI analysis returned an unexpected format.' });
    }

    res.json({ fallback: false, ...parsed });
  } catch (err) {
    console.error('Analyze error:', err);
    res.status(500).json({ error: 'Analysis failed. Please try again.' });
  }
});

// --- Strategies (demo, per-session) ----------------------------------------
// Lightweight persistence so a saved bot strategy survives a page refresh
// within the same browser session. Not shared between users/devices.
app.get('/api/strategies', (req, res) => {
  res.json({ strategies: req.session.strategies || [] });
});

app.post('/api/strategies', (req, res) => {
  const s = req.body;
  if (!s || !s.symbol || !s.direction || !s.stake) {
    return res.status(400).json({ error: 'Strategy needs symbol, direction and stake.' });
  }
  if (!req.session.strategies) req.session.strategies = [];
  const strategy = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    symbol: String(s.symbol).slice(0, 40),
    direction: s.direction === 'FALL' ? 'FALL' : 'RISE',
    stake: Math.max(1, Math.min(1000, Number(s.stake) || 10)),
    takeProfit: Math.max(0, Math.min(100, Number(s.takeProfit) || 0)),
    stopLoss: Math.max(0, Math.min(100, Number(s.stopLoss) || 0)),
    createdAt: new Date().toISOString()
  };
  req.session.strategies.push(strategy);
  res.json({ strategy });
});

app.delete('/api/strategies/:id', (req, res) => {
  if (!req.session.strategies) req.session.strategies = [];
  req.session.strategies = req.session.strategies.filter(s => s.id !== req.params.id);
  res.json({ ok: true });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`OGILA TRADERS running on port ${PORT}`);
});
