const EUER_FORM_YEAR = 2025;

const EUER_INCOME_MAP = {
  'Dienstleistung': { line: 15, kz: '112', note: 'steuerpflichtig 19%/7%, netto' },
  'Warenverkauf': { line: 15, kz: '112', note: 'steuerpflichtig 19%/7%, netto' },
  'Lizenzen': { line: 15, kz: '112', note: 'i. d. R. 19%, netto' },
  'Zinsen': { line: 16, kz: '103', note: 'umsatzsteuerfrei, nur betriebliche Zinsen' },
  'Sonstige Betriebseinnahme': { line: 15, kz: '112', note: 'je nach USt-Pflicht ggf. Zeile 16/Kz 103' },
};

const EUER_EXPENSE_MAP = {
  'Wareneinsatz': { line: 27, kz: '100', note: 'Waren, Roh-, Hilfsstoffe' },
  'Bürobedarf': { line: 51, kz: '229', note: 'Sammelzeile Arbeitsmittel' },
  'Software/IT': { line: 50, kz: '228', note: 'laufende EDV-Kosten' },
  'Miete Arbeitsraum': { line: 39, kz: '150', note: 'nur separat angemietete Raeume' },
  'Telefon/Internet': { line: 43, kz: '280', note: 'nur betrieblicher Anteil' },
  'Reisekosten': { line: 44, kz: '221', note: 'nur Uebernachtung/Reisenebenkosten' },
  'Bewirtung': { line: 63, kz: '165/175', note: 'nur 70% abziehbar' },
  'Fortbildung': { line: 45, kz: '281', note: 'ohne Reisekosten' },
  'Versicherungen': { line: 49, kz: '223', note: 'betrieblich, ohne Gebaeude/Kfz' },
  'Werbung/Marketing': { line: 54, kz: '224', note: 'Inserate, Werbespots' },
  'Fahrzeugkosten': { line: 70, kz: '146', note: 'laufende Kosten' },
  'Abschreibung (AfA)': { line: 33, kz: '130', note: 'bewegliche Wirtschaftsgueter' },
  'Beratung/Buchhaltung': { line: 46, kz: '194', note: 'Rechts-/Steuerberatung' },
  'Bankgebühren': { line: 60, kz: '183', note: 'Sammelzeile uebrige Betriebsausgaben' },
  'Sonstige Betriebsausgabe': { line: 60, kz: '183', note: 'Sammelzeile uebrige Betriebsausgaben' },
};

const USTVA_KZ = {
  rate19: '81',
  rate7: '86',
  vorsteuer: '66',
  zahllast: '83',
};
