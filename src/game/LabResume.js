/** Explicit room links win; a normal visit resumes only within its edition. */
export function resumeCampaignLevel(query, preferences, availableRooms, requestedLevel) {
  const params = new URLSearchParams(query);
  if (params.has('level') || params.get('mode') === 'velocity') return requestedLevel;
  if (availableRooms.includes(preferences.resumeLevel)) return preferences.resumeLevel;
  // Old saves have completion only. Do not skip unplayed rooms when a player
  // used the selector to try a later puzzle.
  if (preferences.completed.length) return availableRooms.find(index => !preferences.completed.includes(index)) ?? availableRooms.at(-1);
  return requestedLevel;
}

export function nextResumeLevel(index, availableRooms) {
  const position = availableRooms.indexOf(index);
  return position < 0 ? availableRooms[0] : availableRooms[Math.min(position + 1, availableRooms.length - 1)];
}
