/* ============================================================
   euer.js — Einnahmen-Überschuss-Rechnung
   Vereinfachte, kategorienbasierte Darstellung nach §4 Abs.3 EStG-
   Logik (Betriebseinnahmen ./. Betriebsausgaben = Gewinn).
   HINWEIS: Dies bildet NICHT die exakten amtlichen Kennzahlen/Zeilen
   der Finanzamt-Anlage EÜR ab (die Formularstruktur ändert sich
   jährlich). Nutze die Werte als Vorbereitung — die Übertragung in
   das offizielle Formular erfolgt manuell in Elster.
   ============================================================ */

const EUER = {
  async compute(year){
    const income = (await Income.list()).filter(i=> yearOf(i.date)===year);
    const expenses = (await Expenses.list()).filter(e=> yearOf(e.date)===year);

    const incomeByCat = {};
    let incomeNet=0, incomeVat=0;
    income.forEach(i=>{
      incomeByCat[i.category] = round2((incomeByCat[i.category]||0) + Number(i.net_amount||0));
      incomeNet += Number(i.net_amount||0);
      incomeVat += Number(i.vat_amount||0);
    });

    const expenseByCat = {};
    let expenseNet=0, expenseVat=0;
    expenses.forEach(e=>{
      expenseByCat[e.category] = round2((expenseByCat[e.category]||0) + Number(e.net_amount||0));
      expenseNet += Number(e.net_amount||0);
      expenseVat += Number(e.vat_amount||0);
    });

    incomeNet=round2(incomeNet); incomeVat=round2(incomeVat);
    expenseNet=round2(expenseNet); expenseVat=round2(expenseVat);
    const profit = round2(incomeNet - expenseNet);

    return {year, incomeByCat, expenseByCat, incomeNet, incomeVat, expenseNet, expenseVat, profit,
      incomeCount: income.length, expenseCount: expenses.length};
  },

  async render(container){
    const years = await this.availableYears();
    const selected = App.state.euerYear || years[0] || yearOf(todayISO());
    App.state.euerYear = selected;
    const r = await this.compute(selected);

    container.innerHTML = `
      <div class="disclaimer-box"><strong>Hinweis:</strong> Diese Berechnung dient der Vorbereitung deiner Steuererklärung und ersetzt keine steuerliche Beratung. Prüfe alle Werte, bevor du sie in Elster oder deine Anlage EÜR überträgst.</div>

      <div class="toolbar">
        <select id="euerYearSelect" class="select">${years.map(y=>`<option value="${y}" ${y==selected?'selected':''}>${y}</option>`).join('')}</select>
        <div class="spacer"></div>
        <button class="btn btn-secondary" id="euerCsv">CSV exportieren</button>
        <button class="btn btn-primary" id="euerPdf">PDF exportieren</button>
      </div>

      <div class="grid grid-4" style="margin-top:16px;">
        <div class="card"><div class="kpi-label">Betriebseinnahmen (netto)</div><div class="kpi-value">${fmtMoney(r.incomeNet)}</div><div class="kpi-sub">${r.incomeCount} Buchungen</div></div>
        <div class="card"><div class="kpi-label">Betriebsausgaben (netto)</div><div class="kpi-value">${fmtMoney(r.expenseNet)}</div><div class="kpi-sub">${r.expenseCount} Buchungen</div></div>
        <div class="card"><div class="kpi-label">Gewinn / Verlust</div><div class="kpi-value ${r.profit>=0?'pos':'neg'}">${fmtMoney(r.profit)}</div><div class="kpi-sub">Einnahmen ./. Ausgaben</div></div>
        <div class="card"><div class="kpi-label">Saldo Umsatzsteuer</div><div class="kpi-value">${fmtMoney(round2(r.incomeVat-r.expenseVat))}</div><div class="kpi-sub">vereinnahmte USt ./. Vorsteuer</div></div>
      </div>

      <div class="section-head"><h3>Betriebseinnahmen nach Kategorie</h3></div>
      <table>
        <thead><tr><th>Kategorie</th><th class="num">Netto</th></tr></thead>
        <tbody>
          ${Object.keys(r.incomeByCat).length? Object.entries(r.incomeByCat).map(([c,v])=>`<tr><td>${escapeHtml(c)}</td><td class="num">${fmtMoney(v)}</td></tr>`).join('') : `<tr class="empty-row"><td colspan="2">Keine Einnahmen in ${selected}.</td></tr>`}
          <tr class="ledger-total"><td>Summe</td><td class="num">${fmtMoney(r.incomeNet)}</td></tr>
        </tbody>
      </table>

      <div class="section-head"><h3>Betriebsausgaben nach Kategorie</h3></div>
      <table>
        <thead><tr><th>Kategorie</th><th class="num">Netto</th></tr></thead>
        <tbody>
          ${Object.keys(r.expenseByCat).length? Object.entries(r.expenseByCat).map(([c,v])=>`<tr><td>${escapeHtml(c)}</td><td class="num">${fmtMoney(v)}</td></tr>`).join('') : `<tr class="empty-row"><td colspan="2">Keine Ausgaben in ${selected}.</td></tr>`}
          <tr class="ledger-total"><td>Summe</td><td class="num">${fmtMoney(r.expenseNet)}</td></tr>
        </tbody>
      </table>
    `;

    document.getElementById('euerYearSelect').addEventListener('change', (e)=>{
      App.state.euerYear = Number(e.target.value);
      this.render(container);
    });
    document.getElementById('euerCsv').addEventListener('click', ()=>ExportFiles.euerCsv(r));
    document.getElementById('euerPdf').addEventListener('click', ()=>ExportFiles.euerPdf(r));
  },

  async availableYears(){
    const income = await Income.list();
    const expenses = await Expenses.list();
    const years = new Set([...income.map(i=>yearOf(i.date)), ...expenses.map(e=>yearOf(e.date)), yearOf(todayISO())]);
    return [...years].sort((a,b)=>b-a);
  }
};
