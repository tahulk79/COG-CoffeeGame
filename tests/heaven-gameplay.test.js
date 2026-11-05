import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { canOccupy, slideMove } from '../src/shared/game/collision.js';
import { createJourney, correctQuestionIds } from '../src/features/heaven/journey.js';
import { EXPERTS, STARTING_GIFT } from '../src/features/heaven/content.js';
import { createPerson } from '../src/characters/player.js';
import { createHeavenScene } from '../src/features/heaven/scene.js';

test('solid corners stop movement and diagonal contact slides without tunnelling', () => {
  const obstacles = [{ minX: 0, maxX: 2, minZ: 0, maxZ: 1 }];
  const bounds = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };
  const canStand = (x, z) => canOccupy(x, z, obstacles, .48, bounds);
  const p = { x: -2, z: .5 };
  slideMove(p, 12, 0, canStand);
  assert.ok(p.x <= -.48, `crossed obstacle: ${p.x}`);
  slideMove(p, 1, 2, canStand);
  assert.ok(p.z > 1.48, 'did not slide along the obstacle');
  assert.ok(canStand(p.x, p.z));
  assert.equal(canStand(2.2, 1.2), false, 'diagonal corner must block the player radius');
});

test('02-mini: reveal, one fixed seeds gift, then rebirth (F-44)', () => {
  let saved;
  const game = createJourney(null, value => { saved = value; });
  assert.equal(game.phase, 'welcome');
  assert.equal(game.chooseGift(STARTING_GIFT), false, 'no gift before the reveal');
  assert.equal(game.reveal(), true); assert.equal(game.phase, 'gift');
  assert.equal(createJourney(saved, () => {}).phase, 'gift', 'reload after the reveal shows only the gift box');
  assert.equal(game.chooseGift(STARTING_GIFT), true);
  assert.equal(game.chooseGift('tools'), false);
  assert.equal(game.phase, 'return');
  assert.equal(game.returnHome(), true);
  assert.equal(saved.gift, 'seeds'); assert.equal(saved.mode, 'mini'); assert.equal(saved.skipped, false);
  assert.equal(createJourney(saved, () => {}).phase, 'completed');
});

test('02-mini: Skip works in one call and keeps the answer record untouched', () => {
  let saved;
  const game = createJourney(null, value => { saved = value; });
  assert.equal(game.skip(), true);
  assert.equal(game.phase, 'gift');
  assert.equal(game.skip(), false);
  assert.equal(game.chooseGift(STARTING_GIFT), true);
  assert.equal(saved.skipped, true);
  assert.deepEqual(saved.answered, { growing: 0, brewing: 0, business: 0 });
});

test('old saves: completed stays full, half-done heaven runs the mini and keeps answers', () => {
  const [growing] = EXPERTS;
  const first = growing.questions[0];
  const answers = { growing: [{ questionId: first.id, optionId: first.correct, correct: true }], brewing: [], business: [] };
  const done = createJourney({ version: 2, metReaper: true, answers, revealed: true, gift: 'tools', completed: true }, () => {});
  assert.equal(done.phase, 'completed'); assert.equal(done.progress.mode, 'full'); assert.equal(done.progress.gift, 'tools');
  let saved;
  const halfway = createJourney({ version: 2, metReaper: true, answers, revealed: false, gift: null, completed: false }, value => { saved = value; });
  assert.equal(halfway.phase, 'welcome');
  halfway.reveal(); halfway.chooseGift(STARTING_GIFT); halfway.returnHome();
  assert.deepEqual(saved.answers.growing, answers.growing);
  assert.deepEqual(correctQuestionIds(saved), [first.id]);
  // Bản cũ đang ở bước chọn 3 hành trang: chỉ còn hộp Nhận.
  assert.equal(createJourney({ version: 2, metReaper: true, answers, revealed: true, gift: null }, () => {}).phase, 'gift');
  // Chơi lại chương giữ câu đã trả lời.
  const replay = createJourney(saved, value => { saved = value; });
  replay.reset();
  assert.equal(replay.phase, 'welcome'); assert.deepEqual(saved.answers.growing, answers.growing);
});

test('world routes around its rendered furniture and keeps joystick movement outside solids', () => {
  const gradient = { addColorStop() {} }; // label art now uses gradients
  const context = { fillRect() {}, fillText() {}, beginPath() {}, roundRect() {}, fill() {}, stroke() {}, createLinearGradient: () => gradient, createRadialGradient: () => gradient, measureText: () => ({ width: 10 }), save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, clearRect() {}, moveTo() {}, lineTo() {}, arc() {}, closePath() {}, drawImage() {}, strokeText() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
  const character = createPerson('#fff'); character.animations = [];
  const world = createHeavenScene(character);
  world.resize(1280, 720);
  const solids = [];
  world.scene.updateMatrixWorld(true);
  world.scene.traverse(object => {
    if (!object.isMesh || object.material?.transparent) return;
    for (let parent = object; parent; parent = parent.parent) if (parent === character || parent.name === 'portal-doors' || parent.userData.nonSolid || !parent.visible) return; // same skip as the scene's colliders (hidden experts too)
    const box = new THREE.Box3().setFromObject(object);
    if (box.max.y > .15 && box.min.y < 2.1) solids.push({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z });
  });
  const bounds = { minX: -19, maxX: 19, minZ: -20, maxZ: 14.4 };
  let time = 0;
  const frame = input => {
    time += 1 / 60;
    const result = world.update(1 / 60, time, input || { x: 0, z: 0 }, false);
    assert.ok(canOccupy(character.position.x, character.position.z, solids, .42, bounds), `inside solid at ${character.position.x},${character.position.z}`);
    return result;
  };
  try {
    for (const id of ['reaper', 'clerk']) { // 02-mini: chuyên gia ẩn, chỉ còn hai thần
      assert.equal(world.moveToNpc(id), true);
      let arrived = false;
      for (let i = 0; i < 1800; i++) {
        const result = frame();
        assert.equal(result.navigationFailed, false, `no path to ${id}`);
        if (result.arrivedNpc === id) { arrived = true; break; }
      }
      assert.ok(arrived, `never reached ${id}`);
    }
    for (let i = 0; i < 300; i++) frame({ x: 0, z: -1 });
    world.setUnlocked(true);
    assert.equal(world.moveToNpc('portal'), true);
    let arrived = false;
    for (let i = 0; i < 1800; i++) { if (frame().arrivedNpc === 'portal') { arrived = true; break; } }
    assert.ok(arrived, 'never reached rebirth gate');
    world.setReturning(true);
    for (let i = 0; i < 180; i++) frame();
    assert.ok(Math.abs(character.position.x) < .2 && character.position.z > 13.4);
  } finally { world.dispose(); delete globalThis.document; }
});
