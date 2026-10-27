import type Phaser from 'phaser';
import { setShown } from './panelVisibility';
import { t } from '../../core/i18n';
import type { SimulationSnapshot } from '../../gameplay/GameSimulation';
import { COLORS, css, FONT } from '../theme/tokens';
import { GameButton } from './GameButton';
import { GameModal } from './GameModal';
import { createIcon } from '../theme/assetRegistry';
import { fadeIn } from '../theme/anim';
import { Panel } from './Panel';

export interface RowData {
  /** Changes whenever the row's content changes (cheap redraw check). */
  key: string;
  icon: string;
  title: string;
  lines: string[];
  /** Highlighted status text (right side / last line). */
  status?: string;
  statusTone?: 'ok' | 'warn' | 'bad';
  dim?: boolean;
  action?: { name: string; label: string; enabled: boolean; onClick: () => void };
}

const ROW_H = 76;
const GAP = 6;

class Row {
  readonly root: Phaser.GameObjects.Container;
  private readonly bg: Panel;
  private readonly title: Phaser.GameObjects.Text;
  private readonly body: Phaser.GameObjects.Text;
  private readonly status: Phaser.GameObjects.Text;
  private icon: Phaser.GameObjects.Container | null = null;
  private iconKey = '';
  readonly button: GameButton;
  private key = '';
  private w = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0);
    this.bg = new Panel(scene, { radius: 12, fill: COLORS.espressoSoft, alpha: 1, border: COLORS.coffeeBrown });
    this.title = scene.add.text(52, 8, '', { fontFamily: FONT.family, fontSize: `${FONT.size.md}px`, color: css(COLORS.cream), fontStyle: 'bold' }).setResolution(2);
    this.body = scene.add.text(52, 28, '', { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, color: css(COLORS.creamDim), lineSpacing: 2 }).setResolution(2);
    this.status = scene.add.text(0, 8, '', { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, fontStyle: 'bold' }).setOrigin(1, 0).setResolution(2);
    this.button = new GameButton(scene, 0, 0, '', () => undefined, 'row', { fontSize: FONT.size.xs, h: 26 });
    this.root.add([this.bg.object, this.title, this.body, this.status, this.button.text]);
  }

  setWidth(w: number): void {
    this.w = w;
    this.key = '';
  }

  set(d: RowData, nameOverride?: string): void {
    const key = `${this.w}|${d.key}`;
    if (key === this.key) return;
    this.key = key;
    this.bg.set(this.w, ROW_H);
    if (d.icon !== this.iconKey) {
      this.icon?.destroy();
      this.icon = createIcon(this.scene, d.icon, 30);
      this.root.add(this.icon);
      this.iconKey = d.icon;
    }
    this.icon!.setPosition(26, ROW_H / 2).setAlpha(d.dim ? 0.5 : 1);
    this.title.setText(d.title).setAlpha(d.dim ? 0.7 : 1);
    this.body.setText(d.lines.join('\n')).setWordWrapWidth(Math.max(80, this.w - 52 - (d.action ? 110 : 10)));
    const tone = d.statusTone === 'bad' ? COLORS.error : d.statusTone === 'warn' ? COLORS.gold : COLORS.leaf;
    this.status.setText(d.status ?? '').setColor(css(tone)).setPosition(this.w - 10, 8);
    if (d.action) {
      this.button.rebind(d.action.name, d.action.onClick).setLabel(d.action.label).setVisible(true);
      this.button.text.setPosition(this.w - this.button.width - 10, ROW_H - 34);
    } else this.button.setVisible(false);
    if (d.action) this.button.setEnabled(d.action.enabled);
  }
}

/**
 * Modal with a paged list of cards. Subclasses provide the rows; the base class
 * handles pooling, responsive page size and the pager, so recipes and staff
 * look and behave alike (and phones get as many rows as fit, per page).
 */
export abstract class PagedListModal {
  readonly modal: GameModal;
  readonly buttons = new Map<string, GameButton>();
  private readonly rows: Row[] = [];
  private readonly pager: GameButton[];
  private readonly pageText: Phaser.GameObjects.Text;
  protected readonly note: Phaser.GameObjects.Text;
  private perPage = 3;
  private page = 0;
  private sig = '';
  private data: RowData[] = [];
  private bodyW = 0;
  private readonly dynamic = new Set<string>();

  protected constructor(
    protected readonly scene: Phaser.Scene,
    title: string,
    id: string,
    maxW: number,
    maxH: number,
    onClosed?: () => void,
  ) {
    this.modal = new GameModal(scene, title, maxW, maxH, id, onClosed);
    for (let i = 0; i < 8; i++) {
      const r = new Row(scene);
      this.rows.push(r);
      this.modal.body.add(r.root);
    }
    const mk = (label: string, name: string, fn: () => void) => {
      const b = new GameButton(scene, 0, 0, label, fn, name, { fontSize: FONT.size.xs, h: 26 });
      this.modal.body.add(b.text);
      this.buttons.set(name, b);
      return b;
    };
    this.pager = [mk('◂', `${id}.prev`, () => this.turn(-1)), mk('▸', `${id}.next`, () => this.turn(1))];
    this.pageText = scene.add.text(0, 0, '', { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, color: css(COLORS.creamDim) }).setResolution(2);
    this.note = scene.add.text(0, 0, '', { fontFamily: FONT.family, fontSize: `${FONT.size.xs}px`, color: css(COLORS.creamDim), wordWrap: { width: 300 } }).setResolution(2);
    this.modal.body.add([this.pageText, this.note]);
    for (const b of this.modal.buttons) this.buttons.set(b.name, b);
    this.modal.onLayout((w, h) => this.relayout(w, h));
    setShown(this.modal.root, false, true);
  }

  /** Rows for the current state; called when the modal is open. */
  protected abstract rowsFor(s: SimulationSnapshot): RowData[];

  /** Optional footer note (e.g. a hint or the last message). */
  protected footer(_s: SimulationSnapshot): string {
    return '';
  }

  private turn(d: number): void {
    const pages = Math.max(1, Math.ceil(this.data.length / this.perPage));
    this.page = Math.max(0, Math.min(pages - 1, this.page + d));
    this.sig = '';
    for (const r of this.rows) fadeIn(this.scene, r.root);
  }

  private relayout(w: number, h: number): void {
    this.bodyW = w;
    this.perPage = Math.max(1, Math.min(this.rows.length, Math.floor((h - 36) / (ROW_H + GAP))));
    this.rows.forEach((r, i) => {
      r.setWidth(w);
      r.root.setPosition(0, i * (ROW_H + GAP));
    });
    const y = this.perPage * (ROW_H + GAP) + 2;
    this.pager[0]!.text.setPosition(0, y);
    this.pager[1]!.text.setPosition(40, y);
    this.pageText.setPosition(84, y + 6);
    this.note.setPosition(w > 420 ? 150 : 0, w > 420 ? y + 4 : y + 30).setWordWrapWidth(Math.max(120, w - 160));
    this.sig = '';
  }

  update(s: SimulationSnapshot): void {
    if (!this.modal.isOpen) return;
    this.data = this.rowsFor(s);
    const pages = Math.max(1, Math.ceil(this.data.length / this.perPage));
    if (this.page >= pages) this.page = pages - 1;
    const sig = `${this.page}|${this.bodyW}|${this.data.map((d) => d.key).join('~')}|${this.footer(s)}`;
    if (sig === this.sig) return;
    this.sig = sig;
    for (const n of this.dynamic) this.buttons.delete(n);
    this.dynamic.clear();
    this.rows.forEach((r, i) => {
      const d = i < this.perPage ? this.data[this.page * this.perPage + i] : undefined;
      setShown(r.root, !!d);
      if (d) {
        r.set(d);
        if (d.action) {
          this.buttons.set(d.action.name, r.button);
          this.dynamic.add(d.action.name);
        }
      }
    });
    this.pager[0]!.setVisible(pages > 1).setEnabled(this.page > 0);
    this.pager[1]!.setVisible(pages > 1).setEnabled(this.page < pages - 1);
    this.pageText.setText(pages > 1 ? t('list.page', { n: this.page + 1, max: pages }) : '');
    this.note.setText(this.footer(s));
  }

  destroy(): void {
    this.modal.destroy();
  }
}
