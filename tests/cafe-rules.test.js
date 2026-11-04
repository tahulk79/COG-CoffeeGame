import test from 'node:test';
import assert from 'node:assert/strict';
import { RECIPES, FRESH_MS, freshFor, quickScore, stars, STAR_CAP, recipeById, resolveUses, ingredientBonus } from '../src/features/cafe/recipes.js';

test('quick brew: new drink ★★, best hand score carries over, ★★★ only after 90 by hand',()=>{
 assert.equal(quickScore(0),70);assert.equal(stars(quickScore(0)),2);
 assert.equal(quickScore(84),84);assert.equal(quickScore(97),90);assert.equal(stars(quickScore(97)),3);
 assert.equal(STAR_CAP.player,3);assert.equal(STAR_CAP.staff,2);assert.equal(STAR_CAP.robot,1);
});
test('cup freshness: iced drinks keep 90 s, hot drinks 60 s',()=>{
 const iced=RECIPES.find(r=>r.uses.ice),hot=RECIPES.find(r=>!r.uses.ice);
 assert.equal(freshFor(iced.id),FRESH_MS.iced);assert.equal(freshFor(hot.id),FRESH_MS.hot);assert.equal(freshFor('nope'),FRESH_MS.hot);
});
test('milk and water brands: the Pantry choice decides what a cup takes and its quality points',()=>{
 const latte=recipeById('latte'),matcha=recipeById('matcha');
 const cafe={prefs:{milk:'milk-meiji',water:'lavie'},supplies:{'milk-meiji':1000,'milk-dalat':1000,lavie:1500}};
 assert.deepEqual(resolveUses(latte.uses,cafe),{cup:1,'milk-meiji':200,lavie:40});
 assert.equal(ingredientBonus(latte,cafe),4+2);
 // Chosen milk ran out → the other brand; Lavie ran out → free tap water (−3).
 const short={prefs:{milk:'milk-meiji',water:'lavie'},supplies:{'milk-meiji':0,'milk-dalat':1000,lavie:0}};
 assert.deepEqual(resolveUses(latte.uses,short),{cup:1,'milk-dalat':200});
 assert.equal(ingredientBonus(latte,short),2-3);
 assert.equal(ingredientBonus(matcha,short),-3,'matcha has water, no milk');
 assert.equal(matcha.beans,0);assert.ok(recipeById('dirty')&&recipeById('matcha-latte'));
});
