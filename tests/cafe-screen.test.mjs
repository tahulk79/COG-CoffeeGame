import test from 'node:test';import assert from 'node:assert/strict';
import {cafeDialoguePages} from '../src/cafe-screen.js';
import {cafeSeasonEpisodes} from '../src/cafe-season-data.js';
test('every bilingual owner passage survives screen pagination without truncation',()=>{for(const e of cafeSeasonEpisodes)for(const pair of [e.arrival,e.acquisition,...e.story,e.guest.line,e.answer,e.ending,e.teaser])for(const text of pair){const pages=cafeDialoguePages(text);assert.equal(pages.join(' '),text.trim().replace(/\s+/g,' '));assert.ok(pages.every(p=>p.length<=135));}});
test('short sentences stay together and empty dialogue has no empty page',()=>{assert.deepEqual(cafeDialoguePages('Một ly. Một câu chuyện.',25),['Một ly. Một câu chuyện.']);assert.deepEqual(cafeDialoguePages(''),[]);});
