/* ============================================================
   settings.js — Firmendaten & Steuereinstellungen
   ============================================================ */

const SETTINGS_ID = 'main';

const Settings = {
  async get(){
    const s = await DB.get('settings', SETTINGS_ID);
    return s || {
      id: SETTINGS_ID,
      companyName:'', address:'', email:'', taxId:'', ustId:'',
      kleinunternehmer:false,
      besteuerungsart:'ist', // 'ist' = nach vereinnahmten Entgelten (üblich für Freelancer), 'soll' = nach vereinbarten Entgelten
      ustva_interval:'monatlich',
    };
  },
  async save(patch){
    const existing = await DB.get('settings', SETTINGS_ID);
    if(existing) return DB.update('settings', SETTINGS_ID, patch);
    return DB.put('settings', {id:SETTINGS_ID, ...patch});
  },

  async render(container){
    const s = await this.get();
    container.innerHTML = `
      <div class="section-head"><h3>Firmendaten (erscheinen auf Rechnungen)</h3></div>
      <div class="card">
        <div class="field-row">
          <div class="field"><label>Name / Firma</label><input id="sName" value="${escapeHtml(s.companyName)}"></div>
          <div class="field"><label>E-Mail</label><input id="sEmail" value="${escapeHtml(s.email)}"></div>
        </div>
        <div class="field"><label>Adresse</label><textarea id="sAddress">${escapeHtml(s.address)}</textarea></div>
        <div class="field-row">
          <div class="field"><label>Steuernummer</label><input id="sTaxId" value="${escapeHtml(s.taxId)}" placeholder="12/345/67890"></div>
          <div class="field"><label>USt-IdNr. (falls vorhanden)</label><input id="sUstId" value="${escapeHtml(s.ustId)}" placeholder="DE123456789"></div>
        </div>
      </div>

      <div class="section-head"><h3>Steuerliche Einstellungen</h3></div>
      <div class="card">
        <div class="field">
          <label><input type="checkbox" id="sKlein" ${s.kleinunternehmer?'checked':''} style="width:auto;margin-right:8px;">Kleinunternehmer nach §19 UStG (keine Umsatzsteuer)</label>
        </div>
        <div class="field-row">
          <div class="field"><label>Besteuerungsart</label>
            <select id="sBesteuerung">
              <option value="ist" ${s.besteuerungsart==='ist'?'selected':''}>Ist-Versteuerung (nach Zahlungseingang) — üblich für Freiberufler</option>
              <option value="soll" ${s.besteuerungsart==='soll'?'selected':''}>Soll-Versteuerung (nach Rechnungsdatum)</option>
            </select>
          </div>
          <div class="field"><label>USt-VA Turnus</label>
            <select id="sInterval">
              <option value="monatlich" ${s.ustva_interval==='monatlich'?'selected':''}>Monatlich</option>
              <option value="vierteljaehrlich" ${s.ustva_interval==='vierteljaehrlich'?'selected':''}>Vierteljährlich</option>
            </select>
          </div>
        </div>
        <p class="field-hint">Diese Einstellungen bestimmen, wie USt-VA und Fristen berechnet werden. Im Zweifel bei deinem Finanzamt oder auf elster.de nachprüfen — die tatsächliche Einordnung hängt von deiner Anmeldung ab.</p>
      </div>

      <div class="section-head"><h3>PIN ändern</h3></div>
      <div class="card">
        <div class="field-row">
          <div class="field"><label>Neue PIN</label><input type="password" id="sPin1" inputmode="numeric" maxlength="8"></div>
          <div class="field"><label>PIN bestätigen</label><input type="password" id="sPin2" inputmode="numeric" maxlength="8"></div>
        </div>
        <button class="btn btn-secondary btn-sm" id="sChangePin">PIN aktualisieren</button>
      </div>

      <div class="section-head"><h3>Daten &amp; Backup</h3></div>
      <div class="card">
        <p class="field-hint" style="margin-top:0;">Alle Daten liegen ausschließlich lokal in diesem Browser (IndexedDB). Es gibt keine Cloud-Synchronisierung. Exportiere regelmäßig ein Backup — bei gelöschtem Browserspeicher sind sonst alle Daten verloren.</p>
        <div class="toolbar">
          <button class="btn btn-secondary" id="exportBackup">Backup exportieren (JSON)</button>
          <label class="btn btn-secondary" style="margin:0;">Backup importieren
            <input type="file" id="importBackup" accept="application/json" style="display:none;">
          </label>
        </div>
      </div>

      <button class="btn btn-primary" id="sSaveAll" style="margin-top:18px;">Alle Änderungen speichern</button>
    `;

    document.getElementById('sSaveAll').addEventListener('click', async ()=>{
      await this.save({
        companyName: document.getElementById('sName').value.trim(),
        email: document.getElementById('sEmail').value.trim(),
        address: document.getElementById('sAddress').value.trim(),
        taxId: document.getElementById('sTaxId').value.trim(),
        ustId: document.getElementById('sUstId').value.trim(),
        kleinunternehmer: document.getElementById('sKlein').checked,
        besteuerungsart: document.getElementById('sBesteuerung').value,
        ustva_interval: document.getElementById('sInterval').value,
      });
      toast('Einstellungen gespeichert.', 'success');
    });

    document.getElementById('sChangePin').addEventListener('click', async ()=>{
      const p1 = document.getElementById('sPin1').value.trim();
      const p2 = document.getElementById('sPin2').value.trim();
      if(p1.length<4){ toast('PIN muss mind. 4 Stellen haben.', 'error'); return; }
      if(p1!==p2){ toast('PINs stimmen nicht überein.', 'error'); return; }
      await Security.setPin(p1);
      toast('PIN aktualisiert.', 'success');
      document.getElementById('sPin1').value=''; document.getElementById('sPin2').value='';
    });

    document.getElementById('exportBackup').addEventListener('click', async ()=>{
      const data = {};
      for(const store of STORES) data[store] = await DB.all(store);
      downloadBlob(`kontobuch_backup_${todayISO()}.json`, JSON.stringify(data,null,2), 'application/json');
      toast('Backup exportiert.', 'success');
    });

    document.getElementById('importBackup').addEventListener('change', async (e)=>{
      const file = e.target.files[0];
      if(!file) return;
      if(!confirm('Import fügt Datensätze aus dem Backup hinzu (bestehende IDs werden überschrieben). Fortfahren?')) return;
      const text = await file.text();
      try{
        const data = JSON.parse(text);
        for(const store of STORES){
          if(Array.isArray(data[store])){
            for(const rec of data[store]) await DB.put(store, rec);
          }
        }
        toast('Backup importiert.', 'success');
        App.renderView();
      }catch(err){
        toast('Import fehlgeschlagen: ungültige Datei.', 'error');
      }
    });
  }
};
