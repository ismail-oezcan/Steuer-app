/* ============================================================
   ustva.js — Umsatzsteuer-Voranmeldung (vereinfacht)
   Bei Ist-Versteuerung: Umsatzsteuer wird zum Zeitpunkt des
   Zahlungseingangs fällig -> Basis = income[].date (Zufluss).
   Bei Soll-Versteuerung: Umsatzsteuer wird zum Rechnungsdatum fällig
   -> Basis = invoices[].date (unabhängig vom Zahlungseingang).
   Vorsteuer aus Ausgaben wird in beiden Fällen nach Zahlungsdatum
   angesetzt (vereinfachend, wie in der Praxis für Kleinbetriebe üblich).
   HINWEIS: vereinfachtes Modell, keine Kennziffern-genaue Elster-Zuordnung.
   ============================================================ */

const USTVA = {
  async periods(){
    // returns list of {key,label} for months present in data, most recent first
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

    let vatCollected = 0, baseNet = 0;
    if(isIst){
      const income = (await Income.list()).filter(i=>monthKey(i.date)===periodKey);
      income.forEach(i=>{ vatCollected += Number(i.vat_amount||0); baseNet += Number(i.net_amount||0); });
    } else {
      const invoices = (await Invoices.list()).filter(i=>monthKey(i.date)===periodKey && Invoices.statusOf(i)!=='storniert');
      invoices.forEach(i=>{ vatCollected += Number(i.vat_amount||0); baseNet += Number(i.net_amount||0); });
    }

    const expenses = (await Expenses.list()).filter(e=>monthKey(e.date)===periodKey);
    let vatPaid = 0, expenseNet = 0;
    expenses.forEach(e=>{ vatPaid += Number(e.vat_amount||0); expenseNet += Number(e.net_amount||0); });

    vatCollected = round2(vatCollected); vatPaid = round2(vatPaid);
    const balance = round2(vatCollected - vatPaid); // positive = Zahllast, negative = Erstattung

    return {periodKey, basis: isIst?'ist':'soll', baseNet: round2(baseNet), expenseNet: round2(expenseNet),
      vatCollected, vatPaid, balance, dueDate: this.dueDateFor(periodKey)};
  },

  dueDateFor(periodKey){
    // German rule: due on the 10th of the month following the period (no Dauerfristverlängerung modeled)
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
      <div class="disclaimer-box"><strong>Hinweis:</strong> Vereinfachte Berechnung zur Vorbereitung. Prüfe Fristen, Dauerfristverlängerung und Kennziffern-Zuordnung immer zusätzlich in Elster bzw. mit deinem Finanzamt.</div>

      ${settings.kleinunternehmer? `<div class="disclaimer-box">Als Kleinunternehmer (§19 UStG) bist du in der Regel von der USt-VA befreit. Die folgende Berechnung wird trotzdem angezeigt, falls sich dein Status ändert.</div>` : ''}

      <div class="toolbar">
        <select id="ustvaPeriodSelect" class="select">${periods.map(p=>`<option value="${p}" ${p===selected?'selected':''}>${p}</option>`).join('')}</select>
        <span class="badge-mono">Basis: ${r.basis==='ist'?'Ist-Versteuerung (Zahlungseingang)':'Soll-Versteuerung (Rechnungsdatum)'}</span>
        <div class="spacer"></div>
        <button class="btn btn-secondary" id="ustvaCsv">CSV exportieren</button>
      </div>

      <div class="grid grid-3" style="margin-top:16px;">
        <div class="card"><div class="kpi-label">Umsatzsteuer (vereinnahmt)</div><div class="kpi-value">${fmtMoney(r.vatCollected)}</div><div class="kpi-sub">auf Netto ${fmtMoney(r.baseNet)}</div></div>
        <div class="card"><div class="kpi-label">Vorsteuer (gezahlt)</div><div class="kpi-value">${fmtMoney(r.vatPaid)}</div><div class="kpi-sub">auf Netto ${fmtMoney(r.expenseNet)}</div></div>
        <div class="card"><div class="kpi-label">${r.balance>=0?'Zahllast':'Erstattung'}</div><div class="kpi-value ${r.balance>=0?'neg':'pos'}">${fmtMoney(Math.abs(r.balance))}</div><div class="kpi-sub">fällig bis ${fmtDate(r.dueDate)}</div></div>
      </div>

      <div class="section-head"><h3>Checkliste für die Elster-Eingabe</h3></div>
      <div class="card">
        <ul style="margin:0;padding-left:18px;font-size:13.5px;line-height:2;">
          <li>Steuerpflichtige Umsätze zu 19% / 7% getrennt aus Rechnungen bzw. Einnahmen übertragen.</li>
          <li>Vorsteuerbeträge aus Eingangsrechnungen (Ausgaben) übertragen.</li>
          <li>Berechnete Zahllast/Erstattung mit Elster-Berechnung abgleichen.</li>
          <li>Fristgerecht bis zum 10. des Folgemonats übermitteln (bzw. verlängerte Frist bei Dauerfristverlängerung).</li>
        </ul>
      </div>
    `;

    document.getElementById('ustvaPeriodSelect').addEventListener('change', e=>{
      App.state.ustvaPeriod = e.target.value;
      this.render(container);
    });
    document.getElementById('ustvaCsv').addEventListener('click', ()=>ExportFiles.ustvaCsv(r));
  }
};
