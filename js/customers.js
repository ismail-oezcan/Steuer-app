/* ============================================================
   customers.js — Kundenverwaltung
   ============================================================ */

const Customers = {

  async list(){
    const all = await DB.all('customers');
    return all.sort((a,b)=> (a.name||'').localeCompare(b.name||'', 'de'));
  },

  openForm(existing){
    const c = existing || {name:'', address:'', email:'', vat_id:''};
    const body = `
      <div class="field"><label>Name / Firma</label><input id="cName" value="${escapeHtml(c.name)}" placeholder="Mustermann GmbH"></div>
      <div class="field"><label>Adresse</label><textarea id="cAddress" placeholder="Straße, PLZ Ort">${escapeHtml(c.address)}</textarea></div>
      <div class="field-row">
        <div class="field"><label>E-Mail</label><input id="cEmail" value="${escapeHtml(c.email)}" placeholder="kontakt@kunde.de"></div>
        <div class="field"><label>USt-IdNr. (optional)</label><input id="cVat" value="${escapeHtml(c.vat_id||'')}" placeholder="DE123456789"></div>
      </div>
    `;
    const foot = `<button class="btn btn-secondary" id="cCancel">Abbrechen</button><button class="btn btn-primary" id="cSave">Speichern</button>`;
    openModal(existing? 'Kunde bearbeiten':'Neuer Kunde', body, foot);
    document.getElementById('cCancel').addEventListener('click', closeModal);
    document.getElementById('cSave').addEventListener('click', async ()=>{
      const name = document.getElementById('cName').value.trim();
      if(!name){ toast('Name ist erforderlich.', 'error'); return; }
      const record = {
        id: existing?.id,
        name,
        address: document.getElementById('cAddress').value.trim(),
        email: document.getElementById('cEmail').value.trim(),
        vat_id: document.getElementById('cVat').value.trim(),
      };
      if(existing) await DB.update('customers', existing.id, record);
      else await DB.put('customers', record);
      closeModal();
      toast('Kunde gespeichert.', 'success');
      App.renderView();
    });
  },

  async render(container){
    const customers = await this.list();
    container.innerHTML = `
      <div class="toolbar">
        <div class="spacer"></div>
        <button class="btn btn-primary" id="newCustomerBtn">+ Neuer Kunde</button>
      </div>
      <table style="margin-top:14px">
        <thead><tr><th>Name</th><th>Adresse</th><th>E-Mail</th><th>USt-IdNr.</th><th></th></tr></thead>
        <tbody>
          ${customers.length? customers.map(c=>`
            <tr>
              <td><strong>${escapeHtml(c.name)}</strong></td>
              <td>${escapeHtml((c.address||'').replace(/\n/g,', '))}</td>
              <td>${escapeHtml(c.email)}</td>
              <td class="mono">${escapeHtml(c.vat_id||'—')}</td>
              <td><button class="btn btn-ghost btn-sm" data-edit="${c.id}">Bearbeiten</button></td>
            </tr>
          `).join('') : `<tr class="empty-row"><td colspan="5">Noch keine Kunden angelegt.</td></tr>`}
        </tbody>
      </table>
    `;
    container.querySelector('#newCustomerBtn').addEventListener('click', ()=>this.openForm());
    container.querySelectorAll('[data-edit]').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const c = await DB.get('customers', btn.dataset.edit);
        this.openForm(c);
      });
    });
  }
};
