import { describe, expect, it } from 'vitest';
import { GameSimulation } from '../../src/gameplay/GameSimulation';
import { CONTENT } from '../../src/data/content';
import { FakeClock } from '../../src/core/Clock';
import type { FinaleKind, HazardKind } from '../../src/gameplay/story/RunService';

/** Chapter 1 played start to finish many times: every gag and every fate must end in chapter 2. */
function chapter1(seed: number, edit?: (c: typeof CONTENT) => void) {
  const content = structuredClone(CONTENT);
  edit?.(content);
  const sim = new GameSimulation(structuredClone(CONTENT.maps.incident!), content, { clock: new FakeClock(), rngSeed: seed });
  sim.startRun();
  return sim;
}

/** No gags: for the tests of talking, shops, barriers and bikes (a random gag would end the street mid-test). */
const calm = (c: typeof CONTENT) => { c.story.chapters.S03!.run!.unlockSec = {}; };

/** Ticks until chapter 2, steering the hero with `drive` (ms elapsed → direction); returns what happened. */
function play(sim: GameSimulation, drive: (ms: number) => [number, number] = () => [0, 0], maxMs = 400_000) {
  const seen = new Set<number>(), kinds: string[] = [];
  let ms = 0, chaosAt = -1, firstGag = -1, koAt = -1, ko: string | null = null;
  while (sim.story.chapterId === 'S03' && ms < maxMs) {
    const [x, y] = drive(ms);
    sim.steer(x, y);
    sim.tick(50);
    ms += 50;
    const run = sim.story.view().run;
    if (!run) continue;
    if (run.phase === 'chaos' && chaosAt < 0) chaosAt = ms;
    for (const h of run.hazards) if (!seen.has(h.id)) { seen.add(h.id); kinds.push(h.kind); if (firstGag < 0) firstGag = ms; }
    if (!ko && (run.hit || run.finale)) { ko = run.hit?.kind ?? run.finale!.kind; koAt = ms; }
  }
  return { ms, chaosAt, firstGag, koAt, ko, kinds, chapter: sim.story.chapterId };
}

/** Wanders the street: changes direction every couple of seconds, like a player looking around. */
const wander = (seed: number) => (ms: number): [number, number] => {
  const k = Math.floor(ms / 1800) + seed * 7;
  const a = ((k * 2654435761) % 360) * (Math.PI / 180);
  return [Math.cos(a), Math.sin(a)];
};

describe('chapter 1 playtest', () => {
  it('a standing hero gets a calm few seconds, then the first gag, and the chapter ends in chapter 2', () => {
    const first = CONTENT.story.chapters.S03!.run!.firstGagMs!;
    for (let seed = 1; seed <= 12; seed++) {
      const r = play(chapter1(seed));
      expect(r.chapter).toBe('S04');
      expect(r.firstGag).toBeGreaterThanOrEqual(first - 100);
      expect(r.firstGag).toBeLessThanOrEqual(first + 1500);
      expect(r.ko).not.toBeNull();
    }
  });

  it('a wandering hero keeps meeting gags along the street and always gets to chapter 2', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const r = play(chapter1(seed), wander(seed));
      expect(r.chapter).toBe('S04');
      expect(r.ko).not.toBeNull();
      // A wanderer can be unlucky early; strolling twenty seconds or more, they see at least four gags.
      if (r.koAt > 20_000) expect(r.kinds.length).toBeGreaterThanOrEqual(4);
    }
  });

  it('every gag can knock the hero out on its own, and the rescue still takes the hero to chapter 2', () => {
    const gags = Object.keys(CONTENT.story.chapters.S03!.run!.unlockSec) as HazardKind[];
    for (const kind of gags.filter((k) => k !== 'laundry')) {
      let knocked = false;
      for (let seed = 1; seed <= 15 && !knocked; seed++) {
        const sim = chapter1(seed, (c) => { c.story.chapters.S03!.run!.unlockSec = { [kind]: 0 }; c.story.chapters.S03!.run!.chaosSec = 120; });
        // Bikes run along the road: wait for them in the middle of it.
        sim.player.pos = kind === 'motorbike' ? { x: 14, y: 9.5 } : { x: 14, y: 6.5 };
        // Peels and holes appear ahead of where you walk: keep walking along the sidewalk.
        const r = play(sim, kind === 'banana' || kind === 'sinkhole' ? (ms) => [Math.floor(ms / 3000) % 2 ? -1 : 1, 0] : undefined);
        expect(r.chapter).toBe('S04');
        knocked = r.ko === kind || r.ko === 'motorbike';
      }
      expect(knocked, kind).toBe(true);
    }
  });

  it('the shorts over the head only blind the hero for a moment: they are never a knock-out', () => {
    const sim = chapter1(2, (c) => { c.story.chapters.S03!.run!.unlockSec = { laundry: 0 }; c.story.chapters.S03!.run!.chaosSec = 20; });
    sim.player.pos = { x: 14, y: 6.5 };
    let dazed = false;
    for (let i = 0; i < 400 && sim.story.view().run?.phase !== 'faint'; i++) { sim.tick(50); dazed ||= sim.story.view().run?.dazed === 'shorts'; }
    expect(dazed).toBe(true);
    expect(sim.story.view().run?.hit).toBeNull();
  });

  it('every fate plays out when its stall was visited', () => {
    const fates = Object.keys(CONTENT.story.chapters.S03!.finales!) as FinaleKind[];
    for (const kind of fates) {
      const sim = chapter1(5, (c) => {
        const ch = c.story.chapters.S03!;
        ch.run!.unlockSec = {};
        ch.run!.chaosSec = 3;
        ch.finales = { [kind]: ch.finales![kind]! };
      });
      for (const id of ['tra_da', 'pho', 'bao']) sim.story.visit(id);
      const r = play(sim);
      expect(r.ko).toBe(kind);
      expect(r.chapter).toBe('S04');
    }
  });

  it('the barrier: arguing gets the hero through, a bike knocks them flat, the ambulance takes them to chapter 2; giving up does not', () => {
    for (const reply of [0, 1]) {
      const sim = chapter1(4, calm);
      sim.player.pos = { x: 2.2, y: 9.5 };
      for (let i = 0; i < 300 && !sim.story.view().street?.choices; i++) sim.tick(50);
      expect(sim.story.view().street?.choices).toHaveLength(2);
      sim.story.chooseReply(reply);
      for (let i = 0; i < 120; i++) sim.tick(50);
      if (reply === 1) {
        expect(sim.story.view().run?.phase).toBe('chaos');
        continue;
      }
      expect(sim.story.view().run?.phase).toBe('faint');
      const r = play(sim);
      expect(r.chapter).toBe('S04');
    }
  });

  it('tapping a seller from afar walks the hero over and starts their talk; tapping them again later gives a short line', () => {
    const sim = chapter1(6, calm);
    // Same sidewalk: crossing the road on foot may end under a motorbike.
    sim.player.pos = { x: 23, y: 7.2 };
    sim.talkTo('banh_mi:anhbay');
    for (let i = 0; i < 200 && sim.story.view().street?.talking !== 'banh_mi'; i++) sim.tick(50);
    expect(sim.story.view().street?.talking).toBe('banh_mi');
    sim.story.visit('bao');
    sim.player.pos = { x: 8, y: 6.6 };
    sim.tick(50);
    sim.talkTo('bao:hai');
    expect(sim.story.view().street?.npcs.find((n) => n.id === 'bao:hai')?.say).toBeTruthy();
  });

  it('the guard scene starts by the guard or at the boom, never from the lake corner', () => {
    const sim = chapter1(6, calm);
    sim.player.pos = { x: 2, y: 16 };
    for (let i = 0; i < 60; i++) sim.tick(50);
    expect(sim.story.view().street?.heroSay ?? null).toBeNull();
    sim.player.pos = { x: 2.2, y: 9.5 };
    sim.tick(50);
    sim.tick(50);
    expect(sim.story.view().street?.heroSay).toBe(CONTENT.story.chapters.S03!.street!.gateLines!.hero);
  });

  it('bikes never cross a street-end boom while it is down', () => {
    const sim = chapter1(8, calm);
    sim.player.pos = { x: 20, y: 15 };
    let crossings = 0;
    // A minute of street (the hero safe on the grass, no gags).
    for (let i = 0; i < 1150; i++) {
      const before = sim.story.view().street!;
      sim.tick(50);
      const after = sim.story.view().street!;
      for (const n of after.npcs) {
        const was = before.npcs.find((m) => m.id === n.id);
        if (!n.bike || !was) continue;
        for (const gate of before.gates) if ((was.x - gate.x) * (n.x - gate.x) < 0 && Math.abs(was.x - n.x) < 2) { crossings++; expect(gate.open, `${n.id} through ${gate.id}`).toBeGreaterThanOrEqual(0.9); }
      }
    }
    expect(crossings).toBeGreaterThan(0);
  });

  it('knocked out, the hero really lies down; once inside the ambulance the camera follows it into the circle', () => {
    const sim = chapter1(9);
    sim.player.pos = { x: 14, y: 9.5 };
    sim.run!.crash('motorbike', 'Ối…', 2000);
    for (let i = 0; i < 60 && !sim.story.view().run?.down; i++) sim.tick(50);
    for (let i = 0; i < 20; i++) sim.tick(50);
    expect(sim.story.view().run!.down!.t).toBeGreaterThan(0.12);
    let followed = false;
    for (let i = 0; i < 400 && sim.story.chapterId === 'S03'; i++) {
      sim.tick(50);
      const st = sim.story.view().street;
      if (st?.focus) { followed = true; expect(st.heroHidden).toBe(true); }
    }
    expect(followed).toBe(true);
  });

  it('stepping in front of a motorbike: sometimes it brakes in a cloud of smoke, sometimes it does not (then the rescue)', () => {
    let braked = 0, knocked = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const sim = chapter1(seed, calm);
      // Past the first seconds, when bikes still give way to a hero on the road.
      sim.steer(1, 0); sim.tick(50); sim.steer(0, 0);
      sim.player.pos = { x: 20, y: 15 };
      for (let i = 0; i < 120; i++) sim.tick(50);
      const bike = sim.story.view().street!.npcs.find((n) => n.bike)!;
      sim.player.pos = { x: bike.x + bike.dir * 0.3, y: bike.y };
      let skid = false;
      for (let i = 0; i < 4; i++) { sim.tick(50); skid ||= !!sim.story.view().street?.npcs.some((n) => n.skid); }
      if (sim.story.view().run?.phase === 'faint') {
        knocked++;
        if (knocked === 1) expect(play(sim).chapter).toBe('S04');
      } else if (skid) braked++;
    }
    expect(braked).toBeGreaterThan(0);
    expect(knocked).toBeGreaterThan(0);
  });

  it('the café: walk into the door, the street waits, the talk and the cat gag play, walking out returns to the door', () => {
    const sim = chapter1(11);
    sim.steer(1, 0); sim.tick(50); sim.steer(0, 0);
    const cfg = CONTENT.story.chapters.S03!.street!.shops!.find((s) => s.id === 'cafe')!;
    sim.player.pos = { ...cfg.door };
    sim.tick(50);
    const shop = () => sim.story.view().street?.shop ?? null;
    expect(shop()?.id).toBe('cafe');
    expect(sim.story.view().objective).toContain('Cà phê ông Tám');
    const alive = sim.story.view().run!.aliveMs;
    for (let i = 0; i < 400 && !sim.story.view().street?.choices; i++) { sim.talkTo(cfg.seller); sim.tick(50); }
    expect(sim.story.view().street?.choices).toHaveLength(2);
    // Inside, the street (and its gags) wait.
    expect(sim.story.view().run!.aliveMs).toBe(alive);
    expect(sim.story.view().run!.hazards.every((h) => h.phase !== 'active')).toBe(true);
    sim.story.chooseReply(0);
    let cat = false;
    for (let i = 0; i < 800 && (sim.story.canVisit('cafe').ok || !cat); i++) { sim.tick(50); cat ||= shop()?.effect?.kind === 'cat'; }
    expect(cat).toBe(true);
    expect(sim.story.canVisit('cafe').ok).toBe(false);
    const s = shop()!;
    sim.shopMoveTo(s.exitX, s.h + 0.3);
    for (let i = 0; i < 200 && shop(); i++) sim.tick(50);
    expect(shop()).toBeNull();
    expect(sim.player.pos.y).toBeGreaterThan(cfg.door.y + 0.5);
    sim.tick(50);
    expect(shop()).toBeNull();
  });

  it('only the café has a door; it is shut once the hero is knocked out', () => {
    const sim = chapter1(12, calm);
    expect(sim.story.view().street?.doors.map((d) => d.id)).toEqual(['cafe']);
    expect(sim.story.view().street?.doors[0]!.open).toBe(true);
    sim.run!.crash('motorbike', 'Ối…', 2000);
    sim.tick(50);
    expect(sim.story.view().street?.doors[0]!.open).toBe(false);
  });

  it('trees, stools and parked bikes block the way; the hero walks round people, never through them', () => {
    const sim = chapter1(14, calm);
    sim.startRun();
    // Straight at the tree on tile (5, 16): stopped in front of it.
    sim.player.pos = { x: 5.5, y: 15.3 };
    sim.steer(0, 1);
    for (let i = 0; i < 20; i++) sim.tick(50);
    expect(sim.world.grid.isWalkable({ x: 5, y: 16 })).toBe(false);
    expect(sim.player.pos.y).toBeLessThan(16);
    sim.steer(0, 0);
    const seller = sim.story.view().street!.npcs.find((n) => n.id === 'tra_da:bay')!;
    sim.player.pos = { x: seller.x + 1.2, y: seller.y };
    sim.steer(-1, 1);
    for (let i = 0; i < 30; i++) {
      sim.tick(50);
      expect(Math.hypot(sim.player.pos.x - seller.x, sim.player.pos.y - seller.y)).toBeGreaterThan(0.4);
    }
  });

  it('onlookers gather on free ground only (never on a tree, a stall or a car)', () => {
    const sim = chapter1(15);
    sim.steer(1, 0); sim.tick(50); sim.steer(0, 0);
    sim.player.pos = { x: 13.5, y: 15.5 };
    sim.run!.crash('motorbike', 'Ối…', 2000);
    for (let i = 0; i < 160; i++) sim.tick(50);
    const crowd = sim.street!['rescue']!.crowd as Array<{ x: number; y: number }>;
    expect(crowd.length).toBeGreaterThan(0);
    for (const n of crowd) expect(sim.world.grid.isWalkable({ x: Math.floor(n.x), y: Math.floor(n.y) }), `${n.x},${n.y}`).toBe(true);
  });
});
