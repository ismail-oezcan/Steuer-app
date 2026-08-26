/* ============================================================
   expenses.js — Ausgabenmodul: Beleg-Foto/Upload, OCR-gestützte
   Vorbefüllung, Kategorisierung, Vorsteuerberechnung.
   ============================================================ */

const Expenses = {
  async list(){
    const all = await DB.all('expenses');
    return all.sort((a,b)=> (b.date||'').localeCompare(a.date||''));
  },

  async openForm(existing){
    const exp = existing || {date: todayISO(), category: EXPENSE_CATEGORIES[0], vendor:'', description:'', vat_rate:19, gross_amount:0, receipt_image:null, ocr_text:''};
    const derived = calcFromGross(exp.gross_amount, exp.vat_rate ?? 19);

    const body = `
      <div class="field">
        <label>Beleg fotografieren / hochladen</label>
        <div class="dropzone" id="dropzone">
          <div id="dzText">📷 Foto aufnehmen oder Datei hierher ziehen (JPG, PNG, PDF)</div>
          <img id="receiptPreview" class="receipt-preview hidden">
        </div>
        <input type="file" id="receiptInput" accept="image/*,.pdf" capture="environment" style="display:none;">
        <div id="ocrStatus" class="field-hint"></div>
      </div>

      <div class="field-row">
        <div class="field"><label>Datum</label><input type="date" id="expDate" value="${exp.date}"></div>
        <div class="field"><label>Händler / Anbieter</label><input id="expVendor" value="${escapeHtml(exp.vendor)}"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Kategorie</label><select id="expCat">${EXPENSE_CATEGORIES.map(c=>`<option ${c===exp.category?'selected':''}>${c}</option>`).join('')}</select></div>
        <div class="field"><label>USt-Satz (Vorsteuer)</label><select id="expVat">${VAT_RATES.map(r=>`<option value="${r.value}" ${r.value==(exp.vat_rate??19)?'selected':''}>${r.label}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Beschreibung</label><input id="expDesc" value="${escapeHtml(exp.description)}"></div>
      <div class="field"><label>Bruttobetrag</label><input type="number" step="0.01" id="expGross" value="${exp.gross_amount}"></div>
      <div class="field-hint" id="expCalc">Netto: ${fmtMoney(derived.net)} · Vorsteuer: ${fmtMoney(derived.vat)}</div>
    `;
    const foot = `<button class="btn btn-secondary" id="expCancel">Abbrechen</button><button class="btn btn-primary" id="expSave">Speichern</button>`;
    openModal(existing?'Ausgabe bearbeiten':'Neue Ausgabe', body, foot);

    let receiptImage = exp.receipt_image || null;
    let ocrText = exp.ocr_text || '';
    const preview = document.getElementById('receiptPreview');
    const dzText = document.getElementById('dzText');
    if(receiptImage){ preview.src = receiptImage; preview.classList.remove('hidden'); dzText.textContent='Beleg ändern'; }

    document.getElementById('dropzone').addEventListener('click', ()=>document.getElementById('receiptInput').click());
    document.getElementById('dropzone').addEventListener('dragover', e=>{ e.preventDefault(); e.currentTarget.classList.add('drag'); });
    document.getElementById('dropzone').addEventListener('dragleave', e=>e.currentTarget.classList.remove('drag'));
    document.getElementById('dropzone').addEventListener('drop', e=>{
      e.preventDefault(); e.currentTarget.classList.remove('drag');
      if(e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });
    document.getElementById('receiptInput').addEventListener('change', e=>{
      if(e.target.files[0]) handleFile(e.target.files[0]);
    });

    async function handleFile(file){
      if(!file.type.startsWith('image/')){
        toast('OCR funktioniert nur für Bilddateien. PDF wird gespeichert, aber nicht automatisch ausgelesen.', '');
        const reader = new FileReader();
        reader.onload = ()=>{ receiptImage = reader.result; };
        reader.readAsDataURL(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = async ()=>{
        receiptImage = reader.result;
        preview.src = receiptImage; preview.classList.remove('hidden'); dzText.textContent='Beleg ändern';
        document.getElementById('ocrStatus').textContent = 'Texterkennung läuft…';
        try{
          const result = await OCR.recognizeReceipt(receiptImage);
          ocrText = result.text;
          document.getElementById('ocrStatus').textContent = 'Texterkennung abgeschlossen — Felder geprüft, bitte kontrollieren.';
          if(result.amount) document.getElementById('expGross').value = result.amount;
          if(result.date) document.getElementById('expDate').value = result.date;
          if(result.vendor) document.getElementById('expVendor').value = result.vendor;
          recalc();
        }catch(err){
          document.getElementById('ocrStatus').textContent = 'Texterkennung fehlgeschlagen (Internetverbindung nötig für OCR-Modell). Bitte Felder manuell ausfüllen.';
        }
      };
      reader.readAsDataURL(file);
    }

    function recalc(){
      const g = Number(document.getElementById('expGross').value)||0;
      const r = Number(document.getElementById('expVat').value)||0;
      const d = calcFromGross(g,r);
      document.getElementById('expCalc').textContent = `Netto: ${fmtMoney(d.net)} · Vorsteuer: ${fmtMoney(d.vat)}`;
    }
    document.getElementById('expGross').addEventListener('input', recalc);
    document.getElementById('expVat').addEventListener('change', recalc);
    document.getElementById('expCancel').addEventListener('click', closeModal);

    document.getElementById('expSave').addEventListener('click', async ()=>{
      const gross = Number(document.getElementById('expGross').value)||0;
      const rate = Number(document.getElementById('expVat').value)||0;
      if(gross<=0){ toast('Bitte einen Betrag angeben.', 'error'); return; }
      const d = calcFromGross(gross, rate);
      const record = {
        id: existing?.id,
        date: document.getElementById('expDate').value,
        vendor: document.getElementById('expVendor').value.trim(),
        category: document.getElementById('expCat').value,
        description: document.getElementById('expDesc').value.trim(),
        net_amount: d.net, vat_amount: d.vat, gross_amount: d.gross, vat_rate: rate,
        receipt_image: receiptImage,
        ocr_text: ocrText,
      };
      if(existing) await DB.update('expenses', existing.id, record);
      else await DB.put('expenses', record);
      closeModal();
      toast('Ausgabe gespeichert.', 'success');
      App.renderView();
    });
  },

  async remove(id){
    if(!confirm('Ausgabe wirklich löschen? (GoBD empfiehlt Aufbewahrung — besser stornieren als löschen, falls der Beleg bereits gemeldet wurde.)')) return;
    await DB.remove('expenses', id);
    toast('Ausgabe gelöscht.');
    App.renderView();
  },

  async viewReceipt(id){
    const rec = await DB.get('expenses', id);
    if(!rec.receipt_image){ toast('Kein Beleg-Bild hinterlegt.'); return; }
    openModal('Beleg — '+escapeHtml(rec.vendor||''), `<img src="${rec.receipt_image}" style="max-width:100%;border-radius:6px;">`, `<button class="btn btn-secondary" id="rClose">Schließen</button>`);
    document.getElementById('rClose').addEventListener('click', closeModal);
  },

  async render(container){
    const items = await this.list();
    const total = items.reduce((s,i)=>s+Number(i.gross_amount||0),0);
    container.innerHTML = `
      <div class="toolbar">
        <span class="badge-mono">Summe: ${fmtMoney(total)}</span>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="newExpenseBtn">+ Neue Ausgabe</button>
      </div>
      <table style="margin-top:14px">
        <thead><tr><th>Datum</th><th>Kategorie</th><th>Händler</th><th class="num">Netto</th><th class="num">Vorsteuer</th><th class="num">Brutto</th><th></th></tr></thead>
        <tbody>
          ${items.length? items.map(i=>`
            <tr>
              <td>${fmtDate(i.date)}</td>
              <td><span class="tag-cat">${escapeHtml(i.category)}</span></td>
              <td>${escapeHtml(i.vendor||'—')} ${i.receipt_image?'<button class="btn-ghost btn-sm" data-view="'+i.id+'">📎</button>':''}</td>
              <td class="num">${fmtMoney(i.net_amount)}</td>
              <td class="num">${fmtMoney(i.vat_amount)}</td>
              <td class="num">${fmtMoney(i.gross_amount)}</td>
              <td><button class="btn-ghost btn-sm" data-edit="${i.id}">Bearbeiten</button><button class="btn-ghost btn-sm" data-del="${i.id}">Löschen</button></td>
            </tr>
          `).join('') : `<tr class="empty-row"><td colspan="7">Noch keine Ausgaben erfasst.</td></tr>`}
        </tbody>
      </table>
    `;
    container.querySelector('#newExpenseBtn').addEventListener('click', ()=>this.openForm());
    container.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click', async ()=>{
      const rec = await DB.get('expenses', b.dataset.edit);
      this.openForm(rec);
    }));
    container.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click', ()=>this.remove(b.dataset.del)));
    container.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click', ()=>this.viewReceipt(b.dataset.view)));
  }
};
