import type Phaser from 'phaser';

/** Anything that behaves like a big panel: at most one is open at a time. */
export interface ManagedPanel {
  readonly id: string;
  readonly isOpen: boolean;
  open(): void;
  close(): void;
}

/**
 * Modal stacking rules: opening a panel closes the others (no overlapping
 * panels), Escape closes the open one, and the HUD can ask whether any panel
 * is open. Panels' backdrops/backgrounds swallow clicks, so the player never
 * walks by clicking inside UI.
 */
export class ModalManager {
  private readonly panels = new Map<string, ManagedPanel>();
  private readonly onEsc = () => this.closeAll();
  private readonly listeners: Array<(openId: string | null) => void> = [];

  constructor(private readonly scene: Phaser.Scene) {
    scene.input.keyboard?.on('keydown-ESC', this.onEsc);
  }

  register(p: ManagedPanel): void {
    this.panels.set(p.id, p);
  }

  get openId(): string | null {
    for (const p of this.panels.values()) if (p.isOpen) return p.id;
    return null;
  }

  isOpen(id: string): boolean {
    return !!this.panels.get(id)?.isOpen;
  }

  open(id: string): void {
    for (const p of this.panels.values()) if (p.id !== id && p.isOpen) p.close();
    const p = this.panels.get(id);
    if (p && !p.isOpen) p.open();
    this.emit();
  }

  toggle(id: string): void {
    if (this.isOpen(id)) this.close(id);
    else this.open(id);
  }

  close(id: string): void {
    this.panels.get(id)?.close();
    this.emit();
  }

  closeAll(): void {
    let any = false;
    for (const p of this.panels.values()) if (p.isOpen) (p.close(), (any = true));
    if (any) this.emit();
  }

  onChange(fn: (openId: string | null) => void): void {
    this.listeners.push(fn);
  }

  private emit(): void {
    const id = this.openId;
    for (const l of this.listeners) l(id);
  }

  destroy(): void {
    this.scene.input.keyboard?.off('keydown-ESC', this.onEsc);
    this.panels.clear();
    this.listeners.length = 0;
  }
}
