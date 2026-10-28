/** Static art footprints; the front edge stays at y=4.9 so doors and gameplay do not move. */
export interface StreetHouse {
  x: number;
  y: number;
  w: number;
  d: number;
  height: number;
  variant: number;
}

export function streetHouses(): StreetHouse[] {
  const houses: StreetHouse[] = [];
  const row = (start: number, end: number, y: number, d: number, back = false) => {
    for (let x = start; x + 2.2 <= end; x += 2.4) {
      const variant = houses.length;
      houses.push({ x, y, w: 2.2, d, height: back ? 116 : [142, 164, 128, 176][variant % 4]!, variant });
    }
  };
  row(-18, 19, 2.3, 2.6);
  row(26, 69, 2.3, 2.6);
  row(19.1, 26, -1, 1.8, true);
  return houses.sort((a, b) => a.x + a.y - b.x - b.y);
}
