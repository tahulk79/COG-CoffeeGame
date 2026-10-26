import {newTasting,tastingAct,tickTasting,validTasting} from './cafe-tasting.js';
export const webtoonOpeningKey='c6s.webtoon.opening.v1';
export function newWebtoonOpening(){return {version:1,scene:'street',dodge:null,cup:null,chat:null,look:null,invitation:null};}
export function webtoonOpeningAct(s,a){
 if(a.type==='dodge'&&s.scene==='street'&&['left','right'].includes(a.side))return {...s,scene:'limbo',dodge:a.side};
 if(a.type==='next'&&s.scene==='limbo')return {...s,scene:'arrival'};
 if(a.type==='chat'&&s.scene==='arrival'&&['home','pay','name'].includes(a.id))return {...s,chat:a.id};
 if(a.type==='next'&&s.scene==='arrival')return {...s,scene:'settle'};
 if(a.type==='prop'&&s.scene==='settle'&&['bell','apron','stool'].includes(a.id))return {...s,look:a.id};
 if(a.type==='next'&&s.scene==='settle')return {...s,scene:'invite'};
 if(a.type==='choose'&&s.scene==='invite'&&['try','watch'].includes(a.id))return {...s,scene:'pour',invitation:a.id,cup:newTasting('s1-yemen',a.id==='watch'?'watch':'self')};
 if(a.type==='later'&&['invite','pour'].includes(s.scene))return {...s,scene:'settle',cup:null,invitation:null};
 if(a.type==='next'&&s.scene==='served')return {...s,scene:'mission'};
 if(a.type==='next'&&s.scene==='mission')return {...s,scene:'done'};
 if(a.type==='start'&&s.scene==='pour'&&s.cup.phase==='prepare')return {...s,cup:tastingAct(s.cup,{type:'start'})};
 if(a.type==='rest'&&s.scene==='pour')return {...s,cup:tastingAct(s.cup,{type:'rest'})};
 return s;
}
export function tickWebtoonOpening(s,flow,dt){if(s.scene!=='pour')return s;const cup=tickTasting(s.cup,flow,dt);if(cup===s.cup)return s;return {...s,cup,scene:cup.phase==='pause'&&cup.collected>=30-.001?'served':'pour'};}
export function validWebtoonOpening(s){
 if(!s||s.version!==1||!['street','limbo','arrival','settle','invite','pour','served','mission','done'].includes(s.scene)||![null,'left','right'].includes(s.dodge))return false;
 if(![undefined,null,'home','pay','name'].includes(s.chat)||![undefined,null,'bell','apron','stool'].includes(s.look)||![undefined,null,'try','watch'].includes(s.invitation))return false;
 if(s.scene==='street')return s.dodge===null&&s.cup===null;
 if(s.dodge===null)return false;if(['limbo','arrival','settle','invite'].includes(s.scene))return s.cup===null&&(s.invitation===undefined||s.invitation===null);
 if(!validTasting(s.cup,'s1-yemen')||!['self','watch'].includes(s.cup.role)||s.cup.stage!==0||!['prepare','pour','pause'].includes(s.cup.phase)||s.cup.elapsed>1e7)return false;
 if(s.cup.role==='watch'&&s.invitation!=='watch'||s.cup.role==='self'&&s.invitation!==undefined&&s.invitation!=='try')return false;
 return s.scene==='pour'?!(s.cup.phase==='pause'&&s.cup.collected>=30-.001):s.cup.phase==='pause'&&s.cup.water===30&&s.cup.collected>=30-.001;
}
export function loadWebtoonOpening(raw){if(raw===null)return {store:newWebtoonOpening(),writable:true};try{const store=JSON.parse(raw);if(!validWebtoonOpening(store))throw Error();return {store,writable:true};}catch{return {store:newWebtoonOpening(),writable:false,raw};}}
