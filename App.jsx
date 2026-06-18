import { useState, useEffect, useRef } from "react";
import { initDB, dbGet, dbSet, dbListen, getFirebaseCfg, saveFirebaseCfg } from "./firebase.js";

// ─── Data & Storage ───────────────────────────────────────────────────────────
const SUMMER_WEEKS = Array.from({length:16},(_,i)=>i+22);
const ALL_COLORS   = ["#FF6B6B","#4FC3F7","#66BB6A","#FFB74D","#CE93D8","#4DB6AC","#F06292","#FF8A65"];
const ALL_EMOJIS   = ["👩","👨","👧","👦","👴","👵","🧒","🧑"];
const USERS_KEY    = "fam_users_v4";
const ACTS_KEY     = "fam_acts_v4";
const CHAT_KEY     = "fam_chat_v2";
const SESSION_KEY  = "fam_session_v1";
const EMOJI_LIST   = ["😀","😂","🥰","😍","🤩","😎","🥳","😜","🤔","😅","😭","😱","🙌","👏","🎉","❤️","🔥","✨","👍","🙏","💪","🤣","😊","😇","🥹","😋","😴","🤯","💀","👻","🎂","🍕","🍦","☀️","⭐","🌈","🏖️","⛺","🚀","🎮","🎵","💃","🕺","🦁","🐶","🌸","🍀","🏆","💎"];

const lsGet = k=>{try{const r=localStorage.getItem(k);return r?JSON.parse(r):null;}catch{return null;}};
const lsSet = (k,d)=>{try{localStorage.setItem(k,JSON.stringify(d));}catch{}};

// ─── Email via EmailJS ────────────────────────────────────────────────────────
const EMAIL_CFG_KEY = "fammy_email_cfg";
function getEmailCfg(){ return lsGet(EMAIL_CFG_KEY)||{serviceId:"",templateId:"",publicKey:"",enabled:false}; }

async function sendEmail(toEmail, toName, subject, message){
  const cfg = getEmailCfg();
  if(!cfg.enabled||!cfg.serviceId||!cfg.templateId||!cfg.publicKey) return false;
  try {
    if(!window.emailjs) return false;
    await window.emailjs.send(cfg.serviceId, cfg.templateId, {
      to_email:  toEmail,
      to_name:   toName,
      subject:   subject,
      message:   message,
      from_name: "Fammy ☀️",
      reply_to:  "noreply@fammy.app",
    }, cfg.publicKey);
    return true;
  } catch(e){ console.error("Email error:",e); return false; }
}

async function loadEmailJS(){
  if(window.emailjs) return;
  return new Promise((res,rej)=>{
    const s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
    s.onload=res; s.onerror=rej;
    document.head.appendChild(s);
  });
}

const FIRST_ADMIN = {id:"admin_root",name:"Marcelo Adalid",email:"adalid.marcelo@gmail.com",password:"Admin",role:"admin",emoji:"👨",color:"#FF6B6B",freeWeeks:[],birthday:"",photo:null,createdAt:new Date().toISOString()};

const PRESET_ACTS = [
  {id:"a1",title:"Badresa Gotland",emoji:"🏖️",plats:"Gotland, Sverige",desc:"Färja till Gotland — kalkstensformationer och kristallklart hav.",votes:{},status:"proposed",date:"",endDate:"",time:""},
  {id:"a2",title:"Fjällsemester",emoji:"⛺",plats:"Jämtlands fjäll",desc:"Vandring, fiske och midnattssol i Jämtlands fjäll.",votes:{},status:"proposed",date:"",endDate:"",time:""},
  {id:"a3",title:"Vattenpark",emoji:"🌊",plats:"",desc:"Heldagsäventyr med rutschkanor och barnpool!",votes:{},status:"proposed",date:"",endDate:"",time:""},
  {id:"a4",title:"Liseberg",emoji:"🎢",cat:"Skoj",desc:"Sveriges bästa nöjespark — perfekt för hela familjen.",votes:{},status:"proposed",date:"",endDate:"",time:""},
  {id:"a5",title:"Cykeltur Öland",emoji:"🚴",plats:"Öland, Sverige",desc:"Cykla längs Alvarets UNESCO-landskap och stränder.",votes:{},status:"proposed",date:"",endDate:"",time:""},
  {id:"a6",title:"Stugvecka vid sjö",emoji:"🏡",plats:"",desc:"Paddla kanot, grilla på bryggan, fiska gädda.",votes:{},status:"proposed",date:"",endDate:"",time:""},
  {id:"a7",title:"Utlandsresa",emoji:"✈️",plats:"Europa",desc:"Charter till Kroatien, Spanien eller Grekland.",votes:{},status:"proposed",date:"",endDate:"",time:""},
  {id:"a8",title:"Skansen & Stockholm",emoji:"🦁",plats:"Stockholm",desc:"Skansen, Junibacken och ABBA-museet i Stockholm.",votes:{},status:"proposed",date:"",endDate:"",time:""},
];

function weekDates(w){const d=new Date(2026,0,1+(w-1)*7),dow=d.getDay();d.setDate(d.getDate()-(dow<=4?dow-1:dow-8));const e=new Date(d);e.setDate(e.getDate()+6);return`${d.getDate()}/${d.getMonth()+1}–${e.getDate()}/${e.getMonth()+1}`;}
function scoreVotes(votes,total){const y=Object.values(votes).filter(v=>v==="yes").length,n=Object.values(votes).filter(v=>v==="no").length,h=Math.max(1,Math.ceil(total/2));return y>=h?"approved":n>=h?"rejected":"proposed";}
function daysUntil(b){const now=new Date();now.setHours(0,0,0,0);const d=new Date(b);const n=new Date(now.getFullYear(),d.getMonth(),d.getDate());if(n<now)n.setFullYear(now.getFullYear()+1);return Math.round((n-now)/864e5);}
function calcAge(b){return Math.floor((Date.now()-new Date(b))/(864e5*365.25));}
function fmtBday(b){const d=new Date(b);return`${d.getDate()} ${d.toLocaleString("sv-SE",{month:"long"})}`;}

// ─── Design System ────────────────────────────────────────────────────────────
const T = {
  sky:    "#0EA5E9",
  skyL:   "#E0F2FE",
  skyD:   "#0284C7",
  coral:  "#FF6B6B",
  coralL: "#FFF0F0",
  mint:   "#34D399",
  mintL:  "#D1FAE5",
  sun:    "#FBBF24",
  sunL:   "#FEF3C7",
  plum:   "#A855F7",
  plumL:  "#F3E8FF",
  rose:   "#F43F5E",
  roseL:  "#FFE4E6",
  bg:     "#F0F9FF",
  card:   "#FFFFFF",
  text:   "#0F172A",
  sub:    "#64748B",
  border: "#E2E8F0",
};

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Outfit',sans-serif;background:${T.bg}}
button{cursor:pointer;border:none;background:none;font-family:inherit}
input,select,textarea{font-family:inherit}
.card{background:white;border-radius:20px;padding:18px;box-shadow:0 2px 16px rgba(14,165,233,.08)}
.tap{transition:transform .15s,opacity .15s}
.tap:active{transform:scale(.96);opacity:.85}
.bounce{transition:transform .2s cubic-bezier(.34,1.56,.64,1)}
.bounce:hover{transform:translateY(-3px)}
.bounce:active{transform:scale(.95)}
.wk{transition:all .18s cubic-bezier(.34,1.56,.64,1);cursor:pointer;user-select:none}
.wk:hover{transform:scale(1.1)}
.wk:active{transform:scale(.9)}
.fade{animation:fd .3s ease-out}
@keyframes fd{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.pop{animation:pp .3s cubic-bezier(.34,1.56,.64,1)}
@keyframes pp{from{opacity:0;transform:scale(.85)}to{opacity:1;transform:scale(1)}}
.overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);z-index:300;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px)}
.sheet{background:white;border-radius:28px 28px 0 0;width:100%;max-width:620px;padding:28px 22px 48px;max-height:90vh;overflow-y:auto}
.pill{display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:100px;font-size:11px;font-weight:700}
::-webkit-scrollbar{width:0}
`;

const FINP = (x={})=>({width:"100%",padding:"13px 16px",borderRadius:14,border:`2px solid ${T.border}`,fontSize:15,outline:"none",fontFamily:"Outfit,sans-serif",...x});
const PBtn = (bg,p="14px",fs="15px")=>({padding:p,borderRadius:14,background:bg,color:"white",fontWeight:800,fontSize:fs,border:"none",fontFamily:"Outfit,sans-serif",boxShadow:`0 4px 14px rgba(0,0,0,.15)`});

// ─── Shared Components ────────────────────────────────────────────────────────
function Avatar({emoji,color,size=44,photo}){
  const r=Math.round(size*.32);
  if(photo)return <img src={photo} style={{width:size,height:size,borderRadius:r,objectFit:"cover",flexShrink:0,border:`3px solid ${color}40`}}/>;
  return <div style={{width:size,height:size,borderRadius:r,background:`${color}18`,border:`3px solid ${color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.5,flexShrink:0}}>{emoji}</div>;
}
function Badge({bg,col,children}){return <span className="pill" style={{background:bg,color:col}}>{children}</span>;}
function Label({children,color=T.sub}){return <label style={{fontSize:11,fontWeight:700,color,letterSpacing:1.2,textTransform:"uppercase",display:"block",marginBottom:6}}>{children}</label>;}
function ErrBox({msg}){return <div style={{background:T.roseL,border:`1.5px solid #FDA4AF`,borderRadius:12,padding:"11px 14px",fontSize:13,color:T.rose,fontWeight:700,marginBottom:14}}>⚠️ {msg}</div>;}
function EmojiPicker({value,onChange}){return <div style={{marginBottom:14}}><Label>EMOJI</Label><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{ALL_EMOJIS.map(e=><button key={e} className="tap" onClick={()=>onChange(e)} style={{width:44,height:44,borderRadius:13,fontSize:22,background:value===e?T.sunL:"#F8FAFC",border:`2px solid ${value===e?T.sun:T.border}`,transition:"all .15s"}}>{e}</button>)}</div></div>;}
function ColorPicker({value,onChange}){return <div style={{marginBottom:4}}><Label>FÄRG</Label><div style={{display:"flex",gap:10,flexWrap:"wrap"}}>{ALL_COLORS.map(c=><button key={c} className="bounce" onClick={()=>onChange(c)} style={{width:36,height:36,borderRadius:"50%",background:c,border:`3px solid ${value===c?"#1E293B":T.border}`,transform:value===c?"scale(1.2)":"scale(1)"}}/>)}</div></div>;}
function Toast({msg}){if(!msg)return null;return <div style={{position:"fixed",top:74,left:"50%",transform:"translateX(-50%)",background:T.text,color:"white",padding:"10px 20px",borderRadius:14,fontWeight:700,fontSize:13,zIndex:999,whiteSpace:"nowrap",boxShadow:"0 8px 24px rgba(15,23,42,.3)"}}>{msg}</div>;}

function SectionHeader({icon,title,color=T.sky,action}){
  return <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:36,height:36,borderRadius:12,background:`${color}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{icon}</div>
      <div style={{fontWeight:800,fontSize:18,color:T.text}}>{title}</div>
    </div>
    {action}
  </div>;
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App(){
  const [screen,setScreen]=useState("loading");
  const [users,setUsers]=useState([]);
  const [acts,setActs]=useState([]);
  const [messages,setMessages]=useState([]);
  const [session,setSession]=useState(null);
  const [toast,setToast]=useState("");

  useEffect(()=>{
    let u=lsGet(USERS_KEY);
    if(!u||!u.length)u=[FIRST_ADMIN];
    else if(!u.find(x=>x.email===FIRST_ADMIN.email))u=[FIRST_ADMIN,...u];
    u=u.map(x=>({freeWeeks:[],birthday:"",photo:null,type:x.role==="child"?"child":"adult",...x}));
    setUsers(u);lsSet(USERS_KEY,u);
    let a=lsGet(ACTS_KEY);
    if(!a||!a.length)a=PRESET_ACTS;
    setActs(a);lsSet(ACTS_KEY,a);
    const m=lsGet(CHAT_KEY)||[];
    setMessages(m);
    const saved = lsGet(SESSION_KEY);
    if(saved && u.find(x=>x.id===saved.userId && x.type!=="child")){
      setSession(saved); setScreen("app");
    } else {
      setScreen("login");
    }
  },[]);

  function saveUsers(u){setUsers(u);lsSet(USERS_KEY,u);const obj={};u.forEach(x=>{obj[x.id]=x;});dbSet("users",obj);}
  function saveActs(a){setActs(a);lsSet(ACTS_KEY,a);const obj={};a.forEach(x=>{obj[x.id]=x;});dbSet("acts",obj);}
  function addMsg(msg){const next=[...messages,msg];setMessages(next);lsSet(CHAT_KEY,next);const obj={};next.forEach(x=>{obj[x.id]=x;});dbSet("messages",obj);}
  function showToast(msg){setToast(msg);setTimeout(()=>setToast(""),2600);}
  function login(email,pass){const u=users.find(x=>x.type!=='child'&&x.email&&x.email.toLowerCase()===email.toLowerCase()&&x.password===pass);if(!u)return false;const s={userId:u.id,role:u.role,name:u.name,email:u.email,emoji:u.emoji,color:u.color,photo:u.photo||null};setSession(s);lsSet(SESSION_KEY,s);setScreen("app");return true;}
  function logout(){setSession(null);lsSet(SESSION_KEY,null);setScreen("login");}
  function register(name,email,pass,emoji,color,photo){if(users.find(u=>u.email.toLowerCase()===email.toLowerCase()))return"E-posten används redan.";const u={id:"u_"+Date.now(),name,email,password:pass,role:"user",emoji,color,photo:photo||null,freeWeeks:[],birthday:"",createdAt:new Date().toISOString()};saveUsers([...users,u]);setSession({userId:u.id,role:"user",name,email,emoji,color,photo:photo||null});setScreen("app");return null;}
  function updateSession(f){setSession(s=>{const next={...s,...f};lsSet(SESSION_KEY,next);return next;});}

  if(screen==="loading")return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:T.bg}}><style>{CSS+"@keyframes spin{to{transform:rotate(360deg)}}"}</style><div style={{fontSize:56,animation:"spin 2s linear infinite"}}>☀️</div></div>;
  if(screen==="login")return <LoginScreen onLogin={login} toast={toast}/>;

  return <MainApp users={users} saveUsers={saveUsers} acts={acts} saveActs={saveActs} messages={messages} addMsg={addMsg} session={session} updateSession={updateSession} onLogout={logout} showToast={showToast} toast={toast}/>;
}

// ─── Login ────────────────────────────────────────────────────────────────────
function LoginScreen({onLogin,toast}){
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [err,setErr]=useState("");
  const [busy,setBusy]=useState(false);
  function submit(){setErr("");setBusy(true);setTimeout(()=>{if(!onLogin(email.trim(),pass))setErr("Fel e-post eller lösenord.");setBusy(false);},380);}
  return(
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,${T.sky} 0%,#0284C7 45%,${T.plum} 100%)`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"Outfit,sans-serif"}}>
      <style>{CSS}</style><Toast msg={toast}/>
      <div className="fade" style={{width:"100%",maxWidth:380}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:40}}>
          <div style={{fontSize:56,marginBottom:16,filter:"drop-shadow(0 4px 12px rgba(0,0,0,.2))"}}>☀️</div>
          <div style={{fontSize:64,fontWeight:900,color:"white",letterSpacing:-2,lineHeight:.9,textShadow:"0 4px 24px rgba(0,0,0,.2)"}}>Fammy</div>
        </div>
        {/* Card */}
        <div style={{background:"rgba(255,255,255,.97)",borderRadius:28,padding:"28px 24px",boxShadow:"0 24px 60px rgba(0,0,0,.3)"}}>
          <div style={{marginBottom:14}}>
            <Label>E-POST</Label>
            <input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="din@epost.se" style={FINP({fontSize:15})} onKeyDown={e=>e.key==="Enter"&&submit()} onFocus={e=>e.target.style.borderColor=T.sky} onBlur={e=>e.target.style.borderColor=T.border}/>
          </div>
          <div style={{marginBottom:20}}>
            <Label>LÖSENORD</Label>
            <input value={pass} onChange={e=>setPass(e.target.value)} type="password" placeholder="••••••••" style={FINP({fontSize:15})} onKeyDown={e=>e.key==="Enter"&&submit()} onFocus={e=>e.target.style.borderColor=T.sky} onBlur={e=>e.target.style.borderColor=T.border}/>
          </div>
          {err&&<ErrBox msg={err}/>}
          <button className="bounce tap" onClick={submit} disabled={busy}
            style={{...PBtn(`linear-gradient(135deg,${T.sky},${T.plum})`,"14px","16px"),width:"100%",opacity:busy?.7:1}}>
            {busy?"Loggar in…":"Logga in →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
function MainApp({users,saveUsers,acts,saveActs,messages,addMsg,session,updateSession,onLogout,showToast,toast}){
  const [tab,setTab]=useState("home");
  const [modal,setModal]=useState(null);
  const [confirmDel,setConfirmDel]=useState(null);
  const [na,setNa]=useState({title:"",emoji:"🌟",cat:"Äventyr",desc:"",date:"",duration:"",visibleTo:[]});
  const ssRef=useRef();

  function canSeeActivity(a,s){return !s||s.role==="admin"||!a.visibleTo||a.visibleTo.length===0||a.visibleTo.includes(s.userId)||a.suggestedBy===s.userId;}

  const notifRef=useRef({seenActs:new Set(lsGet("fammy_seen_acts")||[])});

  // Define early so useEffects can reference it
  const canSeeActivity=(a,s)=>!s||s.role==="admin"||!a.visibleTo||a.visibleTo.length===0||a.visibleTo.includes(s.userId)||a.suggestedBy===s.userId;


  useEffect(()=>{clearTimeout(ssRef.current);ssRef.current=setTimeout(()=>{lsSet(USERS_KEY,users);},600);},[users]);

  // ── Request notification permission once
  useEffect(()=>{
    if("Notification" in window && Notification.permission==="default"){
      Notification.requestPermission();
    }
  },[]);

  function notify(title, body, icon="☀️"){
    if("Notification" in window && Notification.permission==="granted"){
      new Notification(title,{body,icon:"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>"+icon+"</text></svg>"});
    }
  }

  // ── Check for new activities and unvoted on load & when acts change
  useEffect(()=>{
    if(!session?.userId) return;
    const seen = notifRef.current.seenActs;
    const myActs = acts.filter(a=>canSeeActivity(a,session));

    myActs.forEach(a=>{
      if(!seen.has(a.id)&&a.suggestedBy!==session.userId){
        notify("Nytt förslag! 🎯",`${a.emoji} ${a.title} har lagts till — rösta nu!`,"🎯");
        seen.add(a.id);
      }
    });

    // Remind about unvoted (only once per session via ref)
    if(!notifRef.current.remindedUnvoted){
      const unvoted=myActs.filter(a=>a.status==="proposed"&&!a.votes?.[session.userId]);
      if(unvoted.length>0){
        setTimeout(()=>{
          notify(`${unvoted.length} aktivitet${unvoted.length>1?"er":""}  väntar på din röst 🗳️`,
            unvoted.map(a=>a.emoji+" "+a.title).join(", "));
        },3000);
        notifRef.current.remindedUnvoted=true;
      }
    }

    lsSet("fammy_seen_acts",[...seen]);
  },[acts,session?.userId]);

  // ── Birthday notifications on load
  useEffect(()=>{
    if(!session?.userId) return;
    const todayKey="fammy_bday_notif_"+new Date().toDateString();
    if(lsGet(todayKey)) return;
    const todayBdays=users.filter(u=>u.birthday&&daysUntil(u.birthday)===0&&u.id!==session.userId);
    if(todayBdays.length>0){
      todayBdays.forEach(u=>{
        notify(`🎂 Grattis ${u.name}!`,`${u.name} fyller ${calcAge(u.birthday)+1} år idag — skicka en hälsning!`,"🎂");
      });
      lsSet(todayKey,true);
    }
    // Upcoming in 1 day
    const tmrw=users.filter(u=>u.birthday&&daysUntil(u.birthday)===1&&u.id!==session.userId);
    if(tmrw.length>0){
      setTimeout(()=>{
        notify(`🎈 Imorgon fyller ${tmrw[0].name} år!`,`Missa inte att önska grattis!`,"🎈");
      },5000);
    }
  },[session?.userId]);


  // ── Load EmailJS on mount
  useEffect(()=>{ loadEmailJS().catch(()=>{}); },[]);

  // ── Send email notifications
  async function emailNotify(subject, message, toUsers){
    const cfg = getEmailCfg();
    if(!cfg.enabled) return;
    for(const u of toUsers){
      if(u.email && u.type!=="child") {
        await sendEmail(u.email, u.name, subject, message);
      }
    }
  }

  // ── Badge counts
  const myVisibleActs = acts.filter(a=>canSeeActivity(a,session));
  const unvotedCount  = myVisibleActs.filter(a=>a.status==="proposed"&&!a.votes?.[session?.userId]).length;
  const todayBdayCount= users.filter(u=>u.birthday&&daysUntil(u.birthday)===0).length;
  const newMsgCount   = (() => {
    const lastSeen = lsGet("fammy_last_msg_seen_"+session?.userId) || 0;
    return messages.filter(m=>m.ts>lastSeen&&m.userId!==session?.userId).length;
  })();

  const members=users;
  const overlap=SUMMER_WEEKS.filter(w=>members.length>0&&members.every(u=>u.freeWeeks.includes(w)));
  const partial=SUMMER_WEEKS.filter(w=>members.some(u=>u.freeWeeks.includes(w)));
  const approved=acts.filter(a=>a.status==="approved"&&canSeeActivity(a,session));

  function toggleWeek(uid,week){saveUsers(users.map(u=>{if(u.id!==uid)return u;const has=u.freeWeeks.includes(week);return{...u,freeWeeks:has?u.freeWeeks.filter(w=>w!==week):[...u.freeWeeks,week].sort((a,b)=>a-b)};}));}
  function castVote(actId,val){const uid=session?.userId;if(!uid)return;saveActs(acts.map(a=>{if(a.id!==actId)return a;const votes={...a.votes,[uid]:a.votes[uid]===val?null:val};return{...a,votes,status:scoreVotes(votes,members.length)};}));}
  function addActivity(){if(!na.title.trim())return;const a={id:"a_"+Date.now(),...na,title:na.title.trim(),plats:na.plats?.trim()||"",votes:{},status:"proposed",suggestedBy:session?.userId,visibleTo:na.visibleTo,time:na.time,endDate:na.endDate};saveActs([...acts,a]);
    const emailTargets=users.filter(u=>u.id!==session?.userId&&u.type!=="child"&&(!a.visibleTo||a.visibleTo.length===0||a.visibleTo.includes(u.id)));
    emailNotify(`🎯 Nytt förslag: ${a.emoji} ${a.title}`,`Hej!\n\n${session?.name} har lagt till ett nytt aktivitetsförslag i Fammy:\n\n${a.emoji} ${a.title}\n${a.desc||""}\n${a.plats?"📍 "+a.plats:""}\n${a.date?"📅 "+new Date(a.date).toLocaleDateString("sv-SE"):""}\n\nLogga in i Fammy och rösta! ☀️`,emailTargets);
    setNa({title:"",emoji:"🌟",cat:"Äventyr",desc:"",date:"",duration:"",visibleTo:[]});setModal(null);showToast("Förslag tillagt! 🎉");}
  function removeActivity(id){saveActs(acts.filter(a=>a.id!==id));}
  function sendMessage(text,gif){if(!text.trim()&&!gif)return;const msg={id:"msg_"+Date.now(),userId:session?.userId,name:session?.name,emoji:session?.emoji,color:session?.color,photo:session?.photo||null,text:text.trim(),gif:gif||null,ts:Date.now()};addMsg(msg);}
  function sendBirthdayGreeting(user){
    const text=`🎂 Grattis på födelsedagen ${user.name}! 🎉 Hoppas du får en fantastisk dag! 🥳`;
    sendMessage(text,null); setTab("chat"); showToast("Hälsning skickad! 🎂");
  }

  function onTabChange(t){
    if(t==="chat") lsSet("fammy_last_msg_seen_"+session?.userId, Date.now());
    setTab(t);
  }

  const TABS=[
    {id:"home",      icon:"🏠", label:"Hem",        badge:0},
    {id:"family",    icon:"🏖️", label:"Semester",   badge:0},
    {id:"vote",      icon:"🎯", label:"Aktiviteter", badge:unvotedCount},
    {id:"birthdays", icon:"🎂", label:"Dagar",       badge:todayBdayCount},
    {id:"chat",      icon:"💬", label:"Chatt",       badge:newMsgCount},
    {id:"more",      icon:"👤", label:"Profil",      badge:0},
  ];

  return(
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"Outfit,sans-serif",color:T.text}}>
      <style>{CSS}</style>
      <Toast msg={toast}/>

      {/* ── Sticky Header ── */}
      <div style={{background:"white",padding:"12px 18px",boxShadow:`0 2px 16px rgba(14,165,233,.1)`,position:"sticky",top:0,zIndex:200,borderBottom:`1px solid ${T.border}`}}>
        <div style={{maxWidth:620,margin:"0 auto",display:"flex",alignItems:"center",gap:12}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:24,fontWeight:900,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",color:T.text,letterSpacing:-0.5}}>
              {overlap.length>0?`🌟 Alla lediga v${overlap.join(" & ")}!`:"Fammy ☀️"}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6,background:`${session?.color}15`,borderRadius:12,padding:"6px 10px",border:`1.5px solid ${session?.color}30`,flexShrink:0}}>
            {session?.photo?<img src={session.photo} style={{width:24,height:24,borderRadius:8,objectFit:"cover"}} alt=""/>:<span style={{fontSize:18}}>{session?.emoji}</span>}
            <span style={{fontWeight:800,fontSize:13,color:session?.color}}>{session?.name?.split(" ")[0]}</span>
            {session?.role==="admin"&&<Badge bg={T.plumL} col={T.plum}>Admin</Badge>}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{maxWidth:620,margin:"0 auto",padding:"20px 16px 110px"}}>
        {tab==="home"      &&<HomeTab members={members} acts={acts} overlap={overlap} approved={approved} messages={messages} session={session} onTabChange={setTab} castVote={castVote}/>}
        {tab==="family"    &&<FamilyTab members={members} overlap={overlap} session={session} toggleWeek={toggleWeek}/>}
        {tab==="vote"      &&<VoteTab acts={acts.filter(a=>canSeeActivity(a,session))} members={members} session={session} castVote={castVote} removeActivity={removeActivity} setModal={setModal} confirmDel={confirmDel} setConfirmDel={setConfirmDel} showToast={showToast}/>}
        {tab==="birthdays" &&<div className="fade"><SectionHeader icon="🎂" title="Födelsedagar" color={T.sun}/><BirthdaysTab users={users} sendGreeting={sendBirthdayGreeting}/></div>}
        {tab==="chat"      &&<ChatTab messages={messages} session={session} sendMessage={sendMessage}/>}
        {tab==="more"      &&<MoreTab members={members} overlap={overlap} session={session} users={users} saveUsers={saveUsers} updateSession={updateSession} onLogout={onLogout} showToast={showToast} emailNotify={emailNotify}/>}
      </div>

      {/* ── Bottom Nav ── */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"white",boxShadow:"0 -4px 20px rgba(14,165,233,.12)",zIndex:150,display:"flex",borderTop:`1px solid ${T.border}`}}>
        {TABS.map(t=>{
          const active=tab===t.id;
          return <button key={t.id} onClick={()=>onTabChange(t.id)} style={{flex:1,padding:"10px 4px 18px",display:"flex",flexDirection:"column",alignItems:"center",gap:3,transition:"all .2s",position:"relative"}}>
            <div style={{width:40,height:32,borderRadius:12,background:active?`${T.sky}18`:"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .2s",position:"relative"}}>
              <span style={{fontSize:20}}>{t.icon}</span>
              {t.badge>0&&<div style={{position:"absolute",top:-4,right:-4,minWidth:16,height:16,borderRadius:8,background:T.rose,color:"white",fontSize:9,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px",border:"2px solid white"}}>
                {t.badge>9?"9+":t.badge}
              </div>}
            </div>
            <span style={{fontSize:9,fontWeight:active?800:600,letterSpacing:.5,textTransform:"uppercase",color:active?T.sky:T.sub,transition:"color .2s"}}>{t.label}</span>
          </button>;
        })}
      </div>

      {/* Add Activity Modal */}
      {modal==="addActivity"&&(
        <div className="overlay" onClick={()=>setModal(null)}>
          <div className="sheet pop" onClick={e=>e.stopPropagation()}>
            <div style={{fontWeight:900,fontSize:20,marginBottom:18,color:T.text}}>💡 Nytt förslag</div>
            <div style={{marginBottom:12}}><Label>TITEL</Label>
              <input value={na.title} onChange={e=>setNa({...na,title:e.target.value})} placeholder="Vad vill du göra?" autoFocus style={FINP()} onFocus={e=>e.target.style.borderColor=T.sky} onBlur={e=>e.target.style.borderColor=T.border}/>
            </div>
            <div style={{marginBottom:12}}><Label>EMOJI</Label>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {["🏖️","⛺","🌊","🎢","🚴","🏡","✈️","🦁","🎭","🎯","🌟","🏔️","🎪","🛶","🏕️","🚤"].map(e=>(
                  <button key={e} className="tap" onClick={()=>setNa({...na,emoji:e})} style={{width:40,height:40,borderRadius:12,fontSize:21,background:na.emoji===e?T.skyL:"#F8FAFC",border:`2px solid ${na.emoji===e?T.sky:T.border}`}}>{e}</button>
                ))}
              </div>
            </div>
            <div style={{marginBottom:12}}><Label>PLATS (adress eller stad)</Label>
              <input value={na.plats} onChange={e=>setNa({...na,plats:e.target.value})} placeholder="T.ex. Liseberg, Göteborg eller Strandvägen 1" style={FINP()} onFocus={e=>e.target.style.borderColor=T.sky} onBlur={e=>e.target.style.borderColor=T.border}/>
              {na.plats&&<a href={`https://www.google.com/maps/search/${encodeURIComponent(na.plats)}`} target="_blank" rel="noopener noreferrer" style={{fontSize:11,color:T.sky,fontWeight:700,marginTop:5,display:"inline-flex",alignItems:"center",gap:4}}>🗺️ Förhandsgranska på Google Maps</a>}
            </div>
            <div style={{marginBottom:12}}><Label>BESKRIVNING</Label>
              <textarea value={na.desc} onChange={e=>setNa({...na,desc:e.target.value})} placeholder="Beskriv aktiviteten…" rows={2} style={FINP({resize:"none",lineHeight:1.5})} onFocus={e=>e.target.style.borderColor=T.sky} onBlur={e=>e.target.style.borderColor=T.border}/>
            </div>
            <div style={{marginBottom:14}}>
              <Label>STARTDATUM (valfritt)</Label>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                <input value={na.date} onChange={e=>setNa({...na,date:e.target.value})} type="date" style={FINP()} onFocus={e=>e.target.style.borderColor=T.sky} onBlur={e=>e.target.style.borderColor=T.border}/>
                <div>
                  <input value={na.time} onChange={e=>setNa({...na,time:e.target.value})} type="time" placeholder="Tid" style={FINP()} onFocus={e=>e.target.style.borderColor=T.sky} onBlur={e=>e.target.style.borderColor=T.border}/>
                </div>
              </div>
            </div>
            <div style={{marginBottom:20}}>
              <Label>SLUTDATUM (om fler dagar — valfritt)</Label>
              <input value={na.endDate} onChange={e=>setNa({...na,endDate:e.target.value})} type="date" min={na.date||undefined} style={FINP()} onFocus={e=>e.target.style.borderColor=T.sky} onBlur={e=>e.target.style.borderColor=T.border}/>
              {na.date&&na.endDate&&na.endDate>na.date&&(
                <div style={{fontSize:11,color:T.sky,fontWeight:700,marginTop:6}}>
                  📅 {Math.round((new Date(na.endDate)-new Date(na.date))/864e5)+1} dagar
                </div>
              )}
            </div>
            <div style={{marginBottom:16}}>
              <Label>SYNLIG FÖR (lämna tom = alla ser)</Label>
              <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:4}}>
                {members.map(u=>{
                  const checked=na.visibleTo.includes(u.id);
                  return(
                    <button key={u.id} className="tap" onClick={()=>{
                      const next=checked?na.visibleTo.filter(id=>id!==u.id):[...na.visibleTo,u.id];
                      setNa({...na,visibleTo:next});
                    }} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:13,
                      background:checked?`${u.color}15`:"#F8FAFC",
                      border:`2px solid ${checked?u.color:T.border}`,
                      textAlign:"left",transition:"all .18s"}}>
                      <div style={{width:22,height:22,borderRadius:8,background:checked?u.color:T.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,flexShrink:0,transition:"all .18s"}}>
                        {checked?"✓":""}
                      </div>
                      <Avatar emoji={u.emoji} color={u.color} size={30} photo={u.photo}/>
                      <span style={{fontWeight:700,fontSize:14,color:checked?T.text:T.sub}}>{u.name}</span>
                    </button>
                  );
                })}
              </div>
              {na.visibleTo.length>0&&(
                <div style={{marginTop:8,padding:"8px 12px",borderRadius:10,background:T.sunL,border:`1px solid ${T.sun}`,fontSize:12,color:"#92400E",fontWeight:700}}>
                  👁 Bara {na.visibleTo.map(id=>members.find(u=>u.id===id)?.name).filter(Boolean).join(", ")} + admin kan se detta förslag
                </div>
              )}
            </div>
            <button className="bounce" onClick={addActivity} style={{...PBtn(`linear-gradient(135deg,${T.sky},${T.skyD})`),width:"100%",opacity:na.title?1:.4}}>
              Lägg till {na.emoji}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Home Tab ─────────────────────────────────────────────────────────────────
function HomeTab({members,acts,overlap,approved,messages,session,onTabChange,castVote}){
  const today=new Date(); today.setHours(0,0,0,0);
  const lastMsg=messages[messages.length-1];
  const approvedActs=acts.filter(a=>a.status==="approved");
  const proposedActs=acts.filter(a=>a.status==="proposed");
  const [detailEv, setDetailEv] = useState(null);

  return(
    <div className="fade">
      {/* Hero greeting */}
      <div style={{background:`linear-gradient(135deg,${T.sky},${T.plum})`,borderRadius:24,padding:"22px 20px",marginBottom:16,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-20,right:-20,fontSize:80,opacity:.15,transform:"rotate(15deg)"}}>☀️</div>
        <div style={{fontSize:13,color:"rgba(255,255,255,.8)",fontWeight:600,marginBottom:4}}>
          {today.toLocaleDateString("sv-SE",{weekday:"long",day:"numeric",month:"long"})}
        </div>
        <div style={{fontSize:24,fontWeight:900,color:"white",lineHeight:1.2,marginBottom:12}}>
          Hej {session?.name?.split(" ")[0]}! {session?.emoji}
        </div>
        {overlap.length>0
          ? <div style={{background:"rgba(255,255,255,.2)",backdropFilter:"blur(8px)",borderRadius:14,padding:"10px 14px",display:"inline-flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:18}}>⭐</span>
              <div>
                <div style={{fontSize:12,fontWeight:800,color:"white"}}>Alla lediga v{overlap.join(" & ")}!</div>
                <div style={{fontSize:11,color:"rgba(255,255,255,.75)"}}>Dags att boka semestern</div>
              </div>
            </div>
          : null
        }
      </div>



      

      {/* ── Unified Calendar View ── */}
      {(()=>{
        const today = new Date(); today.setHours(0,0,0,0);
        const MONTHS = ["Januari","Februari","Mars","April","Maj","Juni","Juli","Augusti","September","Oktober","November","December"];

        const HOLIDAYS = [
          {date:"2026-01-01",name:"Nyårsdagen",emoji:"🎆"},
          {date:"2026-01-06",name:"Trettondedag jul",emoji:"⭐"},
          {date:"2026-04-03",name:"Långfredagen",emoji:"✝️"},
          {date:"2026-04-05",name:"Påskdagen",emoji:"🐣"},
          {date:"2026-04-06",name:"Annandag påsk",emoji:"🐣"},
          {date:"2026-05-01",name:"Första maj",emoji:"🌹"},
          {date:"2026-05-14",name:"Kristi himmelsfärdsdag",emoji:"☁️"},
          {date:"2026-05-24",name:"Pingstdagen",emoji:"🕊️"},
          {date:"2026-06-06",name:"Nationaldagen",emoji:"🇸🇪"},
          {date:"2026-06-19",name:"Midsommar 🌸",emoji:"🌻"},
          {date:"2026-10-31",name:"Alla helgons dag",emoji:"🕯️"},
          {date:"2026-12-24",name:"Julafton",emoji:"🎄"},
          {date:"2026-12-25",name:"Juldagen",emoji:"🎁"},
          {date:"2026-12-26",name:"Annandag jul",emoji:"🎁"},
          {date:"2026-12-31",name:"Nyårsafton",emoji:"🎆"},
          {date:"2027-01-01",name:"Nyårsdagen",emoji:"🎆"},
          {date:"2027-03-26",name:"Långfredagen",emoji:"✝️"},
          {date:"2027-03-28",name:"Påskdagen",emoji:"🐣"},
          {date:"2027-03-29",name:"Annandag påsk",emoji:"🐣"},
          {date:"2027-05-01",name:"Första maj",emoji:"🌹"},
          {date:"2027-06-06",name:"Nationaldagen",emoji:"🇸🇪"},
          {date:"2027-06-25",name:"Midsommar 🌸",emoji:"🌻"},
          {date:"2027-12-24",name:"Julafton",emoji:"🎄"},
          {date:"2027-12-25",name:"Juldagen",emoji:"🎁"},
          {date:"2027-12-26",name:"Annandag jul",emoji:"🎁"},
          {date:"2027-12-31",name:"Nyårsafton",emoji:"🎆"},
        ];

        const events = [];

        // Holidays — only show next upcoming occurrence of each
        const seenHoliday = {};
        HOLIDAYS.forEach(h=>{
          const d=Math.round((new Date(h.date)-today)/864e5);
          if(d < -1 || d > 730) return;
          // Keep only the soonest (smallest d) per holiday name
          if(seenHoliday[h.name]===undefined || d < seenHoliday[h.name].d){
            const sortDate=new Date(h.date);
            seenHoliday[h.name]={d,event:{id:"hol_"+h.date,type:"holiday",title:h.name,
              subtitle:"🔴 Röd dag",date:h.date,sortDate,daysUntil:d,
              emoji:h.emoji,photo:null,color:"#EF4444",accent:"#EF4444",
              isToday:d===0,votes:null,status:null,actId:null,
              month:sortDate.getMonth(),year:sortDate.getFullYear()}};
          }
        });
        Object.values(seenHoliday).forEach(({event})=>events.push(event));

        members.filter(u=>u.birthday).forEach(u=>{
          const d=daysUntil(u.birthday);
          const bDate=new Date(u.birthday);
          const thisYear=new Date(today.getFullYear(),bDate.getMonth(),bDate.getDate());
          const showDate=thisYear<today?new Date(today.getFullYear()+1,bDate.getMonth(),bDate.getDate()):thisYear;
          events.push({id:"bday_"+u.id,type:"birthday",title:u.name,
            subtitle:`Fyller ${calcAge(u.birthday)+1} år`,
            date:u.birthday,sortDate:showDate,daysUntil:d,
            emoji:u.emoji,photo:u.photo,color:u.color,accent:T.sun,
            isToday:d===0,votes:null,status:null,actId:null,
            month:showDate.getMonth(),year:showDate.getFullYear()});
        });
        acts.forEach(a=>{
          const d=a.date?Math.round((new Date(a.date)-today)/864e5):null;
          const sortDate=a.date?new Date(a.date):null;
          events.push({id:"act_"+a.id,type:"activity",title:a.title,
            subtitle:a.plats||"",
            date:a.date||null,sortDate,daysUntil:d,
            emoji:a.emoji,photo:null,
            color:a.status==="approved"?T.mint:a.status==="rejected"?T.rose:T.sky,
            accent:a.status==="approved"?T.mint:a.status==="rejected"?T.rose:T.sky,
            isToday:d===0,votes:a.votes,status:a.status,actId:a.id,
            month:sortDate?sortDate.getMonth():null,year:sortDate?sortDate.getFullYear():null});
        });
        if(!events.length) return null;

        const todayEvs=events.filter(e=>e.isToday);
        const future=events.filter(e=>!e.isToday&&e.sortDate&&e.daysUntil>=0).sort((a,b)=>a.sortDate-b.sortDate);
        const undated=events.filter(e=>!e.isToday&&!e.sortDate);

        const byMonth={};
        future.forEach(ev=>{
          const key=`${ev.year}-${ev.month}`;
          if(!byMonth[key]) byMonth[key]={month:ev.month,year:ev.year,evs:[]};
          byMonth[key].evs.push(ev);
        });
        const monthGroups=Object.values(byMonth).sort((a,b)=>a.year!==b.year?a.year-b.year:a.month-b.month);

        function VoteRow({actId,votes}){
          if(!votes) return null;
          const myV=session?.userId?votes[session.userId]:null;
          return(
            <div style={{display:"flex",gap:6,marginTop:10,paddingTop:10,borderTop:`1px solid ${T.border}`}}>
              {[{val:"yes",icon:"❤️",label:"Ja",bg:T.mintL,bdr:T.mint,col:"#065F46"},
                {val:"maybe",icon:"🤔",label:"Kanske",bg:T.sunL,bdr:T.sun,col:"#92400E"},
                {val:"no",icon:"✗",label:"Nej",bg:T.roseL,bdr:T.rose,col:T.rose}].map(v=>{
                const cnt=Object.values(votes).filter(x=>x===v.val).length;
                return(
                  <button key={v.val} className="tap" onClick={()=>castVote(actId,v.val)}
                    style={{flex:1,padding:"8px 4px",borderRadius:11,fontWeight:800,fontSize:12,
                      background:myV===v.val?v.bg:"#F8FAFC",
                      border:`1.5px solid ${myV===v.val?v.bdr:T.border}`,
                      color:myV===v.val?v.col:T.sub,transition:"all .18s",
                      display:"flex",alignItems:"center",justifyContent:"center",gap:4}}>
                    <span>{v.icon}</span>
                    <span>{v.label}</span>
                    {cnt>0&&<span style={{background:v.bg,color:v.col,borderRadius:6,padding:"0 4px",fontSize:10,fontWeight:900}}>{cnt}</span>}
                  </button>
                );
              })}
            </div>
          );
        }

        function VoteAvatars({votes}){
          if(!votes||!Object.keys(votes).length) return null;
          const groups=[{key:"yes",icon:"❤️",bg:T.mintL,col:"#065F46"},{key:"maybe",icon:"🤔",bg:T.sunL,col:"#92400E"},{key:"no",icon:"✗",bg:T.roseL,col:T.rose}];
          const waiting=members.filter(m=>!votes[m.id]);
          return(
            <div style={{display:"flex",gap:5,marginTop:6,flexWrap:"wrap",alignItems:"center"}}>
              {groups.map(g=>{
                const ids=Object.entries(votes).filter(([,v])=>v===g.key).map(([id])=>id);
                if(!ids.length) return null;
                return(
                  <div key={g.key} style={{display:"flex",alignItems:"center",gap:3,background:g.bg,borderRadius:9,padding:"3px 7px 3px 5px"}}>
                    <span style={{fontSize:10}}>{g.icon}</span>
                    <div style={{display:"flex",gap:1}}>
                      {ids.map(id=>{const u=members.find(m=>m.id===id);return u?(
                        <div key={id} style={{width:18,height:18,borderRadius:"50%",overflow:"hidden",border:"1.5px solid white",flexShrink:0}}>
                          {u.photo?<img src={u.photo} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
                          :<div style={{width:"100%",height:"100%",background:u.color+"30",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>{u.emoji}</div>}
                        </div>):null;})}
                    </div>
                    <span style={{fontSize:10,fontWeight:800,color:g.col}}>{ids.length}</span>
                  </div>
                );
              })}
              {waiting.length>0&&(
                <div style={{display:"flex",alignItems:"center",gap:3,background:"#F8FAFC",borderRadius:9,padding:"3px 7px 3px 5px",border:`1px solid ${T.border}`}}>
                  <div style={{display:"flex",gap:1}}>
                    {waiting.map(u=>(
                      <div key={u.id} style={{width:18,height:18,borderRadius:"50%",overflow:"hidden",border:"1.5px solid white",opacity:.4,flexShrink:0}}>
                        {u.photo?<img src={u.photo} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
                        :<div style={{width:"100%",height:"100%",background:u.color+"30",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>{u.emoji}</div>}
                      </div>
                    ))}
                  </div>
                  <span style={{fontSize:9,fontWeight:700,color:T.sub}}>väntar</span>
                </div>
              )}
            </div>
          );
        }


        function EventCard({ev}){
          const sb=ev.type==="holiday"
            ?{bg:"#FEF2F2",col:"#DC2626",label:"🔴 Röd dag"}
            :ev.type==="activity"
            ?ev.status==="approved"?{bg:T.mintL,col:"#065F46",label:"✅ Godkänd"}
            :ev.status==="rejected"?{bg:T.roseL,col:T.rose,label:"✗ Avslagen"}
            :{bg:T.skyL,col:T.skyD,label:"🗳️ Rösta"}
            :{bg:T.sunL,col:"#D97706",label:"🎂 Bday"};
          const clickable=ev.type==="activity"||ev.type==="birthday";
          return(
            <div onClick={clickable?()=>setDetailEv(ev):undefined}
              style={{background:ev.isToday?`${ev.accent}08`:"white",borderRadius:18,padding:"14px",marginBottom:8,
                border:`1.5px solid ${ev.isToday?ev.accent:T.border}`,boxShadow:"0 2px 8px rgba(0,0,0,.05)",
                cursor:clickable?"pointer":"default"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:48,height:48,borderRadius:14,
                  background:ev.isToday?ev.accent:`${ev.accent}15`,
                  display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {ev.isToday
                    ?<span style={{fontSize:24}}>🎉</span>
                    :ev.sortDate
                      ?<><div style={{fontWeight:900,fontSize:18,color:ev.accent,lineHeight:1}}>{ev.sortDate.getDate()}</div>
                         <div style={{fontSize:8,color:ev.accent,fontWeight:700,textTransform:"uppercase"}}>{MONTHS[ev.sortDate.getMonth()].slice(0,3)}</div></>
                      :<span style={{fontSize:24}}>{ev.emoji}</span>
                  }
                </div>
                {ev.type==="birthday"
                  ?<Avatar emoji={ev.emoji} color={ev.color} size={40} photo={ev.photo}/>
                  :<div style={{width:40,height:40,borderRadius:13,background:`${ev.color}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{ev.emoji}</div>
                }
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:800,fontSize:14,color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{ev.title}</div>
                  <div style={{fontSize:11,color:T.sub,marginTop:1}}>{ev.subtitle}</div>
                  {ev.daysUntil>0&&<div style={{fontSize:10,color:ev.accent,fontWeight:700,marginTop:2}}>om {ev.daysUntil} dagar</div>}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:5,flexShrink:0}}>
                  <span style={{fontSize:10,background:sb.bg,color:sb.col,padding:"4px 8px",borderRadius:9,fontWeight:800,whiteSpace:"nowrap"}}>{sb.label}</span>
                  {clickable&&<span style={{color:T.border,fontSize:16,fontWeight:300}}>›</span>}
                </div>
              </div>
              {ev.votes&&ev.type!=="holiday"&&<VoteAvatars votes={ev.votes}/>}
              {ev.type==="activity"&&ev.status!=="rejected"&&<VoteRow actId={ev.actId} votes={ev.votes}/>}
            </div>
          );
        }

        function MonthDivider({label}){
          return(
            <div style={{fontSize:9,fontWeight:800,color:T.sky,letterSpacing:1.5,textTransform:"uppercase",margin:"14px 0 8px",display:"flex",alignItems:"center",gap:8}}>
              <div style={{height:1,flex:1,background:T.border}}/>{label}<div style={{height:1,flex:1,background:T.border}}/>
            </div>
          );
        }

        return(
          <div style={{background:"white",borderRadius:22,padding:"18px",marginBottom:16,boxShadow:`0 2px 14px rgba(0,0,0,.06)`}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <div style={{width:34,height:34,borderRadius:11,background:`${T.sky}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>📆</div>
                <div style={{fontWeight:900,fontSize:16}}>Kommande händelser</div>
              </div>
              <div style={{display:"flex",gap:5}}>
                <span style={{fontSize:9,background:"#FEF2F2",color:"#DC2626",padding:"3px 6px",borderRadius:7,fontWeight:800}}>🔴</span>
                <span style={{fontSize:9,background:T.sunL,color:"#D97706",padding:"3px 6px",borderRadius:7,fontWeight:800}}>🎂</span>
                <span style={{fontSize:9,background:T.skyL,color:T.skyD,padding:"3px 6px",borderRadius:7,fontWeight:800}}>🗳️</span>
                <span style={{fontSize:9,background:T.mintL,color:"#065F46",padding:"3px 6px",borderRadius:7,fontWeight:800}}>✅</span>
              </div>
            </div>
            {todayEvs.length>0&&(
              <>
                <MonthDivider label="🌟 IDAG"/>
                {todayEvs.map(ev=><EventCard key={ev.id} ev={ev}/>)}
              </>
            )}
            {monthGroups.map(g=>(
              <div key={`${g.year}-${g.month}`}>
                <MonthDivider label={`${MONTHS[g.month]}${g.year!==today.getFullYear()?" "+g.year:""}`}/>
                {g.evs.map(ev=><EventCard key={ev.id} ev={ev}/>)}
              </div>
            ))}
            {undated.length>0&&(
              <>
                <MonthDivider label="UTAN DATUM"/>
                {undated.map(ev=><EventCard key={ev.id} ev={ev}/>)}
              </>
            )}
            {events.length===0&&(
              <div style={{textAlign:"center",padding:"28px 0",color:T.border}}>
                <div style={{fontSize:36,marginBottom:8}}>📆</div>
                <div style={{fontSize:13,fontWeight:700,color:T.sub}}>Inga händelser ännu</div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Event Detail Sheet ── */}
      {detailEv&&(()=>{
        const act = detailEv.type==="activity" ? acts.find(a=>a.id===detailEv.actId) : null;
        const bdayUser = detailEv.type==="birthday" ? members.find(u=>"bday_"+u.id===detailEv.id) : null;
        return(
          <div className="overlay" onClick={()=>setDetailEv(null)}>
            <div className="sheet pop" onClick={e=>e.stopPropagation()}>
              {/* Handle bar */}
              <div style={{width:40,height:4,borderRadius:2,background:T.border,margin:"0 auto 20px"}}/>

              {act&&(
                <>
                  {/* Activity header */}
                  <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:18}}>
                    <div style={{width:60,height:60,borderRadius:18,background:`${detailEv.accent}15`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,flexShrink:0}}>{act.emoji}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:900,fontSize:20,color:T.text,marginBottom:6}}>{act.title}</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        {act.status==="approved"&&<Badge bg={T.mintL} col="#065F46">✅ Godkänd</Badge>}
                        {act.status==="rejected"&&<Badge bg={T.roseL} col={T.rose}>✗ Avslagen</Badge>}
                        {act.status==="proposed"&&<Badge bg={T.skyL} col={T.skyD}>🗳️ Under omröstning</Badge>}
                        {act.plats&&<a href={`https://www.google.com/maps/search/${encodeURIComponent(act.plats)}`} target="_blank" rel="noopener noreferrer" style={{fontSize:11,fontWeight:700,color:T.sky,background:T.skyL,padding:"3px 9px",borderRadius:8,display:"inline-flex",alignItems:"center",gap:4,textDecoration:"none"}}>📍 {act.plats}</a>}
                      </div>
                    </div>
                  </div>

                  {/* Details grid */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                    {act.date&&(
                      <div style={{background:T.skyL,borderRadius:14,padding:"12px 14px",gridColumn:act.endDate&&act.endDate>act.date?"1/-1":"auto"}}>
                        <div style={{fontSize:10,fontWeight:700,color:T.skyD,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>📅 Datum</div>
                        <div style={{fontWeight:800,fontSize:14,color:T.text}}>
                          {new Date(act.date).toLocaleDateString("sv-SE",{weekday:"short",day:"numeric",month:"long"})}
                          {act.endDate&&act.endDate>act.date&&(
                            <span style={{color:T.skyD}}> → {new Date(act.endDate).toLocaleDateString("sv-SE",{weekday:"short",day:"numeric",month:"long"})}</span>
                          )}
                        </div>
                        {act.endDate&&act.endDate>act.date&&(
                          <div style={{fontSize:11,color:T.sky,fontWeight:700,marginTop:3}}>
                            {Math.round((new Date(act.endDate)-new Date(act.date))/864e5)+1} dagar
                          </div>
                        )}
                        <div style={{fontSize:11,color:T.sub,marginTop:2}}>om {Math.round((new Date(act.date)-new Date())/864e5)} dagar</div>
                      </div>
                    )}
                    {act.time&&(
                      <div style={{background:T.plumL,borderRadius:14,padding:"12px 14px"}}>
                        <div style={{fontSize:10,fontWeight:700,color:T.plum,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>🕐 Tid</div>
                        <div style={{fontWeight:800,fontSize:22,color:T.text}}>{act.time}</div>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  {act.desc&&(
                    <div style={{background:"#F8FAFC",borderRadius:14,padding:"14px",marginBottom:16}}>
                      <div style={{fontSize:10,fontWeight:700,color:T.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:6}}>Beskrivning</div>
                      <div style={{fontSize:14,color:T.text,lineHeight:1.6}}>{act.desc}</div>
                    </div>
                  )}

                  {/* Location */}
                  {act.plats&&(
                    <a href={`https://www.google.com/maps/search/${encodeURIComponent(act.plats)}`}
                      target="_blank" rel="noopener noreferrer"
                      style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",borderRadius:16,
                        background:T.skyL,border:`1.5px solid ${T.sky}30`,marginBottom:16,textDecoration:"none"}}>
                      <div style={{width:40,height:40,borderRadius:12,background:T.sky,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🗺️</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:10,fontWeight:700,color:T.skyD,textTransform:"uppercase",letterSpacing:1,marginBottom:2}}>Plats</div>
                        <div style={{fontWeight:800,fontSize:14,color:T.text}}>{act.plats}</div>
                        <div style={{fontSize:11,color:T.sky,fontWeight:600,marginTop:1}}>Öppna i Google Maps →</div>
                      </div>
                    </a>
                  )}
                  {act.suggestedBy&&(()=>{const u=members.find(m=>m.id===act.suggestedBy);return u?(
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,padding:"10px 14px",background:"#F8FAFC",borderRadius:12}}>
                      <Avatar emoji={u.emoji} color={u.color} size={32} photo={u.photo}/>
                      <div style={{fontSize:12,color:T.sub,fontWeight:600}}>Föreslagen av <strong style={{color:T.text}}>{u.name}</strong></div>
                    </div>
                  ):null;})()}

                  {/* Full vote breakdown */}
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:11,fontWeight:700,color:T.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Röster ({members.length} familjemedlemmar)</div>
                    <div style={{display:"flex",flexDirection:"column",gap:7}}>
                      {members.map(u=>{
                        const v=act.votes?.[u.id];
                        return(
                          <div key={u.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:12,
                            background:v==="yes"?T.mintL:v==="no"?T.roseL:v==="maybe"?T.sunL:"#F8FAFC",
                            border:`1.5px solid ${v==="yes"?T.mint:v==="no"?T.rose:v==="maybe"?T.sun:T.border}`}}>
                            <Avatar emoji={u.emoji} color={u.color} size={32} photo={u.photo}/>
                            <div style={{flex:1,fontWeight:700,fontSize:13}}>{u.name}</div>
                            <span style={{fontSize:16}}>{v==="yes"?"❤️":v==="no"?"✗":v==="maybe"?"🤔":"–"}</span>
                            <span style={{fontSize:11,fontWeight:800,
                              color:v==="yes"?"#065F46":v==="no"?T.rose:v==="maybe"?"#92400E":T.border}}>
                              {v==="yes"?"Ja":v==="no"?"Nej":v==="maybe"?"Kanske":"Ej röstat"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Vote buttons */}
                  {act.status!=="rejected"&&(
                    <>
                      <div style={{fontSize:11,fontWeight:700,color:T.sub,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>Din röst</div>
                      <div style={{display:"flex",gap:8,marginBottom:16}}>
                        {[{val:"yes",icon:"❤️",label:"Ja!",bg:T.mintL,bdr:T.mint,col:"#065F46"},
                          {val:"maybe",icon:"🤔",label:"Kanske",bg:T.sunL,bdr:T.sun,col:"#92400E"},
                          {val:"no",icon:"✗",label:"Nej",bg:T.roseL,bdr:T.rose,col:T.rose}].map(v=>{
                          const myV=session?.userId?act.votes?.[session.userId]:null;
                          return(
                            <button key={v.val} className="bounce tap" onClick={()=>castVote(act.id,v.val)}
                              style={{flex:1,padding:"12px 6px",borderRadius:13,fontWeight:800,fontSize:13,
                                background:myV===v.val?v.bg:"#F8FAFC",
                                border:`2px solid ${myV===v.val?v.bdr:T.border}`,
                                color:myV===v.val?v.col:T.sub,transition:"all .18s"}}>
                              {v.icon} {v.label}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </>
              )}

              {bdayUser&&(
                <>
                  <div style={{textAlign:"center",marginBottom:20}}>
                    <div style={{position:"relative",display:"inline-block",marginBottom:12}}>
                      <Avatar emoji={bdayUser.emoji} color={bdayUser.color} size={88} photo={bdayUser.photo}/>
                      <div style={{position:"absolute",top:-6,right:-6,fontSize:28}}>🎂</div>
                    </div>
                    <div style={{fontWeight:900,fontSize:22}}>{bdayUser.name}</div>
                    <div style={{fontSize:13,color:T.sub,marginTop:4}}>
                      {detailEv.isToday
                        ? <span style={{color:T.sun,fontWeight:800}}>🎉 Fyller {calcAge(bdayUser.birthday)+1} år IDAG!</span>
                        : `Fyller ${calcAge(bdayUser.birthday)+1} år om ${detailEv.daysUntil} dagar`}
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
                    <div style={{background:T.sunL,borderRadius:14,padding:"14px",textAlign:"center"}}>
                      <div style={{fontSize:10,fontWeight:700,color:"#D97706",textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Ålder</div>
                      <div style={{fontWeight:900,fontSize:28,color:"#D97706"}}>{calcAge(bdayUser.birthday)+1}</div>
                      <div style={{fontSize:11,color:"#92400E"}}>år</div>
                    </div>
                    <div style={{background:T.skyL,borderRadius:14,padding:"14px",textAlign:"center"}}>
                      <div style={{fontSize:10,fontWeight:700,color:T.skyD,textTransform:"uppercase",letterSpacing:1,marginBottom:4}}>Datum</div>
                      <div style={{fontWeight:800,fontSize:15,color:T.text}}>{fmtBday(bdayUser.birthday)}</div>
                      <div style={{fontSize:11,color:T.sub}}>{new Date(bdayUser.birthday).getFullYear()}</div>
                    </div>
                  </div>
                  <div style={{background:`linear-gradient(135deg,${T.sun},#F97316)`,borderRadius:16,padding:"16px",textAlign:"center",color:"white"}}>
                    <div style={{fontWeight:900,fontSize:15}}>
                      {detailEv.isToday ? "🎊 Grattis på födelsedagen! 🎊" : `🎈 ${detailEv.daysUntil} dagar kvar!`}
                    </div>
                  </div>
                </>
              )}

              <button className="tap" onClick={()=>setDetailEv(null)}
                style={{width:"100%",padding:"13px",borderRadius:14,background:T.bg,fontWeight:800,color:T.sub,fontSize:14,border:`1px solid ${T.border}`,marginTop:16}}>
                Stäng
              </button>
            </div>
          </div>
        );
      })()}

      {/* Latest chat */}
      {lastMsg&&(
        <button className="bounce" onClick={()=>onTabChange("chat")} style={{width:"100%",background:"white",borderRadius:20,padding:"14px 16px",boxShadow:`0 2px 14px rgba(0,0,0,.06)`,textAlign:"left",display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:44,height:44,borderRadius:"50%",overflow:"hidden",flexShrink:0}}>
            {lastMsg.photo?<img src={lastMsg.photo} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:<div style={{width:"100%",height:"100%",background:lastMsg.color+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{lastMsg.emoji}</div>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:11,color:T.sub,fontWeight:600,marginBottom:2}}>💬 Senaste i chatten</div>
            <div style={{fontSize:13,fontWeight:700,color:T.text}}>{lastMsg.name}</div>
            <div style={{fontSize:12,color:T.sub,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{lastMsg.gif?"📸 GIF":lastMsg.text}</div>
          </div>
          <span style={{color:T.border,fontSize:18}}>›</span>
        </button>
      )}
    </div>
  );
}

// ─── Family Tab ───────────────────────────────────────────────────────────────
function FamilyTab({members,overlap,session,toggleWeek}){
  const [editingWeeks,setEditingWeeks]=useState(false);
  const [showSchedule,setShowSchedule]=useState(false);
  const partial=SUMMER_WEEKS.filter(w=>members.some(u=>u.freeWeeks.includes(w)));
  const me=members.find(u=>u.id===session?.userId);

  return(
    <div className="fade">
      <SectionHeader icon="🏖️" title="Semesterschema" color={T.sky}
        action={<button className="tap" onClick={()=>setShowSchedule(s=>!s)}
          style={{padding:"7px 13px",borderRadius:12,background:showSchedule?T.skyL:"#F8FAFC",
            color:showSchedule?T.sky:T.sub,fontWeight:700,fontSize:12,border:`1.5px solid ${showSchedule?T.sky:T.border}`}}>
          {showSchedule?"Dölj tabell":"Tabell 📅"}
        </button>}
      />

      {/* My weeks — prominent for logged-in user */}
      {me&&(
        <div style={{background:`linear-gradient(135deg,${me.color}18,${me.color}08)`,borderRadius:20,padding:"16px 18px",marginBottom:14,border:`1.5px solid ${me.color}30`}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
            <Avatar emoji={me.emoji} color={me.color} size={40} photo={me.photo}/>
            <div style={{flex:1}}>
              <div style={{fontWeight:800,fontSize:15,color:T.text}}>Mina lediga veckor</div>
              <div style={{fontSize:12,color:T.sub,marginTop:1}}>
                {me.freeWeeks.length===0?"Ingen vecka vald ännu":`v${me.freeWeeks.join(", v")}`}
              </div>
            </div>
            <button className="tap" onClick={()=>setEditingWeeks(true)}
              style={{padding:"8px 14px",borderRadius:11,background:me.color,color:"white",fontWeight:800,fontSize:12,boxShadow:`0 3px 10px ${me.color}50`}}>
              ✏️ Ändra
            </button>
          </div>
          {/* Show selected weeks compactly */}
          {me.freeWeeks.length>0&&(
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {me.freeWeeks.map(w=>{
                const star=overlap.includes(w);
                return <div key={w} style={{padding:"5px 10px",borderRadius:10,fontSize:12,fontWeight:800,
                  background:me.color,color:"white",position:"relative"}}>
                  v{w}{star&&<span style={{position:"absolute",top:-5,right:-4,fontSize:8}}>⭐</span>}
                </div>;
              })}
            </div>
          )}
        </div>
      )}

      {/* Schedule table */}
      {showSchedule&&members.length>0&&(
        <div style={{background:"white",borderRadius:18,padding:"14px 12px",marginBottom:14,boxShadow:`0 2px 14px rgba(0,0,0,.06)`,overflowX:"auto"}}>
          <div style={{minWidth:260}}>
            <div style={{display:"grid",gridTemplateColumns:`58px repeat(${Math.max(members.length,1)},1fr) 76px`,gap:2,marginBottom:6,paddingBottom:5,borderBottom:`1px solid ${T.border}`}}>
              <div style={{fontSize:9,fontWeight:700,color:T.sub}}>VECKA</div>
              {members.map(u=><div key={u.id} style={{textAlign:"center",fontSize:12}}>{u.emoji}</div>)}
              <div style={{fontSize:9,fontWeight:700,color:T.sub,textAlign:"right"}}>DATUM</div>
            </div>
            {SUMMER_WEEKS.map(w=>{
              const isAll=overlap.includes(w),isSome=partial.includes(w);
              return <div key={w} style={{display:"grid",gridTemplateColumns:`58px repeat(${Math.max(members.length,1)},1fr) 76px`,gap:2,alignItems:"center",padding:"3px 3px",borderRadius:8,marginBottom:2,background:isAll?T.sunL:isSome?"#FAFAFA":"transparent",border:isAll?`1.5px solid ${T.sun}`:"1.5px solid transparent"}}>
                <div style={{fontWeight:isAll?800:600,fontSize:11,color:isAll?"#D97706":T.sub,display:"flex",alignItems:"center",gap:2}}>
                  {isAll&&<span style={{fontSize:8}}>⭐</span>}v{w}
                </div>
                {members.map(u=><div key={u.id} style={{textAlign:"center",fontSize:13}}>{u.freeWeeks.includes(w)?"✅":<span style={{opacity:.12,fontSize:10}}>–</span>}</div>)}
                <div style={{fontSize:9,color:T.sub,fontWeight:600,textAlign:"right"}}>{weekDates(w)}</div>
              </div>;
            })}
          </div>
        </div>
      )}

      {/* Compact family list */}
      {members.length===0?(
        <div style={{textAlign:"center",padding:"44px 20px",background:"white",borderRadius:22}}>
          <div style={{fontSize:52,marginBottom:10}}>👨‍👩‍👧‍👦</div>
          <div style={{fontWeight:800,fontSize:15,color:T.sub}}>Admin lägger till familjemedlemmar</div>
        </div>
      ):(
        <div style={{background:"white",borderRadius:20,overflow:"hidden",boxShadow:`0 2px 14px rgba(0,0,0,.06)`}}>
          <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,fontSize:10,fontWeight:800,color:T.sub,letterSpacing:1.2,textTransform:"uppercase"}}>
            Alla i familjen
          </div>
          {members.map((u,i)=>{
            const isMe=u.id===session?.userId;
            return(
              <div key={u.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",
                borderBottom:i<members.length-1?`1px solid ${T.border}`:"none",
                background:isMe?`${u.color}06`:"white"}}>
                <Avatar emoji={u.emoji} color={u.color} size={40} photo={u.photo}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <div style={{fontWeight:800,fontSize:14,color:T.text}}>{u.name}</div>
                    {isMe&&<Badge bg={T.sunL} col="#D97706">DU</Badge>}
                    {(u.type==="child"||u.role==="child")&&<Badge bg="#FEF9C3" col="#D97706">👶</Badge>}
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:5}}>
                    {u.freeWeeks.length===0
                      ?<span style={{fontSize:11,color:T.border}}>Inga veckor valda</span>
                      :u.freeWeeks.map(w=><span key={w} style={{fontSize:10,fontWeight:800,padding:"2px 7px",borderRadius:7,
                          background:overlap.includes(w)?T.sunL:`${u.color}18`,
                          color:overlap.includes(w)?"#D97706":u.color}}>
                        v{w}{overlap.includes(w)?" ⭐":""}
                      </span>)
                    }
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Week picker modal */}
      {editingWeeks&&me&&(
        <div className="overlay" onClick={()=>setEditingWeeks(false)}>
          <div className="sheet pop" onClick={e=>e.stopPropagation()}>
            <div style={{width:40,height:4,borderRadius:2,background:T.border,margin:"0 auto 18px"}}/>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
              <Avatar emoji={me.emoji} color={me.color} size={44} photo={me.photo}/>
              <div>
                <div style={{fontWeight:900,fontSize:17}}>Mina lediga veckor</div>
                <div style={{fontSize:12,color:T.sub,marginTop:2}}>Tryck för att välja eller avmarkera</div>
              </div>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:9,marginBottom:20}}>
              {SUMMER_WEEKS.map(w=>{
                const f=me.freeWeeks.includes(w),star=overlap.includes(w);
                return(
                  <button key={w} className="wk" onClick={()=>toggleWeek(me.id,w)}
                    style={{padding:"10px 14px",borderRadius:13,fontSize:13,fontWeight:f?800:600,
                      background:f?me.color:"#F8FAFC",color:f?"white":T.sub,
                      border:`2px solid ${f?me.color:T.border}`,position:"relative",minWidth:58,textAlign:"center"}}>
                    v{w}
                    {star&&f&&<span style={{position:"absolute",top:-5,right:-4,fontSize:9}}>⭐</span>}
                    <div style={{fontSize:9,color:f?"rgba(255,255,255,.7)":T.border,marginTop:2}}>{weekDates(w).split("–")[0]}</div>
                  </button>
                );
              })}
            </div>
            {me.freeWeeks.length>0&&(
              <div style={{background:T.skyL,borderRadius:12,padding:"10px 14px",marginBottom:14,fontSize:12,color:T.skyD,fontWeight:700}}>
                ✓ Valda: v{me.freeWeeks.join(", v")}
                {overlap.length>0&&` · ⭐ Alla lediga v${overlap.join(" & ")}`}
              </div>
            )}
            <button className="bounce tap" onClick={()=>setEditingWeeks(false)}
              style={{...PBtn(`linear-gradient(135deg,${me.color},${me.color}cc)`),width:"100%",padding:"13px"}}>
              Klar ✓
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Vote Tab ─────────────────────────────────────────────────────────────────
function VoteTab({acts,members,session,castVote,removeActivity,setModal,confirmDel,setConfirmDel,showToast}){
  const approved=acts.filter(a=>a.status==="approved"&&canSeeActivity(a,session));
  const rejected=acts.filter(a=>a.status==="rejected");
  const proposed=acts.filter(a=>a.status==="proposed");
  return(
    <div className="fade">
      <SectionHeader icon="🎯" title="Aktiviteter & Röstning" color={T.sky}
        action={<button className="bounce tap" onClick={()=>setModal("addActivity")} style={PBtn(`linear-gradient(135deg,${T.sky},${T.skyD})`,"8px 16px","13px")}>+ Förslag</button>}
      />
      {/* Stats */}
      <div style={{display:"flex",gap:10,marginBottom:18,overflowX:"auto"}}>
        {[{l:"Förslag",n:proposed.length,c:T.sky},{l:"Godkända",n:approved.length,c:T.mint},{l:"Avslagna",n:rejected.length,c:T.rose}].map(s=>(
          <div key={s.l} style={{background:"white",borderRadius:14,padding:"12px 16px",textAlign:"center",boxShadow:`0 2px 12px rgba(0,0,0,.05)`,borderTop:`3px solid ${s.c}`,minWidth:90,flexShrink:0}}>
            <div style={{fontSize:22,fontWeight:900,color:s.c}}>{s.n}</div>
            <div style={{fontSize:10,color:T.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>{s.l}</div>
          </div>
        ))}
      </div>
      {/* Activity cards */}
      <div style={{display:"flex",flexDirection:"column",gap:14}}>
        {acts.map(act=>{
          const yV=Object.values(act.votes).filter(v=>v==="yes").length;
          const nV=Object.values(act.votes).filter(v=>v==="no").length;
          const mV=Object.values(act.votes).filter(v=>v==="maybe").length;
          const tot=yV+nV+mV;
          const myV=session?.userId?act.votes[session.userId]:null;
          const sugBy=members.find(u=>u.id===act.suggestedBy);
          const canDelete=session?.role==="admin"||act.suggestedBy===session?.userId;
          const statusColor=act.status==="approved"?T.mint:act.status==="rejected"?T.rose:T.border;
          return(
            <div key={act.id} style={{background:"white",borderRadius:22,overflow:"hidden",boxShadow:`0 2px 16px rgba(0,0,0,.07)`,border:`2px solid ${statusColor}`}}>
              {/* Top */}
              <div style={{padding:"14px 16px 10px",display:"flex",gap:12,alignItems:"flex-start"}}>
                <div style={{width:52,height:52,borderRadius:16,background:T.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}>{act.emoji}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",marginBottom:3}}>
                    <div style={{fontWeight:900,fontSize:15,color:T.text}}>{act.title}</div>
                    {act.status==="approved"&&<Badge bg={T.mintL} col="#065F46">✓ Godkänd</Badge>}
                    {act.status==="rejected"&&<Badge bg={T.roseL} col={T.rose}>✗ Avslagen</Badge>}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap",marginBottom:6}}>
                    <span style={{fontSize:11,background:T.bg,padding:"2px 8px",borderRadius:8,fontWeight:700,color:T.sub,border:`1px solid ${T.border}`}}>{act.cat}</span>
                    {sugBy&&<span style={{fontSize:11,color:T.sub,fontWeight:600}}>{sugBy.emoji} {sugBy.name}</span>}
                  {act.visibleTo&&act.visibleTo.length>0&&<span style={{fontSize:11,background:"#FEF3C7",color:"#92400E",fontWeight:800,padding:"2px 7px",borderRadius:7}}>🔒 Begränsad</span>}
                  </div>
                  <div style={{fontSize:13,color:T.sub,lineHeight:1.5}}>{act.desc}</div>
                  {(act.date||act.duration)&&(
                    <div style={{display:"flex",gap:7,marginTop:7,flexWrap:"wrap"}}>
                      {act.date&&<span style={{fontSize:11,fontWeight:700,color:T.sky,background:T.skyL,padding:"3px 8px",borderRadius:8}}>📅 {new Date(act.date).toLocaleDateString("sv-SE",{day:"numeric",month:"short",year:"numeric"})}</span>}
                      {act.duration&&<span style={{fontSize:11,fontWeight:700,color:T.plum,background:T.plumL,padding:"3px 8px",borderRadius:8}}>⏱ {act.duration}</span>}
                    </div>
                  )}
                </div>
                {canDelete&&<button onClick={()=>setConfirmDel(act.id)} style={{color:T.border,fontSize:16,padding:"3px 7px",borderRadius:9,flexShrink:0,transition:"color .15s"}} onMouseEnter={e=>e.target.style.color=T.rose} onMouseLeave={e=>e.target.style.color=T.border}>✕</button>}
              </div>
              {/* Votes */}
              {tot>0&&(
                <div style={{padding:"0 16px 10px"}}>
                  <div style={{display:"flex",gap:5,marginBottom:8,flexWrap:"wrap"}}>
                    {members.map(u=>{const v=act.votes[u.id];if(!v)return null;return <span key={u.id} style={{background:v==="yes"?T.mintL:v==="no"?T.roseL:T.sunL,color:v==="yes"?"#065F46":v==="no"?T.rose:"#92400E",padding:"3px 8px",borderRadius:8,fontSize:11,fontWeight:800}}>{u.emoji}{v==="yes"?"❤️":v==="no"?"✗":"🤔"}</span>;})}
                  </div>
                  <div style={{height:6,borderRadius:4,background:T.bg,overflow:"hidden",display:"flex"}}>
                    <div style={{width:`${(yV/tot)*100}%`,background:T.mint,transition:"width .4s"}}/>
                    <div style={{width:`${(mV/tot)*100}%`,background:T.sun}}/>
                    <div style={{width:`${(nV/tot)*100}%`,background:T.rose}}/>
                  </div>
                </div>
              )}
              {/* Vote buttons */}
              <div style={{display:"flex",gap:0,borderTop:`1px solid ${T.border}`}}>
                {[{val:"yes",icon:"❤️",label:"Ja!",bg:T.mintL,bdr:T.mint,col:"#065F46"},{val:"maybe",icon:"🤔",label:"Kanske",bg:T.sunL,bdr:T.sun,col:"#92400E"},{val:"no",icon:"✗",label:"Nej",bg:T.roseL,bdr:T.rose,col:T.rose}].map((v,i)=>(
                  <button key={v.val} className="tap" onClick={()=>castVote(act.id,v.val)}
                    style={{flex:1,padding:"12px 6px",fontWeight:800,fontSize:12,background:myV===v.val?v.bg:"white",color:myV===v.val?v.col:T.sub,
                      borderRight:i<2?`1px solid ${T.border}`:"none",transition:"all .18s",
                      boxShadow:myV===v.val?`inset 0 -3px 0 ${v.bdr}`:"none"}}>
                    {v.icon} {v.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {/* Confirm delete */}
      {confirmDel&&(()=>{const act=acts.find(a=>a.id===confirmDel);if(!act)return null;return(
        <div className="overlay" onClick={()=>setConfirmDel(null)}>
          <div className="sheet pop" onClick={e=>e.stopPropagation()}>
            <div style={{textAlign:"center",marginBottom:20}}>
              <div style={{width:60,height:60,borderRadius:18,background:T.roseL,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,margin:"0 auto 14px"}}>🗑️</div>
              <div style={{fontWeight:900,fontSize:18,marginBottom:6}}>Ta bort förslag?</div>
              <div style={{fontSize:14,color:T.sub,lineHeight:1.5}}><strong>{act.emoji} {act.title}</strong> tas bort permanent.</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              <button className="tap" onClick={()=>setConfirmDel(null)} style={{padding:"13px",borderRadius:14,background:T.bg,fontWeight:800,fontSize:14,color:T.sub}}>Avbryt</button>
              <button className="bounce tap" onClick={()=>{removeActivity(confirmDel);setConfirmDel(null);showToast("Borttaget.");}} style={PBtn(`linear-gradient(135deg,${T.rose},#E11D48)`,"13px","14px")}>Ta bort</button>
            </div>
          </div>
        </div>
      );})()}
    </div>
  );
}

// ─── Chat Tab ─────────────────────────────────────────────────────────────────
function ChatTab({messages,session,sendMessage}){
  const [text,setText]=useState("");
  const [showEmoji,setShowEmoji]=useState(false);
  const [showGif,setShowGif]=useState(false);
  const [gifSearch,setGifSearch]=useState("");
  const [gifs,setGifs]=useState([]);
  const [gifLoading,setGifLoading]=useState(false);
  const bottomRef=useRef();
  const inputRef=useRef();

  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);

  async function searchGifs(q){if(!q.trim())return;setGifLoading(true);try{const r=await fetch(`https://api.tenor.com/v1/search?q=${encodeURIComponent(q)}&key=LIVDSRZULELA&limit=16&media_filter=minimal&contentfilter=low`);const d=await r.json();setGifs(d.results||[]);}catch{setGifs([]);}setGifLoading(false);}
  async function loadTrending(){setGifLoading(true);try{const r=await fetch(`https://api.tenor.com/v1/trending?key=LIVDSRZULELA&limit=16&media_filter=minimal&contentfilter=low`);const d=await r.json();setGifs(d.results||[]);}catch{setGifs([]);}setGifLoading(false);}
  function pickGif(gif){const url=gif.media?.[0]?.tinygif?.url||gif.media?.[0]?.gif?.url||"";sendMessage(text,url);setText("");setShowGif(false);setGifs([]);}
  function send(){if(!text.trim())return;sendMessage(text,null);setText("");setShowEmoji(false);inputRef.current?.focus();}
  function fmtTime(ts){return new Date(ts).toLocaleTimeString("sv-SE",{hour:"2-digit",minute:"2-digit"});}
  function fmtDay(ts){const d=new Date(ts),t=new Date();if(d.toDateString()===t.toDateString())return"Idag";const y=new Date(t);y.setDate(t.getDate()-1);if(d.toDateString()===y.toDateString())return"Igår";return d.toLocaleDateString("sv-SE",{day:"numeric",month:"short"});}
  let lastDay="";

  return(
    <div className="fade" style={{display:"flex",flexDirection:"column",height:"calc(100vh - 200px)",minHeight:400}}>
      <SectionHeader icon="💬" title="Familjechatten" color={T.plum}/>
      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:4,paddingBottom:8}}>
        {messages.length===0&&(
          <div style={{textAlign:"center",padding:"48px 20px",color:T.sub}}>
            <div style={{fontSize:48,marginBottom:10}}>💬</div>
            <div style={{fontWeight:800,fontSize:15}}>Inga meddelanden ännu</div>
            <div style={{fontSize:13,marginTop:4,color:T.border}}>Var den första att skriva!</div>
          </div>
        )}
        {messages.map((msg,i)=>{
          const isMe=msg.userId===session?.userId;
          const day=fmtDay(msg.ts);
          const showDay=day!==lastDay;lastDay=day;
          const prev=messages[i-1];
          const sameUser=prev&&prev.userId===msg.userId&&fmtDay(prev.ts)===day;
          return(
            <div key={msg.id}>
              {showDay&&<div style={{textAlign:"center",margin:"12px 0 8px"}}><span style={{fontSize:11,fontWeight:700,color:T.sub,background:"white",padding:"4px 12px",borderRadius:12,boxShadow:`0 2px 8px rgba(0,0,0,.06)`}}>{day}</span></div>}
              <div style={{display:"flex",flexDirection:isMe?"row-reverse":"row",alignItems:"flex-end",gap:8,marginBottom:sameUser?2:8}}>
                <div style={{width:30,height:30,borderRadius:"50%",overflow:"hidden",flexShrink:0,opacity:sameUser?0:1}}>
                  {msg.photo?<img src={msg.photo} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:<div style={{width:"100%",height:"100%",background:`${msg.color}20`,border:`1.5px solid ${msg.color}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15}}>{msg.emoji}</div>}
                </div>
                <div style={{maxWidth:"72%",display:"flex",flexDirection:"column",alignItems:isMe?"flex-end":"flex-start"}}>
                  {!sameUser&&!isMe&&<div style={{fontSize:11,fontWeight:700,color:msg.color,marginBottom:3,marginLeft:4}}>{msg.name}</div>}
                  {msg.gif&&<img src={msg.gif} alt="gif" style={{borderRadius:16,maxWidth:"100%",maxHeight:180,objectFit:"cover",marginBottom:msg.text?4:0,boxShadow:"0 3px 12px rgba(0,0,0,.12)"}}/>}
                  {msg.text&&(
                    <div style={{padding:"10px 14px",borderRadius:isMe?"18px 18px 4px 18px":"18px 18px 18px 4px",
                      background:isMe?`linear-gradient(135deg,${msg.color},${msg.color}dd)`:"white",
                      color:isMe?"white":T.text,fontSize:14,lineHeight:1.5,fontWeight:500,
                      boxShadow:isMe?`0 4px 14px ${msg.color}44`:`0 2px 10px rgba(0,0,0,.07)`,wordBreak:"break-word"}}>
                      {msg.text}
                    </div>
                  )}
                  <div style={{fontSize:9,color:T.border,fontWeight:600,marginTop:3,marginLeft:4,marginRight:4}}>{fmtTime(msg.ts)}</div>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>
      {/* Emoji picker */}
      {showEmoji&&(
        <div style={{background:"white",borderRadius:18,padding:"12px",marginBottom:8,boxShadow:`0 4px 20px rgba(0,0,0,.1)`,flexShrink:0,border:`1px solid ${T.border}`}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>{EMOJI_LIST.map(e=><button key={e} className="tap" onClick={()=>{setText(t=>t+e);inputRef.current?.focus();}} style={{fontSize:22,padding:"4px 5px",borderRadius:8}}>{e}</button>)}</div>
        </div>
      )}
      {/* GIF picker */}
      {showGif&&(
        <div style={{background:"white",borderRadius:18,padding:"12px",marginBottom:8,boxShadow:`0 4px 20px rgba(0,0,0,.1)`,flexShrink:0,border:`1px solid ${T.border}`}}>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <input value={gifSearch} onChange={e=>setGifSearch(e.target.value)} placeholder="Sök GIF…" style={FINP({fontSize:13,padding:"9px 12px",flex:1})} onKeyDown={e=>e.key==="Enter"&&searchGifs(gifSearch)} autoFocus onFocus={e=>e.target.style.borderColor=T.plum} onBlur={e=>e.target.style.borderColor=T.border}/>
            <button className="tap" onClick={()=>searchGifs(gifSearch)} style={PBtn(`linear-gradient(135deg,${T.plum},#7C3AED)`,"9px 14px","13px")}>Sök</button>
          </div>
          {gifLoading&&<div style={{textAlign:"center",padding:"16px",color:T.sub,fontSize:13}}>Laddar… 🔄</div>}
          {!gifLoading&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,maxHeight:180,overflowY:"auto"}}>
              {gifs.map(g=>{const src=g.media?.[0]?.tinygif?.url||g.media?.[0]?.gif?.url||"";return src?<img key={g.id} src={src} alt="" onClick={()=>pickGif(g)} style={{width:"100%",height:72,objectFit:"cover",borderRadius:10,cursor:"pointer"}}/>:null;})}
              {!gifs.length&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"16px",color:T.sub,fontSize:13}}>Inga GIFs hittades</div>}
            </div>
          )}
          <div style={{fontSize:9,color:T.border,textAlign:"right",marginTop:6,fontWeight:700}}>Powered by Tenor</div>
        </div>
      )}
      {/* Input */}
      <div style={{display:"flex",gap:8,alignItems:"flex-end",flexShrink:0,paddingTop:10,borderTop:`1px solid ${T.border}`}}>
        <button className="tap" onClick={()=>{setShowEmoji(s=>!s);setShowGif(false);}} style={{width:42,height:42,borderRadius:14,fontSize:20,background:showEmoji?T.sunL:"#F8FAFC",flexShrink:0,border:`1.5px solid ${showEmoji?T.sun:T.border}`,transition:"all .2s"}}>😊</button>
        <button className="tap" onClick={()=>{showGif?setShowGif(false):(setShowGif(true),loadTrending());setShowEmoji(false);}} style={{width:42,height:42,borderRadius:14,fontSize:12,fontWeight:900,background:showGif?T.plumL:"#F8FAFC",flexShrink:0,color:T.plum,border:`1.5px solid ${showGif?T.plum:T.border}`,transition:"all .2s"}}>GIF</button>
        <textarea ref={inputRef} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}} placeholder="Skriv ett meddelande…" rows={1}
          style={{...FINP({padding:"11px 14px",resize:"none",lineHeight:1.5,flex:1,borderRadius:16,fontSize:14}),overflowY:"auto",maxHeight:100}}
          onFocus={e=>e.target.style.borderColor=T.sky} onBlur={e=>e.target.style.borderColor=T.border}/>
        <button className="bounce tap" onClick={send} disabled={!text.trim()} style={{width:42,height:42,borderRadius:14,fontSize:18,flexShrink:0,background:text.trim()?`linear-gradient(135deg,${T.sky},${T.skyD})`:"#F8FAFC",boxShadow:text.trim()?`0 4px 14px ${T.sky}44`:"none",transition:"all .2s",display:"flex",alignItems:"center",justifyContent:"center",color:text.trim()?"white":T.border}}>➤</button>
      </div>
    </div>
  );
}

// ─── More Tab (Schema + Birthdays + Settings) ─────────────────────────────────
function MoreTab({members,overlap,session,users,saveUsers,updateSession,onLogout,showToast,emailNotify}){
  return(
    <div className="fade">
      <SettingsTab session={session} users={users} saveUsers={saveUsers} updateSession={updateSession} onLogout={onLogout} showToast={showToast} emailNotify={emailNotify}/>
    </div>
  );
}

// ─── Birthdays Tab ────────────────────────────────────────────────────────────
function BirthdaysTab({users, sendGreeting}){
  const withBday=users.filter(u=>u.birthday);
  const sorted=[...withBday].sort((a,b)=>{const md=d=>{const x=new Date(d);return x.getMonth()*100+x.getDate();};return md(a.birthday)-md(b.birthday);});
  const todayB=sorted.filter(u=>daysUntil(u.birthday)===0);
  const soonB=sorted.filter(u=>daysUntil(u.birthday)>0&&daysUntil(u.birthday)<=14);
  const nextUp=[...sorted].sort((a,b)=>daysUntil(a.birthday)-daysUntil(b.birthday))[0];
  const MONTHS=["Januari","Februari","Mars","April","Maj","Juni","Juli","Augusti","September","Oktober","November","December"];

  return(
    <div>
      {todayB.length>0&&(
        <div style={{background:`linear-gradient(135deg,${T.sun},#F97316)`,borderRadius:20,padding:"16px 18px",marginBottom:14,boxShadow:`0 6px 20px ${T.sun}50`}}>
          {todayB.map(u=>(
            <div key={u.id}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:10}}>
                <Avatar emoji={u.emoji} color="white" size={48} photo={u.photo}/>
                <div>
                  <div style={{fontSize:16,fontWeight:900,color:"white"}}>🎉 Grattis {u.name}!</div>
                  <div style={{fontSize:13,color:"rgba(255,255,255,.85)",fontWeight:600}}>Fyller {calcAge(u.birthday)+1} år idag! 🎂</div>
                </div>
              </div>
              {sendGreeting&&<button className="tap" onClick={()=>sendGreeting(u)}
                style={{width:"100%",padding:"10px",borderRadius:12,background:"rgba(255,255,255,.25)",
                  color:"white",fontWeight:800,fontSize:13,border:"1.5px solid rgba(255,255,255,.4)"}}>
                💬 Skicka födelsedag­hälsning i chatten
              </button>}
            </div>
          ))}
        </div>
      )}
      {soonB.length>0&&(
        <div style={{background:"white",borderRadius:18,padding:"14px 16px",marginBottom:14,boxShadow:`0 2px 14px rgba(0,0,0,.06)`,borderLeft:`5px solid ${T.coral}`}}>
          <div style={{fontSize:11,fontWeight:800,color:T.coral,letterSpacing:1.2,textTransform:"uppercase",marginBottom:10}}>📅 Snart — inom 14 dagar</div>
          {soonB.map(u=>{const d=daysUntil(u.birthday);return(
            <div key={u.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <Avatar emoji={u.emoji} color={u.color} size={38} photo={u.photo}/>
              <div style={{flex:1}}><div style={{fontWeight:800,fontSize:14}}>{u.name}</div><div style={{fontSize:11,color:T.sub}}>🎂 {fmtBday(u.birthday)} · fyller {calcAge(u.birthday)+1} år</div></div>
              <div style={{textAlign:"center"}}><div style={{fontWeight:900,fontSize:18,color:T.coral}}>{d}</div><div style={{fontSize:9,color:T.sub,fontWeight:700}}>dagar</div></div>
            </div>
          );})}
        </div>
      )}
      {withBday.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9,marginBottom:16}}>
          {[{l:"Registrerade",n:withBday.length,c:T.plum},{l:"Nästa om",n:`${nextUp?daysUntil(nextUp.birthday):"-"}d`,c:T.coral},{l:"Saknar datum",n:users.filter(u=>!u.birthday).length,c:T.sub}].map(s=>(
            <div key={s.l} style={{background:"white",borderRadius:14,padding:"11px 8px",textAlign:"center",boxShadow:`0 2px 12px rgba(0,0,0,.05)`,borderTop:`3px solid ${s.c}`}}>
              <div style={{fontWeight:900,fontSize:20,color:s.c}}>{s.n}</div>
              <div style={{fontSize:9,color:T.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:.4,marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>
      )}
      {withBday.length===0&&(
        <div style={{textAlign:"center",padding:"48px 20px",background:"white",borderRadius:22}}>
          <div style={{fontSize:52,marginBottom:12}}>🎂</div>
          <div style={{fontWeight:800,fontSize:15,color:T.sub}}>Inga födelsedagar ännu</div>
          <div style={{fontSize:13,color:T.border,marginTop:4}}>Lägg till under ⚙️ Inställningar → Min profil</div>
        </div>
      )}
      {MONTHS.map((month,mi)=>{
        const inM=sorted.filter(u=>new Date(u.birthday).getMonth()===mi);
        if(!inM.length)return null;
        return(
          <div key={month} style={{marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:800,color:T.sky,letterSpacing:1.5,textTransform:"uppercase",marginBottom:8,display:"flex",alignItems:"center",gap:8}}>
              <div style={{height:1,flex:1,background:T.border}}/>{month}<div style={{height:1,flex:1,background:T.border}}/>
            </div>
            {[...inM].sort((a,b)=>new Date(a.birthday).getDate()-new Date(b.birthday).getDate()).map(u=>{
              const d=daysUntil(u.birthday),isToday=d===0,soon=d<=14&&d>0;
              return(
                <div key={u.id} style={{background:"white",borderRadius:18,padding:"14px 16px",marginBottom:8,boxShadow:`0 2px 12px rgba(0,0,0,.06)`,borderLeft:`5px solid ${isToday?T.sun:soon?T.coral:u.color}`,display:"flex",alignItems:"center",gap:12}}>
                  <Avatar emoji={u.emoji} color={u.color} size={42} photo={u.photo}/>
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                      <div style={{fontWeight:800,fontSize:14}}>{u.name}</div>
                      {isToday&&<Badge bg={T.sunL} col="#D97706">🎉 IDAG!</Badge>}
                      {soon&&!isToday&&<Badge bg={T.roseL} col={T.rose}>Om {d} dag{d!==1?"ar":""}</Badge>}
                    </div>
                    <div style={{fontSize:13,fontWeight:800,color:T.text,marginTop:3}}>
                      {calcAge(u.birthday)+1} år
                    </div>
                    <div style={{fontSize:11,fontWeight:600,color:T.sub,marginTop:1}}>
                      Född {new Date(u.birthday).getFullYear()}
                    </div>
                  </div>
                  {/* Date on the right */}
                  <div style={{textAlign:"right",flexShrink:0,background:isToday?T.sunL:soon?T.roseL:`${u.color}12`,borderRadius:12,padding:"8px 12px"}}>
                    <div style={{fontWeight:900,fontSize:22,color:isToday?T.sun:soon?T.coral:u.color,lineHeight:1}}>
                      {new Date(u.birthday).getDate()}
                    </div>
                    <div style={{fontSize:11,fontWeight:700,color:isToday?T.sun:soon?T.coral:u.color,marginTop:2}}>
                      {fmtBday(u.birthday).split(" ")[1]}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────
function SettingsTab({session,users,saveUsers,updateSession,onLogout,showToast,emailNotify}){
  const isAdmin=session?.role==="admin";
  const [stab,setStab]=useState("profile");
  const STABS=[{id:"profile",label:"Min profil",icon:"👤"},...(isAdmin?[{id:"users",label:"Användare",icon:"👥"},{id:"create",label:"Skapa användare",icon:"➕"},{id:"firebase",label:"Databas",icon:"🔗"},{id:"email",label:"E-post",icon:"📧"}]:[])];
  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={{fontWeight:900,fontSize:18}}>⚙️ Inställningar</div>
        <button className="tap" onClick={onLogout} style={{padding:"8px 14px",borderRadius:12,background:T.roseL,color:T.rose,fontWeight:800,fontSize:13,border:`1px solid #FDA4AF`}}>Logga ut</button>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:18,overflowX:"auto",paddingBottom:2}}>
        {STABS.map(t=><button key={t.id} className="tap" onClick={()=>setStab(t.id)}
          style={{padding:"8px 14px",borderRadius:12,fontWeight:800,fontSize:12,whiteSpace:"nowrap",
            background:stab===t.id?`linear-gradient(135deg,${T.sky},${T.skyD})`:"white",
            color:stab===t.id?"white":T.sub,
            boxShadow:stab===t.id?`0 4px 14px ${T.sky}44`:`0 2px 8px rgba(0,0,0,.05)`,
            border:`1px solid ${stab===t.id?"transparent":T.border}`,transition:"all .2s"}}>
          {t.icon} {t.label}
        </button>)}
      </div>
      {stab==="profile"&&<ProfileTab session={session} users={users} saveUsers={saveUsers} updateSession={updateSession} showToast={showToast}/>}
      {stab==="firebase"&&isAdmin&&<FirebaseSettingsTab showToast={showToast}/>}
      {stab==="email"&&isAdmin&&<EmailSettingsTab users={users} showToast={showToast}/>}
      {stab==="users"&&isAdmin&&<UsersTab session={session} users={users} saveUsers={saveUsers} showToast={showToast}/>}
      {stab==="create"&&isAdmin&&<CreateUserTab users={users} saveUsers={saveUsers} showToast={showToast} onDone={()=>setStab("users")}/>}
    </div>
  );
}

// ─── Firebase Settings Tab (admin) ────────────────────────────────────────────
function FirebaseSettingsTab({showToast}){
  const existing = getFirebaseCfg()||{};
  const [cfg,setCfg]=useState(JSON.stringify(existing,null,2)||"");
  const [status,setStatus]=useState(existing?.databaseURL?"✅ Ansluten":"❌ Ej konfigurerad");

  async function save(){
    try{
      const parsed=JSON.parse(cfg);
      if(!parsed.databaseURL) return showToast("databaseURL saknas i konfigurationen.");
      saveFirebaseCfg(parsed);
      initDB();
      setStatus("✅ Ansluten till "+parsed.databaseURL);
      showToast("Firebase konfigurerad! Ladda om appen. ✓");
    }catch(e){ showToast("Ogiltig JSON — kontrollera formatet."); }
  }

  return(
    <div className="fade">
      <div style={{background:"#EFF6FF",border:"1.5px solid #BFDBFE",borderRadius:16,padding:"14px 16px",marginBottom:14}}>
        <div style={{fontWeight:800,fontSize:13,color:"#1D4ED8",marginBottom:6}}>🔗 Varför Firebase?</div>
        <div style={{fontSize:12,color:"#1E40AF",lineHeight:1.7}}>
          Utan Firebase sparas data bara på <strong>din enhet</strong>.<br/>
          Med Firebase delar alla familjemedlemmar samma data — oavsett vilken mobil de använder.
        </div>
      </div>

      <div style={{background:"#FEF3C7",border:"1.5px solid #FCD34D",borderRadius:14,padding:"12px 14px",marginBottom:14}}>
        <div style={{fontWeight:800,fontSize:12,color:"#92400E",marginBottom:6}}>🔧 Steg 1 — Skapa Firebase-projekt (gratis)</div>
        <div style={{fontSize:11,color:"#78350F",lineHeight:1.8}}>
          1. Gå till <strong>console.firebase.google.com</strong><br/>
          2. Klicka <strong>"Skapa projekt"</strong> → döp det till "fammy"<br/>
          3. Gå till <strong>Realtime Database</strong> → Skapa databas → välj <strong>testläge</strong><br/>
          4. Gå till <strong>Projektinställningar</strong> (kugghjul) → <strong>Dina appar</strong> → Lägg till webbapp<br/>
          5. Kopiera firebaseConfig-objektet och klistra in nedan
        </div>
      </div>

      <div style={{background:"white",borderRadius:20,padding:"18px",boxShadow:`0 2px 14px rgba(0,0,0,.06)`}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <Label>FIREBASE CONFIG (JSON)</Label>
          <span style={{fontSize:11,fontWeight:700,color:status.startsWith("✅")?T.mint:T.rose}}>{status}</span>
        </div>
        <textarea value={cfg} onChange={e=>setCfg(e.target.value)} rows={10}
          placeholder={`{
  "apiKey": "...",
  "authDomain": "...",
  "databaseURL": "https://fammy-default-rtdb.firebaseio.com",
  "projectId": "...",
  "storageBucket": "...",
  "messagingSenderId": "...",
  "appId": "..."
}`}
          style={{...FINP({fontSize:11,lineHeight:1.5,fontFamily:"monospace",resize:"none"}),marginBottom:14}}
          onFocus={e=>e.target.style.borderColor=T.sky} onBlur={e=>e.target.style.borderColor=T.border}/>
        <button className="bounce tap" onClick={save} style={{...PBtn(`linear-gradient(135deg,${T.sky},${T.skyD})`),width:"100%",padding:"13px"}}>
          Spara & anslut 🔗
        </button>
        <div style={{fontSize:11,color:T.sub,marginTop:10,textAlign:"center"}}>Ladda om appen efter att du sparat</div>
      </div>
    </div>
  );
}

// ─── Email Settings Tab (admin) ───────────────────────────────────────────────
function EmailSettingsTab({users,showToast}){
  const cfg = getEmailCfg();
  const [serviceId,  setServiceId]  = useState(cfg.serviceId||"");
  const [templateId, setTemplateId] = useState(cfg.templateId||"");
  const [publicKey,  setPublicKey]  = useState(cfg.publicKey||"");
  const [enabled,    setEnabled]    = useState(cfg.enabled||false);
  const [testing,    setTesting]    = useState(false);

  function save(){
    lsSet(EMAIL_CFG_KEY,{serviceId:serviceId.trim(),templateId:templateId.trim(),publicKey:publicKey.trim(),enabled});
    showToast("E-postinställningar sparade! ✓");
  }

  async function testEmail(){
    setTesting(true);
    lsSet(EMAIL_CFG_KEY,{serviceId:serviceId.trim(),templateId:templateId.trim(),publicKey:publicKey.trim(),enabled:true});
    await loadEmailJS();
    const me=users.find(u=>u.email);
    if(!me){showToast("Ingen användare med e-post hittades.");setTesting(false);return;}
    const ok=await sendEmail(me.email,me.name,"☀️ Fammy fungerar!",`Hej ${me.name}!\n\nDetta är ett testmeddelande från Fammy. E-postaviseringar fungerar!\n\n☀️ Fammy`);
    showToast(ok?"✅ Testmail skickat till "+me.email:"❌ Något gick fel — kontrollera uppgifterna.");
    setTesting(false);
  }

  return(
    <div className="fade">
      <div style={{background:"#EFF6FF",border:"1.5px solid #BFDBFE",borderRadius:16,padding:"14px 16px",marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:13,color:"#1D4ED8",marginBottom:6}}>📧 Hur det fungerar</div>
        <div style={{fontSize:12,color:"#1E40AF",lineHeight:1.6}}>
          Fammy använder <strong>EmailJS</strong> (gratis, 200 mail/mån) för att skicka:<br/>
          • 🎯 Avisering vid nytt aktivitetsförslag<br/>
          • 🎂 Påminnelse när det är någons födelsedag<br/>
          • 🗳️ Påminnelse om ej röstade förslag
        </div>
      </div>

      <div style={{background:"#FEF3C7",border:"1.5px solid #FCD34D",borderRadius:14,padding:"12px 14px",marginBottom:16}}>
        <div style={{fontWeight:800,fontSize:12,color:"#92400E",marginBottom:4}}>🔧 Steg 1 — Skapa EmailJS-konto</div>
        <div style={{fontSize:11,color:"#78350F",lineHeight:1.7}}>
          1. Gå till <strong>emailjs.com</strong> och skapa gratis konto<br/>
          2. Lägg till en Email Service (Gmail, Outlook m.fl.)<br/>
          3. Skapa ett Email Template med variablerna:<br/>
          &nbsp;&nbsp;&nbsp;<code style={{background:"#FDE68A",padding:"1px 5px",borderRadius:4}}>{"{{to_name}}"}</code>&nbsp;
          <code style={{background:"#FDE68A",padding:"1px 5px",borderRadius:4}}>{"{{subject}}"}</code>&nbsp;
          <code style={{background:"#FDE68A",padding:"1px 5px",borderRadius:4}}>{"{{message}}"}</code><br/>
          4. Kopiera Service ID, Template ID och Public Key nedan
        </div>
      </div>

      <div style={{background:"white",borderRadius:20,padding:"18px",boxShadow:`0 2px 14px rgba(0,0,0,.06)`}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <Label>E-POSTAVISERINGAR</Label>
          <button className="tap" onClick={()=>setEnabled(e=>!e)}
            style={{padding:"6px 14px",borderRadius:10,fontWeight:800,fontSize:12,
              background:enabled?T.mintL:T.bg,color:enabled?"#065F46":T.sub,
              border:`1.5px solid ${enabled?T.mint:T.border}`}}>
            {enabled?"✓ Aktiverat":"Inaktiverat"}
          </button>
        </div>

        {[["SERVICE ID","ex: service_abc123",serviceId,setServiceId],
          ["TEMPLATE ID","ex: template_xyz456",templateId,setTemplateId],
          ["PUBLIC KEY","ex: user_AbCdEfGh...",publicKey,setPublicKey]].map(([lbl,ph,val,set])=>(
          <div key={lbl} style={{marginBottom:12}}>
            <Label>{lbl}</Label>
            <input value={val} onChange={e=>set(e.target.value)} placeholder={ph}
              style={FINP({fontSize:13,fontFamily:"monospace"})}
              onFocus={e=>e.target.style.borderColor=T.sky} onBlur={e=>e.target.style.borderColor=T.border}/>
          </div>
        ))}

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:16}}>
          <button className="tap" onClick={testEmail} disabled={testing||!serviceId||!templateId||!publicKey}
            style={{padding:"12px",borderRadius:13,background:T.skyL,color:T.skyD,fontWeight:800,fontSize:13,
              opacity:(!serviceId||!templateId||!publicKey)?0.4:1}}>
            {testing?"Skickar…":"📨 Testa"}
          </button>
          <button className="bounce tap" onClick={save}
            style={PBtn(`linear-gradient(135deg,${T.sky},${T.skyD})`,"12px","13px")}>
            Spara ✓
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────
function ProfileTab({session,users,saveUsers,updateSession,showToast}){
  const u=users.find(x=>x.id===session?.userId)||{};
  const [name,setName]=useState(u.name||"");
  const [emoji,setEmoji]=useState(u.emoji||"👦");
  const [color,setColor]=useState(u.color||T.sky);
  const [birthday,setBirthday]=useState(u.birthday||"");
  const [photo,setPhoto]=useState(u.photo||null);
  const [pass,setPass]=useState("");
  const [conf,setConf]=useState("");
  const [err,setErr]=useState("");
  const fileRef=useRef();
  function handlePhoto(e){const file=e.target.files?.[0];if(!file)return;if(file.size>2*1024*1024)return setErr("Max 2 MB.");const r=new FileReader();r.onload=ev=>setPhoto(ev.target.result);r.readAsDataURL(file);}
  function save(){setErr("");if(!name.trim())return setErr("Ange ditt namn.");if(pass&&pass.length<4)return setErr("Minst 4 tecken.");if(pass&&pass!==conf)return setErr("Lösenorden matchar inte.");saveUsers(users.map(x=>x.id!==session.userId?x:{...x,name:name.trim(),emoji,color,birthday,photo,...(pass?{password:pass}:{})}));updateSession({name:name.trim(),emoji,color,photo});setPass("");setConf("");showToast("Profil sparad! ✓");}
  const a=birthday?calcAge(birthday):null;
  return(
    <div>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{position:"relative",display:"inline-block",marginBottom:8}}>
          <Avatar emoji={emoji} color={color} size={84} photo={photo}/>
          <button className="tap" onClick={()=>fileRef.current?.click()} style={{position:"absolute",bottom:-4,right:-4,width:30,height:30,borderRadius:"50%",background:`linear-gradient(135deg,${T.sky},${T.skyD})`,color:"white",fontSize:15,boxShadow:`0 3px 10px ${T.sky}55`,display:"flex",alignItems:"center",justifyContent:"center"}}>📷</button>
          <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handlePhoto}/>
        </div>
        {photo&&<div><button className="tap" onClick={()=>setPhoto(null)} style={{fontSize:11,color:T.sub,textDecoration:"underline",fontWeight:700}}>Ta bort foto</button></div>}
        <div style={{fontWeight:900,fontSize:17,marginTop:8}}>{name||u.name}</div>
        <div style={{fontSize:12,color:T.sub,marginTop:2}}>{u.email}</div>
        {a!==null&&<div style={{fontSize:12,color:T.sun,fontWeight:800,marginTop:3}}>🎂 {a} år</div>}
        <div style={{marginTop:6}}><Badge bg={session?.role==="admin"?T.plumL:T.mintL} col={session?.role==="admin"?T.plum:"#065F46"}>{session?.role==="admin"?"👑 Admin":"👤 Användare"}</Badge></div>
      </div>
      <div style={{background:"white",borderRadius:20,padding:"18px",boxShadow:`0 2px 14px rgba(0,0,0,.06)`}}>
        <div style={{marginBottom:12}}><Label>NAMN</Label><input value={name} onChange={e=>setName(e.target.value)} style={FINP()} onFocus={e=>e.target.style.borderColor=T.sky} onBlur={e=>e.target.style.borderColor=T.border}/></div>
        <div style={{marginBottom:14}}><Label>FÖDELSEDAG</Label><input value={birthday} onChange={e=>setBirthday(e.target.value)} type="date" style={FINP()} onFocus={e=>e.target.style.borderColor=T.sky} onBlur={e=>e.target.style.borderColor=T.border}/></div>
        <EmojiPicker value={emoji} onChange={setEmoji}/>
        <ColorPicker value={color} onChange={setColor}/>
        <div style={{margin:"14px 0 12px",borderTop:`1px solid ${T.border}`,paddingTop:14}}>
          <Label>NYTT LÖSENORD (lämna tomt för att behålla)</Label>
          <input value={pass} onChange={e=>setPass(e.target.value)} type="password" placeholder="Nytt lösenord…" style={{...FINP(),marginBottom:10}} onFocus={e=>e.target.style.borderColor=T.sky} onBlur={e=>e.target.style.borderColor=T.border}/>
          <input value={conf} onChange={e=>setConf(e.target.value)} type="password" placeholder="Bekräfta…" style={FINP()} onFocus={e=>e.target.style.borderColor=T.sky} onBlur={e=>e.target.style.borderColor=T.border}/>
        </div>
        {err&&<ErrBox msg={err}/>}
        <button className="bounce tap" onClick={save} style={{...PBtn(`linear-gradient(135deg,${T.sky},${T.skyD})`),width:"100%",marginTop:14}}>Spara ändringar ✓</button>
      </div>
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab({session,users,saveUsers,showToast}){
  const [editing, setEditing] = useState(null); // user object being edited
  const [ef, setEf] = useState({}); // edit fields
  const [epass, setEpass] = useState("");
  const [econf, setEconf] = useState("");
  const [eerr, setEerr]   = useState("");
  const eFileRef = useRef();

  function openEdit(u){
    setEf({name:u.name,email:u.email,emoji:u.emoji,color:u.color,birthday:u.birthday||"",role:u.role,photo:u.photo||null});
    setEpass(""); setEconf(""); setEerr("");
    setEditing(u);
  }

  function handleEPhoto(e){
    const file=e.target.files?.[0]; if(!file) return;
    if(file.size>2*1024*1024) return setEerr("Max 2 MB.");
    const r=new FileReader(); r.onload=ev=>setEf(f=>({...f,photo:ev.target.result})); r.readAsDataURL(file);
  }

  function saveEdit(){
    setEerr("");
    if(!ef.name.trim()) return setEerr("Ange namn.");
    if(!ef.email.includes("@")) return setEerr("Ogiltig e-post.");
    if(users.find(u=>u.email.toLowerCase()===ef.email.toLowerCase()&&u.id!==editing.id)) return setEerr("E-posten används redan.");
    if(epass&&epass.length<4) return setEerr("Lösenordet måste vara minst 4 tecken.");
    if(epass&&epass!==econf) return setEerr("Lösenorden matchar inte.");
    saveUsers(users.map(u=>u.id!==editing.id?u:{...u,...ef,name:ef.name.trim(),...(epass?{password:epass}:{})}));
    showToast(`${ef.emoji} ${ef.name} uppdaterad! ✓`);
    setEditing(null);
  }

  function toggleRole(id){if(id==="admin_root")return showToast("Rot-adminen kan inte ändras.");saveUsers(users.map(u=>u.id===id?{...u,role:u.role==="admin"?"user":"admin"}:u));showToast("Roll uppdaterad!");}
  function deleteUser(id){if(id===session.userId)return showToast("Du kan inte ta bort dig själv.");if(id==="admin_root")return showToast("Rot-adminen kan inte tas bort.");saveUsers(users.filter(u=>u.id!==id));showToast("Användare borttagen.");}

  return(
    <div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9,marginBottom:16}}>
        {[{l:"Totalt",n:users.length,c:T.plum},{l:"Admins",n:users.filter(u=>u.role==="admin").length,c:T.sky},{l:"Användare",n:users.filter(u=>u.role==="user").length,c:T.mint}].map(s=>(
          <div key={s.l} style={{background:"white",borderRadius:14,padding:"11px 8px",textAlign:"center",boxShadow:`0 2px 12px rgba(0,0,0,.05)`,borderTop:`3px solid ${s.c}`}}>
            <div style={{fontWeight:900,fontSize:22,color:s.c}}>{s.n}</div>
            <div style={{fontSize:10,color:T.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:.5}}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {users.map(u=>{const isMe=u.id===session.userId,isRoot=u.id==="admin_root";return(
          <div key={u.id} style={{background:"white",borderRadius:18,padding:"14px 16px",boxShadow:`0 2px 12px rgba(0,0,0,.06)`,borderLeft:`5px solid ${u.role==="admin"?T.plum:T.mint}`}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <Avatar emoji={u.emoji} color={u.color} size={44} photo={u.photo}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                  <div style={{fontWeight:900,fontSize:15}}>{u.name}</div>
                  {isMe&&<Badge bg={T.sunL} col="#D97706">DU</Badge>}
                  {isRoot&&<Badge bg={T.plumL} col={T.plum}>ROT</Badge>}
                </div>
                <div style={{fontSize:11,color:T.sub,marginTop:1}}>{u.email}</div>
                {u.birthday&&<div style={{fontSize:11,color:T.sun,fontWeight:700,marginTop:2}}>🎂 {fmtBday(u.birthday)} · {calcAge(u.birthday)} år</div>}
                <div style={{marginTop:4}}>{u.type==="child"||u.role==="child"?<Badge bg="#FEF9C3" col="#D97706">👶 Barn</Badge>:<Badge bg={u.role==="admin"?T.plumL:T.mintL} col={u.role==="admin"?T.plum:"#065F46"}>{u.role==="admin"?"👑 Admin":"👤 Användare"}</Badge>}</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:6,flexShrink:0}}>
                <button className="tap" onClick={()=>openEdit(u)} style={{padding:"7px 12px",borderRadius:10,background:T.skyL,fontWeight:700,fontSize:11,color:T.sky}}>✏️ Redigera</button>
                <div style={{display:"flex",gap:6}}>
                  <button className="tap" onClick={()=>toggleRole(u.id)} disabled={isRoot} style={{flex:1,padding:"6px 8px",borderRadius:9,background:isRoot?"#F8FAFC":T.plumL,fontWeight:700,fontSize:10,color:isRoot?T.border:T.plum,cursor:isRoot?"default":"pointer"}}>{u.role==="admin"?"→ User":"→ Admin"}</button>
                  <button className="tap" onClick={()=>deleteUser(u.id)} disabled={isMe||isRoot} style={{padding:"6px 9px",borderRadius:9,background:isMe||isRoot?"#F8FAFC":T.roseL,fontWeight:700,fontSize:11,color:isMe||isRoot?T.border:T.rose,cursor:isMe||isRoot?"default":"pointer"}}>🗑</button>
                </div>
              </div>
            </div>
            <div style={{marginTop:7,fontSize:10,color:T.border}}>Skapad: {new Date(u.createdAt).toLocaleDateString("sv-SE")}</div>
          </div>
        );})}
      </div>

      {/* Edit user sheet */}
      {editing&&(
        <div className="overlay" onClick={()=>setEditing(null)}>
          <div className="sheet pop" onClick={e=>e.stopPropagation()}>
            <div style={{fontWeight:900,fontSize:20,marginBottom:4,color:T.text}}>✏️ Redigera användare</div>
            <div style={{fontSize:13,color:T.sub,marginBottom:18}}>{editing.name}</div>

            {/* Avatar */}
            <div style={{textAlign:"center",marginBottom:18}}>
              <div style={{position:"relative",display:"inline-block"}}>
                <Avatar emoji={ef.emoji} color={ef.color} size={72} photo={ef.photo}/>
                <button className="tap" onClick={()=>eFileRef.current?.click()} style={{position:"absolute",bottom:-4,right:-4,width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${T.sky},${T.skyD})`,color:"white",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 3px 8px ${T.sky}55`}}>📷</button>
                <input ref={eFileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleEPhoto}/>
              </div>
              {ef.photo&&<div style={{marginTop:4}}><button className="tap" onClick={()=>setEf(f=>({...f,photo:null}))} style={{fontSize:11,color:T.sub,textDecoration:"underline",fontWeight:700}}>Ta bort foto</button></div>}
            </div>

            {/* Fields */}
            <div style={{marginBottom:12}}><Label>NAMN</Label>
              <input value={ef.name} onChange={e=>setEf(f=>({...f,name:e.target.value}))} style={FINP()} onFocus={e=>e.target.style.borderColor=T.sky} onBlur={e=>e.target.style.borderColor=T.border}/>
            </div>
            <div style={{marginBottom:12}}><Label>E-POST</Label>
              <input value={ef.email} onChange={e=>setEf(f=>({...f,email:e.target.value}))} type="email" style={FINP()} onFocus={e=>e.target.style.borderColor=T.sky} onBlur={e=>e.target.style.borderColor=T.border}/>
            </div>
            <div style={{marginBottom:14}}><Label>FÖDELSEDAG</Label>
              <input value={ef.birthday} onChange={e=>setEf(f=>({...f,birthday:e.target.value}))} type="date" style={FINP()} onFocus={e=>e.target.style.borderColor=T.sky} onBlur={e=>e.target.style.borderColor=T.border}/>
            </div>
            <EmojiPicker value={ef.emoji} onChange={v=>setEf(f=>({...f,emoji:v}))}/>
            <ColorPicker value={ef.color} onChange={v=>setEf(f=>({...f,color:v}))}/>

            {/* Role */}
            {editing.id!=="admin_root"&&(
              <div style={{marginBottom:14,marginTop:8}}><Label>ROLL</Label>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {[["user","👤","Användare",T.mint,T.mintL,"#065F46"],["admin","👑","Admin",T.plum,T.plumL,T.plum]].map(([r,ic,lbl,bdr,bg,col])=>(
                    <button key={r} className="tap" onClick={()=>setEf(f=>({...f,role:r}))} style={{padding:"11px",borderRadius:13,border:`2.5px solid ${ef.role===r?bdr:T.border}`,background:ef.role===r?bg:"#F8FAFC",fontWeight:800,fontSize:13,color:ef.role===r?col:T.sub,transition:"all .18s"}}>{ic} {lbl}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Password */}
            <div style={{borderTop:`1px solid ${T.border}`,paddingTop:14,marginBottom:12}}>
              <Label>NYTT LÖSENORD (lämna tomt för att behålla)</Label>
              <input value={epass} onChange={e=>setEpass(e.target.value)} type="password" placeholder="Nytt lösenord…" style={{...FINP(),marginBottom:10}} onFocus={e=>e.target.style.borderColor=T.sky} onBlur={e=>e.target.style.borderColor=T.border}/>
              <input value={econf} onChange={e=>setEconf(e.target.value)} type="password" placeholder="Bekräfta lösenord…" style={FINP()} onFocus={e=>e.target.style.borderColor=T.sky} onBlur={e=>e.target.style.borderColor=T.border}/>
            </div>

            {eerr&&<ErrBox msg={eerr}/>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:4}}>
              <button className="tap" onClick={()=>setEditing(null)} style={{padding:"13px",borderRadius:14,background:T.bg,fontWeight:800,color:T.sub,fontSize:14,border:`1px solid ${T.border}`}}>Avbryt</button>
              <button className="bounce tap" onClick={saveEdit} style={PBtn(`linear-gradient(135deg,${T.sky},${T.skyD})`,"13px","14px")}>Spara ✓</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create User Tab ──────────────────────────────────────────────────────────
function CreateUserTab({users,saveUsers,showToast,onDone}){
  const [accountType,setAccountType] = useState(null); // null=pick, "adult", "child"
  const [step,setStep]  = useState(1);
  const [name,setName]  = useState(""); const [email,setEmail]=useState("");
  const [pass,setPass]  = useState(""); const [conf,setConf] =useState("");
  const [birthday,setBirthday]=useState(""); const [role,setRole]=useState("user");
  const [emoji,setEmoji]=useState("👦"); const [color,setColor]=useState(T.sky);
  const [photo,setPhoto]=useState(null); const [err,setErr]=useState(""); const [done,setDone]=useState(false);
  const fileRef=useRef();

  function handlePhoto(e){const file=e.target.files?.[0];if(!file)return;if(file.size>2*1024*1024)return setErr("Max 2 MB.");const r=new FileReader();r.onload=ev=>setPhoto(ev.target.result);r.readAsDataURL(file);}

  function next(){
    setErr("");
    if(!name.trim()) return setErr("Ange namn.");
    if(accountType==="adult"){
      if(!email.includes("@")) return setErr("Ogiltig e-post.");
      if(users.find(u=>u.email&&u.email.toLowerCase()===email.toLowerCase())) return setErr("E-posten används redan.");
      if(pass.length<4) return setErr("Minst 4 tecken i lösenordet.");
      if(pass!==conf) return setErr("Lösenorden matchar inte.");
    }
    setStep(2);
  }

  function submit(){
    const u = accountType==="child"
      ? {id:"u_"+Date.now(),name:name.trim(),type:"child",role:"child",emoji,color,photo:photo||null,freeWeeks:[],birthday,createdAt:new Date().toISOString()}
      : {id:"u_"+Date.now(),name:name.trim(),type:"adult",email:email.trim(),password:pass,role,emoji,color,photo:photo||null,freeWeeks:[],birthday,createdAt:new Date().toISOString()};
    saveUsers([...users,u]);
    showToast(`${emoji} ${name} skapad! 🎉`);
    setDone(true);
  }

  function reset(){setAccountType(null);setStep(1);setName("");setEmail("");setPass("");setConf("");setBirthday("");setRole("user");setEmoji("👦");setColor(T.sky);setPhoto(null);setErr("");setDone(false);}

  if(done) return(
    <div style={{background:"white",borderRadius:22,padding:"36px 20px",textAlign:"center",boxShadow:`0 2px 14px rgba(0,0,0,.06)`}}>
      <div style={{fontSize:52,marginBottom:12}}>🎉</div>
      <div style={{fontWeight:900,fontSize:18,marginBottom:6}}>{accountType==="child"?"Barn":"Användare"} skapad!</div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:4}}>
        <Avatar emoji={emoji} color={color} size={36} photo={photo}/>
        <span style={{fontWeight:800,fontSize:15}}>{name}</span>
      </div>
      <div style={{fontSize:13,color:T.sub,marginBottom:20}}>
        {accountType==="child"
          ? <><span style={{background:"#FEF9C3",color:"#D97706",padding:"3px 10px",borderRadius:8,fontWeight:800,fontSize:12}}>👶 Barn · ingen inloggning</span></>
          : <span style={{background:role==="admin"?T.plumL:T.mintL,color:role==="admin"?T.plum:"#065F46",padding:"3px 10px",borderRadius:8,fontWeight:800,fontSize:12}}>{role==="admin"?"👑 Admin":"👤 Användare"}</span>
        }
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <button className="tap" onClick={reset} style={{padding:"12px",borderRadius:13,background:T.bg,fontWeight:800,color:T.sub,fontSize:14,border:`1px solid ${T.border}`}}>+ Ny</button>
        <button className="bounce tap" onClick={onDone} style={PBtn(`linear-gradient(135deg,${T.sky},${T.skyD})`,"12px","14px")}>Visa alla →</button>
      </div>
    </div>
  );

  // Step 0 — pick account type
  if(!accountType) return(
    <div className="fade">
      <div style={{fontWeight:900,fontSize:17,marginBottom:6}}>Vad ska kontot vara?</div>
      <div style={{fontSize:13,color:T.sub,marginBottom:20}}>Välj typ av konto</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <button className="bounce tap" onClick={()=>setAccountType("adult")}
          style={{background:"white",borderRadius:20,padding:"24px 16px",textAlign:"center",boxShadow:`0 4px 20px rgba(0,0,0,.08)`,border:`2px solid ${T.border}`}}>
          <div style={{fontSize:42,marginBottom:10}}>🧑</div>
          <div style={{fontWeight:900,fontSize:15,marginBottom:4}}>Vuxen</div>
          <div style={{fontSize:11,color:T.sub,lineHeight:1.5}}>Kan logga in med<br/>e-post & lösenord</div>
        </button>
        <button className="bounce tap" onClick={()=>setAccountType("child")}
          style={{background:"white",borderRadius:20,padding:"24px 16px",textAlign:"center",boxShadow:`0 4px 20px rgba(0,0,0,.08)`,border:`2px solid ${T.border}`}}>
          <div style={{fontSize:42,marginBottom:10}}>👶</div>
          <div style={{fontWeight:900,fontSize:15,marginBottom:4}}>Barn</div>
          <div style={{fontSize:11,color:T.sub,lineHeight:1.5}}>Syns i familjen<br/>men loggar inte in</div>
        </button>
      </div>
    </div>
  );

  return(
    <div>
      {/* Type indicator + back */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
        <button className="tap" onClick={()=>{setAccountType(null);setStep(1);setErr("");}} style={{padding:"6px 12px",borderRadius:10,background:T.bg,fontWeight:700,fontSize:12,color:T.sub,border:`1px solid ${T.border}`}}>← Byt typ</button>
        <div style={{padding:"5px 12px",borderRadius:10,fontWeight:800,fontSize:12,
          background:accountType==="child"?"#FEF9C3":T.mintL,
          color:accountType==="child"?"#D97706":"#065F46"}}>
          {accountType==="child"?"👶 Barn · ingen inloggning":"🧑 Vuxen · med inloggning"}
        </div>
      </div>

      {/* Steps indicator */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
        {[1,2].map(n=><div key={n} style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:28,height:28,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,fontSize:12,
            background:step>=n?`linear-gradient(135deg,${T.sky},${T.skyD})`:"#F8FAFC",
            color:step>=n?"white":T.sub,border:`1.5px solid ${step>=n?T.sky:T.border}`}}>{n}</div>
          <span style={{fontSize:12,fontWeight:700,color:step>=n?T.sky:T.sub}}>{n===1?"Info":"Utseende"}</span>
          {n<2&&<div style={{width:20,height:2,borderRadius:1,background:step>n?T.sky:T.border}}/>}
        </div>)}
      </div>

      <div style={{background:"white",borderRadius:20,padding:"18px",boxShadow:`0 2px 14px rgba(0,0,0,.06)`}}>
        {step===1&&(
          <div className="fade">
            <div style={{marginBottom:14}}><Label>NAMN</Label>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder="Barnets namn" style={FINP()} onFocus={e=>e.target.style.borderColor=T.sky} onBlur={e=>e.target.style.borderColor=T.border}/>
            </div>
            <div style={{marginBottom:14}}><Label>FÖDELSEDAG (valfritt)</Label>
              <input value={birthday} onChange={e=>setBirthday(e.target.value)} type="date" style={FINP()} onFocus={e=>e.target.style.borderColor=T.sky} onBlur={e=>e.target.style.borderColor=T.border}/>
            </div>

            {accountType==="adult"&&(
              <>
                {[["E-POST","email","epost@exempel.se",email,setEmail],["LÖSENORD","password","Minst 4 tecken",pass,setPass],["BEKRÄFTA LÖSENORD","password","Samma igen",conf,setConf]].map(([lbl,type,ph,val,set])=>(
                  <div key={lbl} style={{marginBottom:12}}><Label>{lbl}</Label>
                    <input value={val} onChange={e=>set(e.target.value)} type={type} placeholder={ph} style={FINP()} onFocus={e=>e.target.style.borderColor=T.sky} onBlur={e=>e.target.style.borderColor=T.border}/>
                  </div>
                ))}
                <div style={{marginBottom:16}}><Label>ROLL</Label>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                    {[["user","👤","Användare",T.mint,T.mintL,"#065F46"],["admin","👑","Admin",T.plum,T.plumL,T.plum]].map(([r,ic,lbl,bdr,bg,col])=>(
                      <button key={r} className="tap" onClick={()=>setRole(r)} style={{padding:"12px",borderRadius:13,border:`2.5px solid ${role===r?bdr:T.border}`,background:role===r?bg:"#F8FAFC",fontWeight:800,fontSize:13,color:role===r?col:T.sub,transition:"all .18s"}}>{ic} {lbl}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {accountType==="child"&&(
              <div style={{background:"#FEF9C3",border:`1.5px solid ${T.sun}`,borderRadius:14,padding:"12px 14px",marginBottom:16,fontSize:13,color:"#92400E",fontWeight:600,lineHeight:1.6}}>
                👶 Barnkonton syns i fammy, kan ha lediga veckor och födelsedag, men kan <strong>inte logga in</strong>. Admin hanterar deras uppgifter.
              </div>
            )}

            {err&&<ErrBox msg={err}/>}
            <button className="bounce tap" onClick={next} style={{...PBtn(`linear-gradient(135deg,${T.sky},${T.skyD})`),width:"100%"}}>Nästa →</button>
          </div>
        )}

        {step===2&&(
          <div className="fade">
            <div style={{textAlign:"center",marginBottom:18}}>
              <div style={{position:"relative",display:"inline-block"}}>
                <Avatar emoji={emoji} color={color} size={72} photo={photo}/>
                <button className="tap" onClick={()=>fileRef.current?.click()} style={{position:"absolute",bottom:-4,right:-4,width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${T.sky},${T.skyD})`,color:"white",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 3px 8px ${T.sky}55`}}>📷</button>
                <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handlePhoto}/>
              </div>
              {photo&&<div style={{marginTop:4}}><button className="tap" onClick={()=>setPhoto(null)} style={{fontSize:11,color:T.sub,textDecoration:"underline",fontWeight:700}}>Ta bort foto</button></div>}
              <div style={{fontWeight:900,fontSize:16,marginTop:10}}>{name}</div>
            </div>
            <EmojiPicker value={emoji} onChange={setEmoji}/>
            <ColorPicker value={color} onChange={setColor}/>
            {err&&<ErrBox msg={err}/>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:18}}>
              <button className="tap" onClick={()=>setStep(1)} style={{padding:"13px",borderRadius:13,background:T.bg,fontWeight:800,color:T.sub,fontSize:14,border:`1px solid ${T.border}`}}>← Tillbaka</button>
              <button className="bounce tap" onClick={submit} style={PBtn(`linear-gradient(135deg,${T.sky},${T.skyD})`,"13px","14px")}>Skapa 🎉</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
