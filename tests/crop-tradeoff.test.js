import test from 'node:test';
import assert from 'node:assert/strict';
import { createFarm } from '../src/features/farm/model.js';
import { cropById } from '../src/features/farm/content.js';
import { careYield,marketQualityFactor,orderPay,regionCrop,regionFit,REGION_CROP } from '../src/features/farm/rules.js';
const AT=100000;
// Plot 0 one second from ripe, health 100; returns the ripened plot.
function ripen(region,cropId,{fertilized=false,pruned=false,left=1}={}){
  const saved=createFarm(null,'capital',()=>{},AT).progress;saved.region=region;
  Object.assign(saved.plots[0],{cropId,stage:'growing',mature:true,growthMs:cropById(cropId).regrowMs-left,water:100,weeds:0,health:100,fertilized,pruned});
  const farm=createFarm(saved,null,()=>{},AT);farm.tick(AT+3000);return farm.progress.plots[0];
}
test('F-41 care combinations: quality and yield at health 100 (vn, robusta x1.10 region)',()=>{
  const base=cropById('robusta').yield*1.1;
  for(const [f,p,q,y] of [[false,false,80,1],[true,false,74,1.15],[false,true,90,.9],[true,true,84,1.035]]){
    const plot=ripen('vn','robusta',{fertilized:f,pruned:p});
    assert.equal(plot.stage,'ready');assert.equal(plot.quality,q);assert.equal(careYield(f,p),y);
    assert.equal(plot.readyYield,Math.round(base*y));
  }
});
test('market quality factor and order payout',()=>{
  assert.ok(Math.abs(marketQualityFactor(80)-.94)<1e-9);
  const o={reward:17};assert.equal(orderPay(o,84.9),17);assert.equal(orderPay(o,85),23);
});
test('F-43 region multipliers apply; café-only region is neutral',()=>{
  assert.equal(ripen('ke','arabica').quality,80+10);
  assert.equal(ripen('ke','arabica').readyYield,Math.round(cropById('arabica').yield*.95));
  assert.equal(ripen('vn','arabica',{left:3000}).stage,'ready');assert.equal(ripen('ke','arabica',{left:3000}).stage,'growing','growth x1.1 is slower');
  assert.deepEqual(regionCrop('it','robusta'),{yield:1,quality:0,growth:1});
  assert.equal(ripen('it','robusta').quality,80);
  assert.equal(regionFit('ke','arabica'),'good');assert.equal(regionFit('co','robusta'),'poor');assert.equal(regionFit('vn','liberica'),'neutral');
  assert.deepEqual(Object.keys(REGION_CROP).sort(),['br','co','id','ke','vn']);
});
