import assert from 'node:assert/strict';

/** Restore just the prior architecture finisher's authored initial view. Every retained
 * collider, interaction, optical state and reunion policy remains hashed. */
export function originalRoom13EntryContract(contract) {
  assert.equal(contract.room.id, 'optical-paradox'); assert.equal(contract.room.index, 12);
  assert.deepEqual(contract.room.spawnView, {yaw: 1.25, pitch: -.15}, 'Only the visually audited room-thirteen entry orbit is accepted');
  const original = structuredClone(contract); original.room.spawnView = {yaw: 1.55, pitch: .12};
  return original;
}
