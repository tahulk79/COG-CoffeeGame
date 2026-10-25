import {newTasting,tastingAct,tickTasting,validTasting} from './cafe-tasting.js';
export const rebirthKey='c6s.rebirth.hanoi.v1';
export const rebirthTools=[{id:'scale',label:['Cân','Scale']},{id:'kettle',label:['Bình rót','Kettle']},{id:'v60',label:['Phễu V60','V60 dripper']}];
export const rebirthToolTasks=[['Chủ quán cần biết lượng nước đã rót. Đặt món nào lên bàn?','The owner needs to track water input. Which tool belongs here?'],['Đã có cân. Giờ chọn món giúp điều khiển dòng nước nóng.','Scale ready. Choose the tool for controlling the hot-water stream.'],['Cuối cùng, chọn món đỡ giấy lọc và bột cà phê.','Finally, choose what holds the filter paper and coffee grounds.']];
export function rebirthQueue(){return {beans:2,preparedC:false,served:[],errors:0,actions:[]};}
export function rebirthQueueStep(q,action){
 if(!['serveA','waterB','brewC','serveC','brewA'].includes(action)||q.errors>=2||q.served.length===3)return q;
 let next={...q,actions:[...q.actions,action]};
 if(action==='serveA'&&!q.served.includes('A'))next.served=[...q.served,'A'];
 else if(action==='waterB'&&!q.served.includes('B'))next.served=[...q.served,'B'];
 else if(action==='brewC'&&!q.preparedC&&!q.served.includes('C')&&q.beans>0){next.beans--;next.preparedC=true;}
 else if(action==='serveC'&&q.preparedC&&!q.served.includes('C')){next.served=[...q.served,'C'];next.preparedC=false;}
 else {next.errors++;if(action==='brewA'&&q.beans>0)next.beans--;}
 return next;
}
export function newRebirth(random=Math.random){const n=Number(random());return {version:1,city:'hanoi',phase:'intro',intro:0,death:Math.min(2,Math.max(0,Math.floor((Number.isFinite(n)?n:0)*3))),toolIndex:0,mistakes:0,asked:false,order:null,brew:null,queue:rebirthQueue(),rescues:0,receipts:[],hint:''};}
function receipt(book,shift,proof,excellent){const old=book.receipts.find(r=>r.shift===shift);if(old?.excellent||old&&!excellent)return book.receipts;return [...book.receipts.filter(r=>r.shift!==shift),{shift,excellent,proof}].sort((a,b)=>a.shift-b.shift);}
export function rebirthProgress(book){const xp=book.receipts.reduce((n,r)=>n+[0,40,60,80][r.shift],0);return {xp,level:1+Number(xp>=40)+Number(xp>=100)+Number(xp>=180),badges:book.receipts.filter(r=>r.excellent).map(r=>r.shift),completed:book.receipts.length};}
export function rebirthAct(s,a){
 if(a.type==='next'&&s.phase==='intro')return s.intro===0?{...s,intro:1}:{...s,phase:'tools',hint:''};
 if(a.type==='tool'&&s.phase==='tools'&&rebirthTools.some(t=>t.id===a.id)){if(a.id!==rebirthTools[s.toolIndex].id)return {...s,mistakes:Math.min(99,s.mistakes+1),hint:'wrong-tool'};const toolIndex=s.toolIndex+1;if(toolIndex<3)return {...s,toolIndex,hint:''};const receipts=receipt(s,1,{correct:3,mistakes:s.mistakes},s.mistakes===0);return {...s,toolIndex,receipts,phase:s.receipts.some(r=>r.shift===2)?'report':'order',mistakes:0,hint:''};}
 if(a.type==='ask'&&s.phase==='order')return {...s,asked:true,hint:''};
 if(a.type==='order'&&s.phase==='order'&&['filter','milk','iced'].includes(a.id)){if(!s.asked)return {...s,hint:'ask-first'};if(a.id!=='filter')return {...s,mistakes:Math.min(99,s.mistakes+1),hint:'wrong-order'};return {...s,order:'filter',phase:'brew',brew:newTasting('s1-yemen'),hint:''};}
 if(a.type==='brew'&&s.phase==='brew'){const brew=tastingAct(s.brew,a.action);return brew===s.brew?s:{...s,brew};}
 if(a.type==='queue'&&s.phase==='queue'){const queue=rebirthQueueStep(s.queue,a.action);if(queue===s.queue)return s;if(queue.errors>=2)return {...s,queue,phase:'animal',hint:''};if(queue.served.length===3){const excellent=queue.errors===0&&s.rescues===0;return {...s,queue,phase:'report',receipts:receipt(s,3,{actions:queue.actions,rescues:s.rescues},excellent),hint:''};}return {...s,queue,hint:queue.errors>s.queue.errors?'queue-error':''};}
 if(a.type==='recover'&&s.phase==='animal'){if(a.id!=='bell')return {...s,hint:'hoof'};return {...s,phase:'queue',queue:rebirthQueue(),rescues:Math.min(99,s.rescues+1),hint:''};}
 if(a.type==='retry'&&((['report','animal'].includes(s.phase)&&[2,3].includes(a.shift)&&s.receipts.some(r=>r.shift===a.shift-1))||(s.phase==='report'&&a.shift===1))){const base={...s,mistakes:0,hint:''};return a.shift===1?{...base,phase:'tools',toolIndex:0}:a.shift===2?{...base,phase:'order',asked:false,order:null,brew:null}:{...base,phase:'queue',queue:rebirthQueue(),rescues:0};}
 return s;
}
export function tickRebirth(s,flow,dt){if(s.phase!=='brew')return s;const brew=tickTasting(s.brew,flow,dt);if(brew===s.brew)return s;if(brew.phase!=='finished')return {...s,brew};const excellent=s.mistakes===0&&brew.manualPauses>0;return {...s,brew,receipts:receipt(s,2,{asked:true,order:'filter',mistakes:s.mistakes,brew},excellent),phase:s.receipts.some(r=>r.shift===3)?'report':'queue',queue:rebirthQueue(),rescues:0,hint:''};}
const bounded=(n,max)=>Number.isInteger(n)&&n>=0&&n<=max;
function validRebirthReceipt(r){if(!r||![1,2,3].includes(r.shift)||typeof r.excellent!=='boolean'||!r.proof)return false;const p=r.proof;if(r.shift===1)return p.correct===3&&bounded(p.mistakes,99)&&r.excellent===(p.mistakes===0);if(r.shift===2)return p.asked===true&&p.order==='filter'&&bounded(p.mistakes,99)&&validTasting(p.brew,'s1-yemen')&&p.brew.role==='self'&&p.brew.phase==='finished'&&r.excellent===(p.mistakes===0&&p.brew.manualPauses>0);if(!Array.isArray(p.actions)||p.actions.length>10||!p.actions.every(x=>['serveA','waterB','brewC','serveC','brewA'].includes(x))||!bounded(p.rescues,99))return false;const q=p.actions.reduce(rebirthQueueStep,rebirthQueue());return q.actions.length===p.actions.length&&q.served.length===3&&q.errors<2&&r.excellent===(q.errors===0&&p.rescues===0);}
export function validRebirth(s){
 if(!s||s.version!==1||s.city!=='hanoi'||!['intro','tools','order','brew','queue','animal','report'].includes(s.phase)||!bounded(s.intro,1)||!bounded(s.death,2)||!bounded(s.toolIndex,3)||!bounded(s.mistakes,99)||typeof s.asked!=='boolean'||![null,'filter'].includes(s.order)||!(s.brew===null||validTasting(s.brew,'s1-yemen')&&s.brew.role==='self')||!bounded(s.rescues,99)||!['','wrong-tool','ask-first','wrong-order','queue-error','hoof'].includes(s.hint)||!Array.isArray(s.receipts)||s.receipts.length>3||!s.receipts.every(validRebirthReceipt)||new Set(s.receipts.map(r=>r.shift)).size!==s.receipts.length)return false;
 const ids=s.receipts.map(r=>r.shift);if(ids.some(n=>n>1&&!ids.includes(n-1)))return false;
 if(!s.queue||!Array.isArray(s.queue.actions)||s.queue.actions.length>10||!s.queue.actions.every(x=>['serveA','waterB','brewC','serveC','brewA'].includes(x)))return false;
 const q=s.queue.actions.reduce(rebirthQueueStep,rebirthQueue());if(['beans','preparedC','errors'].some(k=>s.queue[k]!==q[k])||JSON.stringify(s.queue.served)!==JSON.stringify(q.served)||s.queue.actions.length!==q.actions.length)return false;
 if(s.phase==='tools'&&s.toolIndex>=3||s.phase==='order'&&!ids.includes(1)||s.phase==='brew'&&(!ids.includes(1)||!s.asked||s.order!=='filter'||s.brew===null||s.brew.phase==='finished')||['queue','animal'].includes(s.phase)&&!ids.includes(2)||s.phase==='queue'&&(q.errors>=2||q.served.length===3)||s.phase==='animal'&&q.errors!==2||s.phase==='report'&&ids.length!==3)return false;
 return true;
}
export function loadRebirth(raw){if(raw===null)return {store:newRebirth(),writable:true};try{const store=JSON.parse(raw);if(!validRebirth(store))throw Error();return {store,writable:true};}catch{return {store:newRebirth(()=>0),writable:false,raw};}}
