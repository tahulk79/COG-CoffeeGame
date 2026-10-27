import Phaser from 'phaser';
import { t } from '../core/i18n';
import type { CafeProfile, CafeVisit, SocialResult } from '../gameplay/social/NeighborService';
import type { SimulationSnapshot } from '../gameplay/GameSimulation';
import { PLACEHOLDER_STYLES } from '../components/render/placeholderStyles';
import { Button } from './widgets/Button';
import { CSS, TEXT, panelBg } from './theme/textStyles';
import { setShown } from './components/panelVisibility';
import { hudViewport } from './layout/HudLayout';

/** The only commands the world-map UI may issue. */
export interface WorldMapUiCommands {
  buyLand(regionId: string): SocialResult;
  build(regionId: string, kind: 'cafe' | 'farm'): SocialResult;
  travel(regionId: string): { ok: true } | { ok: false; reason: string };
  visit(cafeId: string): CafeVisit | null;
  like(cafeId: string): SocialResult;
}

const W = 960;
const H = 540;
const MAP_W = 620;
const CELL = 22;
const ROWS = 3;
const SEAT_TYPES = new Set(['chair', 'armchair']);

interface Dot {
  x: number;
  y: number;
  tx: number;
  ty: number;
  wait: number;
}

/**
 * Placeholder world map: regions as nodes you can open (travel) or inspect.
 * Districts list other players' cafés with stars, decor score and how crowded
 * they are; "Ghé thăm" draws their room from above with customers in it.
 */
export class WorldMapHud {
  readonly buttons = new Map<string, Button>();
  private readonly root: Phaser.GameObjects.Container;
  private readonly mapRoot: Phaser.GameObjects.Container;
  private readonly background: Phaser.GameObjects.NineSlice;
  private portrait = false;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly labels = new Map<string, Phaser.GameObjects.Text>();
  private readonly title: Phaser.GameObjects.Text;
  private readonly info: Phaser.GameObjects.Text;
  private readonly message: Phaser.GameObjects.Text;
  private readonly go: Button;
  private readonly back: Button;
  private readonly likeBtn: Button;
  private readonly rows: Array<{ text: Phaser.GameObjects.Text; btn: Button }> = [];
  private readonly estateButtons: Button[] = [];
  private readonly next: Button;
  private readonly closeButton: Button;
  private page = 0;
  private shown = false;
  private selected = 'cafe';
  private visiting: CafeVisit | null = null;
  private dots: Dot[] = [];
  private lastS: SimulationSnapshot | null = null;
  private readonly keyHandler = () => this.toggle();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly commands: WorldMapUiCommands,
  ) {
    this.root = scene.add.container(0, 0).setDepth(1400).setVisible(false);
    this.background = panelBg(scene, W, H, 0.98);
    this.root.add(this.background);
    this.mapRoot = scene.add.container(0, 0);
    this.root.add(this.mapRoot);
    this.gfx = scene.add.graphics();
    this.mapRoot.add(this.gfx);
    this.root.add(scene.add.text(10, 8, t('world.title'), { ...TEXT, fontSize: '16px', color: CSS.gold }));
    const px = MAP_W + 20;
    this.title = scene.add.text(px, 40, '', { ...TEXT, fontSize: '16px', color: CSS.gold, wordWrap: { width: 300 } });
    this.info = scene.add.text(px, 70, '', { ...TEXT, wordWrap: { width: 300 } });
    this.message = scene.add.text(px, H - 28, '', TEXT);
    this.go = new Button(scene, px, 0, t('world.go'), () => this.report(commands.travel(this.selected), ''), 'world.go');
    this.back = new Button(scene, px, H - 62, t('world.back'), () => this.leaveVisit(), 'world.back');
    this.likeBtn = new Button(scene, px + 90, H - 62, t('world.like'), () => this.visiting && this.report(commands.like(this.visiting.id), t('world.liked')), 'world.like');
    this.root.add([this.title, this.info, this.message, this.go.text, this.back.text, this.likeBtn.text]);
    for (const b of [this.go, this.back, this.likeBtn]) this.buttons.set(b.name, b);
    for (let i = 0; i < ROWS; i++) {
      const text = scene.add.text(px, 0, '', { ...TEXT, fontSize: '12px', wordWrap: { width: 300 } });
      const btn = new Button(scene, px, 0, '', () => undefined, `world.visit.${i}`);
      this.root.add([text, btn.text]);
      this.rows.push({ text, btn });
    }
    for (const [name, kind] of [['land', null], ['cafe', 'cafe'], ['farm', 'farm']] as const) {
      const b = new Button(scene, px, 0, '', () => {
        const own = this.lastS?.estates.find((r) => r.id === this.selected);
        const built = kind === 'cafe' ? own?.cafeBuilt : own?.farmBuilt;
        if (kind && built) this.report(commands.travel(`${this.selected}__${kind}`), '');
        else this.report(kind ? commands.build(this.selected, kind) : commands.buyLand(this.selected), 'Đã hoàn tất');
      }, `world.${name}`);
      this.estateButtons.push(b);
      this.root.add(b.text);
      this.buttons.set(b.name, b);
    }
    this.closeButton = new Button(scene, W - 80, 8, 'Đóng', () => this.close(), 'world.close');
    this.root.add(this.closeButton.text);
    this.buttons.set(this.closeButton.name, this.closeButton);
    this.next = new Button(scene, px, H - 62, 'Trang tiếp →', () => { this.page++; }, 'world.next');
    this.root.add(this.next.text);
    this.buttons.set(this.next.name, this.next);
    scene.input.keyboard?.on('keydown-M', this.keyHandler);
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.layout();
  }

  close(): void {
    if (this.shown) this.toggle();
  }

  readonly id = 'map';

  get isOpen(): boolean {
    return this.shown;
  }

  open(): void {
    if (!this.shown) this.toggle();
  }

  toggle(): void {
    this.shown = !this.shown;
    if (!this.shown) this.visiting = null;
    setShown(this.root, this.shown);
  }

  private layout(): void {
    this.portrait = hudViewport.h > hudViewport.w && hudViewport.w < W;
    const width = this.portrait ? Math.min(390, hudViewport.w - 12) : W;
    const height = this.portrait ? 760 : H;
    const scale = Math.min(1, (hudViewport.w - 12) / width, (hudViewport.h - 12) / height);
    this.background.setSize(width, height);
    this.closeButton.text.setPosition(width - 80, 8);
    this.root.setScale(scale).setPosition((hudViewport.w - width * scale) / 2, (hudViewport.h - height * scale) / 2);
    this.mapRoot.setScale(this.portrait ? (width - 16) / 640 : 1).setPosition(0, 0);
    const x = this.portrait ? 16 : MAP_W + 20;
    const offset = this.portrait ? 235 : 0;
    this.title.setPosition(x, 40 + offset);
    this.info.setPosition(x, 70 + offset);
    this.message.setPosition(x, height - 28);
    this.back.text.setPosition(x, height - 62);
    this.likeBtn.text.setPosition(x + 110, height - 62);
    this.next.text.setPosition(x, height - 62);
    this.go.text.setPosition(x, 140 + offset);
    this.rows.forEach((r) => { r.text.x = x; r.btn.text.x = x; });
  }

  private report(r: { ok: true } | { ok: false; reason: string }, ok: string): void {
    this.message.setColor(r.ok ? CSS.leaf : CSS.error);
    this.message.setText(r.ok ? ok : ({ landRequired: 'Cần mua đất trước.', unknownRegion: 'Khu vực không hợp lệ.' }[r.reason] ?? t(`meta.fail.${r.reason}`)));
    if (r.ok && !ok) this.toggle(); // travelling: close the map
  }

  private leaveVisit(): void {
    this.visiting = null;
    this.message.setText('');
  }

  private startVisit(id: string): void {
    const v = this.commands.visit(id);
    if (!v) return;
    this.visiting = v;
    this.message.setText('');
    const seats = v.layout.filter((f) => SEAT_TYPES.has(f.type));
    this.dots = [];
    for (let i = 0; i < v.customersNow; i++) {
      const s = seats[i % Math.max(1, seats.length)];
      const x = s ? s.x + 0.5 : 6;
      const y = s ? s.y + 0.5 : 8;
      this.dots.push({ x: 6, y: 13, tx: x, ty: y, wait: 0.5 + Math.random() * 3 });
    }
  }

  private crowdText(p: CafeProfile): string {
    return `${t(`world.crowd.${p.crowd}`)} (${p.customersNow}/${p.seats})`;
  }

  private statsText(p: CafeProfile, total: number): string {
    if (p.businessKind === 'farm') return [
      `Chủ vườn: ${p.owner} · ${p.controller === 'bot' ? 'Máy' : 'Bạn'}`,
      `16 ô trồng · ${p.activity}`,
      p.simulation ? `Hạt giống: ${p.simulation.stock}\nĐã bán: ${p.simulation.sold} nông sản\nVí cơ sở: ${p.simulation.coins} xu` : '',
      p.signature,
    ].filter(Boolean).join('\n');
    return [
      `${p.mine ? t('world.you') : t('world.owner', { name: p.owner })}`,
      `★ ${p.rating.toFixed(1)}   ♥ ${p.likes}`,
      `${t('world.decor')}: ${p.decorScore}/100  (#${p.rankDecor}/${total})`,
      `${t('world.crowd')}: ${this.crowdText(p)}  (#${p.rankBusy}/${total})`,
      p.mine ? '' : `${p.controller === 'bot' ? 'Chủ cơ sở: Máy' : 'Người chơi'} · ${p.activity}`,
      p.mine ? '' : `${t('world.signature')}: ${p.signature}`,
      p.simulation ? `Kho: ${p.simulation.stock} · Đã bán: ${p.simulation.sold}\nVí cơ sở: ${p.simulation.coins} xu` : '',
    ].filter(Boolean).join('\n');
  }

  private drawMap(s: SimulationSnapshot): void {
    const g = this.gfx;
    g.clear();
    g.fillStyle(0x24445c, 1).fillRect(10, 36, MAP_W, 420); // sea
    g.fillStyle(0x6f9a52, 1).fillRoundedRect(40, 150, 250, 230, 40).fillRoundedRect(210, 50, 380, 300, 50); // land
    const reg = s.meta.regions;
    const at = (id: string) => reg.find((r) => r.id === id)!;
    g.lineStyle(3, 0xe8c48a, 0.8);
    for (const [a, b] of [['farm', 'cafe'], ['cafe', 'old_town'], ['cafe', 'night_market'], ['night_market', 'riverside']] as const) {
      g.lineBetween(10 + at(a).pos.x, 36 + at(a).pos.y, 10 + at(b).pos.x, 36 + at(b).pos.y);
    }
    for (const r of reg) {
      const x = 10 + r.pos.x;
      const y = 36 + r.pos.y;
      const estate = s.estates.find((e) => e.id === r.id);
      g.fillStyle(r.locked ? 0x6b6b6b : r.current ? 0xf2c14e : estate?.owned ? 0x4e9e63 : 0xc8463d, 1).fillCircle(x, y, 13);
      if (this.selected === r.id) g.lineStyle(3, 0xffffff, 1).strokeCircle(x, y, 17);
      let lab = this.labels.get(r.id);
      if (!lab) {
        lab = this.scene.add.text(0, 0, '', { ...TEXT, fontSize: '12px', backgroundColor: '#1d1612aa' }).setOrigin(0.5, 0);
        this.mapRoot.add(lab);
        this.labels.set(r.id, lab);
      }
      lab.setVisible(true).setPosition(x, y + 17).setText(r.locked ? `${r.label}\n${t('meta.needLevel', { n: r.unlockLevel })}` : `${r.label}${estate?.owned ? `\n${Number(estate.cafeBuilt) + Number(estate.farmBuilt)}/2 công trình` : ''}`);
    }
  }

  private drawVisit(dt: number): void {
    for (const label of this.labels.values()) label.setVisible(false);
    const v = this.visiting!;
    const g = this.gfx;
    g.clear();
    const ox = 10 + (MAP_W - 14 * CELL) / 2;
    const oy = 50;
    g.fillStyle(0xd9c3a0, 1).fillRect(ox, oy, 14 * CELL, 14 * CELL);
    g.lineStyle(1, 0x3e2f27, 0.25);
    for (let i = 0; i <= 14; i++) g.lineBetween(ox + i * CELL, oy, ox + i * CELL, oy + 14 * CELL).lineBetween(ox, oy + i * CELL, ox + 14 * CELL, oy + i * CELL);
    const box = (type: string, x: number, y: number, rot: number, fixed: boolean): void => {
      const style = PLACEHOLDER_STYLES[type];
      const sw = type === 'cafe_table_long' || type === 'bookshelf' || type === 'counter' || type === 'order_counter' ? 2 : 1;
      const w = rot % 2 === 1 ? 1 : sw;
      const h = rot % 2 === 1 ? sw : 1;
      g.fillStyle(fixed ? 0x8a7a68 : style?.color ?? 0xff00ff, 1).fillRect(ox + x * CELL + 2, oy + y * CELL + 2, w * CELL - 4, h * CELL - 4);
    };
    for (const f of v.fixed) box(f.type, f.x, f.y, f.rotation, true);
    for (const f of v.layout) {
      box(f.type, f.x, f.y, f.rotation, false);
      if (v.businessKind === 'farm') g.fillStyle((v.simulation?.phase ?? 0) < 2 ? 0x548b36 : 0xc2994b, 1).fillCircle(ox + (f.x + 0.5) * CELL, oy + (f.y + 0.5) * CELL, 7);
    }
    // Customers wander between seats (purely visual).
    for (const d of this.dots) {
      d.wait -= dt;
      const dx = d.tx - d.x;
      const dy = d.ty - d.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.05) {
        const step = Math.min(dist, 1.6 * dt);
        d.x += (dx / dist) * step;
        d.y += (dy / dist) * step;
      } else if (d.wait <= 0) {
        const seats = v.layout.filter((f) => SEAT_TYPES.has(f.type));
        const s = seats[Math.floor(Math.random() * Math.max(1, seats.length))];
        if (s) {
          d.tx = s.x + 0.5;
          d.ty = s.y + 0.5;
        }
        d.wait = 3 + Math.random() * 6;
      }
      g.fillStyle(0xd07a3a, 1).fillCircle(ox + d.x * CELL, oy + d.y * CELL, 6);
    }
  }

  update(s: SimulationSnapshot, dtMs: number): void {
    const available = !s.story.active;
    setShown(this.root, available && this.shown);
    this.lastS = s;
    if (!available || !this.shown) return;
    const total = s.cafes.length;
    for (const b of this.estateButtons) b.setVisible(false);
    this.next.setVisible(false);
    const rowsFor = (region: string): CafeProfile[] => s.cafes.filter((c) => c.region === region && !c.mine);

    for (const r of this.rows) {
      r.text.setVisible(false);
      r.btn.setVisible(false);
    }
    this.go.setVisible(false);
    this.back.setVisible(!!this.visiting);
    this.likeBtn.setVisible(!!this.visiting && !this.visiting.mine);

    if (this.visiting) {
      const cur = s.cafes.find((c) => c.id === this.visiting!.id);
      if (cur) Object.assign(this.visiting, cur);
      this.drawVisit(dtMs / 1000);
      this.title.setText(this.visiting.name);
      this.info.setText(cur ? this.statsText(cur, total) : '');
      if (cur) this.likeBtn.setEnabled(!cur.liked).setLabel(cur.liked ? t('world.likedAlready') : t('world.like'));
      return;
    }

    this.drawMap(s);
    // Clicking a node: the map area is a plain rectangle, so hit-test the pointer against node positions.
    const reg = s.meta.regions.find((r) => r.id === this.selected) ?? s.meta.regions[0]!;
    this.title.setText(reg.label);
    const lines: string[] = [];
    if (reg.locked) lines.push(t('world.locked', { n: reg.unlockLevel }));
    else if (reg.map) {
      lines.push(reg.current ? t('meta.here') : t('world.travelHint'));
      this.go.setVisible(!reg.current).setEnabled(true).text.setPosition(this.go.text.x, 140 + (this.portrait ? 235 : 0));
      const mine = s.cafes.find((c) => c.mine);
      if (reg.id === 'cafe' && mine) lines.push('', this.statsText(mine, total));
    } else if (!reg.locked) {
      const estate = s.estates.find((e) => e.id === reg.id);
      lines.push(estate?.owned ? 'Đất của bạn · Chọn công trình' : 'Mua đất → Xây dựng → Sản xuất → Bán');
      const [land, cafe, farm] = this.estateButtons;
      if (estate) {
        land!.setVisible(!estate.owned).setEnabled(s.economy.coins >= estate.landCost).setLabel(`Mua đất · ${estate.landCost} xu`).text.setPosition(this.title.x, 110 + (this.portrait ? 235 : 0));
        for (const [b, kind, y] of [[cafe!, 'cafe', 110], [farm!, 'farm', 148]] as const) {
          const built = kind === 'cafe' ? estate.cafeBuilt : estate.farmBuilt;
          const cost = kind === 'cafe' ? estate.cafeCost : estate.farmCost;
          b.setVisible(estate.owned).setEnabled(built || s.economy.coins >= cost)
            .setLabel(`${built ? 'Vào' : 'Xây'} ${kind === 'cafe' ? 'quán' : 'nông trại'}${built ? '' : ` · ${cost} xu`}`).text.setPosition(this.title.x, y + (this.portrait ? 235 : 0));
        }
      }
      const list = rowsFor(reg.id);
      const pages = Math.max(1, Math.ceil(list.length / ROWS));
      this.page %= pages;
      list.slice(this.page * ROWS, (this.page + 1) * ROWS).forEach((c, i) => {
        const row = this.rows[i]!;
        const y = 202 + i * 62 + (this.portrait ? 235 : 0);
        row.text.setVisible(true).setPosition(row.text.x, y).setText(`${c.businessKind === 'farm' ? '🌱' : '☕'} ${c.name} · Máy\n${c.activity}`);
        row.btn.setVisible(true).setLabel(t('world.visit')).rebind(`world.visit.${c.id}`, () => this.startVisit(c.id));
        row.btn.text.setPosition(row.btn.text.x, y + 28);
        this.buttons.set(`world.visit.${c.id}`, row.btn);
      });
      this.next.setVisible(pages > 1).setLabel(`Trang ${this.page + 1}/${pages} →`);
    }
    this.info.setText(lines.join('\n'));
  }

  /** Pointer handling on the map area (nodes are drawn with Graphics, so hit-test by distance). */
  handlePointer(px: number, py: number): void {
    if (!this.shown || this.visiting || !this.lastS) return;
    const lx = (px - this.root.x) / this.root.scaleX / this.mapRoot.scaleX - 10;
    const ly = (py - this.root.y) / this.root.scaleY / this.mapRoot.scaleY - 36;
    for (const r of this.lastS.meta.regions) {
      if (Math.hypot(lx - r.pos.x, ly - r.pos.y) <= 18) {
        this.selected = r.id;
        this.page = 0;
        this.message.setText('');
        return;
      }
    }
  }

  destroy(): void {
    this.scene.input.keyboard?.off('keydown-M', this.keyHandler);
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.root.destroy();
  }
}
