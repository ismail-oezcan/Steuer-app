/* ============================================================
   app.js — router, dashboard, bootstrap
   ============================================================ */

const VIEW_TITLES = {
  dashboard:'Übersicht', rechnungen:'Rechnungen', kunden:'Kunden',
  einnahmen:'Einnahmen', ausgaben:'Ausgaben', euer:'EÜR',
  ustva:'Umsatzsteuer-Voranmeldung', fristen:'Fristen', einstellungen:'Einstellungen'
};

const App = {
  state: { view:'dashboard' },

  async go(view){
    this.state.view = view;
    document.querySelectorAll('.nav-item').forEach(b=> b.classList.toggle('active', b.dataset.view===view));
    document.getElementById('viewTitle').textContent = VIEW_TITLES[view] || view;
    await this.renderView();
  },

  async renderView(){
    const container = document.getElementById('viewBody');
    const view = this.state.view;
    document.getElementById('periodBadge').textContent = new Date().toLocaleDateString('de-DE', {year:'numeric', month:'long'});
    switch(view){
      case 'dashboard': return this.renderDashboard(container);
      case 'rechnungen': return Invoices.render(container);
      case 'kunden': return Customers.render(container);
      case 'einnahmen': return Income.render(container);
      case 'ausgaben': return Expenses.render(container);
      case 'euer': return EUER.render(container);
      case 'ustva': return USTVA.render(container);
      case 'fristen': return Reminders.render(container);
      case 'einstellungen': return Settings.render(container);
    }
  },

  async renderDashboard(container){
    const invoices = await Invoices.list();
    const income = await Income.list();
    const expenses = await Expenses.list();
    const settings = await Settings.get();

    const open = invoices.filter(i=> Invoices.statusOf(i)==='offen');
    const overdue = invoices.filter(i=> Invoices.statusOf(i)==='überfällig');
    const openSum = [...open, ...overdue].reduce((s,i)=>s+Number(i.gross_amount||0),0);

    const thisMonth = monthKey(todayISO());
    const monthIncome = income.filter(i=>monthKey(i.date)===thisMonth).reduce((s,i)=>s+Number(i.gross_amount||0),0);
    const monthExpense = expenses.filter(e=>monthKey(e.date)===thisMonth).reduce((s,e)=>s+Number(e.gross_amount||0),0);

    const year = yearOf(todayISO());
    const euer = await EUER.compute(year);
    const reminders = (await Reminders.upcoming()).slice(0,3);

    const recent = [
      ...invoices.map(i=>({date:i.date, label:`Rechnung ${i.invoice_number}`, amount:i.gross_amount, kind:'Rechnung'})),
      ...expenses.map(e=>({date:e.date, label:e.vendor||e.description||'Ausgabe', amount:-e.gross_amount, kind:'Ausgabe'})),
    ].sort((a,b)=> (b.date||'').localeCompare(a.date||'')).slice(0,6);

    container.innerHTML = `
      ${!settings.companyName ? `<div class="disclaimer-box"><strong>Erste Schritte:</strong> Hinterlege deine Firmendaten in den <a href="#" id="goSettings" style="color:inherit;text-decoration:underline;">Einstellungen</a>, bevor du Rechnungen als PDF exportierst.</div>` : ''}

      <div class="grid grid-4">
        <div class="card"><div class="kpi-label">Offene Rechnungen</div><div class="kpi-value">${fmtMoney(openSum)}</div><div class="kpi-sub">${open.length+overdue.length} Rechnung(en), davon ${overdue.length} überfällig</div></div>
        <div class="card"><div class="kpi-label">Einnahmen (dieser Monat)</div><div class="kpi-value pos">${fmtMoney(monthIncome)}</div><div class="kpi-sub">brutto, Zahlungseingänge</div></div>
        <div class="card"><div class="kpi-label">Ausgaben (dieser Monat)</div><div class="kpi-value neg">${fmtMoney(monthExpense)}</div><div class="kpi-sub">brutto</div></div>
        <div class="card"><div class="kpi-label">Gewinn ${year} (YTD)</div><div class="kpi-value ${euer.profit>=0?'pos':'neg'}">${fmtMoney(euer.profit)}</div><div class="kpi-sub">Netto-Einnahmen ./. Netto-Ausgaben</div></div>
      </div>

      <div class="section-head"><h3>Anstehende Fristen</h3></div>
      ${reminders.length? reminders.map(it=>{
        const d = Reminders.daysUntil(it.due);
        return `<div class="reminder-item">
          <div class="reminder-count ${d<=10?'soon':'ok'}">${d}</div>
          <div class="reminder-body"><div class="reminder-title">${it.title}</div><div class="reminder-sub">${it.sub} · fällig ${fmtDate(it.due)}</div></div>
        </div>`;
      }).join('') : `<div class="card">Keine anstehenden Fristen.</div>`}

      <div class="section-head"><h3>Letzte Aktivität</h3></div>
      <table>
        <thead><tr><th>Datum</th><th>Typ</th><th>Beschreibung</th><th class="num">Betrag</th></tr></thead>
        <tbody>
          ${recent.length? recent.map(r=>`
            <tr><td>${fmtDate(r.date)}</td><td><span class="tag-cat">${r.kind}</span></td><td>${escapeHtml(r.label)}</td>
            <td class="num ${r.amount<0?'kpi-value neg':''}" style="font-size:13.5px;">${fmtMoney(r.amount)}</td></tr>
          `).join('') : `<tr class="empty-row"><td colspan="4">Noch keine Buchungen — lege deine erste Rechnung oder Ausgabe an.</td></tr>`}
        </tbody>
      </table>
    `;
    const gs = document.getElementById('goSettings');
    if(gs) gs.addEventListener('click', (e)=>{ e.preventDefault(); App.go('einstellungen'); });
  },

  async init(){
    document.querySelectorAll('.nav-item').forEach(btn=>{
      btn.addEventListener('click', ()=> this.go(btn.dataset.view));
    });
    document.getElementById('lockBtn').addEventListener('click', ()=> Security.lock());
    await this.go('dashboard');
  }
};

window.addEventListener('DOMContentLoaded', ()=>{
  initLockScreen(async ()=>{
    document.getElementById('lockScreen').classList.add('hidden');
    document.getElementById('appShell').classList.remove('hidden');
    await App.init();
  });
});
