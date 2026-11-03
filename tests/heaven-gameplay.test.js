import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { canOccupy, slideMove } from '../src/shared/game/collision.js';
import { createJourney } from '../src/features/heaven/journey.js';
import { EXPERTS } from '../src/features/heaven/content.js';
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

test('six one-shot answers including wrong answers lead to review, gift and rebirth', () => {
  let saved;
  let game = createJourney(null, value => { saved = value; });
  assert.equal(game.chooseGift('seeds'), false);
  game.meetReaper();
  for (const expert of EXPERTS) {
    for (let i = 0; i < expert.questions.length; i++) {
      const question = game.question(expert.id);
      const option = question.options.find(item => i === 0 ? item.id !== question.correct : item.id === question.correct);
      const result = game.answer(expert.id, question.id, option.id);
      assert.equal(result.correct, i !== 0);
      assert.equal(game.answer(expert.id, question.id, question.correct), null, 'answered question cannot be retried');
      game = createJourney(saved, value => { saved = value; });
    }
  }
  assert.deepEqual(game.score, { correct: 3, wrong: 3, answered: 6, total: 6 });
  assert.equal(game.phase, 'review');
  assert.equal(game.returnHome(), false);
  game.reveal(); assert.equal(game.phase, 'gift');
  assert.equal(game.chooseGift('seeds'), true);
  assert.equal(game.chooseGift('tools'), false);
  assert.equal(game.returnHome(), true);
  assert.equal(createJourney(saved, () => {}).phase, 'completed');
});

test('world routes around its rendered furniture and keeps joystick movement outside solids', () => {
  const context = { fillRect() {}, fillText() {}, beginPath() {}, roundRect() {}, fill() {}, stroke() {} };
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => context }) };
  const character = createPerson('#fff'); character.animations = [];
  const world = createHeavenScene(character);
  world.resize(1280, 720);
  const solids = [];
  world.scene.updateMatrixWorld(true);
  world.scene.traverse(object => {
    if (!object.isMesh || object.material?.transparent) return;
    for (let parent = object; parent; parent = parent.parent) if (parent === character || parent.name === 'portal-doors') return;
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
    for (const id of ['reaper', 'growing', 'brewing', 'business', 'clerk']) {
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
