// Firebase — delar data mellan alla enheter
// Fungerar även utan Firebase (faller tillbaka på localStorage)

const CFG_KEY = "fammy_firebase_cfg";

export function getFirebaseCfg(){
  try{ return JSON.parse(localStorage.getItem(CFG_KEY)||"null"); }
  catch{ return null; }
}
export function saveFirebaseCfg(cfg){
  try{ localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }catch{}
}

let _db = null;
let _firebase = null;

async function loadFirebase(){
  if(_firebase) return _firebase;
  try{
    _firebase = await import("firebase/app");
    return _firebase;
  }catch(e){ console.warn("Firebase not available"); return null; }
}

export async function initDB(){
  const cfg = getFirebaseCfg();
  if(!cfg?.databaseURL) return null;
  try{
    const fb = await loadFirebase();
    if(!fb) return null;
    const { initializeApp, getApps, getApp } = fb;
    const { getDatabase } = await import("firebase/database");
    const app = getApps().length ? getApp() : initializeApp(cfg);
    _db = getDatabase(app);
    return _db;
  }catch(e){ console.warn("Firebase init failed:", e); return null; }
}

export async function dbGet(path){
  try{
    if(!_db) await initDB();
    if(!_db) return null;
    const { ref, get } = await import("firebase/database");
    const snap = await get(ref(_db, path));
    return snap.exists() ? snap.val() : null;
  }catch(e){ console.warn("dbGet failed:", e); return null; }
}

export async function dbSet(path, data){
  try{
    if(!_db) await initDB();
    if(!_db) return false;
    const { ref, set } = await import("firebase/database");
    await set(ref(_db, path), data);
    return true;
  }catch(e){ console.warn("dbSet failed:", e); return false; }
}

export function dbListen(path, cb){
  // Only set up listener if Firebase is configured
  if(!getFirebaseCfg()?.databaseURL) return ()=>{};
  let unsubscribe = ()=>{};
  (async()=>{
    try{
      if(!_db) await initDB();
      if(!_db) return;
      const { ref, onValue } = await import("firebase/database");
      unsubscribe = onValue(ref(_db, path), snap => {
        try{ if(snap.exists()) cb(snap.val()); }catch{}
      });
    }catch(e){ console.warn("dbListen failed:", e); }
  })();
  return ()=>{ try{ unsubscribe(); }catch{} };
}
