// Public navigation always belongs to the numbered campaign. Old speed-mode
// bookmarks remain usable without granting completion or changing stored data.
export function readCampaignRoute(query, levelCount) {
  const params = new URLSearchParams(query);
  const legacyVelocityLink = params.get('mode') === 'velocity';
  let requested = params.get('level');
  if (legacyVelocityLink) {
    const chapter = params.get('chapter') === '2' ? 2 : 1;
    const legacyReturn = chapter === 2 ? '21' : '11';
    if (requested === null && params.get('return') === legacyReturn) {
      requested = legacyReturn;
      params.set('level', requested);
    }
    for (const key of ['mode', 'chapter', 'return']) params.delete(key);
  }
  const level = Number(requested || 1);
  const levelIndex = Number.isInteger(level) && level >= 1 && level <= levelCount ? level - 1 : 0;
  const search = params.toString();
  return { levelIndex, legacyVelocityLink, search: search ? `?${search}` : '' };
}

export function nextCampaignLevel(index, levelCount) {
  return Number.isInteger(index) && index >= 0 && index + 1 < levelCount ? index + 1 : 0;
}
