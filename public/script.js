const $ = (s) => document.querySelector(s);
const toastEl = $('#toast');
let toastTimer;
function toast(message){ clearTimeout(toastTimer); toastEl.textContent=message; toastEl.classList.add('show'); toastTimer=setTimeout(()=>toastEl.classList.remove('show'),2600); }
function scrollToId(id){ document.getElementById(id)?.scrollIntoView({behavior:'smooth',block:'center'}); }
function runAnalysis(){
  const trend = ['UPTREND','RANGE','MOMENTUM UP'][Math.floor(Math.random()*3)];
  toast(`AI Demo Analysis: ${trend}. Check confirmation and risk before any real trade.`);
}
function openStrategy(){ scrollToId('strategy'); toast('Strategy Builder opened — demo configuration ready.'); }
let running=false;
function toggleBot(){
  running=!running;
  $('#runIcon').textContent=running?'■':'▶';
  $('#runText').textContent=running?'Stop Demo Bot':'Run Demo Bot';
  $('#botStatus').textContent=running?'RUNNING':'READY';
  if(running) toast('Demo bot started. No real trades are executed.');
  else toast('Demo bot stopped.');
}
$('#speedRange').addEventListener('input',e=>{
  const labels={1:'SAFE SPEED',2:'NORMAL SPEED',3:'FAST SPEED'};
  $('#speedValue').textContent=labels[e.target.value];
});
// Demo-only market movement for visual polish.
setInterval(()=>{
  const base=10000; const move=(Math.random()-.47)*45; $('#balance').textContent=(base+move).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
},3500);
fetch('/api/health').catch(()=>{});
