/* ============================================================
   invoices.js — Rechnungsmodul
   Pflichtangaben §14 UStG werden über Einstellungen (Absender)
   + Formularfelder (Empfänger, Rechnungsnr., Datum, Leistungsdatum,
   Steuersätze) abgedeckt. Vor PDF-Export wird geprüft, ob die
   Absenderdaten in den Einstellungen vollständig sind.
   ============================================================ */

const Invoices = {

  async list(){
    // voided invoices stay visible (marked "storniert") for GoBD traceability
    const all = await DB.all('invoices');
    return all.sort((a,b)=> (b.date||'').localeCompare(a.date||''));
  },

  async nextInvoiceNumber(date){
    const year = yearOf(date||todayISO());
    const all = await DB.all('invoices');
    const countThisYear = all.filter(i=> yearOf(i.date) === year).length;
    return `${year}-${String(countThisYear+1).padStart(4,'0')}`;
  },

  computeTotals(lineItems){
    let net=0, vat=0, gross=0;
    const byRate = {};
    lineItems.forEach(li=>{
      const qty = Number(li.qty)||0;
      const unitNet = Number(li.unit_price_net)||0;
      const lineNet = round2(qty*unitNet);
      const rate = Number(li.vat_rate)||0;
      const lineVat = round2(lineNet*rate/100);
      net += lineNet; vat += lineVat;
      byRate[rate] = round2((byRate[rate]||0) + lineNet);
    });
    gross = round2(net+vat);
    return {net:round2(net), vat:round2(vat), gross, byRate};
  },

  statusOf(inv){
    if(inv.status==='storniert') return 'storniert';
    if(inv.status==='bezahlt') return 'bezahlt';
    if(inv.due_date && inv.due_date < todayISO()) return 'überfällig';
    return 'offen';
  },

  pillClass(status){
    return {offen:'pill-open', bezahlt:'pill-paid', 'überfällig':'pill-overdue', storniert:'pill-draft'}[status] || 'pill-draft';
  },

  emptyLineItem(){
    return {description:'', qty:1, unit_price_net:0, vat_rate:19};
  },

  async openForm(existing){
    const customers = await Customers.list();
    if(!customers.length){
      toast('Bitte zuerst einen Kunden anlegen.', 'error');
      Customers.openForm();
      return;
    }
    const inv = existing || {
      customer_id: customers[0].id,
      date: todayISO(),
      due_date: addDays(todayISO(), 14),
      leistungsdatum: todayISO(),
      line_items: [this.emptyLineItem()],
      status: 'offen',
      notes: ''
    };
    const invoiceNumber = existing? existing.invoice_number : await this.nextInvoiceNumber(inv.date);

    const body = `
      <div class="field-row">
        <div class="field"><label>Rechnungsnummer</label><input class="mono" value="${escapeHtml(invoiceNumber)}" disabled></div>
        <div class="field"><label>Kunde</label>
          <select id="iCustomer">${customers.map(c=>`<option value="${c.id}" ${c.id===inv.customer_id?'selected':''}>${escapeHtml(c.name)}</option>`).join('')}</select>
        </div>
      </div>
      <div class="field-row">
        <div class="field"><label>Rechnungsdatum</label><input type="date" id="iDate" value="${inv.date}"></div>
        <div class="field"><label>Fällig am</label><input type="date" id="iDue" value="${inv.due_date}"></div>
      </div>
      <div class="field"><label>Leistungsdatum / -zeitraum</label><input id="iLeistung" value="${escapeHtml(inv.leistungsdatum||inv.date)}" placeholder="z.B. 03.–07.03.2026 oder Lieferdatum"></div>

      <div class="field"><label>Positionen</label>
        <div class="line-items" id="lineItems"></div>
        <button class="btn btn-secondary btn-sm" id="addLine">+ Position hinzufügen</button>
      </div>

      <div class="field"><label>Notiz auf Rechnung (optional)</label><textarea id="iNotes">${escapeHtml(inv.notes||'')}</textarea></div>

      <div id="totalsBox" class="card" style="margin-top:4px;"></div>
    `;
    const foot = `<button class="btn btn-secondary" id="iCancel">Abbrechen</button><button class="btn btn-primary" id="iSave">Rechnung speichern</button>`;
    openModal(existing? `Rechnung ${invoiceNumber} bearbeiten` : 'Neue Rechnung', body, foot);

    let lineItems = JSON.parse(JSON.stringify(inv.line_items));

    function renderLines(){
      const wrap = document.getElementById('lineItems');
      wrap.innerHTML = `
        <div class="line-item-row" style="background:var(--paper-2);font-size:11px;color:var(--text-dim);text-transform:uppercase;">
          <div>Beschreibung</div><div>Menge</div><div>Einzelpreis netto</div><div>USt</div><div></div>
        </div>
        ${lineItems.map((li,idx)=>`
          <div class="line-item-row" data-idx="${idx}">
            <input data-f="description" value="${escapeHtml(li.description)}" placeholder="Leistung / Produkt">
            <input data-f="qty" type="number" step="0.01" value="${li.qty}">
            <input data-f="unit_price_net" type="number" step="0.01" value="${li.unit_price_net}">
            <select data-f="vat_rate">${VAT_RATES.map(r=>`<option value="${r.value}" ${r.value==li.vat_rate?'selected':''}>${r.value}%</option>`).join('')}</select>
            <button class="btn-ghost" data-del="${idx}" title="entfernen">✕</button>
          </div>
        `).join('')}
      `;
      wrap.querySelectorAll('input,select').forEach(inp=>{
        inp.addEventListener('input', ()=>{
          const idx = Number(inp.closest('[data-idx]').dataset.idx);
          lineItems[idx][inp.dataset.f] = inp.type==='number'? Number(inp.value) : inp.value;
          renderTotals();
        });
      });
      wrap.querySelectorAll('[data-del]').forEach(btn=>{
        btn.addEventListener('click', ()=>{
          lineItems.splice(Number(btn.dataset.del),1);
          if(!lineItems.length) lineItems.push(Invoices.emptyLineItem());
          renderLines(); renderTotals();
        });
      });
    }
    function renderTotals(){
      const t = Invoices.computeTotals(lineItems);
      document.getElementById('totalsBox').innerHTML = `
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;"><span>Netto</span><span class="mono">${fmtMoney(t.net)}</span></div>
        ${Object.entries(t.byRate).map(([rate,net])=>`<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-dim);"><span>davon USt ${rate}%</span><span class="mono">${fmtMoney(round2(net*rate/100))}</span></div>`).join('')}
        <hr class="hr-ledger">
        <div style="display:flex;justify-content:space-between;font-weight:600;"><span>Gesamt (Brutto)</span><span class="mono">${fmtMoney(t.gross)}</span></div>
      `;
    }
    renderLines(); renderTotals();
    document.getElementById('addLine').addEventListener('click', ()=>{ lineItems.push(Invoices.emptyLineItem()); renderLines(); renderTotals(); });
    document.getElementById('iCancel').addEventListener('click', closeModal);

    document.getElementById('iSave').addEventListener('click', async ()=>{
      const totals = this.computeTotals(lineItems);
      if(totals.gross<=0){ toast('Rechnung hat keinen Betrag.', 'error'); return; }
      const record = {
        id: existing?.id,
        invoice_number: invoiceNumber,
        customer_id: document.getElementById('iCustomer').value,
        date: document.getElementById('iDate').value,
        due_date: document.getElementById('iDue').value,
        leistungsdatum: document.getElementById('iLeistung').value,
        line_items: lineItems,
        net_amount: totals.net,
        vat_amount: totals.vat,
        gross_amount: totals.gross,
        notes: document.getElementById('iNotes').value.trim(),
        status: inv.status || 'offen',
      };
      if(existing) await DB.update('invoices', existing.id, record);
      else await DB.put('invoices', record);
      closeModal();
      toast('Rechnung gespeichert.', 'success');
      App.renderView();
    });
  },

  async markPaid(invId){
    const inv = await DB.get('invoices', invId);
    const body = `
      <div class="field"><label>Zahlungseingang am</label><input type="date" id="payDate" value="${todayISO()}"></div>
      <p class="field-hint">Der Betrag wird automatisch als Einnahme (§11 EStG Zuflussprinzip) erfasst.</p>
    `;
    const foot = `<button class="btn btn-secondary" id="pCancel">Abbrechen</button><button class="btn btn-primary" id="pConfirm">Als bezahlt markieren</button>`;
    openModal('Zahlung erfassen', body, foot);
    document.getElementById('pCancel').addEventListener('click', closeModal);
    document.getElementById('pConfirm').addEventListener('click', async ()=>{
      const payDate = document.getElementById('payDate').value;
      await DB.update('invoices', invId, {status:'bezahlt', paid_date: payDate});
      const customer = await DB.get('customers', inv.customer_id);
      await DB.put('income', {
        invoice_id: inv.id,
        date: payDate,
        category: 'Dienstleistung',
        net_amount: inv.net_amount,
        vat_amount: inv.vat_amount,
        gross_amount: inv.gross_amount,
        description: `Zahlungseingang Rechnung ${inv.invoice_number} — ${customer?customer.name:''}`
      });
      closeModal();
      toast('Zahlung erfasst, Einnahme automatisch angelegt.', 'success');
      App.renderView();
    });
  },

  async voidInvoice(invId){
    if(!confirm('Rechnung stornieren? Sie bleibt aus GoBD-Gründen sichtbar, wird aber als storniert markiert.')) return;
    await DB.voidRecord('invoices', invId, 'Manuell storniert');
    toast('Rechnung storniert.');
    App.renderView();
  },

  async exportPdf(invId){
    const inv = await DB.get('invoices', invId);
    const customer = await DB.get('customers', inv.customer_id);
    const settings = await Settings.get();
    if(!settings.companyName || !settings.address || (!settings.taxId && !settings.ustId)){
      toast('Bitte zuerst Firmendaten (Name, Adresse, Steuernummer) in den Einstellungen ausfüllen.', 'error');
      App.go('einstellungen');
      return;
    }
    if(typeof window.jspdf === 'undefined'){
      toast('PDF-Bibliothek nicht geladen — Internetverbindung erforderlich (einmalig).', 'error');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 20;
    doc.setFontSize(9); doc.setTextColor(90);
    doc.text(settings.companyName + ' · ' + (settings.address||'').replace(/\n/g,', '), 14, y); y+=12;

    doc.setFontSize(16); doc.setTextColor(20);
    doc.text('Rechnung ' + inv.invoice_number, 14, y); y+=10;

    doc.setFontSize(10); doc.setTextColor(60);
    doc.text('Empfänger:', 14, y); y+=5;
    doc.text(customer?customer.name:'—', 14, y); y+=5;
    (customer?.address||'').split('\n').forEach(line=>{ doc.text(line, 14, y); y+=5; });
    y+=3;
    doc.text(`Rechnungsdatum: ${fmtDate(inv.date)}`, 14, y); 
    doc.text(`Fällig am: ${fmtDate(inv.due_date)}`, 110, y); y+=5;
    doc.text(`Leistungsdatum: ${inv.leistungsdatum||fmtDate(inv.date)}`, 14, y); y+=8;

    doc.setDrawColor(200); doc.line(14,y,196,y); y+=6;
    doc.setFontSize(9); doc.setTextColor(90);
    doc.text('Beschreibung', 14, y); doc.text('Menge', 110, y); doc.text('Einzelpreis', 135, y); doc.text('USt', 165, y); doc.text('Netto', 182, y);
    y+=4; doc.line(14,y,196,y); y+=6;
    doc.setTextColor(20);
    inv.line_items.forEach(li=>{
      const lineNet = round2((Number(li.qty)||0)*(Number(li.unit_price_net)||0));
      doc.text(String(li.description||'').slice(0,48), 14, y);
      doc.text(String(li.qty), 112, y);
      doc.text(fmtMoney(li.unit_price_net), 135, y);
      doc.text(li.vat_rate+'%', 168, y);
      doc.text(fmtMoney(lineNet), 182, y);
      y+=6;
    });
    y+=2; doc.line(14,y,196,y); y+=8;
    doc.text('Netto', 150, y); doc.text(fmtMoney(inv.net_amount), 182, y); y+=6;
    doc.text('USt', 150, y); doc.text(fmtMoney(inv.vat_amount), 182, y); y+=6;
    doc.setFontSize(11);
    doc.text('Gesamtbetrag', 150, y); doc.text(fmtMoney(inv.gross_amount), 182, y); y+=10;

    if(inv.notes){ doc.setFontSize(9); doc.setTextColor(90); doc.text(doc.splitTextToSize(inv.notes, 180), 14, y); y+=10; }

    doc.setFontSize(8); doc.setTextColor(120);
    let taxLine = settings.ustId? `USt-IdNr.: ${settings.ustId}` : `Steuernummer: ${settings.taxId}`;
    if(settings.kleinunternehmer) taxLine += '  ·  Gemäß §19 UStG wird keine Umsatzsteuer berechnet.';
    doc.text(taxLine, 14, 285);

    doc.save(`Rechnung_${inv.invoice_number}.pdf`);
    await DB.update('invoices', inv.id, {pdf_generated_at: new Date().toISOString()});
    toast('PDF exportiert.', 'success');
  },

  async render(container){
    const invoices = await this.list();
    const customers = await Customers.list();
    const custMap = Object.fromEntries(customers.map(c=>[c.id,c]));
    container.innerHTML = `
      <div class="toolbar">
        <div class="spacer"></div>
        <button class="btn btn-primary" id="newInvoiceBtn">+ Neue Rechnung</button>
      </div>
      <table style="margin-top:14px">
        <thead><tr><th>Nr.</th><th>Kunde</th><th>Datum</th><th>Fällig</th><th class="num">Betrag</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${invoices.length? invoices.map(i=>{
            const status = this.statusOf(i);
            return `<tr>
              <td class="mono">${escapeHtml(i.invoice_number)}</td>
              <td>${escapeHtml(custMap[i.customer_id]?.name || '—')}</td>
              <td>${fmtDate(i.date)}</td>
              <td>${fmtDate(i.due_date)}</td>
              <td class="num">${fmtMoney(i.gross_amount)}</td>
              <td><span class="pill ${this.pillClass(status)}">${status}</span></td>
              <td style="white-space:nowrap;">
                <button class="btn-ghost btn-sm" data-pdf="${i.id}">PDF</button>
                ${status==='offen'||status==='überfällig' ? `<button class="btn-ghost btn-sm" data-pay="${i.id}">Bezahlt</button>`:''}
                ${status!=='storniert' ? `<button class="btn-ghost btn-sm" data-edit="${i.id}">Bearbeiten</button><button class="btn-ghost btn-sm" data-void="${i.id}">Stornieren</button>`:''}
              </td>
            </tr>`;
          }).join('') : `<tr class="empty-row"><td colspan="7">Noch keine Rechnungen erstellt.</td></tr>`}
        </tbody>
      </table>
    `;
    container.querySelector('#newInvoiceBtn').addEventListener('click', ()=>this.openForm());
    container.querySelectorAll('[data-pdf]').forEach(b=>b.addEventListener('click', ()=>this.exportPdf(b.dataset.pdf)));
    container.querySelectorAll('[data-pay]').forEach(b=>b.addEventListener('click', ()=>this.markPaid(b.dataset.pay)));
    container.querySelectorAll('[data-void]').forEach(b=>b.addEventListener('click', ()=>this.voidInvoice(b.dataset.void)));
    container.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click', async ()=>{
      const inv = await DB.get('invoices', b.dataset.edit);
      this.openForm(inv);
    }));
  }
};
