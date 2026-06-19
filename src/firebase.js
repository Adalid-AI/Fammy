import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase, ref, set, get, onValue } from "firebase/database";

const CFG_KEY = "fammy_firebase_cfg";
export function getFirebaseCfg(){ try{ return JSON.parse(localStorage.getItem(CFG_KEY)||"null"); }catch{ return null; } }
export function saveFirebaseCfg(cfg){ localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }

let _db = null;
export function initDB(){
  const cfg=getFirebaseCfg();
  if(!cfg?.databaseURL) return null;
  try{
    const app=getApps().length?getApp():initializeApp(cfg);
    _db=getDatabase(app); return _db;
  }catch(e){ try{_db=getDatabase();return _db;}catch{return null;} }
}
export async function dbGet(path){
  if(!_db)_db=initDB(); if(!_db)return null;
  try{const s=await get(ref(_db,path));return s.exists()?s.val():null;}catch{return null;}
}
export async function dbSet(path,data){
  if(!_db)_db=initDB(); if(!_db)return false;
  try{await set(ref(_db,path),data);return true;}catch{return false;}
}
export function dbListen(path,cb){
  if(!_db)_db=initDB(); if(!_db)return()=>{};
  return onValue(ref(_db,path),s=>{if(s.exists())cb(s.val());});
}
