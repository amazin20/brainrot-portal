/** Route-driver waypoint only, not a gameplay constraint or cargo relocation.
 * The receiver's corner posts occupy x >= 19.5; a standing capsule also needs
 * radius clearance. A drifting load can put the old cargo.x + 1 waypoint inside
 * that post even though the load itself remains within ordinary pickup reach.
 * Keep the approach inside the existing tray, reached through its open side. */
export function room21ReceiverApproach(position) {
  if (!Number.isFinite(position?.x) || !Number.isFinite(position?.z)) {
    throw new TypeError('A finite cargo position is required');
  }
  return [Math.max(7.7, Math.min(18.8, position.x + 1)),
    Math.max(2.65, Math.min(9.35, position.z))];
}
