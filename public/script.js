const $ = (s) => document.querySelector(s);
const toastEl = $('#toast');
let toastTimer;
function toast(message){ clearTimeout(toastTimer); toastEl.textContent=message; toastEl.classList.add('show'); toastTimer=setTimeout(()=>toastEl.classList.remove('show'),2600); }
function scrollToId(id){ document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'center'}); }

// ---------------------------------------------------------------------------
// LIVE PRICES — Deriv public WebSocket feed (no login required for ticks)
// ---------------------------------------------------------------------------
const SYMBOLS = ['R_75', 'BOOM500', 'CRASH500'];
const priceState = {}; // { R_75: { last, open, history: [] } }
SYMBOLS.forEach(s => priceState[s] = { last: null, open: null, history: [] });

let derivSocket = null;
let reconnectTimer = null;

function connectDeriv(){
  try {
    derivSocket = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=1089');
  } catch (e) {
    setFeedStatus(false);
    scheduleReconnect();
    return;
  }

  derivSocket.onopen = () => {
    setFeedStatus(true);
    SYMBOLS.forEach(symbol => {
      derivSocket.send(JSON.stringify({ ticks: symbol, subscribe: 1 }));
    });
  };

  derivSocket.onmessage = (event) => {
    let data;
    try { data = JSON.parse(event.data); } catch (e) { return; }
    if (data.msg_type === 'tick' && data.tick) {
      handleTick(data.tick.symbol, Number(data.tick.quote));
    }
    if (data.error) {
      console.error('Deriv API error:', data.error.message);
    }
  };

  derivSocket.onclose = () => {
    setFeedStatus(false);
    scheduleReconnect();
  };

  derivSocket.onerror = () => {
    derivSocket.close();
  };
}

function scheduleReconnect(){
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connectDeriv, 4000);
}

function setFeedStatus(live){
  const statusEl = $('#feedStatus');
  const pulseEl = $('#feedPulse');
  if (!statusEl) return;
  statusEl.textContent = live ? 'LIVE MARKET FEED' : 'RECONNECTING…';
  pulseEl.style.background = live ? '#1ee5a6' : '#b56e3d';
  pulseEl.style.boxShadow = live ? '0 0 12px #1ee5a6' : '0 0 12px #b56e3d';
}

function handleTick(symbol, quote){
  const state = priceState[symbol];
  if (!state || !Number.isFinite(quote)) return;
  if (state.open === null) state.open = quote;
  state.last = quote;
  state.history.push(quote);
  if (state.history.length > 60) state.history.shift();

  const priceEl = $('#price-' + symbol);
  const changeEl = $('#change-' + symbol);
  if (priceEl) priceEl.textContent = quote.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (changeEl) {
    const pct = ((quote - state.open) / state.open) * 100;
    const sign = pct >= 0 ? '+' : '';
    changeEl.textContent = `${sign}${pct.toFixed(2)}%`;
    changeEl.style.color = pct >= 0 ? '#c7a33a' : '#b56e3d';
  }

  if (activeBot.running && activeBot.strategy && activeBot.strategy.symbol === symbol) {
    activeBot.lastTickBySymbol[symbol] = quote;
  }
}

connectDeriv();

// ---------------------------------------------------------------------------
// AI ANALYSIS — calls the server, which calls the real Anthropic API
// ---------------------------------------------------------------------------
async function runAnalysis(){
  const btn = $('#analyzeBtn');
  const summaryEl = $('#aiSummary');
  if (btn) { btn.disabled = true; btn.textContent = 'Analyzing…'; }
  if (summaryEl) summaryEl.textContent = 'Reading live ticks and generating a readout…';

  const markets = {};
  SYMBOLS.forEach(s => { markets[s] = priceState[s].history.slice(-20); });

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markets })
    });
    const data = await res.json();

    if (!res.ok) {
      toast(data.error || 'Analysis failed.');
      if (summaryEl) summaryEl.textContent = 'Analysis failed — try again in a moment.';
      return;
    }

    if (data.fallback) {
      toast('AI Analysis needs setup — see README (ANTHROPIC_API_KEY).');
      if (summaryEl) summaryEl.textContent = data.summary;
      return;
    }

    $('#scanScore').innerHTML = `${data.score}<span>%</span>`;
    $('#scanMeter').style.width = `${data.score}%`;
    $('#scanMomentum').textContent = data.momentum;
    $('#scanTrend').textContent = data.trend;
    $('#scanRisk').textContent = data.risk;
    $('#scanSubtitle').textContent = 'Live AI readout across tracked markets.';
    if (summaryEl) summaryEl.textContent = data.summary;
    toast(`AI Analysis: ${data.trend} · momentum ${data.momentum} · risk ${data.risk}`);
  } catch (err) {
    toast('Could not reach the analysis service.');
    if (summaryEl) summaryEl.textContent = 'Could not reach the analysis service.';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Analyze market'; }
  }
}

// ---------------------------------------------------------------------------
// STRATEGY BUILDER — saved via the server session, used by the demo bot
// ---------------------------------------------------------------------------
let strategies = [];
const activeBot = { running: false, strategy: null, lastTickBySymbol: {}, timer: null, startBalance: 0 };

function openStrategyModal(){
  $('#strategyModal').classList.add('show');
  loadStrategies();
}
function closeStrategyModal(){
  $('#strategyModal').classList.remove('show');
}

async function loadStrategies(){
  try {
    const res = await fetch('/api/strategies');
    const data = await res.json();
    strategies = data.strategies || [];
    renderStrategies();
  } catch (e) {
    toast('Could not load saved strategies.');
  }
}

function renderStrategies(){
  const list = $('#strategyList');
  if (!strategies.length) {
    list.innerHTML = '<span class="empty">No strategies saved yet.</span>';
    return;
  }
  list.innerHTML = strategies.map(s => `
    <div class="strategy-item">
      <span><b>${labelSymbol(s.symbol)}</b> · ${s.direction} · $${s.stake} stake · TP ${s.takeProfit}% / SL ${s.stopLoss}%</span>
      <span style="display:flex;gap:6px">
        <button class="use-btn" onclick="setActiveStrategy('${s.id}')">Use</button>
        <button class="del-btn" onclick="deleteStrategy('${s.id}')">✕</button>
      </span>
    </div>`).join('');
}

function labelSymbol(sym){
  return { R_75: 'Volatility 75', BOOM500: 'Boom 500', CRASH500: 'Crash 500' }[sym] || sym;
}

$('#strategyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    symbol: $('#stSymbol').value,
    direction: $('#stDirection').value,
    stake: Number($('#stStake').value),
    takeProfit: Number($('#stTakeProfit').value),
    stopLoss: Number($('#stStopLoss').value)
  };
  try {
    const res = await fetch('/api/strategies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) { toast(data.error || 'Could not save strategy.'); return; }
    strategies.push(data.strategy);
    renderStrategies();
    setActiveStrategy(data.strategy.id);
    toast('Strategy saved and set active.');
  } catch (err) {
    toast('Could not save strategy.');
  }
});

async function deleteStrategy(id){
  try {
    await fetch('/api/strategies/' + id, { method: 'DELETE' });
    strategies = strategies.filter(s => s.id !== id);
    if (activeBot.strategy && activeBot.strategy.id === id) {
      activeBot.strategy = null;
      $('#activeStrategyLabel').textContent = 'None — build one to run the bot';
    }
    renderStrategies();
  } catch (e) {
    toast('Could not delete strategy.');
  }
}

function setActiveStrategy(id){
  const s = strategies.find(x => x.id === id);
  if (!s) return;
  activeBot.strategy = s;
  $('#activeStrategyLabel').textContent = `${labelSymbol(s.symbol)} · ${s.direction} · $${s.stake} stake`;
  closeStrategyModal();
}

// ---------------------------------------------------------------------------
// DEMO BOT — simulates fills off real price direction, no real trades
// ---------------------------------------------------------------------------
let running = false;
function toggleBot(){
  if (!running) {
    if (!activeBot.strategy) {
      toast('Build and select a strategy first.');
      openStrategyModal();
      return;
    }
    startBot();
  } else {
    stopBot('Demo bot stopped.');
  }
}

function startBot(){
  running = true;
  activeBot.running = true;
  activeBot.startBalance = getBalance();
  $('#runIcon').textContent = '■';
  $('#runText').textContent = 'Stop Demo Bot';
  $('#botStatus').textContent = 'RUNNING';
  toast('Demo bot started. No real trades are executed.');
  scheduleNextTrade();
}

function stopBot(message){
  running = false;
  activeBot.running = false;
  clearTimeout(activeBot.timer);
  $('#runIcon').textContent = '▶';
  $('#runText').textContent = 'Run Demo Bot';
  $('#botStatus').textContent = 'READY';
  if (message) toast(message);
}

function scheduleNextTrade(){
  const speed = Number($('#speedRange').value);
  const intervalMs = { 1: 6000, 2: 3500, 3: 1800 }[speed] || 3500;
  activeBot.timer = setTimeout(executeSimulatedTrade, intervalMs);
}

function executeSimulatedTrade(){
  if (!running || !activeBot.strategy) return;
  const s = activeBot.strategy;
  const state = priceState[s.symbol];
  const hist = state.history;

  if (hist.length < 2) {
    // not enough live data yet, wait and retry
    scheduleNextTrade();
    return;
  }

  const prev = hist[hist.length - 2];
  const curr = hist[hist.length - 1];
  const movedUp = curr > prev;
  const predictedUp = s.direction === 'RISE';
  const win = movedUp === predictedUp;

  const payoutRate = 0.85; // demo payout assumption for a rise/fall style contract
  const pnl = win ? +(s.stake * payoutRate).toFixed(2) : -s.stake;
  adjustBalance(pnl);
  logTrade(s, win, pnl, curr);

  const balance = getBalance();
  const changePct = ((balance - activeBot.startBalance) / activeBot.startBalance) * 100;
  if (s.takeProfit > 0 && changePct >= s.takeProfit) {
    stopBot(`Take-profit hit (+${changePct.toFixed(1)}%). Bot stopped.`);
    return;
  }
  if (s.stopLoss > 0 && changePct <= -s.stopLoss) {
    stopBot(`Stop-loss hit (${changePct.toFixed(1)}%). Bot stopped.`);
    return;
  }
  if (balance <= 0) {
    stopBot('Demo balance depleted. Bot stopped.');
    return;
  }

  scheduleNextTrade();
}

function getBalance(){
  return Number($('#balance').textContent.replace(/,/g, '')) || 0;
}
function adjustBalance(delta){
  const next = Math.max(0, getBalance() + delta);
  $('#balance').textContent = next.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function logTrade(strategy, win, pnl, price){
  const log = $('#tradeLog');
  const empty = log.querySelector('.empty');
  if (empty) empty.remove();
  const row = document.createElement('div');
  row.className = 'trade-row ' + (win ? 'win' : 'loss');
  const time = new Date().toLocaleTimeString();
  row.innerHTML = `<span>${time} · ${labelSymbol(strategy.symbol)} · ${strategy.direction} @ ${price.toFixed(2)}</span><span>${win ? 'WIN' : 'LOSS'} ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}</span>`;
  log.appendChild(row);
  while (log.children.length > 25) log.removeChild(log.firstChild);
  log.scrollTop = log.scrollHeight;
}

$('#speedRange').addEventListener('input', e => {
  const labels = { 1: 'SAFE SPEED', 2: 'NORMAL SPEED', 3: 'FAST SPEED' };
  $('#speedValue').textContent = labels[e.target.value];
});

// Close modal on overlay click (not on inner modal click)
$('#strategyModal').addEventListener('click', (e) => {
  if (e.target.id === 'strategyModal') closeStrategyModal();
});

loadStrategies();
fetch('/api/health').catch(() => {});
