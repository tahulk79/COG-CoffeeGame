// Two bounded follow-ups to the first scale discovery. Existing tasting physics is unchanged.
export const positionCaseId='scale-position-v1',postcardCaseId='bag-letter-v1';
export function emptyDiscoveryTrail(){return {version:1,active:null,scale:null,postcard:null};}
const unique=(a,pool)=>Array.isArray(a)&&a.length<=pool.length&&new Set(a).size===a.length&&a.every(x=>pool.includes(x));
const context=a=>a&&typeof a.contextId==='string'&&a.contextId.length>0&&a.contextId.length<=240&&['self','watch'].includes(a.role);
const snapshot=e=>e&&['input','collected','seconds'].every(k=>Number.isFinite(e[k])&&e[k]>=0)&&Math.abs(e.input-225)<.001&&e.collected<=e.input;
export function validPositionPair(a,b){return snapshot(a)&&snapshot(b)&&a.collected<60&&b.collected-a.collected>1&&b.collected<224.999&&b.seconds>a.seconds&&a.input===b.input;}
function validPosition(a){return context(a)&&a.caseId===positionCaseId&&['ready','recording','inspect','solved','interrupted'].includes(a.step)&&['whole','server'].includes(a.position)&&unique(a.placements,['whole','server'])&&typeof a.feedback==='boolean'&&(a.before===null||snapshot(a.before))&&(a.after===null||snapshot(a.after))&&(!['recording','inspect','solved'].includes(a.step)||a.before)&&(!['inspect','solved'].includes(a.step)||validPositionPair(a.before,a.after))&&(a.step!=='solved'||a.position==='server'&&a.placements.length===2);}
function validPostcard(a){return context(a)&&a.caseId===postcardCaseId&&['inspect','solved','interrupted'].includes(a.step)&&unique(a.seen,['washed','natural'])&&[null,'washed','natural'].includes(a.chosen)&&typeof a.feedback==='boolean'&&(a.step!=='solved'||a.chosen==='washed'&&a.seen.includes('washed'));}
export function validDiscoveryTrail(t,hasLens){if(!t||t.version!==1||!(t.active===null||validPosition(t.active)||validPostcard(t.active)))return false;
 if(t.scale!==null&&(!validPosition(t.scale)||t.scale.step!=='solved'||t.scale.reward!=='postcard-fragment-v1'||!Number.isFinite(Date.parse(t.scale.completedAt))))return false;
 if(t.postcard!==null&&(!validPostcard(t.postcard)||t.postcard.step!=='solved'||t.postcard.reward!=='cafe-postcard-v1'||!Number.isFinite(Date.parse(t.postcard.completedAt))))return false;
 return !((t.active||t.scale||t.postcard)&&!hasLens||t.postcard&&!t.scale||t.active?.caseId===postcardCaseId&&!t.scale);
}
export function followCaseFor(episodeId,store){if(!store.discovery)return null;if(episodeId==='s1-aeropress')return positionCaseId;if(episodeId==='s1-yirgacheffe'&&store.trail?.scale)return postcardCaseId;return null;}
export function beginFollowCase(store,caseId,contextId,role){if(!context({contextId,role})||!store.discovery||![positionCaseId,postcardCaseId].includes(caseId)||caseId===postcardCaseId&&!store.trail?.scale)return store;const trail=store.trail||emptyDiscoveryTrail();const active=caseId===positionCaseId?{caseId,contextId,role,step:'ready',position:'whole',placements:[],before:null,after:null,feedback:false}:{caseId,contextId,role,step:'inspect',seen:[],chosen:null,feedback:false};return {...store,trail:{...trail,active}};}
const update=(store,active)=>({...store,trail:{...store.trail,active}});
export function observeFollowCase(store,contextId,s){const a=store.trail?.active;if(!a||a.contextId!==contextId||a.role!==s.role||['solved','interrupted'].includes(a.step))return store;
 if(a.caseId===postcardCaseId)return s.episodeId==='s1-yirgacheffe'&&s.phase==='prepare'?store:update(store,{...a,step:'interrupted'});
 if(s.episodeId!=='s1-aeropress')return store;
 if(s.phase==='finished')return update(store,{...a,step:'interrupted'});
 const e={input:s.water,collected:s.collected,seconds:s.elapsed};
 if(a.step==='ready'&&s.phase==='press')return update(store,{...a,step:'recording',before:e});
 if(a.before&&(s.elapsed<a.before.seconds-.001||s.water<225-.001))return update(store,{...a,step:'interrupted'});
 if(a.step==='recording'&&s.phase==='press'&&s.collected>=60)return update(store,{...a,after:e,step:validPositionPair(a.before,e)?'inspect':'interrupted'});
 return store;
}
export function selectScalePosition(store,position){const a=store.trail?.active;if(a?.caseId!==positionCaseId||a.step!=='inspect'||!['whole','server'].includes(position))return store;return update(store,{...a,position,placements:[...new Set([...a.placements,position])],feedback:false});}
export function completePositionCase(store,now=new Date().toISOString()){const a=store.trail?.active;if(a?.caseId!==positionCaseId||a.step!=='inspect'||!a.placements.includes('whole')||!a.placements.includes('server'))return store;if(a.position!=='server')return update(store,{...a,feedback:true});if(!Number.isFinite(Date.parse(now)))throw Error('Invalid time');const solved={...a,step:'solved'};return {...store,trail:{...store.trail,active:solved,scale:store.trail.scale||{...solved,reward:'postcard-fragment-v1',completedAt:now}}};}
export function inspectPostcardBag(store,bag){const a=store.trail?.active;if(a?.caseId!==postcardCaseId||a.step!=='inspect'||!['washed','natural'].includes(bag))return store;return update(store,{...a,seen:[...new Set([...a.seen,bag])],chosen:bag,feedback:false});}
export function completePostcardCase(store,now=new Date().toISOString()){const a=store.trail?.active;if(a?.caseId!==postcardCaseId||a.step!=='inspect'||!a.seen.includes(a.chosen))return store;if(a.chosen!=='washed')return update(store,{...a,feedback:true});if(!Number.isFinite(Date.parse(now)))throw Error('Invalid time');const solved={...a,step:'solved'};return {...store,trail:{...store.trail,active:solved,postcard:store.trail.postcard||{...solved,reward:'cafe-postcard-v1',completedAt:now}}};}
export function abandonFollowCase(store,contextId){const a=store.trail?.active;return a?.contextId===contextId?update(store,{...a,step:'interrupted'}):store;}
