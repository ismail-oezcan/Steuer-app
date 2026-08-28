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
   <div class="disclaimer-box"><strong>Hinweis:</strong> Diese Berechnung dient der Vorbereitung deiner Steuererklaerung und ersetzt keine steuerliche Beratung. Pruefe alle Werte, bevor du sie in Elster oder deine Anlage EUER uebertraegst.</div>

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
   <thead><tr><th>Kategorie</th><th>Anlage EUER ${EUER_FORM_YEAR}</th><th class="num">Netto</th></tr></thead>
   <tbody>
   ${Object.keys(r.incomeByCat).length? Object.entries(r.incomeByCat).map(([c,v])=>{
      const m = EUER_INCOME_MAP[c];
      return `<tr><td>${escapeHtml(c)}</td><td>${m?`<span class="mono">Zeile ${m.line} Kz ${m.kz}</span>`:'-'}</td><td class="num">${fmtMoney(v)}</td></tr>`;
   }).join('') : `<tr class="empty-row"><td colspan="3">Keine Einnahmen in ${selected}.</td></tr>`}
   <tr class="ledger-total"><td>Summe</td><td></td><td class="num">${fmtMoney(r.incomeNet)}</td></tr>
   </tbody>
   </table>

   <div class="section-head"><h3>Betriebsausgaben nach Kategorie</h3></div>
   <table>
   <thead><tr><th>Kategorie</th><th>Anlage EUER ${EUER_FORM_YEAR}</th><th class="num">Netto</th></tr></thead>
   <tbody>
   ${Object.keys(r.expenseByCat).length? Object.entries(r.expenseByCat).map(([c,v])=>{
      const m = EUER_EXPENSE_MAP[c];
      return `<tr><td>${escapeHtml(c)}</td><td>${m?`<span class="mono">Zeile ${m.line} Kz ${m.kz}</span>`:'-'}</td><td class="num">${fmtMoney(v)}</td></tr>`;
   }).join('') : `<tr class="empty-row"><td colspan="3">Keine Ausgaben in ${selected}.</td></tr>`}
   <tr class="ledger-total"><td>Summe</td><td></td><td class="num">${fmtMoney(r.expenseNet)}</td></tr>
   </tbody>
   </table>

   <div class="section-head"><h3>Elster-Uebertragstabelle (Kennziffern, Anlage EUER ${EUER_FORM_YEAR})</h3></div>
   <div class="card">
   <p class="field-hint" style="margin-top:0;">Fertig zusammengefasst nach amtlicher Kennziffer, so wie sie in Mein ELSTER einzutragen sind. Kategorien mit derselben Kennziffer werden hier automatisch zusammengezaehlt (z.B. Bankgebuehren + Sonstige zu Kz 183).</p>
   ${this.renderKzTable(r)}
   <p class="field-hint">Quelle: BMF-Schreiben v. 29.08.2025 Anlage EUER 2025. Zeilennummern koennen sich in kuenftigen Formularjahren verschieben, die Kennziffer (Kz) ist der stabilere Anker. Vor der Abgabe gegen die aktuelle amtliche Anlage EUER pruefen, das ist keine Steuerberatung.</p>
   </div>
   `;

   document.getElementById('euerYearSelect').addEventListener('change', (e)=>{
      App.state.euerYear = Number(e.target.value);
      this.render(container);
   });
      document.getElementById('euerCsv').addEventListener('click', ()=>ExportFiles.euerCsv(r));
      document.getElementById('euerPdf').addEventListener('click', ()=>ExportFiles.euerPdf(r));
   },

   kzSummary(r){
      const byKz = {};
      Object.entries(r.incomeByCat).forEach(([cat,v])=>{
         const m = EUER_INCOME_MAP[cat]; if(!m) return;
         const key = 'in:'+m.kz;
         byKz[key] = byKz[key] || {kz:m.kz, line:m.line, kind:'Einnahme', sum:0, categories:[]};
         byKz[key].sum = round2(byKz[key].sum + v);
         byKz[key].categories.push(cat);
      });
      Object.entries(r.expenseByCat).forEach(([cat,v])=>{
         const m = EUER_EXPENSE_MAP[cat]; if(!m) return;
         const key = 'ex:'+m.kz;
         byKz[key] = byKz[key] || {kz:m.kz, line:m.line, kind:'Ausgabe', sum:0, categories:[]};
         byKz[key].sum = round2(byKz[key].sum + v);
         byKz[key].categories.push(cat);
      });
      return Object.values(byKz).sort((a,b)=> a.kind===b.kind ? a.line-b.line : (a.kind==='Einnahme'?-1:1));
   },

   renderKzTable(r){
      const rows = this.kzSummary(r);
      if(!rows.length) return `<p class="field-hint">Noch keine zuordenbaren Buchungen in ${r.year}.</p>`;
      return `<table>
      <thead><tr><th>Kz</th><th>Zeile</th><th>Typ</th><th>Enthaelt</th><th class="num">Netto</th></tr></thead>
      <tbody>
      ${rows.map(row=>`<tr>
      <td class="mono">${row.kz}</td>
      <td class="mono">${row.line}</td>
      <td>${row.kind}</td>
      <td>${row.categories.map(escapeHtml).join(', ')}</td>
      <td class="num">${fmtMoney(row.sum)}</td>
      </tr>`).join('')}
      </tbody>
      </table>`;
   },

   async availableYears(){
      const income = await Income.list();
      const expenses = await Expenses.list();
      const years = new Set([...income.map(i=>yearOf(i.date)), ...expenses.map(e=>yearOf(e.date)), yearOf(todayISO())]);
      return [...years].sort((a,b)=>b-a);
   }
};
