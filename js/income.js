/* ============================================================
   income.js — Einnahmenmodul (manuell + automatisch aus Rechnungen)
   ============================================================ */

const Income = {
  async list(){
    const all = await DB.all('income');
    return all.sort((a,b)=> (b.date||'').localeCompare(a.date||''));
  },

  async openForm(existing){
    const inc = existing || {date: todayISO(), category: INCOME_CATEGORIES[0], description:'', vat_rate:19, gross_amount:0};
    const derived = calcFromGross(inc.gross_amount, inc.vat_rate ?? 19);
    const body = `
      <div class="field-row">
        <div class="field"><label>Datum (Zahlungseingang)</label><input type="date" id="incDate" value="${inc.date}"></div>
        <div class="field"><label>Kategorie</label><select id="incCat">${INCOME_CATEGORIES.map(c=>`<option ${c===inc.category?'selected':''}>${c}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Beschreibung</label><input id="incDesc" value="${escapeHtml(inc.description)}" placeholder="z.B. Beratungshonorar Kunde X"></div>
      <div class="field-row">
        <div class="field"><label>Bruttobetrag</label><input type="number" step="0.01" id="incGross" value="${inc.gross_amount}"></div>
        <div class="field"><label>USt-Satz</label><select id="incVat">${VAT_RATES.map(r=>`<option value="${r.value}" ${r.value==(inc.vat_rate??19)?'selected':''}>${r.label}</option>`).join('')}</select></div>
      </div>
      <div class="field-hint" id="incCalc">Netto: ${fmtMoney(derived.net)} · USt: ${fmtMoney(derived.vat)}</div>
    `;
    const foot = `<button class="btn btn-secondary" id="incCancel">Abbrechen</button><button class="btn btn-primary" id="incSave">Speichern</button>`;
    openModal(existing?'Einnahme bearbeiten':'Neue Einnahme', body, foot);

    function recalc(){
      const g = Number(document.getElementById('incGross').value)||0;
      const r = Number(document.getElementById('incVat').value)||0;
      const d = calcFromGross(g,r);
      document.getElementById('incCalc').textContent = `Netto: ${fmtMoney(d.net)} · USt: ${fmtMoney(d.vat)}`;
    }
    document.getElementById('incGross').addEventListener('input', recalc);
    document.getElementById('incVat').addEventListener('change', recalc);
    document.getElementById('incCancel').addEventListener('click', closeModal);
    document.getElementById('incSave').addEventListener('click', async ()=>{
      const gross = Number(document.getElementById('incGross').value)||0;
      const rate = Number(document.getElementById('incVat').value)||0;
      if(gross<=0){ toast('Bitte einen Betrag angeben.', 'error'); return; }
      const d = calcFromGross(gross, rate);
      const record = {
        id: existing?.id,
        date: document.getElementById('incDate').value,
        category: document.getElementById('incCat').value,
        description: document.getElementById('incDesc').value.trim(),
        net_amount: d.net, vat_amount: d.vat, gross_amount: d.gross, vat_rate: rate,
        invoice_id: existing?.invoice_id || null,
      };
      if(existing) await DB.update('income', existing.id, record);
      else await DB.put('income', record);
      closeModal();
      toast('Einnahme gespeichert.', 'success');
      App.renderView();
    });
  },

  async remove(id){
    const rec = await DB.get('income', id);
    if(rec?.invoice_id){ toast('Diese Einnahme stammt aus einer Rechnung — bitte die Rechnung stornieren statt die Einnahme zu löschen.', 'error'); return; }
    if(!confirm('Einnahme wirklich löschen?')) return;
    await DB.remove('income', id);
    toast('Einnahme gelöscht.');
    App.renderView();
  },

  async render(container){
    const items = await this.list();
    const total = items.reduce((s,i)=>s+Number(i.gross_amount||0),0);
    container.innerHTML = `
      <div class="toolbar">
        <span class="badge-mono">Summe: ${fmtMoney(total)}</span>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="newIncomeBtn">+ Neue Einnahme</button>
      </div>
      <table style="margin-top:14px">
        <thead><tr><th>Datum</th><th>Kategorie</th><th>Beschreibung</th><th class="num">Netto</th><th class="num">USt</th><th class="num">Brutto</th><th></th></tr></thead>
        <tbody>
          ${items.length? items.map(i=>`
            <tr>
              <td>${fmtDate(i.date)}</td>
              <td><span class="tag-cat">${escapeHtml(i.category)}</span></td>
              <td>${escapeHtml(i.description)} ${i.invoice_id?'<span class="tag-cat">aus Rechnung</span>':''}</td>
              <td class="num">${fmtMoney(i.net_amount)}</td>
              <td class="num">${fmtMoney(i.vat_amount)}</td>
              <td class="num">${fmtMoney(i.gross_amount)}</td>
              <td>${!i.invoice_id?`<button class="btn-ghost btn-sm" data-edit="${i.id}">Bearbeiten</button><button class="btn-ghost btn-sm" data-del="${i.id}">Löschen</button>`:''}</td>
            </tr>
          `).join('') : `<tr class="empty-row"><td colspan="7">Noch keine Einnahmen erfasst.</td></tr>`}
        </tbody>
      </table>
    `;
    container.querySelector('#newIncomeBtn').addEventListener('click', ()=>this.openForm());
    container.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click', async ()=>{
      const rec = await DB.get('income', b.dataset.edit);
      this.openForm(rec);
    }));
    container.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click', ()=>this.remove(b.dataset.del)));
  }
};
