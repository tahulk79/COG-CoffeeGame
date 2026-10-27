import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../src/data/content';
import { GameSimulation } from '../../src/gameplay/GameSimulation';
import { cafeSim, farmSim, runUntil } from './helpers';

describe('map-specific UI and table upgrades',()=>{
  it('does not expose saved farm plots in a cafe or replayed story map',()=>{
    const {sim}=farmSim(); sim.state.story.chapter='done';
    expect(sim.snapshot().farm.plots.length).toBeGreaterThan(0);
    for(const id of ['cafe','incident','portal']) {
      const other=new GameSimulation(structuredClone(CONTENT.maps[id]!),CONTENT,{state:structuredClone(sim.captureState()),clock:sim.clock});
      expect(other.snapshot().farm.plots).toEqual([]);
      expect(other.state.farm.plots).toEqual(sim.state.farm.plots);
    }
  });
  it('keeps story presentation active during chapter travel so menus cannot flash',()=>{
    const sim=new GameSimulation(structuredClone(CONTENT.maps.incident!),CONTENT);
    while(sim.story.view().dialog) sim.story.advanceDialog();
    sim.clickObject('kitten'); runUntil(sim,()=>!!sim.state.story.flags.rescued);
    while(sim.story.view().dialog) sim.story.advanceDialog();
    expect(sim.story.view()).toMatchObject({active:true,locked:true,chapter:'S04'});
  });
  it('upgrades each table with money, meaningful bonuses and persisted levels',()=>{
    const {sim}=cafeSim(); sim.enableTestMode();
    const t=sim.snapshot().tables[0]!; const before=sim.decor.bonuses(); const coins=sim.tx.coins;
    expect(sim.upgrades.buyTable(sim.world,t.id).ok).toBe(true);
    expect(sim.tx.coins).toBe(coins-150);
    expect(sim.decor.bonuses().comfort).toBe(before.comfort+2);
    expect(sim.decor.bonuses().decor).toBe(before.decor+1);
    expect(sim.decor.bonuses().patienceFactor).toBeGreaterThan(before.patienceFactor);
    const again=cafeSim({state:structuredClone(sim.captureState())}).sim;
    expect(again.snapshot().tables[0]!.level).toBe(2);
    expect(again.decor.store(t.id)).toMatchObject({ok:false,reason:'upgradedTable'});
    expect(again.upgrades.buyTable(again.world,t.id).ok).toBe(true);
    expect(again.upgrades.buyTable(again.world,t.id).ok).toBe(true);
    const maxCoins=again.tx.coins;
    expect(again.upgrades.buyTable(again.world,t.id)).toMatchObject({ok:false,reason:'maxed'});
    expect(again.tx.coins).toBe(maxCoins);
    expect(again.upgrades.buyTable(again.world,'grinder')).toMatchObject({ok:false,reason:'unknownTable'});
  });
  it('test mode unlocks every existing requirement and tops up coins without destroying story when requested',()=>{
    const sim=new GameSimulation(structuredClone(CONTENT.maps.incident!),CONTENT);
    sim.enableTestMode(false);
    expect(sim.state.story.chapter).toBe('S03');
    expect(sim.progression.level).toBeGreaterThanOrEqual(99);
    expect(sim.tx.coins).toBeGreaterThanOrEqual(1000000000);
    sim.enableTestMode(false);
    expect(sim.tx.coins).toBeGreaterThanOrEqual(1000000000);
    sim.tx.execute({reason:'test:spend',coins:-100}); sim.enableTestMode(false);
    expect(sim.tx.coins).toBeGreaterThanOrEqual(1000000000);
  });
});
