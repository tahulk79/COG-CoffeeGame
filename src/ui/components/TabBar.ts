import type Phaser from 'phaser';
import { FONT } from '../theme/tokens';
import { GameButton } from './GameButton';

export interface TabDef {
  id: string;
  label: string;
}

/** Wrapping row of tab buttons. Selection is shown with the gold "selected" state. */
export class TabBar {
  readonly root: Phaser.GameObjects.Container;
  readonly buttons = new Map<string, GameButton>();
  private selected: string;
  private heightUsed = 28;

  constructor(
    scene: Phaser.Scene,
    private readonly prefix: string,
    private readonly tabs: TabDef[],
    private readonly onSelect: (id: string) => void,
  ) {
    this.selected = tabs[0]!.id;
    this.root = scene.add.container(0, 0);
    for (const tab of tabs) {
      const b = new GameButton(scene, 0, 0, tab.label, () => this.select(tab.id), `${prefix}.tab.${tab.id}`, { variant: 'ghost', fontSize: FONT.size.xs, h: 26 });
      this.buttons.set(tab.id, b);
      this.root.add(b.text);
    }
    this.refresh();
  }

  get current(): string {
    return this.selected;
  }

  select(id: string): void {
    if (id === this.selected) return;
    this.selected = id;
    this.refresh();
    this.onSelect(id);
  }

  private refresh(): void {
    for (const [id, b] of this.buttons) b.setSelected(id === this.selected);
  }

  /** Flow the tabs into rows within `maxW`; returns the height used. */
  layout(maxW: number): number {
    let x = 0;
    let y = 0;
    for (const tab of this.tabs) {
      const b = this.buttons.get(tab.id)!;
      if (x > 0 && x + b.width > maxW) {
        x = 0;
        y += 30;
      }
      b.text.setPosition(x, y);
      x += b.width + 6;
    }
    this.heightUsed = y + 28;
    return this.heightUsed;
  }

  get height(): number {
    return this.heightUsed;
  }
}
