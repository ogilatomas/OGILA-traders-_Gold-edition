const markets = [
  {symbol:"R_100", name:"Volatility 100 Index", price:1842.73},
  {symbol:"R_50", name:"Volatility 50 Index", price:921.42},
  {symbol:"R_25", name:"Volatility 25 Index", price:436.18},
  {symbol:"R_75", name:"Volatility 75 Index", price:1275.61}
];

let selected = markets[0].symbol;
let series = {};
let botRunning = false, botTimer = null, trades = 0, balance = 1000, pnl = 0;
let history = JSON.parse(localStorage.getItem("ogilaHistory") || "[]");

function seedSeries() {
  markets.forEach(m => {
    let v = m.price;
    series[m.symbol] = Array.from({length:70}, () => {
      v += (Math.random() - .48) * m.price * .004;
      return v;
    });
  });
}
seedSeries();

const $ = id => document.getElementById(id);
const money = n => `${n >= 0 ? "+" : ""}$${Math.abs(n).toFixed(2)}`;

function renderMarkets() {
  $("marketGrid").innerHTML = markets.map(m => {
    const s = series[m.symbol], last=s.at(-1), prev=s.at(-2), pct=(last-prev)/prev*100;
    return `<div class="market" data-symbol="${m.symbol}">
      <b>${m.name}</b><div class="price">${last.toFixed(2)}</div>
      <small class="${pct>=0?"up":"down"}">${pct>=0?"▲":"▼"} ${Math.abs(pct).toFixed(2)}%</small>
    </div>`;
  }).join("");
  document.querySelectorAll(".market").forEach(x => x.onclick=()=>{selected=x.dataset.symbol;$("symbolSelect").value=selected;draw();});
}

function populateSelects() {
  ["symbolSelect","botSymbol"].forEach(id=>{
    $(id).innerHTML=markets.map(m=>`<option value="${m.symbol}">${m.name}</option>`).join("");
    $(id).value=selected;
  });
}

function indicators(data) {
  const gains=[], losses=[];
  for(let i=1;i<data.length;i++){const d=data[i]-data[i-1];gains.push(Math.max(d,0));losses.push(Math.max(-d,0));}
  const n=14, ag=gains.slice(-n).reduce((a,b)=>a+b,0)/n, al=losses.slice(-n).reduce((a,b)=>a+b,0)/n;
  const rsi=al===0?100:100-(100/(1+ag/al));
  const short=data.slice(-10).reduce((a,b)=>a+b,0)/10, long=data.slice(-30).reduce((a,b)=>a+b,0)/30;
  const trend=short>long?"UP":"DOWN";
  const momentum=((data.at(-1)-data.at(-6))/data.at(-6))*100;
  return {rsi,trend,momentum,volatility:Math.abs(momentum)*2+Math.random()*3};
}

function draw() {
  const m=markets.find(x=>x.symbol===selected), data=series[selected], c=$("chart"), ctx=c.getContext("2d");
  const w=c.width,h=c.height; ctx.clearRect(0,0,w,h);
  ctx.strokeStyle="#172537";ctx.lineWidth=1;
  for(let i=1;i<6;i++){let y=i*h/6;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
  const min=Math.min(...data),max=Math.max(...data), pad=30;
  ctx.beginPath();data.forEach((v,i)=>{let x=pad+i*(w-2*pad)/(data.length-1),y=h-pad-(v-min)/(max-min||1)*(h-2*pad);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle="#25d695";ctx.lineWidth=2;ctx.stroke();
  const ind=indicators(data);
  $("chartTitle").textContent=m.name;$("rsi").textContent=ind.rsi.toFixed(1);$("trend").textContent=ind.trend;$("momentum").textContent=ind.momentum.toFixed(2)+"%";$("volatility").textContent=ind.volatility.toFixed(2);
}

function analyze() {
  const ind=indicators(series[selected]); let signal="WAIT", reason="Conditions are mixed.";
  if(ind.trend==="UP" && ind.rsi<70 && ind.momentum>0){signal="UP";reason="Trend and momentum are positive."}
  else if(ind.trend==="DOWN" && ind.rsi>30 && ind.momentum<0){signal="DOWN";reason="Trend and momentum are negative."}
  $("signalBox").innerHTML=`<span>DEMO ANALYSIS</span><b>${signal}</b><small>${reason} RSI ${ind.rsi.toFixed(1)} • Trend ${ind.trend}</small>`;
  $("signalCount").textContent=Number($("signalCount").textContent)+1;
  return signal;
}

function renderHistory(){
  $("historyBody").innerHTML=history.length?history.slice().reverse().map(t=>`<tr><td>${t.time}</td><td>${t.market}</td><td class="${t.signal==="UP"?"up":"down"}">${t.signal}</td><td>$${t.stake}</td><td class="${t.result>=0?"up":"down"}">${money(t.result)}</td><td>DEMO</td></tr>`).join(""):`<tr><td colspan="6" class="empty">No demo trades yet.</td></tr>`;
  $("balance").textContent=`$${balance.toFixed(2)}`;$("pnl").textContent=money(pnl);
}

function demoTrade(){
  if(!botRunning || trades>=Number($("maxTrades").value)) return stopBot();
  const signal=analyze(), stake=Math.max(.35,Number($("stake").value)||1);
  if(signal==="WAIT") return;
  const win=Math.random()>.48, result=win?stake*.92:-stake;
  balance+=result;pnl+=result;trades++;
  history.push({time:new Date().toLocaleTimeString(),market:selected,signal,stake:stake.toFixed(2),result});
  localStorage.setItem("ogilaHistory",JSON.stringify(history.slice(-50)));renderHistory();
  if(pnl<=-Math.abs(Number($("stopLoss").value)) || pnl>=Math.abs(Number($("takeProfit").value))) stopBot();
}

function startBot(){
  if(botRunning)return; botRunning=true;trades=0;$("botLabel").textContent="RUNNING";$("botStatus").textContent="Demo bot running";$("botMessage").textContent="Automation is simulated locally."; $("botDot").style.background="var(--accent)";
  demoTrade();botTimer=setInterval(demoTrade,3000);
}
function stopBot(){botRunning=false;clearInterval(botTimer);$("botLabel").textContent="READY";$("botStatus").textContent="Bot stopped";$("botMessage").textContent="No automated trades are running."}

$("analyzeBtn").onclick=analyze;$("startBot").onclick=startBot;$("stopBot").onclick=stopBot;$("emergency").onclick=stopBot;
$("clearHistory").onclick=()=>{history=[];localStorage.removeItem("ogilaHistory");balance=1000;pnl=0;renderHistory()};
$("refreshMarkets").onclick=()=>{markets.forEach(m=>series[m.symbol].push(series[m.symbol].at(-1)+(Math.random()-.48)*m.price*.004));renderMarkets();draw()};
$("symbolSelect").onchange=e=>{selected=e.target.value;draw()};
$("botSymbol").onchange=e=>{selected=e.target.value;$("symbolSelect").value=selected;draw()};
$("menuBtn").onclick=()=>document.querySelector(".sidebar").classList.toggle("open");
$("loginBtn").onclick=()=>alert("Deriv OAuth is ready to be connected. Add your Deriv Client ID and HTTPS redirect URI on the server before enabling authentication.");

populateSelects();renderMarkets();renderHistory();draw();
setInterval(()=>{markets.forEach(m=>series[m.symbol].push(series[m.symbol].at(-1)+(Math.random()-.48)*m.price*.002));renderMarkets();draw()},4000);
