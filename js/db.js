/* ============================================================
   db.js — thin IndexedDB wrapper.
   Stores mirror the data model:
   customers, invoices, income, expenses, reminders, settings
   Every record gets: id, created_at, updated_at, history[] (append-only
   log of prior versions) and a sha256 integrity hash — a lightweight
   nod toward GoBD's "unveränderbar & nachvollziehbar" requirement.
   This is NOT a certified GoBD archiving system; see README.
   ============================================================ */

const DB_NAME = 'kontobuch_db';
const DB_VERSION = 1;
const STORES = ['customers','invoices','income','expenses','reminders','settings'];

let _dbPromise = null;

function openDB(){
  if(_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e)=>{
      const db = e.target.result;
      STORES.forEach(name=>{
        if(!db.objectStoreNames.contains(name)){
          db.createObjectStore(name, {keyPath:'id'});
        }
      });
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
  return _dbPromise;
}

async function sha256(text){
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

function uid(){
  return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,9);
}

const DB = {
  async put(store, record){
    const db = await openDB();
    const now = new Date().toISOString();
    if(!record.id) record.id = uid();
    if(!record.created_at) record.created_at = now;
    record.updated_at = now;
    record.hash = await sha256(JSON.stringify({...record, hash:undefined, history:undefined}));
    return new Promise((resolve,reject)=>{
      const tx = db.transaction(store,'readwrite');
      tx.objectStore(store).put(record);
      tx.oncomplete = ()=>resolve(record);
      tx.onerror = ()=>reject(tx.error);
    });
  },

  // append-only style update: keeps prior version in history[] instead of overwriting silently
  async update(store, id, patch){
    const existing = await this.get(store, id);
    if(!existing) throw new Error('Datensatz nicht gefunden: '+id);
    const history = existing.history || [];
    const snapshot = {...existing};
    delete snapshot.history;
    history.push(snapshot);
    const updated = {...existing, ...patch, id, history};
    return this.put(store, updated);
  },

  async get(store, id){
    const db = await openDB();
    return new Promise((resolve,reject)=>{
      const tx = db.transaction(store,'readonly');
      const req = tx.objectStore(store).get(id);
      req.onsuccess = ()=>resolve(req.result || null);
      req.onerror = ()=>reject(req.error);
    });
  },

  async all(store){
    const db = await openDB();
    return new Promise((resolve,reject)=>{
      const tx = db.transaction(store,'readonly');
      const req = tx.objectStore(store).getAll();
      req.onsuccess = ()=>resolve(req.result || []);
      req.onerror = ()=>reject(req.error);
    });
  },

  // GoBD-flavored rule: no hard delete on financial records. For customers/settings a real delete is fine.
  async remove(store, id){
    const db = await openDB();
    return new Promise((resolve,reject)=>{
      const tx = db.transaction(store,'readwrite');
      tx.objectStore(store).delete(id);
      tx.oncomplete = ()=>resolve(true);
      tx.onerror = ()=>reject(tx.error);
    });
  },

  async voidRecord(store, id, reason){
    return this.update(store, id, {status:'storniert', void_reason: reason||'', voided_at:new Date().toISOString()});
  }
};
