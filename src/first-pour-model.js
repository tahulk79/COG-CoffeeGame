import {recipeReference,recipeReferencePlan} from './recipe-references.js';
// Versioned illustrative game rules. Not extraction, TDS, or measured taste.
export const firstPourKey='c6s.first-pour.v03';
export const firstPourVersion='first-pour-0.3.1';
export const firstPourAxes=['aroma','acidity','sweetness','bitterness','body','aftertaste'];
export const firstPourBeans=[
 {id:'ethiopia',name:'Ethiopia · Washed',target:{dose:20,ratio:15,grind:18,temp:94,time:180}},
 {id:'colombia',name:'Colombia · Honey',target:{dose:20,ratio:15,grind:20,temp:93,time:180}},
 {id:'brazil',name:'Brazil · Natural',target:{dose:20,ratio:15,grind:22,temp:92,time:180}},
 {id:'vietnam-washed',name:'Vietnam Arabica · Washed'},
 {id:'guatemala-washed',name:'Guatemala · Washed'},
 {id:'costa-rica-honey',name:'Costa Rica · Honey'},
 {id:'ethiopia-natural',name:'Ethiopia · Natural'}
];
export function firstPourPreset(bean='ethiopia'){const entry=firstPourBeans.find(b=>b.id===bean);if(!entry)throw Error('Unknown bean');return {bean,...(entry.target||{dose:20,ratio:15,grind:20,temp:93,time:180})};}
export const firstPourLimits={dose:[12,30],ratio:[12,20],grind:[1,40],temp:[80,100],time:[90,360]};
export function validFirstRecipe(recipe){return Boolean((recipe?.referenceId===undefined||Boolean(recipeReference(recipe.referenceId)?.practiceSupported))&&firstPourBeans.some(b=>b.id===recipe?.bean)&&Object.entries(firstPourLimits).every(([k,[min,max]])=>Number.isFinite(recipe[k])&&recipe[k]>=min&&recipe[k]<=max));}
export function firstPourPlan(recipe){if(!validFirstRecipe(recipe))throw Error('Invalid first-pour recipe');if(recipe.referenceId)return recipeReferencePlan(recipe);const total=Math.round(recipe.dose*recipe.ratio);return [Math.round(total*.2),Math.round(total*.7),total];}
export function firstPourScore(recipe){
 if(!validFirstRecipe(recipe))throw Error('Invalid first-pour recipe');
 const target=firstPourBeans.find(b=>b.id===recipe.bean).target;
 if(!target||recipe.referenceId)return {modelVersion:firstPourVersion,score:null,largest:null,matched:false};
 const weights={grind:3,temp:4,ratio:6,time:.15};
 const deviations=Object.entries(weights).map(([field,weight])=>({field,delta:recipe[field]-target[field],penalty:Math.abs(recipe[field]-target[field])*weight}));
 return {modelVersion:firstPourVersion,score:Math.max(0,Math.round(100-deviations.reduce((s,d)=>s+d.penalty,0))),largest:deviations.reduce((a,b)=>a.penalty>=b.penalty?a:b).field,matched:deviations.every(d=>d.penalty===0)};
}
export function startFirstPour(recipe){return {recipe:{...recipe},plan:firstPourPlan(recipe),stage:0,water:0,seconds:0,pouringSeconds:0,ready:false,done:false};}
export function tickFirstPour(state,pouring,dt){
 if(!Number.isFinite(dt)||dt<0||dt>.1)throw Error('Invalid first-pour timestep');
 if(state.done||state.ready||!pouring)return state;
 const target=state.plan[state.stage],rate=state.plan[2]/12;
 const added=Math.min(target-state.water,rate*dt);
 const water=Math.min(target,state.water+added),complete=target-water<.000001;
 return {...state,water:complete?target:water,seconds:state.seconds+dt,pouringSeconds:state.pouringSeconds+added/rate,ready:complete,done:complete&&state.stage===2};
}
export function advanceFirstPour(state){if(!state.ready||state.done)throw Error('Finish the current stage first');return {...state,stage:state.stage+1,ready:false};}
export function validFirstFeedback(feedback){return Boolean(feedback&&['reflection','self-reported-real-tasting'].includes(feedback.context)&&typeof feedback.notes==='string'&&feedback.notes.length<=1000&&typeof feedback.nextChange==='string'&&feedback.nextChange.length<=1000&&(feedback.enjoyment===null||Number.isInteger(feedback.enjoyment)&&feedback.enjoyment>=1&&feedback.enjoyment<=5)&&feedback.axes&&firstPourAxes.every(k=>feedback.axes[k]===null||Number.isInteger(feedback.axes[k])&&feedback.axes[k]>=1&&feedback.axes[k]<=5));}
export function validFirstMemory(entry){
 if(entry?.practice!==undefined&&(!entry.practice||entry.practice.version!==1||!Number.isInteger(entry.practice.pauses)||entry.practice.pauses<0||entry.practice.pauses>9999))return false;
 if(entry?.shift!==undefined&&(!entry.shift||typeof entry.shift.id!=='string'||!entry.shift.id||entry.shift.id.length>160||!['a','b'].includes(entry.shift.role)))return false;
 if(entry?.baselineId!==undefined&&(typeof entry.baselineId!=='string'||!entry.baselineId||entry.baselineId===entry.id))return false;
 if(!entry||typeof entry.id!=='string'||!entry.id||typeof entry.date!=='string'||!Number.isFinite(Date.parse(entry.date))||entry.kind!=='first-pour-game-memory'||!validFirstRecipe(entry.recipe)||!validFirstFeedback(entry.feedback))return false;
 const expected=firstPourScore(entry.recipe),total=firstPourPlan(entry.recipe)[2];
 return entry.result?.modelVersion===firstPourVersion&&entry.result.score===expected.score&&entry.pour?.water===total&&entry.pour.stages===3&&Number.isFinite(entry.pour.playSeconds)&&entry.pour.playSeconds>=0;
}
export function loadFirstMemories(raw){
 if(raw===null)return {records:[],writable:true};
 try{const parsed=JSON.parse(raw);if(parsed.version!==1||!Array.isArray(parsed.records)||!parsed.records.every(validFirstMemory)||new Set(parsed.records.map(r=>r.id)).size!==parsed.records.length)throw Error('Invalid memory');return {records:parsed.records,writable:true};}catch{return {records:[],writable:false,raw};}
}
export function putFirstMemory(records,entry){if(!validFirstMemory(entry))throw Error('Invalid first-pour memory');return [...records.filter(r=>r.id!==entry.id),entry];}
export function compareFirstMemories(a,b){return ['bean',...Object.keys(firstPourLimits),'referenceId'].filter(k=>a.recipe[k]!==b.recipe[k]);}

// Presentation-only drawdown, independent of the recipe score and saved measurements.
export function firstPourDrawdown(collected,poured,total,dt){
 if(![collected,poured,total,dt].every(Number.isFinite)||total<=0||collected<0||poured<collected||poured>total||dt<0||dt>.1)throw Error('Invalid visual drawdown');
 return Math.min(poured,collected+total/18*dt);
}
