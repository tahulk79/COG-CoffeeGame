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
      // Before the hero is in the van the camera stays near the hero (and tilts to the van); after it, it rides with the van.
      if (st?.focus && !st.heroHidden) expect(Math.hypot(st.focus.x - sim.player.pos.x, st.focus.y - sim.player.pos.y)).toBeLessThanOrEqual(1.61);
      if (st?.focus && st.heroHidden) followed = true;
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

  it('the rescue: nobody ever walks through a tree, stall or car; the medics clear the crowd and scold the one filming', () => {
    const L = CONTENT.story.chapters.S03!.street!.rescue!;
    for (const at of [{ x: 13.5, y: 15.5 }, { x: 12, y: 6.5 }, { x: 26, y: 12.5 }]) {
      const sim = chapter1(16, calm);
      sim.steer(1, 0); sim.tick(50); sim.steer(0, 0);
      sim.player.pos = { ...at };
      sim.run!.crash('motorbike', 'Ối…', 2000);
      const said = new Set<string>();
      let hiddenWhileLeaving = false;
      let bonkAt: number | null = null;
      for (let i = 0; i < 700 && sim.story.chapterId === 'S03'; i++) {
        sim.tick(50);
        const st = sim.story.view().street!;
        for (const n of st.npcs) if (n.say) said.add(n.say);
        const r = sim.street!['rescue'] as { crowd: Array<{ x: number; y: number }>; medics: Array<{ x: number; y: number }> } | null;
        for (const n of [...(r?.crowd ?? []), ...(r?.medics ?? [])]) expect(sim.world.grid.isWalkable({ x: Math.floor(n.x), y: Math.floor(n.y) }), `${n.x.toFixed(2)},${n.y.toFixed(2)} at ${at.x},${at.y}`).toBe(true);
        // Once the ambulance has pulled up, the crowd keeps off its lane.
        const rr = sim.street!['rescue'] as { ms: number; van: { y: number } | null; crowd: Array<{ y: number; goal?: unknown }> } | null;
        if (rr?.van && rr.ms > 5500 && rr.ms < 12000) for (const n of rr.crowd) expect(Math.abs(n.y - rr.van.y), 'onlooker on the ambulance lane').toBeGreaterThan(0.9);
        // "CỐP!" and the hero is in the van within a second.
        if (st.bonk) bonkAt ??= i;
        if (bonkAt !== null && i - bonkAt > 20) expect(st.heroHidden).toBe(true);
      }
      expect([...said]).toEqual(expect.arrayContaining([L.shoo, L.scold, L.filmer, L.noStretcher, L.handCarry, ...L.photo]));
      // Chapter 2 is next, but until the map changes the street still shows the hero gone and follows the van.
      const v = sim.story.view();
      expect(v.chapter).toBe('S04');
      hiddenWhileLeaving = !!v.street?.heroHidden;
      expect(hiddenWhileLeaving).toBe(true);
      expect(v.run?.down).toBeTruthy();
    }
  });

  it('on the way into the circle the ambulance may lose a wheel and blow up (BÙM!) — chapter 2 either way', () => {
    for (const chance of [1, 0]) {
      const sim = chapter1(17, (c) => { calm(c); c.story.chapters.S03!.street!.rescue!.wheelOffChance = chance; });
      sim.steer(1, 0); sim.tick(50); sim.steer(0, 0);
      sim.player.pos = { x: 14, y: 9.5 };
      sim.run!.crash('motorbike', 'Ối…', 2000);
      let wheel = false, boom = false;
      for (let i = 0; i < 800 && sim.story.chapterId === 'S03'; i++) {
        sim.tick(50);
        const st = sim.story.view().street!;
        wheel ||= !!st.wheel; boom ||= !!st.boom;
      }
      expect([wheel, boom], `chance ${chance}`).toEqual(chance ? [true, true] : [false, false]);
      expect(sim.story.chapterId).toBe('S04');
    }
  });

  it('the ambulance keeps to its lane for its direction (west on the north lane, east on the south lane), never veering', () => {
    const lanes = CONTENT.story.chapters.S03!.street!.bikeLanes;
    // A hero on the east half makes it come from the east (heading west); on the west half, the other way.
    for (const [x, dir] of [[40, -1], [8, 1]] as const) {
      const sim = chapter1(18, (c) => { calm(c); c.story.chapters.S03!.street!.rescue!.wheelOffChance = 0; });
      sim.steer(1, 0); sim.tick(50); sim.steer(0, 0);
      sim.player.pos = { x, y: 9.5 };
      sim.run!.crash('motorbike', 'Ối…', 2000);
      // The bike lane, a little in from the kerb.
      const want = lanes[dir > 0 ? lanes.length - 1 : 0]! + (dir > 0 ? -0.3 : 0.3);
      let seen = 0;
      for (let i = 0; i < 800 && sim.story.chapterId === 'S03'; i++) {
        sim.tick(50);
        const van = sim.story.view().street!.npcs.find((n) => n.look === 'ambulance');
        if (!van) continue;
        seen++;
        expect(van.y, `lane at x=${van.x.toFixed(1)}`).toBeCloseTo(want, 5);
        expect(van.dir).toBe(dir);
      }
      expect(seen).toBeGreaterThan(50);
    }
  });

  it('nobody stands on or walks through the hero lying on the street (onlookers keep a tile and a half away, passers-by turn back)', () => {
    for (const at of [{ x: 13.5, y: 9.5 }, { x: 30, y: 6.5 }, { x: 20, y: 12.5 }]) {
      const sim = chapter1(19, (c) => { calm(c); c.story.chapters.S03!.street!.rescue!.wheelOffChance = 0; });
      sim.steer(1, 0); sim.tick(50); sim.steer(0, 0);
      sim.player.pos = { ...at };
      sim.run!.crash('motorbike', 'Ối…', 2000);
      for (let i = 0; i < 700 && sim.story.chapterId === 'S03'; i++) {
        sim.tick(50);
        const st = sim.story.view().street!, rr = sim.street!['rescue'] as { ms: number; carried: boolean; hidden: boolean } | null;
        if (!rr || rr.carried || rr.hidden) continue;
        for (const n of st.npcs) {
          // The medics come to the hero on purpose; everyone else keeps off them.
          if (n.id.startsWith('medic') || n.look === 'ambulance' || n.bike) continue;
          const d = Math.hypot(n.x - sim.player.pos.x, n.y - sim.player.pos.y);
          // Onlookers settle at a distance once they have arrived (they walk there from wherever they were).
          if (rr.ms > 5000) expect(d, `${n.id} at ${rr.ms | 0} ms`).toBeGreaterThan(0.9);
        }
      }
    }
  });

  /** A button-masher: random steering, taps on the floor and on people, door walks, shop taps, reply picks. */
  function masher(sim: GameSimulation, seed: number, ms: number): void {
    // Seeded by the seed and the time, so every tick of every run decides differently.
    let r = (seed * 2654435761 + ms * 40503) >>> 0;
    const rnd = () => ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296);
    rnd(); rnd();
    if (Math.floor(ms / 50) % 8 !== 0) return;
    const st = sim.story.view().street;
    const roll = rnd();
    if (st?.shop) {
      if (roll < 0.5) sim.shopMoveTo(rnd() * st.shop.w, rnd() * (st.shop.h + 0.3));
      else if (roll < 0.7 && st.shop.npcs.length) sim.talkTo(st.shop.npcs[Math.floor(rnd() * st.shop.npcs.length)]!.id);
      else sim.steer(rnd() * 2 - 1, rnd() * 2 - 1);
    } else if (roll < 0.25) sim.steer(rnd() * 2 - 1, rnd() * 2 - 1);
    else if (roll < 0.45) sim.clickTile({ x: Math.floor(rnd() * 47), y: Math.floor(rnd() * 17) });
    else if (roll < 0.6 && st?.npcs.length) sim.talkTo(st.npcs[Math.floor(rnd() * st.npcs.length)]!.id);
    else if (roll < 0.68) {
      // Walk up to a door or a street end.
      const targets = [...(st?.doors ?? []).map((d) => ({ x: d.x, y: d.y })), { x: 2.2, y: 9.5 }, { x: 45.8, y: 9.5 }];
      const t = targets[Math.floor(rnd() * targets.length)]!;
      // A jump to somewhere else drops the old walking orders, like the game does when it moves the hero itself.
      sim.player.pos = { x: t.x, y: t.y };
      sim.player.clearWaypoints();
    } else if (roll < 0.8) sim.steer(0, 0);
    if (st?.choices && rnd() < 0.5) sim.story.chooseReply(rnd() < 0.5 ? 0 : 1);
  }

  it('fuzz: a button-masher can never break the street (no stuck state, no bad numbers, always on to chapter 2)', () => {
    const finite = (...v: number[]) => v.every((n) => Number.isFinite(n));
    for (let seed = 1; seed <= 40; seed++) {
      const sim = chapter1(seed);
      let ms = 0;
      while (sim.story.chapterId === 'S03' && ms < 600_000) {
        masher(sim, seed, ms);
        sim.tick(50);
        ms += 50;
        const v = sim.story.view(), run = v.run, st = v.street;
        if (!run || !st) continue;
        expect(finite(sim.player.pos.x, sim.player.pos.y), `seed ${seed} player ${ms}`).toBe(true);
        for (const n of st.npcs) expect(finite(n.x, n.y, n.scale, n.tilt), `seed ${seed} npc ${n.id} ${ms}`).toBe(true);
        for (const h of run.hazards) expect(finite(h.x, h.y), `seed ${seed} hazard ${h.kind} ${ms}`).toBe(true);
        // Walking about, the hero is always on free ground (the barrier scene and the rescue walk them on purpose).
        if (run.running && !st.shop && run.phase === 'chaos' && sim.story.chapterId === 'S03' && !sim.run!.held) {
          expect(sim.world.grid.isWalkable(sim.player.tile) || sim.player.tile.x < 0, `seed ${seed} hero in a blocked tile at ${ms}: ${JSON.stringify(sim.player.pos)}`).toBe(true);
        }
      }
      expect(sim.story.chapterId, `seed ${seed} never reached chapter 2 (${ms} ms)`).toBe('S04');
    }
  }, 120_000);

  it('knocked out by another gag while arguing through the barrier: the barrier scene lets go of the hero', () => {
    const sim = chapter1(21, calm);
    sim.player.pos = { x: 2.2, y: 9.5 };
    for (let i = 0; i < 300 && !sim.story.view().street?.choices; i++) sim.tick(50);
    sim.story.chooseReply(0);
    for (let i = 0; i < 60; i++) sim.tick(50);
    // Walking out through the open barrier: a gag gets them first.
    sim.run!.crash('durian', 'Ối…', 2000);
    sim.tick(50);
    const at = { ...sim.player.pos };
    for (let i = 0; i < 20; i++) sim.tick(50);
    expect(sim.story.view().run?.phase).toBe('faint');
    expect(Math.hypot(sim.player.pos.x - at.x, sim.player.pos.y - at.y)).toBeLessThan(0.5);
    expect(play(sim).chapter).toBe('S04');
  });

  it('the rescue camera keeps both the hero and the ambulance in view on a narrow phone, both ways the ambulance comes', () => {
    // A phone in portrait shows about five tiles across (zoom 0.586 at 375 px wide): 320 render px either side of the camera.
    const half = 320, sx = (p: { x: number; y: number }) => (p.x - p.y) * 64;
    for (const x of [8, 40]) {
      const sim = chapter1(22, (c) => { calm(c); c.story.chapters.S03!.street!.rescue!.wheelOffChance = 0; });
      sim.steer(1, 0); sim.tick(50); sim.steer(0, 0);
      sim.player.pos = { x, y: 9.5 };
      sim.run!.crash('motorbike', 'Ối…', 2000);
      let checked = 0;
      for (let i = 0; i < 400 && sim.story.chapterId === 'S03'; i++) {
        sim.tick(50);
        const st = sim.story.view().street!, rr = sim.street!['rescue'] as { ms: number; hidden: boolean } | null;
        const van = st.npcs.find((n) => n.look === 'ambulance');
        if (!rr || !van || !st.focus) continue;
        const f = st.focus;
        if (!rr.hidden) {
          // The camera stays close to the hero…
          expect(Math.hypot(f.x - sim.player.pos.x, f.y - sim.player.pos.y)).toBeLessThanOrEqual(1.61);
          // …and once the ambulance has pulled up, it is in the frame too (with half its length to spare).
          if (rr.ms > 6000 && rr.ms < 11000) {
            checked++;
            expect(Math.abs(sx(van) - sx(f)) + 64, `van at ${van.x.toFixed(1)}`).toBeLessThan(half);
            expect(Math.abs(sx(sim.player.pos) - sx(f)) + 40).toBeLessThan(half);
          }
        }
      }
      expect(checked).toBeGreaterThan(20);
    }
  });
});
