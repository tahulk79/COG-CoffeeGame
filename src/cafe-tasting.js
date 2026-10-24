import {cafeSeasonEpisodes} from './cafe-season-data.js';
import {recipeReference} from './recipe-references.js';
// The new café experience is separate from saved First Pour cups and taste scores.
export function tastingProfile(episodeId){
 const e=cafeSeasonEpisodes.find(x=>x.id===episodeId);if(!e)return null;
 const reference=e.referenceId?recipeReference(e.referenceId):null;
 const method=e.tool==='aeropress'?'aeropress':e.tool==='origami'?'origami':'v60';
 let dose=15,water=240,targets=[30,150,240];
 if(reference){dose=reference.dose;water=reference.waterGrams;targets=e.referenceId==='hoffmann-ultimate-v60-v1'?[60,300,500]:e.referenceId==='hoffmann-one-cup-v60-v1'?[50,100,150,200,250]:[60,120,180,240,300];}
 if(method==='aeropress'){water=225;targets=[225];}
 return {episodeId,method,dose,water,targets,referenceId:reference?.id||null,protocol:reference?.id||(method==='aeropress'?'c6s-aeropress-15-225-v1':'c6s-pourover-15-240-v1'),title:e.item,prepare:e.quiz};
}
export function tastingWaitQuestion(episodeId){
 const p=tastingProfile(episodeId);if(!p)return null;
 if(p.method==='aeropress')return {question:['Khi ép, nước chuyển từ buồng xuống cốc. Cả bộ vẫn trên cân: số cân phải thế nào?','While plunging, water moves from chamber to cup. The whole setup stays on the scale: what should the reading do?'],choices:[['Giảm về 0','Fall to zero'],['Giữ tổng nước đã rót','Keep the cumulative water input'],['Tăng gấp đôi','Double']],correct:1,explanation:['Đúng: chuyển nước trong cùng bộ pha không phải thêm hay lấy nước ra khỏi cân. Game không đo áp suất hoặc lượng nước bột giữ lại.','Moving water within the same setup does not add or remove mass from the scale. The game does not measure pressure or water retained by grounds.']};
 const start=p.targets[0],next=p.targets[1],added=next-start;
 return {question:[`Cân đang ở ${start} g*. Muốn đạt tổng ${next} g*, bạn rót thêm bao nhiêu?`,`The scale reads ${start} g*. To reach ${next} g* total, how much more do you add?`],choices:[[`${next} g*`,`${next} g*`],[`${added} g*`,`${added} g*`],[`${p.water} g*`,`${p.water} g*`]],correct:1,explanation:[`${next} − ${start} = ${added} g*. Mốc trên cân là tổng tích lũy, không phải lượng rót thêm.`,`${next} − ${start} = ${added} g*. A scale target is cumulative, not the amount to add.`]};
}
export function newTasting(episodeId,role='self'){
 if(!tastingProfile(episodeId)||!['self','watch'].includes(role))throw Error('Unknown café tasting');
 return {version:1,protocol:tastingProfile(episodeId).protocol,episodeId,role,sample:episodeId==='s1-yirgacheffe'?'washed':'default',phase:'prepare',stage:0,water:0,collected:0,elapsed:0,pourSeconds:0,waitSeconds:0,plunge:0,answers:{prepare:null,wait:null},assisted:{prepare:false,wait:false}};
}
export function tastingAct(s,action){
 const p=tastingProfile(s.episodeId);if(!p||s.phase==='finished')return s;
 if(action.type==='sample'&&s.phase==='prepare'&&s.episodeId==='s1-yirgacheffe'&&['washed','natural'].includes(action.value))return {...s,sample:action.value};
 if(action.type==='answer'){
  const key=action.key,q=key==='prepare'?p.prepare:key==='wait'?tastingWaitQuestion(s.episodeId):null;
  const permitted=key==='prepare'&&s.phase==='prepare'||key==='wait'&&['pause','immerse'].includes(s.phase)&&s.stage===0;
  if(!q||!permitted||s.role!=='self'||!Number.isInteger(action.index)||action.index<0||action.index>=q.choices.length)return s;
  return {...s,answers:{...s.answers,[key]:action.index}};
 }
 if(action.type==='help'){
  const key=action.key;if(!(key==='prepare'&&s.phase==='prepare'||key==='wait'&&['pause','immerse'].includes(s.phase)&&s.stage===0))return s;
  return {...s,assisted:{...s.assisted,[key]:true}};
 }
 if(action.type==='start'&&s.phase==='prepare')return {...s,phase:'pour',assisted:{...s.assisted,prepare:s.role==='watch'||s.answers.prepare!==p.prepare.correct||s.assisted.prepare}};
 if(action.type==='next'&&s.phase==='pause')return {...s,phase:'pour',stage:s.stage+1,waitSeconds:0,assisted:{...s.assisted,wait:s.assisted.wait||s.stage===0&&(s.role==='watch'||s.answers.wait!==tastingWaitQuestion(s.episodeId).correct)}};
 if(action.type==='next'&&s.phase==='immerse'&&s.waitSeconds>=3)return {...s,phase:'press',waitSeconds:0,assisted:{...s.assisted,wait:s.assisted.wait||s.role==='watch'||s.answers.wait!==tastingWaitQuestion(s.episodeId).correct}};
 return s;
}
export function tickTasting(s,flow,dt){
 if(!Number.isFinite(dt)||dt<0||dt>.1)throw Error('Invalid tasting timestep');
 if(s.phase==='prepare'||s.phase==='finished'||dt===0)return s;
 const p=tastingProfile(s.episodeId),active=s.role==='watch'||flow;
 const delivering=s.phase==='pour'&&active,pressing=s.phase==='press'&&active;
 const started=s.water>0||delivering;
 if(!started)return s;
 let next={...s,elapsed:s.elapsed+dt};
 if(delivering){const added=Math.min(p.targets[s.stage]-s.water,p.water/12*dt);next.water=s.water+added;next.pourSeconds=s.pourSeconds+added/(p.water/12);
  if(p.targets[s.stage]-next.water<.000001){next.water=p.targets[s.stage];if(next.water===p.water)next.pourSeconds=12;next.waitSeconds=0;next.phase=p.method==='aeropress'?'immerse':s.stage===p.targets.length-1?'drain':'pause';}
 }
 if(s.phase==='pause'||s.phase==='immerse')next.waitSeconds=s.waitSeconds+dt;
 if(pressing){next.plunge=Math.min(1,s.plunge+dt/4);next.collected=next.water*next.plunge;if(next.plunge>=1)next.phase='finished';}
 if(p.method!=='aeropress'){next.collected=Math.min(next.water,s.collected+p.water/18*dt);if(next.phase==='drain'&&next.water-next.collected<.001){next.collected=next.water;next.phase='finished';}}
 if(s.role==='watch'&&next.phase==='pause'&&next.waitSeconds>=2.5)next=tastingAct(next,{type:'next'});
 if(s.role==='watch'&&next.phase==='immerse'&&next.waitSeconds>=3)next=tastingAct(next,{type:'next'});
 return next;
}
export function validTasting(s,episodeId){
 const p=tastingProfile(episodeId);if(!p||!s||s.version!==1||s.protocol!==p.protocol||s.episodeId!==episodeId||!['self','watch'].includes(s.role)||!['prepare','pour','pause','immerse','press','drain','finished'].includes(s.phase)||!Number.isInteger(s.stage)||s.stage<0||s.stage>=p.targets.length)return false;
 if(!(episodeId==='s1-yirgacheffe'?['washed','natural'].includes(s.sample):s.sample==='default'))return false;
 for(const k of ['water','collected','elapsed','pourSeconds','waitSeconds','plunge'])if(!Number.isFinite(s[k])||s[k]<0||s[k]>1e7)return false;
 if(s.water>p.targets[s.stage]+.000001||s.water<(p.targets[s.stage-1]||0)-.000001||s.collected>s.water+.000001||s.pourSeconds>s.elapsed+.000001||s.plunge>1)return false;
 for(const key of ['prepare','wait']){const q=key==='prepare'?p.prepare:tastingWaitQuestion(episodeId),a=s.answers?.[key];if(!(a===null||Number.isInteger(a)&&a>=0&&a<q.choices.length)||typeof s.assisted?.[key]!=='boolean')return false;}
 if(s.phase==='prepare'&&(s.stage!==0||s.water!==0||s.collected!==0||s.elapsed!==0||s.pourSeconds!==0||s.waitSeconds!==0||s.plunge!==0))return false;
 if(p.method==='aeropress'){
  if(['pause','drain'].includes(s.phase)||s.phase==='immerse'&&s.plunge!==0||['immerse','press','finished'].includes(s.phase)&&s.water!==p.water||Math.abs(s.collected-s.water*s.plunge)>.001)return false;
 }else if(['immerse','press'].includes(s.phase)||s.plunge!==0)return false;
 if(s.phase==='pause'&&(s.stage===p.targets.length-1||s.water!==p.targets[s.stage]))return false;
 if(['drain','finished'].includes(s.phase)&&(s.stage!==p.targets.length-1||s.water!==p.water))return false;
 if(s.phase==='finished'&&(Math.abs(s.collected-p.water)>.001||p.method==='aeropress'&&s.plunge!==1))return false;
 return true;
}
