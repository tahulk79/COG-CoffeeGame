import test from 'node:test';import assert from 'node:assert/strict';
import {welcomeScenes,welcomeScenario,welcomeLine,loadWelcomeSeen} from '../src/cafe-welcome.js';
test('fourteen visits have distinct complete bilingual cold opens and independent reactions',()=>{
 assert.equal(welcomeScenes.length,14);assert.equal(new Set(welcomeScenes.map(s=>s.id)).size,14);
 for(let i=0;i<14;i++){const s=welcomeScenario(i);assert.notEqual(s.id,welcomeScenario(i+1).id);for(const lang of ['vi','en']){const responses=['hello','lift','tap','offer'].map(c=>welcomeLine(c,lang,i));assert.equal(new Set(responses).size,4);assert.ok(responses.every(s=>typeof s==='string'&&s.length>10));for(const c of ['lift','tap','offer'])assert.ok(s.labels[c][lang==='vi'?0:1]);}}
});
test('selection is stable for rerenders and finite repertoire wraps without adjacent repeats',()=>{
 for(let i=0;i<100;i++){assert.equal(welcomeScenario(i),welcomeScenario(i));assert.notEqual(welcomeScenario(i).id,welcomeScenario(i+1).id);}assert.equal(welcomeScenario(NaN),welcomeScenario(0));
});
test('dismissal storage accepts bounded contexts and protects malformed or future originals',()=>{
 assert.deepEqual(loadWelcomeSeen(null),{seen:[],writable:true});const seen=['s1-yemen:2026-10-25T00:00:00Z'];assert.deepEqual(loadWelcomeSeen(JSON.stringify({version:1,seen})),{seen,writable:true});
 for(const raw of ['{',JSON.stringify({version:2,seen}),JSON.stringify({version:1,seen:[...seen,...seen]}),JSON.stringify({version:1,seen:Array.from({length:15},(_,i)=>String(i))})])assert.equal(loadWelcomeSeen(raw).writable,false);
});
