// The opening approaches these obstacles from the left, including on skipped frames.
export function approachOffsetX(body, obstacles, clearance = .03) {
  let offset = 0;
  for (const obstacle of obstacles) {
    const overlapsHeight = body.max.y > obstacle.min.y && body.min.y < obstacle.max.y;
    const overlapsDepth = body.max.z > obstacle.min.z && body.min.z < obstacle.max.z;
    if (overlapsHeight && overlapsDepth) {
      offset = Math.min(offset, obstacle.min.x - clearance - body.max.x);
    }
  }
  return offset;
}
