import test from 'node:test';
import assert from 'node:assert/strict';
import { clearOldKeys, PROGRESS_KEY } from '../src/state/storage-keys.js';

const memory = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };

test('rename COG → Godbean starts fresh: old keys are deleted, the Godbean save is untouched',()=>{
 const s=memory({'cog-coffee-progress':'old','cog-coffee-player':'old','cog-coffee-progress-backup':'old',[PROGRESS_KEY]:'new'});
 clearOldKeys(s);
 for(const k of ['cog-coffee-progress','cog-coffee-player','cog-coffee-progress-backup'])assert.equal(s.getItem(k),null);
 assert.equal(s.getItem(PROGRESS_KEY),'new');
});
