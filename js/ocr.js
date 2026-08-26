/* ============================================================
   ocr.js — Texterkennung für Belegfotos via Tesseract.js (CDN).
   Extraktion ist heuristisch (Regex) — IMMER manuell prüfen, bevor
   der Beleg in die EÜR einfließt. Läuft im Browser, das Modell wird
   beim ersten Gebrauch aus dem Netz geladen (danach gecacht).
   ============================================================ */

const OCR = {
  async recognizeReceipt(dataUrl){
    if(typeof Tesseract === 'undefined'){
      throw new Error('Tesseract.js nicht geladen');
    }
    const { data } = await Tesseract.recognize(dataUrl, 'deu+eng', { logger: ()=>{} });
    const text = data.text || '';
    return {
      text,
      amount: this.extractAmount(text),
      date: this.extractDate(text),
      vendor: this.extractVendor(text),
    };
  },

  // Looks for the largest plausible currency amount on the receipt —
  // typically the total. Heuristic only.
  extractAmount(text){
    const matches = [...text.matchAll(/(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*(?:€|EUR)?/g)]
      .map(m=>m[1])
      .map(s=> s.includes(',') && s.lastIndexOf(',')>s.lastIndexOf('.')
                ? s.replace(/\./g,'').replace(',','.')
                : s.replace(/,/g,''))
      .map(Number)
      .filter(n=>!isNaN(n) && n>0 && n<100000);
    if(!matches.length) return null;
    return Math.max(...matches).toFixed(2);
  },

  extractDate(text){
    const m = text.match(/\b(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})\b/);
    if(!m) return null;
    let [_, d, mo, y] = m;
    if(y.length===2) y = '20'+y;
    d = d.padStart(2,'0'); mo = mo.padStart(2,'0');
    const iso = `${y}-${mo}-${d}`;
    return isNaN(new Date(iso).getTime()) ? null : iso;
  },

  // First non-empty, reasonably-lettered line is often the shop name on German receipts.
  extractVendor(text){
    const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);
    for(const line of lines.slice(0,5)){
      if(/[a-zA-ZÄÖÜäöüß]{3,}/.test(line) && !/rechnung|beleg|quittung/i.test(line)){
        return line.slice(0,60);
      }
    }
    return null;
  }
};
