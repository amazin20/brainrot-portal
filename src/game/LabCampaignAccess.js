import {FOUNDATION_SEQUENCE} from './LabCampaignSequence.js';

/** Saved completions keep their permanent room indices. Access follows the
 * campaign presentation order: completed replays plus the first unfinished
 * room. A late completion from an older open demo never unlocks the gaps.
 * Merely inspecting access does not create or rewrite a preference record. */
export function deriveCampaignAccess(preferences={},sequence=FOUNDATION_SEQUENCE){
  const ordered=Array.isArray(sequence)?Array.from(sequence):null;
  if(!ordered||ordered.some(index=>!Number.isInteger(index)||index<0)||new Set(ordered).size!==ordered.length){
    throw new TypeError('Campaign access requires distinct nonnegative room indices');
  }
  const known=new Set(ordered);
  const completed=new Set(Array.isArray(preferences?.completed)?preferences.completed.filter(index=>Number.isInteger(index)&&known.has(index)):[]);
  const nextIndex=ordered.find(index=>!completed.has(index))??null;
  return Object.freeze({
    sequence:Object.freeze(ordered),
    completedIndices:Object.freeze(ordered.filter(index=>completed.has(index))),
    accessibleIndices:Object.freeze(ordered.filter(index=>completed.has(index)||index===nextIndex)),
    nextIndex,
    allCompleted:ordered.length>0&&nextIndex===null,
  });
}

export function canAccessCampaignLevel(index,preferences={},sequence=FOUNDATION_SEQUENCE){
  return Number.isInteger(index)&&deriveCampaignAccess(preferences,sequence).accessibleIndices.includes(index);
}

/** Used after historical resume translation and again at every actual launch.
 * It deliberately does not trust a URL, selector value or saved resume index. */
export function resolveCampaignLevel(requested,preferences={},sequence=FOUNDATION_SEQUENCE){
  const access=deriveCampaignAccess(preferences,sequence);
  return Number.isInteger(requested)&&access.accessibleIndices.includes(requested)
    ?requested:access.nextIndex??access.sequence[0]??null;
}
