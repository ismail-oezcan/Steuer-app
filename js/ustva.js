const USTVA = {
   async periods(){
      const income = await Income.list();
      const invoices = await Invoices.list();
      const expenses = await Expenses.list();
      const keys = new Set([...income.map(i=>monthKey(i.date)), ...invoices.map(i=>monthKey(i.date)),
                            ...expenses.map(e=>monthKey(e.date)), monthKey(todayISO())]);
      return [...keys].sort().reverse();
   },

   async compute(periodKey){
      const settings = await Settings.get();
      const isIst = settings.besteuerungsart !== 'soll';

   let net19 = 0, net7 = 0, vatCollected = 0;
      if(isIst){
         const income = (await Income.list()).filter(i=>monthKey(i.date)===periodKey);
         income.forEach(i=>{
            const rate = Number(i.vat_rate ?? 19);
            if(rate===19) net19 += Number(i.net_amount||0);
            else if(rate===7) net7 += Number(i.net_amount||0);
            vatCollected += Number(i.vat_amount||0);
         });
      } else {
         const invoices = (await Invoices.list()).filter(i=>monthKey(i.date)===periodKey && Invoices.statusOf(i)!=='storniert');
         invoices.forEach(inv=>{
            (inv.line_items||[]).forEach(li=>{
               const lineNet = round2((Number(li.qty)||0)*(Number(li.unit_price_net)||0));
               const rate = Number(li.vat_rate)||0;
               if(rate===19) net19 += lineNet;
               else if(rate===7) net7 += lineNet;
            });
            vatCollected += Number(inv.vat_amount||0);
         });
      }

   const expenses = (await Expenses.list()).filter(e=>monthKey(e.date)===periodKey);
      let vatPaid = 0, expenseNet = 0;
      expenses.forEach(e=>{ vatPaid += Number(e.vat_amount||0); expenseNet += Number(e.net_amount||0); });

   net19 = round2(net19); net7 = round2(net7);
      vatCollected = round2(vatCollected); vatPaid = round2(vatPaid);
      const balance = round2(vatCollected - vatPaid);
      const baseNet = round2(net19 + net7);

   return {periodKey, basis: isIst?'ist':'soll', baseNet, net19, net7, expenseNet: round2(expenseNet),
           vatCollected, vatPaid, balance, dueDate: this.dueDateFor(periodKey), kz: USTVA_KZ};
   },

   dueDateFor(periodKey){
      const [y,m] = periodKey.split('-').map(Number);
      let ny=y, nm=m+1;
      if(nm>12){ nm=1; ny+=1; }
      return `${ny}-${String(nm).padStart(2,'0')}-10`;
   },

   async render(container){
      const periods = await this.periods();
      const selected = App.state.ustvaPeriod || periods[0];
      App.state.ustvaPeriod = selected;
      const r = await this.compute(selected);
      const settings = await Settings.get();

   container.innerHTML = `
   <div class="disclaimer-box"><strong>Hinweis:</strong> Vereinfachte Berechnung zur Vorbereitung. Pruefe Fristen, Dauerfristverlaengerung und Kennziffern-Zuordnung immer zusaetzlich in Elster bzw. mit deinem Finanzamt.</div>

   ${settings.kleinunternehmer? `<div class="disclaimer-box">Als Kleinunternehmer (Par.19 UStG) bist du in der Regel von der USt-VA befreit. Die folgende Berechnung wird trotzdem angezeigt, falls sich dein Status aendert.</div>` : ''}

   <div class="toolbar">
   <select id="ustvaPeriodSelect" class="select">${periods.map(p=>`<option value="${p}" ${p===selected?'selected':''}>${p}</option>`).join('')}</select>
   <span class="badge-mono">Basis: ${r.basis==='ist'?'Ist-Versteuerung (Zahlungseingang)':'Soll-Versteuerung (Rechnungsdatum)'}</span>
   <div class="spacer"></div>
   <button class="btn btn-secondary" id="ustvaCsv">CSV exportieren</button>
   </div>

   <div class="grid grid-3" style="margin-top:16px;">
   <div class="card"><div class="kpi-label">Umsatzsteuer (vereinnahmt)</div><div class="kpi-value">${fmtMoney(r.vatCollected)}</div><div class="kpi-sub">auf Netto ${fmtMoney(r.baseNet)}</div></div>
   <div class="card"><div class="kpi-label">Vorsteuer (gezahlt) Kz ${r.kz.vorsteuer}</div><div class="kpi-value">${fmtMoney(r.vatPaid)}</div><div class="kpi-sub">auf Netto ${fmtMoney(r.expenseNet)}</div></div>
   <div class="card"><div class="kpi-label">${r.balance>=0?'Zahllast':'Erstattung'} Kz ${r.kz.zahllast}</div><div class="kpi-value ${r.balance>=0?'neg':'pos'}">${fmtMoney(Math.abs(r.balance))}</div><div class="kpi-sub">faellig bis ${fmtDate(r.dueDate)}</div></div>
   </div>

   <div class="section-head"><h3>Elster-Uebertragstabelle (Kennzahlen)</h3></div>
   <table>
   <thead><tr><th>Kz</th><th>Bezeichnung</th><th class="num">Wert</th></tr></thead>
   <tbody>
   <tr><td class="mono">${r.kz.rate19}</td><td>Steuerpflichtige Umsaetze 19% (netto)</td><td class="num">${fmtMoney(r.net19)}</td></tr>
   <tr><td class="mono">${r.kz.rate7}</td><td>Steuerpflichtige Umsaetze 7% (netto)</td><td class="num">${fmtMoney(r.net7)}</td></tr>
   <tr><td class="mono">${r.kz.vorsteuer}</td><td>Abziehbare Vorsteuerbetraege (Steuerbetrag, nicht netto)</td><td class="num">${fmtMoney(r.vatPaid)}</td></tr>
   <tr class="ledger-total"><td class="mono">${r.kz.zahllast}</td><td>${r.balance>=0?'Verbleibende Vorauszahlung (Zahllast)':'Ueberschuss (Erstattung)'}</td><td class="num">${fmtMoney(Math.abs(r.balance))}</td></tr>
   </tbody>
   </table>

   <div class="section-head"><h3>Checkliste fuer die Elster-Eingabe</h3></div>
   <div class="card">
   <ul style="margin:0;padding-left:18px;font-size:13.5px;line-height:2;">
   <li>Kz ${r.kz.rate19} / Kz ${r.kz.rate7}: Nettoumsaetze aus obiger Tabelle uebertragen, ELSTER berechnet die Steuer automatisch.</li>
   <li>Kz ${r.kz.vorsteuer}: Vorsteuer als <strong>Steuerbetrag</strong> eintragen, nicht als Nettobetrag, haeufigster Fehler.</li>
   <li>Berechnete Zahllast/Erstattung (Kz ${r.kz.zahllast}) mit Elster-Berechnung abgleichen.</li>
   <li>Fristgerecht bis zum 10. des Folgemonats uebermitteln (bzw. verlaengerte Frist bei Dauerfristverlaengerung).</li>
   </ul>
   <p class="field-hint">Kennzahlen nach amtlichem USt-VA-Vordruck. Ab 2026 kommt ggf. Kz 500 (neue Meldepflicht) hinzu, bei Bedarf gegen den aktuellen Vordruck pruefen. Keine Steuerberatung.</p>
   </div>
   `;

   document.getElementById('ustvaPeriodSelect').addEventListener('change', e=>{
      App.state.ustvaPeriod = e.target.value;
      this.render(container);
   });
      document.getElementById('ustvaCsv').addEventListener('click', ()=>ExportFiles.ustvaCsv(r));
   }
};
