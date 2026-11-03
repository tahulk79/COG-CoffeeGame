import * as THREE from 'three';
import { createFarmGame } from '../../src/features/farm/game.js';
const source = new DOMParser().parseFromString(await (await fetch('/index.html')).text(), 'text/html');
for (const style of source.head.querySelectorAll('style,link[rel="stylesheet"]')) document.head.append(style.cloneNode(true));
for (const script of source.body.querySelectorAll('script')) script.remove();
document.body.innerHTML = source.body.innerHTML;
document.body.className = 'booting';
let memory;
const persistence = { read: () => memory, save: value => { memory = value; return true; } };
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.shadowMap.enabled = true; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5)); renderer.setSize(innerWidth,innerHeight);
document.getElementById('game').append(renderer.domElement);
let game, previous = null, time = 0;
async function start() {
 game = await createFarmGame({ name: 'Người làm vườn', gender: 'female' }, 'capital', persistence);
 game.resize(innerWidth,innerHeight); await renderer.compileAsync(game.scene,game.camera);
 document.body.classList.remove('booting'); document.getElementById('loading').hidden = true;
 game.activate();
 renderer.setAnimationLoop(now => {
   const dt = previous === null ? 0 : Math.min(.1,(now-previous)/1000); previous = now; time += dt;
   game.update(dt,time); renderer.render(game.scene,game.camera);
 });
}
window.addEventListener('keydown',event => game?.handleKeyDown(event));
window.addEventListener('keyup',event => game?.handleKeyUp(event));
window.addEventListener('blur',() => {previous=null;game?.clearInput();});
window.addEventListener('resize',()=>{renderer.setSize(innerWidth,innerHeight);game?.resize(innerWidth,innerHeight);});
document.addEventListener('visibilitychange',()=>{previous=null;if(document.hidden)game?.clearInput();});
start().catch(error=>{document.getElementById('loading').hidden=true;const node=document.getElementById('error');node.hidden=false;node.textContent=error.stack;});
