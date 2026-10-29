/** Static art footprints; the front edge stays at y=4.9 so doors and gameplay do not move. */
export interface StreetHouse {
  x: number;
  y: number;
  w: number;
  d: number;
  height: number;
  variant: number;
  /** One of the rows behind the street frontage (decor only). */
  back?: boolean;
}

/** A continuous Hanoi frontage: tube houses side by side, a hair's gap between them. */
const HOUSE = { w: 2, d: 2.2, gap: .12 } as const;
const FRONT = 4.9;

export function streetHouses(): StreetHouse[] {
  const houses: StreetHouse[] = [];
  const row = (start: number, end: number) => {
    for (let x = start; x + HOUSE.w <= end; x += HOUSE.w + HOUSE.gap) {
      const variant = houses.length;
      houses.push({ x, y: FRONT - HOUSE.d, w: HOUSE.w, d: HOUSE.d, height: [128, 150, 118, 158][variant % 4]!, variant });
    }
  };
  row(-18, 19);
  row(26, 69);
  // Separate blocks by service lanes; tightly packing complete facades made them look piled onto the next roof.
  for (const [y, shift] of [[-2.6, .8], [-7.2, 1.4]] as const) {
    for (let x = -18 + shift; x + HOUSE.w <= 69; x += HOUSE.w + HOUSE.gap) {
      if (x + HOUSE.w > 18.6 && x < 26.4 && y > -3) continue;
      const variant = houses.length;
      houses.push({ x, y, w: HOUSE.w, d: HOUSE.d, height: [120, 138, 126, 146][variant % 4]!, variant, back: true });
    }
  }
  // Behind the courtyard at the end of the alley: low houses, so the alley stays readable.
  for (let x = 19.1; x + 1.8 <= 26; x += 2.2) houses.push({ x, y: -.6, w: 1.8, d: 1.5, height: 104, variant: houses.length });
  // …and the city carries on behind those.
  for (let x = 18.7; x + HOUSE.w <= 26.6; x += HOUSE.w + HOUSE.gap) houses.push({ x, y: -3.1, w: HOUSE.w, d: HOUSE.d, height: 150, variant: houses.length, back: true });
  return houses.sort((a, b) => a.x + a.y - b.x - b.y);
}
