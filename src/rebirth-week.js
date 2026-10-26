// Additive continuation: original three-shift profile is never migrated or reset.
export const rebirthWeekKey='c6s.rebirth.week.v1';
export const weekRewards={4:90,5:100,6:110,7:120};
export function newRebirthWeek(){return {version:1,started:false,day:4,actions:[],mistakes:0,receipts:[]};}
export function weekStation(day){return day===4?{asked:false,label:false}:day===5?{cart:[]}:day===6?{empty:false,full:false}:{served:[],ready:null,beans:{regular:1,decaf:1}};}
const weekAllowed={4:['ask','label','regular','decaf'],5:['beans','filters','poster','submit'],6:['empty','full','tare','subtract','guess'],7:['readyA','waterB','brewRegular','brewDecaf','serveC','serveD']};
export function weekStep(day,q,id){
 if(!weekAllowed[day]?.includes(id))return {station:q,error:false,done:false,ignored:true};
 const n=structuredClone(q);let error=false,done=false;
 if(day===4){if(id==='ask')n.asked=true;else if(id==='label')n.label=true;else if(id==='decaf'&&q.asked&&q.label)done=true;else error=true;}
 if(day===5){if(id==='submit'){done=q.cart.includes('beans')&&q.cart.includes('filters')&&!q.cart.includes('poster');error=!done;}else n.cart=q.cart.includes(id)?q.cart.filter(x=>x!==id):[...q.cart,id];}
 if(day===6){if(id==='empty'||id==='full')n[id]=true;else if(id==='subtract'&&q.empty&&q.full)done=true;else error=true;}
 if(day===7){if(id==='readyA'||id==='waterB'){const who=id==='readyA'?'A':'B';if(q.served.includes(who))error=true;else n.served.push(who);}else if(id.startsWith('brew')){const bean=id==='brewRegular'?'regular':'decaf';if(q.ready||!q.beans[bean])error=true;else {n.beans[bean]--;n.ready=bean;}}else {const who=id==='serveC'?'C':'D',needed=who==='C'?'decaf':'regular';if(q.served.includes(who)||q.ready!==needed)error=true;else {n.served.push(who);n.ready=null;}}done=n.served.length===4;}
 return {station:n,error,done};
}
export function weekReplay(day,actions){let station=weekStation(day),errors=0,done=false;for(const id of actions){if(done)return null;const r=weekStep(day,station,id);if(r.ignored)return null;station=r.station;errors+=Number(r.error);done=r.done;}return {station,errors,done};}
export function weekProgress(s){return {xp:s.receipts.reduce((n,r)=>n+weekRewards[r.day],0),badges:s.receipts.filter(r=>r.excellent).map(r=>r.day),completed:s.receipts.length};}
export function rebirthWeekAct(s,a){
 if(a.type==='start'&&!s.started)return {...s,started:true};
 if(!s.started)return s;
 if(a.type==='retry'&&s.day===8&&[4,5,6,7].includes(a.day)&&s.receipts.some(r=>r.day===a.day))return {...s,day:a.day,actions:[],mistakes:0};
 if(a.type==='reset'&&s.day<=7)return {...s,actions:[],mistakes:Math.min(99,s.mistakes+1)};
 if(a.type!=='play'||s.day>7||s.actions.length>=80)return s;
 const state=weekReplay(s.day,s.actions);if(!state)return s;const r=weekStep(s.day,state.station,a.id);if(r.ignored)return s;
 const actions=[...s.actions,a.id];if(!r.done)return {...s,actions};
 const proof={actions,mistakes:s.mistakes},excellent=s.mistakes===0&&state.errors===0&&!r.error;
 const old=s.receipts.find(x=>x.day===s.day);const receipts=old?.excellent||old&&!excellent?s.receipts:[...s.receipts.filter(x=>x.day!==s.day),{day:s.day,excellent,proof}].sort((x,y)=>x.day-y.day);
 const next=s.day+1;return {...s,day:s.receipts.some(x=>x.day===next)?8:next,actions:[],mistakes:0,receipts};
}
export function validRebirthWeek(s){
 if(!s||s.version!==1||typeof s.started!=='boolean'||!Number.isInteger(s.day)||s.day<4||s.day>8||!Array.isArray(s.actions)||s.actions.length>80||!Number.isInteger(s.mistakes)||s.mistakes<0||s.mistakes>99||!Array.isArray(s.receipts)||s.receipts.length>4)return false;
 const ids=s.receipts.map(r=>r.day);if(new Set(ids).size!==ids.length||ids.some(d=>![4,5,6,7].includes(d)||d>4&&!ids.includes(d-1)))return false;
 for(const r of s.receipts){const p=r.proof;if(typeof r.excellent!=='boolean'||!p||!Array.isArray(p.actions)||p.actions.length>80||!Number.isInteger(p.mistakes)||p.mistakes<0||p.mistakes>99)return false;const result=weekReplay(r.day,p.actions);if(!result?.done||r.excellent!==(p.mistakes===0&&result.errors===0))return false;}
 if(!s.started&&(s.day!==4||s.actions.length||ids.length||s.mistakes))return false;
 if(s.day===8)return ids.length===4&&s.actions.length===0&&s.mistakes===0;
 if(s.day>4&&!ids.includes(s.day-1))return false;
 const replay=weekReplay(s.day,s.actions);return !!replay&&!replay.done;
}
export function loadRebirthWeek(raw){if(raw===null)return {store:newRebirthWeek(),writable:true};try{const store=JSON.parse(raw);if(!validRebirthWeek(store))throw Error();return {store,writable:true};}catch{return {store:newRebirthWeek(),writable:false,raw};}}
