/* ============================================================
   exportfiles.js — CSV/PDF export helpers for EÜR and USt-VA
   ============================================================ */

const ExportFiles = {
  euerCsv(r){
    const lines = [['Kategorie','Typ','Netto (EUR)']];
    Object.entries(r.incomeByCat).forEach(([c,v])=> lines.push([c,'Einnahme', v.toFixed(2)]));
    Object.entries(r.expenseByCat).forEach(([c,v])=> lines.push([c,'Ausgabe', v.toFixed(2)]));
    lines.push(['Summe Einnahmen','', r.incomeNet.toFixed(2)]);
    lines.push(['Summe Ausgaben','', r.expenseNet.toFixed(2)]);
    lines.push(['Gewinn/Verlust','', r.profit.toFixed(2)]);
    const csv = lines.map(row=>row.map(csvEscape).join(';')).join('\n');
    downloadBlob(`EUER_${r.year}.csv`, '\uFEFF'+csv, 'text/csv;charset=utf-8');
    toast('EÜR-CSV exportiert.', 'success');
  },

  euerPdf(r){
    if(typeof window.jspdf === 'undefined'){ toast('PDF-Bibliothek nicht geladen.', 'error'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y=20;
    doc.setFontSize(16); doc.text(`Einnahmen-Überschuss-Rechnung ${r.year}`, 14, y); y+=8;
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text('Vorbereitende Aufstellung — kein amtliches Formular. Bitte in Elster / Anlage EÜR übertragen.', 14, y); y+=10;
    doc.setTextColor(20); doc.setFontSize(11);
    doc.text('Betriebseinnahmen', 14, y); y+=6;
    doc.setFontSize(10);
    Object.entries(r.incomeByCat).forEach(([c,v])=>{ doc.text(c, 16, y); doc.text(fmtMoney(v), 182, y); y+=6; });
    doc.setFontSize(10.5); doc.text('Summe Einnahmen', 16, y); doc.text(fmtMoney(r.incomeNet), 182, y); y+=10;

    doc.setFontSize(11); doc.text('Betriebsausgaben', 14, y); y+=6;
    doc.setFontSize(10);
    Object.entries(r.expenseByCat).forEach(([c,v])=>{ doc.text(c, 16, y); doc.text(fmtMoney(v), 182, y); y+=6; });
    doc.setFontSize(10.5); doc.text('Summe Ausgaben', 16, y); doc.text(fmtMoney(r.expenseNet), 182, y); y+=10;

    doc.setDrawColor(20); doc.line(14,y,196,y); y+=8;
    doc.setFontSize(13); doc.text('Gewinn / Verlust', 14, y); doc.text(fmtMoney(r.profit), 182, y);

    doc.save(`EUER_${r.year}.pdf`);
    toast('EÜR-PDF exportiert.', 'success');
  },

  ustvaCsv(r){
    const lines = [
      ['Zeitraum', r.periodKey],
      ['Besteuerungsart', r.basis==='ist'?'Ist-Versteuerung':'Soll-Versteuerung'],
      ['Umsatz netto', r.baseNet.toFixed(2)],
      ['Umsatzsteuer', r.vatCollected.toFixed(2)],
      ['Ausgaben netto', r.expenseNet.toFixed(2)],
      ['Vorsteuer', r.vatPaid.toFixed(2)],
      [r.balance>=0?'Zahllast':'Erstattung', Math.abs(r.balance).toFixed(2)],
      ['Fällig am', r.dueDate],
    ];
    const csv = lines.map(row=>row.map(csvEscape).join(';')).join('\n');
    downloadBlob(`USt-VA_${r.periodKey}.csv`, '\uFEFF'+csv, 'text/csv;charset=utf-8');
    toast('USt-VA-CSV exportiert.', 'success');
  }
};
