const ExportFiles = {
   euerCsv(r){
      const lines = [['Kategorie','Typ','Anlage-EUER-Zeile','Kennziffer (Kz)','Netto (EUR)']];
      Object.entries(r.incomeByCat).forEach(([c,v])=>{
         const m = EUER_INCOME_MAP[c] || {};
         lines.push([c,'Einnahme', m.line??'', m.kz??'', v.toFixed(2)]);
      });
      Object.entries(r.expenseByCat).forEach(([c,v])=>{
         const m = EUER_EXPENSE_MAP[c] || {};
         lines.push([c,'Ausgabe', m.line??'', m.kz??'', v.toFixed(2)]);
      });
      lines.push(['Summe Einnahmen','','','', r.incomeNet.toFixed(2)]);
      lines.push(['Summe Ausgaben','','','', r.expenseNet.toFixed(2)]);
      lines.push(['Gewinn/Verlust','','','', r.profit.toFixed(2)]);
      lines.push([]);
      lines.push(['Elster-Uebertragstabelle (nach Kennziffer zusammengefasst)']);
      lines.push(['Kz','Zeile','Typ','Enthaelt','Netto (EUR)']);
      EUER.kzSummary(r).forEach(row=>{
         lines.push([row.kz, row.line, row.kind, row.categories.join(', '), row.sum.toFixed(2)]);
      });
      lines.push([]);
      lines.push(['Formularjahr Anlage EUER', EUER_FORM_YEAR]);
      lines.push(['Hinweis','Vorbereitende Aufstellung, keine Steuerberatung. Vor Abgabe gegen aktuelle amtliche Anlage EUER pruefen.']);
      const csv = lines.map(row=>row.map(csvEscape).join(';')).join('\n');
      downloadBlob(`EUER_${r.year}.csv`, '\uFEFF'+csv, 'text/csv;charset=utf-8');
      toast('EUER-CSV mit Kennziffern exportiert.', 'success');
   },

   euerPdf(r){
      if(typeof window.jspdf === 'undefined'){ toast('PDF-Bibliothek nicht geladen.', 'error'); return; }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      let y=20;
      doc.setFontSize(16); doc.text(`Einnahmen-Ueberschuss-Rechnung ${r.year}`, 14, y); y+=8;
      doc.setFontSize(9); doc.setTextColor(120);
      doc.text('Vorbereitende Aufstellung, kein amtliches Formular. Bitte in Elster / Anlage EUER uebertragen.', 14, y); y+=10;
      doc.setTextColor(20); doc.setFontSize(11);
      doc.text('Betriebseinnahmen', 14, y); y+=6;
      doc.setFontSize(10);
      Object.entries(r.incomeByCat).forEach(([c,v])=>{
         const m = EUER_INCOME_MAP[c];
         doc.text(c + (m?`  (Zeile ${m.line} Kz ${m.kz})`:''), 16, y); doc.text(fmtMoney(v), 182, y); y+=6;
      });
      doc.setFontSize(10.5); doc.text('Summe Einnahmen', 16, y); doc.text(fmtMoney(r.incomeNet), 182, y); y+=10;

   doc.setFontSize(11); doc.text('Betriebsausgaben', 14, y); y+=6;
      doc.setFontSize(10);
      Object.entries(r.expenseByCat).forEach(([c,v])=>{
         const m = EUER_EXPENSE_MAP[c];
         doc.text(c + (m?`  (Zeile ${m.line} Kz ${m.kz})`:''), 16, y); doc.text(fmtMoney(v), 182, y); y+=6;
      });
      doc.setFontSize(10.5); doc.text('Summe Ausgaben', 16, y); doc.text(fmtMoney(r.expenseNet), 182, y); y+=10;

   doc.setDrawColor(20); doc.line(14,y,196,y); y+=8;
      doc.setFontSize(13); doc.text('Gewinn / Verlust', 14, y); doc.text(fmtMoney(r.profit), 182, y); y+=12;

   doc.setFontSize(8); doc.setTextColor(120);
      doc.text(`Formularjahr Anlage EUER ${EUER_FORM_YEAR}. Vorbereitende Aufstellung, keine Steuerberatung, vor Abgabe gegen die aktuelle amtliche Anlage EUER pruefen.`, 14, 285);

   doc.save(`EUER_${r.year}.pdf`);
      toast('EUER-PDF exportiert.', 'success');
   },

   ustvaCsv(r){
      const lines = [
         ['Zeitraum', r.periodKey],
         ['Besteuerungsart', r.basis==='ist'?'Ist-Versteuerung':'Soll-Versteuerung'],
         [],
         ['Kz','Bezeichnung','Wert (EUR)'],
         [r.kz.rate19, 'Steuerpflichtige Umsaetze 19% (netto)', r.net19.toFixed(2)],
         [r.kz.rate7, 'Steuerpflichtige Umsaetze 7% (netto)', r.net7.toFixed(2)],
         [r.kz.vorsteuer, 'Abziehbare Vorsteuer (Steuerbetrag)', r.vatPaid.toFixed(2)],
         [r.kz.zahllast, r.balance>=0?'Zahllast':'Erstattung', Math.abs(r.balance).toFixed(2)],
         [],
         ['Faellig am', r.dueDate],
         ['Hinweis','Vorbereitende Aufstellung, keine Steuerberatung. Vor Abgabe gegen aktuellen amtlichen USt-VA-Vordruck pruefen.'],
         ];
      const csv = lines.map(row=>row.map(csvEscape).join(';')).join('\n');
      downloadBlob(`USt-VA_${r.periodKey}.csv`, '\uFEFF'+csv, 'text/csv;charset=utf-8');
      toast('USt-VA-CSV exportiert.', 'success');
   }
};
