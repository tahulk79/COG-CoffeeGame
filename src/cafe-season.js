import {newTasting,validTasting} from './cafe-tasting.js';
import {cafeSeasonId,cafeSeasonEpisodes} from './cafe-season-data.js';
export const cafeSeasonKey='c6s.cafe-season.v1';
export function seasonEpisodesFor(store){if(store?.route!=='curiosity-v1')return cafeSeasonEpisodes;const order=[0,5,2,3,4,1,6,7,8,9,10,11,12,13];return order.map(i=>cafeSeasonEpisodes[i]);}
export function newCuriousSeason(){return {...newSeasonStore(),route:'curiosity-v1'};}
export function seasonLocalDate(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
function seasonRandomIndex(length,random){const value=Number(random());return Math.min(length-1,Math.max(0,Math.floor((Number.isFinite(value)?value:0)*length)));}
function seasonShuffle(values,random){const copy=[...values];for(let i=copy.length-1;i>0;i--){const j=seasonRandomIndex(i+1,random);[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;}
function seasonGameProgress(){return {flipped:[],matched:[],ordered:[],quizAnswer:null,wrongOrder:false,light:'window',frame:'cream',postcardKept:false,brewOpened:false};}
export function newSeasonStore(){return {version:1,seasonId:cafeSeasonId,visits:[]};}
export function beginSeasonVisit(store,random=Math.random,date=new Date()){
 const last=store.visits.at(-1);if(last&&!last.closed||store.visits.length>=cafeSeasonEpisodes.length)return store;
 if(!(date instanceof Date)||!Number.isFinite(date.getTime()))throw Error('Invalid visit date');
 const episode=seasonEpisodesFor(store)[store.visits.length],pool=episode.modes.filter(m=>m!==last?.mode),choices=pool.length?pool:episode.modes;
 const visit={episodeId:episode.id,enteredAt:date.toISOString(),localDate:seasonLocalDate(date),beat:1,closed:false,mode:choices[seasonRandomIndex(choices.length,random)],activity:'offered',inspected:[],faces:seasonShuffle([0,0,1,1,2,2],random),orderChoices:seasonShuffle([0,1,2],random),progress:seasonGameProgress()};
 return {...store,visits:[...store.visits,visit]};
}
export function seasonAct(store,action){
 const v=store.visits.at(-1);if(!v||v.closed)return store;const episode=seasonEpisodesFor(store)[store.visits.length-1];let patch=null;
 if(action.type==='discover'&&v.beat===1&&['map','seed','label'].includes(action.value))patch={discovery:action.value};
 if(action.type==='next'&&v.beat>=1&&v.beat<=4)patch={beat:v.beat+1};
 if(action.type==='inspect'&&v.beat===4&&Number.isInteger(action.index)&&action.index>=0&&action.index<3&&!v.inspected.includes(action.index))patch={inspected:[...v.inspected,action.index]};
 if(action.type==='experience-start'&&[1,2,5,6].includes(v.beat)&&['self','watch'].includes(action.role))patch={beat:6,activity:'playing',experience:newTasting(episode.id,action.role),...(v.beat<5?{quickStart:true}:{})};
 if(action.type==='accept'&&v.beat===5)patch={beat:6,activity:'playing'};
 if(action.type==='skip'&&(v.beat===5||v.beat===6))patch={beat:7,activity:v.experience?(v.experience.phase==='finished'?'done':'declined'):v.activity==='done'?'done':'declined'};
 if(action.type==='goodbye'&&v.beat===7)patch={beat:8,closed:true};
 if(action.type==='replay-game'&&v.beat===6&&v.activity==='done')patch={activity:'playing',progress:seasonGameProgress()};
 if(v.beat===6&&v.activity==='playing'){
  const p=v.progress;
  if(action.type==='flip'&&v.mode==='memory'&&Number.isInteger(action.index)&&action.index>=0&&action.index<6&&!p.flipped.includes(action.index)&&!p.matched.includes(v.faces[action.index])){
   const flipped=p.flipped.length===2?[action.index]:[...p.flipped,action.index];const matched=flipped.length===2&&v.faces[flipped[0]]===v.faces[flipped[1]]?[...p.matched,v.faces[action.index]]:p.matched;
   patch={progress:{...p,flipped,matched},activity:matched.length===3?'done':'playing'};
  }
  if(action.type==='quiz'&&v.mode==='clue'&&Number.isInteger(action.index)&&action.index>=0&&action.index<episode.quiz.choices.length)patch={progress:{...p,quizAnswer:action.index},activity:action.index===episode.quiz.correct?'done':'playing'};
  if(action.type==='order'&&v.mode==='order'&&Number.isInteger(action.index)&&action.index>=0&&action.index<3){const correct=action.index===p.ordered.length;const ordered=correct?[...p.ordered,action.index]:p.ordered;patch={progress:{...p,ordered,wrongOrder:!correct},activity:ordered.length===3?'done':'playing'};}
  if(action.type==='postcard-style'&&v.mode==='postcard'&&((action.field==='light'&&['window','lamp'].includes(action.value))||(action.field==='frame'&&['cream','pine'].includes(action.value))))patch={progress:{...p,[action.field]:action.value}};
  if(action.type==='keep-postcard'&&v.mode==='postcard')patch={progress:{...p,postcardKept:true},activity:'done'};
  if(action.type==='open-brew'&&v.mode==='brew')patch={progress:{...p,brewOpened:true}};
  if(action.type==='brew-return'&&v.mode==='brew'&&p.brewOpened)patch={activity:'done'};
 }
 if(!patch)return store;return {...store,visits:[...store.visits.slice(0,-1),{...v,...patch}]};
}
function seasonValidDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
function seasonUniqueRange(a,max){return Array.isArray(a)&&a.length<=max&&new Set(a).size===a.length&&a.every(x=>Number.isInteger(x)&&x>=0&&x<max);}
export function validSeasonVisit(v,index,route){
 const e=seasonEpisodesFor({route})[index],p=v?.progress;
 if(!e||!v||v.episodeId!==e.id||typeof v.enteredAt!=='string'||!Number.isFinite(Date.parse(v.enteredAt))||!seasonValidDate(v.localDate)||!Number.isInteger(v.beat)||v.beat<1||v.beat>8||typeof v.closed!=='boolean'||v.closed!==(v.beat===8)||!e.modes.includes(v.mode)||!['offered','playing','done','declined'].includes(v.activity)||!seasonUniqueRange(v.inspected,3)||!Array.isArray(v.faces)||v.faces.length!==6||![0,1,2].every(face=>v.faces.filter(x=>x===face).length===2)||!seasonUniqueRange(v.orderChoices,3)||v.orderChoices.length!==3||!p)return false;
 if(!seasonUniqueRange(p.flipped,6)||p.flipped.length>2||!seasonUniqueRange(p.matched,3)||!Array.isArray(p.ordered)||p.ordered.length>3||!p.ordered.every((x,i)=>x===i)||!(p.quizAnswer===null||Number.isInteger(p.quizAnswer)&&p.quizAnswer>=0&&p.quizAnswer<e.quiz.choices.length)||typeof p.wrongOrder!=='boolean'||!['window','lamp'].includes(p.light)||!['cream','pine'].includes(p.frame)||typeof p.postcardKept!=='boolean'||typeof p.brewOpened!=='boolean')return false;
 if(v.beat<6&&v.activity!=='offered'||v.beat===6&&!['playing','done'].includes(v.activity)||v.beat>=7&&!['done','declined'].includes(v.activity))return false;
 if(v.quickStart!==undefined&&typeof v.quickStart!=='boolean')return false;
 if(v.discovery!==undefined&&!['map','seed','label'].includes(v.discovery))return false;
 if(v.experience!==undefined&&!validTasting(v.experience,e.id))return false;
 if(v.experience!==undefined&&v.beat<6)return false;
 if(v.activity==='done'&&v.experience!==undefined&&v.experience.phase!=='finished')return false;
 if(v.activity==='done'&&v.experience===undefined&&!({memory:p.matched.length===3,order:p.ordered.length===3,clue:p.quizAnswer===e.quiz.correct,postcard:p.postcardKept,brew:p.brewOpened}[v.mode]))return false;
 return true;
}
export function loadCafeSeason(raw){
 if(raw===null)return {store:newSeasonStore(),writable:true};
 try{const s=JSON.parse(raw);if(s.version!==1||(s.route!==undefined&&s.route!=='curiosity-v1')||s.seasonId!==cafeSeasonId||!Array.isArray(s.visits)||s.visits.length>cafeSeasonEpisodes.length||!s.visits.every((v,i)=>validSeasonVisit(v,i,s.route)&&(i===s.visits.length-1||v.closed)))throw Error('Invalid season');return {store:s,writable:true};}
 catch{return {store:newSeasonStore(),writable:false,raw};}
}

export function saveSeasonTasting(store,experience){const v=store.visits.at(-1);if(!v||v.closed||v.beat!==6||!v.experience||v.experience.role!==experience?.role||!validTasting(experience,v.episodeId))return store;return {...store,visits:[...store.visits.slice(0,-1),{...v,experience,activity:experience.phase==='finished'?'done':'playing'}]};}
