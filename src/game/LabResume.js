import {CASTLE_LEVEL_INDEX,FOUNDATION_SEQUENCE_REVISION,isFoundationSequence} from './LabCampaignSequence.js';
/** Explicit room links win; a normal visit resumes only within its edition. */
export function resumeCampaignLevel(query, preferences, availableRooms, requestedLevel) {
  const params = new URLSearchParams(query);
  if (params.has('level') || params.get('mode') === 'velocity') return requestedLevel;
 if(isFoundationSequence(availableRooms)){
  const completed=preferences.completed??[],firstFortyDone=availableRooms.slice(0,40).every(index=>completed.includes(index));
  // Translate former automatic finale continuations once. The revision is
  // saved only on an actual start/win, so merely opening a menu writes nothing.
  if(preferences.campaignSequenceRevision!==FOUNDATION_SEQUENCE_REVISION){
   if(preferences.resumeLevel===29&&availableRooms.slice(0,30).every(index=>completed.includes(index))&&!completed.includes(30))return 30;
   // Old expansion saves can point at their last room after the replacement
   // revision has cleared those completions. Introduce the new spatial chapter
   // at its first unplayed room instead of silently skipping to its finale.
   if(Number.isInteger(preferences.resumeLevel)&&preferences.resumeLevel>=42&&preferences.resumeLevel<=50){
    return availableRooms.filter(index=>index>=42&&index<=50).find(index=>!completed.includes(index))
     ??availableRooms.find(index=>!completed.includes(index))??CASTLE_LEVEL_INDEX;
   }
   if(firstFortyDone&&(preferences.resumeLevel===39||preferences.resumeLevel===CASTLE_LEVEL_INDEX)){
    return availableRooms.slice(40).find(index=>!completed.includes(index))??CASTLE_LEVEL_INDEX;
   }
   if(preferences.resumeLevel===50&&completed.includes(50)&&availableRooms.slice(0,50).every(index=>completed.includes(index)))return CASTLE_LEVEL_INDEX;
  }
  if(availableRooms.includes(preferences.resumeLevel))return preferences.resumeLevel;
  if(completed.length)return availableRooms.find(index=>!completed.includes(index))??CASTLE_LEVEL_INDEX;
  return requestedLevel;
 }
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
