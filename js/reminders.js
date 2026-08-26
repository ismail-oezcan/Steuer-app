/* ============================================================
   reminders.js — Fristenmodul
   Berechnet anstehende Termine deterministisch aus dem Kalender
   (keine Push-Benachrichtigungen außerhalb des Browsers möglich —
   die App muss dafür geöffnet sein / ein Tab-Reminder gesetzt werden).
   Fristen sind Richtwerte des allgemeinen Rechts — bei individueller
   Fristverlängerung (z.B. Dauerfristverlängerung, Steuerberater-
   Fristen) bitte manuell anpassen bzw. beim Finanzamt prüfen.
   ============================================================ */

const Reminders = {
  async upcoming(){
    const settings = await Settings.get();
    const today = todayISO();
    const items = [];

    if(!settings.kleinunternehmer){
      // next 3 USt-VA deadlines from today
      const [y0,m0] = today.split('-').map(Number);
      const step = settings.ustva_interval==='vierteljaehrlich' ? 3 : 1;
      for(let i=-1;i<4;i++){
        let m = m0 + i*step, y = y0;
        while(m>12){ m-=12; y+=1; }
        while(m<1){ m+=12; y-=1; }
        const periodKey = `${y}-${String(m).padStart(2,'0')}`;
        const due = USTVA.dueDateFor(periodKey);
        if(due >= today || due === today){
          items.push({
            type:'ust_va',
            title:`USt-Voranmeldung ${periodKey}`,
            due,
            sub: settings.ustva_interval==='vierteljaehrlich' ? 'Vierteljährliche Meldung' : 'Monatliche Meldung',
          });
        }
      }
    }

    // EÜR / Einkommensteuererklärung: general statutory deadline July 31 of the following year
    // (without Steuerberater-Fristverlängerung). Verify current-year deadline with your Finanzamt —
    // exact dates shift (e.g. extensions were granted in recent pandemic years).
    const thisYear = yearOf(today);
    [thisYear-1, thisYear].forEach(taxYear=>{
      const due = `${taxYear+1}-07-31`;
      if(due >= today){
        items.push({
          type:'euer',
          title:`EÜR &amp; Einkommensteuererklärung ${taxYear}`,
          due,
          sub:`Für das Steuerjahr ${taxYear} (allgemeine Regelfrist ohne Steuerberater — bitte aktuellen Stand prüfen)`,
        });
      }
    });

    items.sort((a,b)=> a.due.localeCompare(b.due));
    return items.slice(0,6);
  },

  daysUntil(dateStr){
    const ms = new Date(dateStr) - new Date(todayISO());
    return Math.ceil(ms / 86400000);
  },

  async render(container){
    const items = await this.upcoming();
    container.innerHTML = `
      <div class="disclaimer-box"><strong>Hinweis:</strong> Fristen werden nach allgemeinen gesetzlichen Regelfristen berechnet. Individuelle Verlängerungen (z.B. Dauerfristverlängerung) sind hier nicht berücksichtigt — bitte mit deinem Finanzamt-Bescheid abgleichen.</div>
      ${items.length? items.map(it=>{
        const d = this.daysUntil(it.due);
        const cls = d<=10 ? 'soon' : 'ok';
        return `<div class="reminder-item">
          <div class="reminder-count ${cls}">${d>=0? d : '—'}</div>
          <div class="reminder-body">
            <div class="reminder-title">${it.title}</div>
            <div class="reminder-sub">${it.sub} · fällig am ${fmtDate(it.due)}</div>
          </div>
        </div>`;
      }).join('') : `<div class="card">Keine anstehenden Fristen erkannt.</div>`}
      <p class="timeline-note">Tage bis Fälligkeit werden bei jedem Öffnen der App neu berechnet.</p>
    `;
  }
};
