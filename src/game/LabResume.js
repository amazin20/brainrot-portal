/** Explicit room links win; a normal visit resumes only within its edition. */
export function resumeCampaignLevel(query, preferences, availableRooms, requestedLevel) {
  const params = new URLSearchParams(query);
  if (params.has('level') || params.get('mode') === 'velocity') return requestedLevel;
  // The previous campaign stopped at room 30 and saved its own index after
  // victory. Move that exact completed finale into the newly added chapter.
  if (availableRooms.length >= 40 && availableRooms[29] === 29 && availableRooms[30] === 30 &&
      preferences.resumeLevel === 29 && !preferences.completed.includes(30) &&
      availableRooms.slice(0, 30).every(index => preferences.completed.includes(index))) return 30;
  if (availableRooms.length >= 41 && availableRooms[40] === 40 &&
      preferences.resumeLevel === 39 && !preferences.completed.includes(40) &&
      availableRooms.slice(0, 40).every(index => preferences.completed.includes(index))) return 40;
  // A completed former finale continues into the new chapter, without
  // granting completion or a checkpoint inside the castle.
  if (availableRooms.length >= 51 && availableRooms[41] === 41 &&
      preferences.resumeLevel === 40 && !preferences.completed.includes(41) &&
      availableRooms.slice(0,41).every(index => preferences.completed.includes(index))) return 41;
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
