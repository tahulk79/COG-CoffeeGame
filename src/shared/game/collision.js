export function canOccupy(x, z, obstacles, radius, bounds) {
  if (x < bounds.minX || x > bounds.maxX || z < bounds.minZ || z > bounds.maxZ) return false;
  const limit = radius * radius;
  for (const obstacle of obstacles) {
    const dx = x - Math.max(obstacle.minX, Math.min(x, obstacle.maxX));
    const dz = z - Math.max(obstacle.minZ, Math.min(z, obstacle.maxZ));
    if (dx * dx + dz * dz < limit) return false;
  }
  return true;
}

// Small swept steps prevent tunnelling; separate axes slide along the surface.
export function slideMove(position, dx, dz, canStand) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / .06));
  for (let i = 0; i < steps; i++) {
    const x = position.x + dx / steps, z = position.z + dz / steps;
    if (canStand(x, z)) { position.x = x; position.z = z; }
    else if (Math.abs(dx) >= Math.abs(dz)) {
      if (canStand(x, position.z)) position.x = x;
      if (canStand(position.x, z)) position.z = z;
    } else {
      if (canStand(position.x, z)) position.z = z;
      if (canStand(x, position.z)) position.x = x;
    }
  }
}

// An overlapping actor must be allowed to escape before enforcing full clearance.
export function avoidanceStep(origin, awayFrom, blockers, distance, canStand, side=1) {
  if(distance<=0)return null;
  const base=Math.atan2(origin.z-awayFrom.z,origin.x-awayFrom.x);
  for(const offset of [side*Math.PI/3,-side*Math.PI/3,0,side*Math.PI/2,-side*Math.PI/2,side*Math.PI*2/3,-side*Math.PI*2/3,Math.PI]) {
    const angle=base+offset,x=origin.x+Math.cos(angle)*distance,z=origin.z+Math.sin(angle)*distance;
    if(!canStand(x,z))continue;
    if(Math.hypot(x-awayFrom.x,z-awayFrom.z)<=Math.hypot(origin.x-awayFrom.x,origin.z-awayFrom.z)+.00001)continue;
    if(blockers.some(other=>Math.hypot(x-other.x,z-other.z)<Math.min(.96,Math.hypot(origin.x-other.x,origin.z-other.z)+.00001)))continue;
    return {x,z};
  }
  return null;
}
