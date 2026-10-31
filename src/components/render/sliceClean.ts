/** One frame cut: name, then its box in the sheet canvas. */
export type SheetCut = [frame: string, x: number, y: number, w: number, h: number];
/** What cleaning a sheet needs: the frames to cut and the boxes (x, y, w, h) of spilled pixels to erase. */
export interface SheetPlan { cuts: SheetCut[]; erase: Array<[number, number, number, number]> }

const BLOCK = 4;

/**
 * Per cell, opaque pixels (alpha >= 64) are grouped into connected pieces of BLOCK×BLOCK blocks; pieces that spilled in from
 * a neighbour (small and touching the cell edge) are marked for erasing, and the frame is the box round what is kept.
 * `words` is the RGBA image read as little-endian 32-bit words, so alpha is the top byte.
 */
export function analyzeSheet(words: Uint32Array, width: number, height: number, columns: number, rows: number): SheetPlan {
  const plan: SheetPlan = { cuts: [], erase: [] };
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const x0 = Math.floor(column * width / columns), x1 = Math.floor((column + 1) * width / columns);
    const y0 = Math.floor(row * height / rows), y1 = Math.floor((row + 1) * height / rows);
    const bw = Math.ceil((x1 - x0) / BLOCK), bh = Math.ceil((y1 - y0) / BLOCK);
    const solid = new Uint8Array(bw * bh);
    for (let y = y0; y < y1; y++) {
      const base = Math.floor((y - y0) / BLOCK) * bw, line = y * width;
      for (let x = x0; x < x1; x++) if (words[line + x]! >= 0x40000000) solid[base + Math.floor((x - x0) / BLOCK)] = 1;
    }
    // Connected pieces of opaque blocks (8-neighbour).
    const piece = new Int32Array(bw * bh).fill(-1), sizes: number[] = [], edges: boolean[] = [];
    for (let start = 0; start < solid.length; start++) {
      if (!solid[start] || piece[start]! >= 0) continue;
      const id = sizes.length, stack = [start];
      let size = 0, edge = false;
      piece[start] = id;
      while (stack.length) {
        const b = stack.pop()!, bx = b % bw, by = (b - bx) / bw;
        size++;
        if (bx === 0 || by === 0 || bx === bw - 1 || by === bh - 1) edge = true;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = bx + dx, ny = by + dy, nb = ny * bw + nx;
          if (nx < 0 || ny < 0 || nx >= bw || ny >= bh || !solid[nb] || piece[nb]! >= 0) continue;
          piece[nb] = id;
          stack.push(nb);
        }
      }
      sizes.push(size);
      edges.push(edge);
    }
    if (!sizes.length) continue;
    const largest = Math.max(...sizes);
    // Kept: the main figure, anything nearly as big, and small details floating inside the cell (not spilled in).
    const keep = sizes.map((size, i) => size === largest || size >= largest * .3 || (!edges[i] && size >= largest * .02));
    let left = x1, right = x0, top = y1, bottom = y0;
    for (let b = 0; b < piece.length; b++) {
      const id = piece[b]!;
      if (id < 0) continue;
      const bx = x0 + (b % bw) * BLOCK, by = y0 + Math.floor(b / bw) * BLOCK, ex = Math.min(x1, bx + BLOCK), ey = Math.min(y1, by + BLOCK);
      if (keep[id]) { left = Math.min(left, bx); right = Math.max(right, ex - 1); top = Math.min(top, by); bottom = Math.max(bottom, ey - 1); continue; }
      // Blocks arrive row by row: a block touching the last box on the same row just widens it.
      const last = plan.erase[plan.erase.length - 1];
      if (last && last[1] === by && last[3] === ey - by && last[0] + last[2] === bx) last[2] += ex - bx;
      else plan.erase.push([bx, by, ex - bx, ey - by]);
    }
    if (left > right || top > bottom) continue;
    left = Math.max(x0, left - 2); right = Math.min(x1 - 1, right + 2);
    top = Math.max(y0, top - 2); bottom = Math.min(y1 - 1, bottom + 2);
    plan.cuts.push([String(row * columns + column), left, top, right - left + 1, bottom - top + 1]);
  }
  return plan;
}
