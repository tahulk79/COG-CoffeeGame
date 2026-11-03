import * as THREE from 'three';
import { loadPlayer } from '../../src/characters/load-player.js';
import { getCharacterBounds } from '../../src/characters/bounds.js';
import { DURATION } from '../../src/features/intro/timeline.js';
import { createIntro } from '../../src/features/intro/scene.js';
const $ = id => document.getElementById(id);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1); renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
document.body.append(renderer.domElement);
let intro, hero, playing = false, previous;
$('time').max = DURATION;
const bounds = () => getCharacterBounds(hero, new THREE.Box3());
function render() {
 if (!intro) return;
 const time = Number($('time').value);
 intro.update(time); renderer.render(intro.scene, intro.camera);
 $('clock').textContent = `${time.toFixed(2)}s`;
}
async function load() {
 playing = false; $('report').textContent = 'Đang tải model thật…';
 intro?.dispose(); hero = await loadPlayer($('model').value);
 intro = createIntro({}, hero); intro.resize(innerWidth, innerHeight);
 render(); $('report').textContent = 'Sẵn sàng';
}
async function test() {
 const failures = []; let maxStep = 0, lastCenter;
 let maxGripError = 0, maxGripDistance = 0, maxBedError = 0;
 playing = false; $('report').textContent = 'Đang kiểm tra…';
 const sample = time => { intro.update(time); return bounds(); };
 for (const time of [0, 1, 3.4, 4.45, 4.99]) {
   sample(time);
   if (intro.scene.getObjectByName('intro-ambulance').visible) failures.push(`Xe xuất hiện trước lúc cứu hộ ${time}`);
 }
 for (let i = 180; i <= 780; i++) {
   if (i % 12 === 0) await new Promise(resolve => setTimeout(resolve, 0));
   const time = i / 60, body = sample(time), center = body.getCenter(new THREE.Vector3());
   if (time <= 7.9) {
     if (lastCenter) maxStep = Math.max(maxStep, center.distanceTo(lastCenter));
     lastCenter = center;
     if (body.min.y < .265) failures.push(`Xuyên đất ${time.toFixed(3)}: ${body.min.y.toFixed(3)}`);
   }
   if (time >= 6.4) {
     const bedPosition = intro.scene.getObjectByName('intro-stretcher').position;
     const overlapsBed = body.max.x > bedPosition.x-1.05 && body.min.x < bedPosition.x+1.05 && body.max.z > bedPosition.z-.375 && body.min.z < bedPosition.z+.375;
     if (overlapsBed && body.max.y > bedPosition.y+.705 && body.min.y < bedPosition.y+.855-.025) failures.push(`Xuyên mặt cáng ${time.toFixed(3)}`);
     const bed = intro.scene.getObjectByName('intro-stretcher');
     for (let medicIndex = 0; medicIndex < 2; medicIndex++) {
       const medic = intro.scene.getObjectByName(`intro-medic-${medicIndex}`);
       const side = medicIndex === 0 ? -1 : 1;
       for (const arm of medic.userData.arms) {
         const hand = arm.userData.hand.getWorldPosition(new THREE.Vector3());
         const depth = hand.z < bed.position.z ? -.31 : .31;
         const target = arm.userData.gripTargetWorld;
         maxGripError = Math.max(maxGripError, hand.distanceTo(target));
         maxGripDistance = Math.max(maxGripDistance, arm.userData.gripDistance);
         if (hand.distanceTo(target) > .001) failures.push(`Tay rời cáng ${time.toFixed(3)}`);
         if (arm.userData.gripDistance > .8) failures.push(`Tay vượt tầm với ${time.toFixed(3)}: ${arm.userData.gripDistance.toFixed(3)}`);
       }
     }
   }
   if (time >= 9.2) {
     const bed = intro.scene.getObjectByName('intro-stretcher').position;
     maxBedError = Math.max(maxBedError, Math.hypot(center.x-bed.x, center.z-bed.z));
     if (Math.hypot(center.x-bed.x, center.z-bed.z) > .04) failures.push(`Lệch cáng ${time.toFixed(3)}: ${Math.hypot(center.x-bed.x,center.z-bed.z).toFixed(3)}`);
     if (Math.abs(body.min.y - (bed.y+.855)) > .025) failures.push(`Lệch mặt cáng ${time.toFixed(3)}: ${body.min.y.toFixed(3)}`);
   }
 }
 if (maxStep > .12) failures.push(`Nhảy vị trí khi va/ngã: ${maxStep.toFixed(3)}m/frame`);
 const a = sample(4.5).getCenter(new THREE.Vector3());
 const b = sample(7.8).getCenter(new THREE.Vector3());
 if (a.distanceTo(b) > .001) failures.push('Cơ thể di chuyển trước lúc nâng');
 render();
 $('report').textContent = `${$('model').value}: ${failures.length ? 'FAIL' : 'PASS'}\nMax step: ${maxStep.toFixed(4)}m/frame\nLệch tâm cáng: ${maxBedError.toFixed(6)}m\nSai số bám tay: ${maxGripError.toFixed(6)}m\nTầm tay tối đa: ${maxGripDistance.toFixed(3)} / 0.8m\n${[...new Set(failures)].slice(0,25).join('\n')}`;
}
$('time').addEventListener('input', () => { playing = false; render(); });
$('model').addEventListener('change', load);
document.querySelectorAll('[data-time]').forEach(button => button.addEventListener('click', () => { playing = false; $('time').value = button.dataset.time; render(); }));
$('test').addEventListener('click', test);
$('play').addEventListener('click', () => { playing = !playing; previous = null; });
renderer.setAnimationLoop(now => {
 const dt = previous == null ? 0 : Math.min((now-previous)/1000,.1); previous = now;
 if (playing) { $('time').value = Math.min(DURATION, Number($('time').value)+dt); render(); }
});
window.addEventListener('resize', () => { renderer.setSize(innerWidth,innerHeight); intro?.resize(innerWidth,innerHeight); render(); });
load().catch(error => { $('report').textContent = error.stack; });
