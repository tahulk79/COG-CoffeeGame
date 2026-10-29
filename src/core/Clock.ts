/**
 * Wall-clock source for anything that must survive closing the game (crop
 * growth, processing timers). Simulation movement uses tick time instead.
 */
export interface Clock {
  now(): number;
}

/** Real time plus an optional offset (dev/test only: lets E2E fast-forward crops). */
export class SystemClock implements Clock {
  constructor(public offsetMs = 0) {}
  now(): number {
    return Date.now() + this.offsetMs;
  }
}
