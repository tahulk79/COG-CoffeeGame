// A bounded observation case, not a new extraction or sensory model.
export const discoveryCaseKey='c6s.discovery-lab.v1';
export const scaleCaseId='still-scale-v1';
export function emptyDiscoveryLab(){return {version:1,attempt:null,discovery:null};}
const caseChoices=['rise','fall','steady'];
export function scaleEvidence(s){return {input:s.water,collected:s.collected,seconds:s.elapsed};}
function validEvidence(e){return !!e&&['input','collected','seconds'].every(k=>Number.isFinite(e[k])&&e[k]>=0)&&Math.abs(e.input-30)<.001&&e.collected<=e.input+.001;}
export function supportsScaleDiscovery(before,after){return validEvidence(before)&&validEvidence(after)&&Math.abs(after.input-before.input)<.001&&after.collected-before.collected>.1&&after.seconds-before.seconds>=.2;}
function validAttempt(a){
 if(!a||a.caseId!==scaleCaseId||typeof a.contextId!=='string'||!a.contextId||a.contextId.length>240||!['self','watch'].includes(a.role)||!caseChoices.includes(a.prediction)||!['ready','rest','observing','evidence','solved','interrupted'].includes(a.step))return false;
 if(!(a.conclusion===null||caseChoices.includes(a.conclusion))||![null,.25,1].includes(a.wait)||!(a.before===null||validEvidence(a.before))||!(a.after===null||validEvidence(a.after)))return false;
 if(['rest','observing','evidence','solved'].includes(a.step)&&!a.before)return false;
 if(['observing','evidence','solved'].includes(a.step)&&a.wait===null)return false;
 if(['evidence','solved'].includes(a.step)&&!supportsScaleDiscovery(a.before,a.after))return false;
 if(a.step==='solved'&&a.conclusion!=='steady')return false;
 return true;
}
export function loadDiscoveryLab(raw){
 if(raw===null)return {store:emptyDiscoveryLab(),writable:true};
 try{const s=JSON.parse(raw);if(s?.version!==1||!(s.attempt===null||validAttempt(s.attempt)))throw Error('Invalid case');
  const d=s.discovery;if(d!==null&&(!validAttempt(d)||d.step!=='solved'||d.reward!=='inspection-lens-v1'||!Number.isFinite(Date.parse(d.completedAt))))throw Error('Invalid discovery');
  return {store:s,writable:true};
 }catch{return {store:emptyDiscoveryLab(),writable:false,raw};}
}
export function beginScaleCase(store,contextId,role,prediction){
 if(typeof contextId!=='string'||!contextId||contextId.length>240||!['self','watch'].includes(role)||!caseChoices.includes(prediction))throw Error('Invalid case start');
 return {...store,attempt:{caseId:scaleCaseId,contextId,role,prediction,step:'ready',wait:null,before:null,after:null,conclusion:null}};
}
export function observeScaleCase(store,contextId,s){
 const a=store.attempt;if(!a||a.contextId!==contextId||s.episodeId!=='s1-yemen'||s.role!==a.role||['solved','interrupted'].includes(a.step))return store;
 if(s.stage>0||s.phase==='finished'||s.water>30.001)return {...store,attempt:{...a,step:'interrupted'}};
 if(a.step==='ready'&&s.phase==='pause'&&s.stage===0){const before=scaleEvidence(s);return {...store,attempt:{...a,step:before.input-before.collected>.1?'rest':'interrupted',before}};}
 if(a.before&&(s.elapsed+.001<a.before.seconds||s.water+.001<a.before.input))return {...store,attempt:{...a,step:'interrupted'}};
 if(a.step==='observing'&&s.elapsed-a.before.seconds>=a.wait-.000001){const after=scaleEvidence(s);return {...store,attempt:{...a,after,step:supportsScaleDiscovery(a.before,after)?'evidence':'interrupted'}};}
 return store;
}
export function waitForScaleEvidence(store,seconds){const a=store.attempt;if(!a||a.step!=='rest'||![.25,1].includes(seconds))return store;return {...store,attempt:{...a,step:'observing',wait:seconds}};}
export function concludeScaleCase(store,choice,now=new Date().toISOString()){
 const a=store.attempt;if(!a||a.step!=='evidence'||!caseChoices.includes(choice))return store;
 const next={...a,conclusion:choice};if(choice!=='steady')return {...store,attempt:next};
 if(!Number.isFinite(Date.parse(now)))throw Error('Invalid completion time');next.step='solved';
 return {...store,attempt:next,discovery:store.discovery||{...next,completedAt:now,reward:'inspection-lens-v1'}};
}

export function abandonScaleCase(store,contextId){const a=store.attempt;return a&&a.contextId===contextId?{...store,attempt:{...a,step:'interrupted'}}:store;}
