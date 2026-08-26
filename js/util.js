/* ============================================================
   util.js — formatting, toasts, small shared helpers
   ============================================================ */

const VAT_RATES = [
  {value:19, label:'19% (Regelsteuersatz)'},
  {value:7,  label:'7% (ermäßigt)'},
  {value:0,  label:'0% (steuerfrei / Kleinunternehmer §19 UStG)'},
];

const INCOME_CATEGORIES = ['Dienstleistung','Warenverkauf','Lizenzen','Zinsen','Sonstige Betriebseinnahme'];
const EXPENSE_CATEGORIES = [
  'Wareneinsatz','Bürobedarf','Software/IT','Miete Arbeitsraum','Telefon/Internet',
  'Reisekosten','Bewirtung','Fortbildung','Versicherungen','Werbung/Marketing',
  'Fahrzeugkosten','Abschreibung (AfA)','Beratung/Buchhaltung','Bankgebühren','Sonstige Betriebsausgabe'
];

function fmtMoney(cents_or_number){
  // we store amounts as plain Euro numbers (float) for simplicity of a personal-use app
  const n = Number(cents_or_number || 0);
  return n.toLocaleString('de-DE', {minimumFractionDigits:2, maximumFractionDigits:2}) + ' €';
}

function fmtDate(iso){
  if(!iso) return '—';
  const d = new Date(iso);
  if(isNaN(d)) return iso;
  return d.toLocaleDateString('de-DE');
}

function todayISO(){
  return new Date().toISOString().slice(0,10);
}

function addDays(dateStr, days){
  const d = new Date(dateStr);
  d.setDate(d.getDate()+days);
  return d.toISOString().slice(0,10);
}

function monthKey(dateStr){
  return (dateStr||todayISO()).slice(0,7); // YYYY-MM
}

function yearOf(dateStr){
  return Number((dateStr||todayISO()).slice(0,4));
}

function round2(n){
  return Math.round((Number(n)+Number.EPSILON)*100)/100;
}

function calcFromNet(net, vatRate){
  net = Number(net)||0;
  const vat = round2(net * (Number(vatRate)||0) / 100);
  return {net: round2(net), vat, gross: round2(net+vat)};
}

function calcFromGross(gross, vatRate){
  gross = Number(gross)||0;
  const rate = Number(vatRate)||0;
  const net = round2(gross / (1+rate/100));
  const vat = round2(gross-net);
  return {net, vat, gross: round2(gross)};
}

function toast(msg, type=''){
  const root = document.getElementById('toastRoot');
  const el = document.createElement('div');
  el.className = 'toast' + (type?' '+type:'');
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(()=>{ el.remove(); }, 3200);
}

function el(html){
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function escapeHtml(s){
  return String(s??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function downloadBlob(filename, content, mime){
  const blob = new Blob([content], {type:mime});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 4000);
}

function csvEscape(v){
  const s = String(v??'');
  if(/[;"\n]/.test(s)) return '"'+s.replace(/"/g,'""')+'"';
  return s;
}

/* ---- tiny modal system used by every module ---- */
function openModal(titleHtml, bodyHtml, footHtml){
  const root = document.getElementById('modalRoot');
  root.innerHTML = '';
  const overlay = el(`<div class="modal-overlay">
    <div class="modal">
      <div class="modal-head"><h3>${titleHtml}</h3><button class="modal-close" id="mClose">✕</button></div>
      <div class="modal-body" id="mBody">${bodyHtml}</div>
      <div class="modal-foot" id="mFoot">${footHtml||''}</div>
    </div>
  </div>`);
  root.appendChild(overlay);
  overlay.addEventListener('click', (e)=>{ if(e.target===overlay) closeModal(); });
  document.getElementById('mClose').addEventListener('click', closeModal);
  return overlay;
}
function closeModal(){
  document.getElementById('modalRoot').innerHTML = '';
}
