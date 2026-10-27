import Phaser from 'phaser';
import { CONTENT } from '../data/content';
import { t } from '../core/i18n';
import type { Reward } from '../gameplay/meta/MetaService';
import type { SimulationSnapshot } from '../gameplay/GameSimulation';
import { Button } from './widgets/Button';
import { CSS, TEXT, panelBg } from './theme/textStyles';
import { setShown } from './components/panelVisibility';
import { hudViewport } from './layout/HudLayout';

/** The only commands the world-progress UI may issue. */
export interface MetaUiCommands {
  replayStory(): void;
  newGame(): void;
  claimQuest(id: string): { ok: true } | { ok: false; reason: string };
  buySkill(id: string): { ok: true } | { ok: false; reason: string };
  buyBranch(id: string): { ok: true } | { ok: false; reason: string };
  collectBranch(id: string): { ok: true } | { ok: false; reason: string };
  buyUpgrade(id: string): { ok: true } | { ok: false; reason: string };
}

type Tab = 'quests' | 'achievements' | 'skills' | 'upgrades' | 'branches' | 'system';
const TABS: Tab[] = ['quests', 'achievements', 'skills', 'upgrades', 'branches', 'system'];
const W = 720;
const ROWS = 10;
const ROW_H = 30;

interface RowData {
  text: string;
  button?: { label: string; enabled: boolean; name: string; onClick: () => void };
}

const rewardText = (r: Reward): string => [r.coins ? `${r.coins}đ` : '', r.exp ? `${r.exp} EXP` : '', ...(r.items ?? []).map((i) => `${i.qty}× ${CONTENT.items[i.itemId]?.label ?? i.itemId}`)].filter(Boolean).join(' + ');

/** Placeholder "Sổ tay" panel: world map, quests, achievements, skills and branches. */
export class MetaHud {
  readonly buttons = new Map<string, Button>();
  private readonly root: Phaser.GameObjects.Container;
  private readonly header: Phaser.GameObjects.Text;
  private readonly message: Phaser.GameObjects.Text;
  private readonly rows: Array<{ text: Phaser.GameObjects.Text; button: Button }> = [];
  private tab: Tab = 'quests';
  private confirmNew = false;
  private shown = false;
  private readonly keyHandler = () => this.toggle();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly commands: MetaUiCommands,
  ) {
    this.root = scene.add.container(0, 0).setDepth(1300).setVisible(false);
    this.root.add(panelBg(scene, W, 76 + ROWS * ROW_H + 34, 0.98));
    this.header = scene.add.text(10, 40, '', { ...TEXT, color: CSS.gold });
    this.message = scene.add.text(10, 76 + ROWS * ROW_H + 8, '', TEXT);
    this.root.add([scene.add.text(10, 8, t('meta.title'), { ...TEXT, fontSize: '16px', color: CSS.gold }), this.header, this.message]);
    let tabX = 96;
    TABS.forEach((id) => {
      const b = new Button(scene, tabX, 6, t(`meta.tab.${id}`), () => this.setTab(id), `meta.tab.${id}`);
      tabX += b.width + 6;
      this.root.add(b.text);
      this.buttons.set(b.name, b);
    });
    for (let i = 0; i < ROWS; i++) {
      const y = 70 + i * ROW_H;
      const text = scene.add.text(10, y + 4, '', { ...TEXT, wordWrap: { width: 540 } });
      const button = new Button(scene, W - 130, y, '', () => undefined, `meta.row.${i}`);
      this.root.add([text, button.text]);
      this.rows.push({ text, button });
    }
    scene.input.keyboard?.on('keydown-J', this.keyHandler);
    scene.scale.on(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.layout();
  }

  readonly id = 'meta';

  get isOpen(): boolean {
    return this.shown;
  }

  open(): void {
    if (!this.shown) this.toggle();
  }

  close(): void {
    if (this.shown) this.toggle();
  }

  toggle(): void {
    this.shown = !this.shown;
    setShown(this.root, this.shown);
  }

  private setTab(tab: Tab): void {
    this.tab = tab;
    this.confirmNew = false;
    this.message.setText('');
  }

  private layout(): void {
    this.root.setPosition((hudViewport.w - W) / 2, 60);
  }

  private report(r: { ok: true } | { ok: false; reason: string }, ok: string): void {
    this.message.setColor(r.ok ? CSS.leaf : CSS.error);
    this.message.setText(r.ok ? ok : t(`meta.fail.${r.reason}`, {}));
  }

  private content(s: SimulationSnapshot): { header: string; rows: RowData[] } {
    const m = s.meta;
    const c = this.commands;
    const rows: RowData[] = [];
    let header = '';
    switch (this.tab) {
      case 'system':
        header = t('meta.system.help');
        rows.push({ text: t('meta.replayDesc'), button: { label: t('meta.replay'), enabled: true, name: 'meta.replay', onClick: () => c.replayStory() } });
        rows.push({
          text: t('meta.newGameDesc'),
          button: {
            label: this.confirmNew ? t('meta.newGameConfirm') : t('meta.newGame'),
            enabled: true,
            name: 'meta.newGame',
            onClick: () => {
              if (this.confirmNew) c.newGame();
              else this.confirmNew = true;
            },
          },
        });
        break;
      case 'quests':
        header = t('meta.quests.help');
        for (const q of m.quests)
          rows.push({
            text: `${q.claimed ? '✓' : q.locked ? '🔒' : '·'} ${q.label} (${q.progress}/${q.target}) → ${rewardText(q.reward)}`,
            ...(q.claimed || q.locked ? {} : { button: { label: t('meta.claim'), enabled: q.done, name: `meta.claim.${q.id}`, onClick: () => this.report(c.claimQuest(q.id), t('meta.claimed')) } }),
          });
        break;
      case 'achievements':
        header = t('meta.achievements.help');
        for (const a of m.achievements) rows.push({ text: `${a.claimed ? '★' : '☆'} ${a.label} (${a.progress}/${a.target})` });
        break;
      case 'skills':
        header = t('meta.skills.points', { n: m.skills.points });
        for (const k of m.skills.list)
          rows.push({
            text: `${k.label} ${k.level}/${k.max} - ${k.desc}`,
            button: { label: t('meta.upgrade', { n: k.cost }), enabled: k.canBuy, name: `meta.skill.${k.id}`, onClick: () => this.report(c.buySkill(k.id), t('meta.upgraded')) },
          });
        break;
      case 'upgrades':
        header = t('meta.upgrades.help');
        for (const u of s.upgrades) {
          const status = u.reason === 'maxed' ? t('meta.upgrades.maxed') : u.reason === 'levelTooLow' ? t('meta.needLevel', { n: u.requiresLevel ?? 0 }) : u.reason === 'insufficientCoins' ? t('meta.upgrades.needCoins') : '';
          rows.push({
            text: `${u.label} ${u.level}/${u.max} - ${u.desc}${status ? `  ${status}` : ''}`,
            ...(u.cost === null ? {} : { button: { label: t('meta.upgrade', { n: u.cost }), enabled: u.canBuy, name: `upgrade.buy.${u.id}`, onClick: () => this.report(c.buyUpgrade(u.id), t('meta.upgraded')) } }),
          });
        }
        break;
      case 'branches':
        header = t('meta.branches.help');
        for (const b of m.branches) {
          const text = `${b.label} - ${b.revenuePerHour}đ/${t('meta.hour')}${b.locked ? ` (${t('meta.locked')})` : ''}${b.owned ? `  ${t('meta.pending', { n: b.pending })}` : ''}`;
          rows.push({
            text,
            button: b.owned
              ? { label: t('meta.collect'), enabled: b.pending > 0, name: `meta.collect.${b.id}`, onClick: () => this.report(c.collectBranch(b.id), t('meta.collected')) }
              : { label: t('meta.buy', { price: b.cost }), enabled: b.canBuy && s.economy.coins >= b.cost, name: `meta.buyBranch.${b.id}`, onClick: () => this.report(c.buyBranch(b.id), t('meta.bought')) },
          });
        }
        break;
    }
    return { header, rows };
  }

  update(s: SimulationSnapshot): void {
    // Hidden during story chapters (their own objectives are on screen).
    const available = !s.story.active;
    setShown(this.root, available && this.shown);
    if (!available || !this.shown) return;
    const { header, rows } = this.content(s);
    this.header.setText(header);
    this.rows.forEach((r, i) => {
      const d = rows[i];
      r.text.setVisible(!!d).setText(d?.text ?? '');
      r.button.setVisible(!!d?.button);
      if (!d?.button) this.buttons.delete(r.button.name);
      if (d?.button) {
        r.button.setLabel(d.button.label).setEnabled(d.button.enabled);
        this.buttons.delete(r.button.name);
        r.button.rebind(d.button.name, d.button.onClick);
        this.buttons.set(d.button.name, r.button);
      }
    });
  }

  destroy(): void {
    this.scene.input.keyboard?.off('keydown-J', this.keyHandler);
    this.scene.scale.off(Phaser.Scale.Events.RESIZE, this.layout, this);
    this.root.destroy();
  }
}
