import type Phaser from 'phaser';

const WAS_INTERACTIVE = '__wasInteractive';

type Tagged = Phaser.GameObjects.GameObject & { [WAS_INTERACTIVE]?: boolean };

/** Every descendant of a container, depth first. */
function descendants(c: Phaser.GameObjects.Container, out: Phaser.GameObjects.GameObject[] = []): Phaser.GameObjects.GameObject[] {
  for (const child of c.list) {
    out.push(child);
    if ((child as Phaser.GameObjects.Container).list) descendants(child as Phaser.GameObjects.Container, out);
  }
  return out;
}

const state = new WeakMap<Phaser.GameObjects.Container, boolean>();

/**
 * Show or hide a panel. Phaser keeps hit-testing the interactive children of
 * an invisible container, so a hidden panel's background would still swallow
 * clicks meant for the world. This hides the container AND switches its
 * interactive descendants off (and back on when shown). Cheap to call every frame.
 */
export function setShown(c: Phaser.GameObjects.Container, on: boolean, force = false): void {
  if (state.get(c) === on && !force) return;
  state.set(c, on);
  c.setVisible(on);
  for (const o of [c, ...descendants(c)] as Tagged[]) {
    if (!on) {
      if (o.input?.enabled) {
        o[WAS_INTERACTIVE] = true;
        o.input.enabled = false;
      }
    } else if (o[WAS_INTERACTIVE] && isShown(o)) {
      if (o.input) o.input.enabled = true;
      delete o[WAS_INTERACTIVE];
    }
  }
}

/** True when the object and all its parent containers are visible. */
export function isShown(o: Phaser.GameObjects.GameObject & { visible?: boolean; parentContainer?: Phaser.GameObjects.Container | null }): boolean {
  let cur: typeof o | null | undefined = o;
  while (cur) {
    if (cur.visible === false) return false;
    cur = cur.parentContainer as typeof o | null | undefined;
  }
  return true;
}
