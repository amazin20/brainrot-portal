// Speed chapters are interludes, not numbered campaign chambers. Their save
// record must never overwrite the campaign's completed rooms or hint history.
export const VELOCITY_PROGRESS_KEY = 'brainrot-portal.velocity-chapters.v1';
export const VELOCITY_CHAPTERS = Object.freeze([
  Object.freeze({ chapter: 1, id: 'velocity-flow-v1', title: 'Вместе в поток', afterLevel: 10, returnLevel: 11,
    description: 'Освой первый разгон вместе с другом. Широкие порталы, световой маршрут и площадки для передышки.' }),
  Object.freeze({ chapter: 2, id: 'velocity-cascade-v1', title: 'Каскад', afterLevel: 20, returnLevel: 21,
    description: 'Длиннее пролёты, выше скорость. Открывай выходы с площадок и разгоняйся — друг летит рядом весь маршрут.' }),
]);

export function getVelocityChapter(value = 1) {
  return VELOCITY_CHAPTERS.find(chapter => chapter.chapter === Number(value)) || VELOCITY_CHAPTERS[0];
}

export function getVelocityInterlude(completedRoomIndex) {
  if (!Number.isInteger(completedRoomIndex)) return null;
  return VELOCITY_CHAPTERS.find(chapter => chapter.afterLevel === completedRoomIndex + 1) || null;
}

export function velocityChapterURL(value, { returnToCampaign = false } = {}) {
  const chapter = getVelocityChapter(value);
  return `?mode=velocity&chapter=${chapter.chapter}${returnToCampaign ? `&return=${chapter.returnLevel}` : ''}`;
}

export function readVelocityRoute(query) {
  const params = typeof query === 'string' ? new URLSearchParams(query) : query;
  const chapter = getVelocityChapter(params?.get('chapter'));
  // Accept only the matching campaign return, never arbitrary destinations.
  const returnLevel = params?.get('return') === String(chapter.returnLevel) ? chapter.returnLevel : null;
  return { chapter, returnLevel };
}

export function sanitizeVelocityProgress(value) {
  const valid = new Set(VELOCITY_CHAPTERS.map(chapter => chapter.id));
  return { completed: [...new Set(Array.isArray(value?.completed) ? value.completed.filter(id => valid.has(id)) : [])] };
}

export class LabVelocityProgress {
  constructor(storage) {
    this.storage = storage; this.readFailed = false;
    try {
      const raw = JSON.parse(storage?.getItem(VELOCITY_PROGRESS_KEY) || '{}');
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('Invalid speed chapter progress');
      this.value = sanitizeVelocityProgress(raw);
    } catch { this.readFailed = true; this.value = { completed: [] }; }
  }
  has(value) { return this.value.completed.includes(getVelocityChapter(value).id); }
  complete(value) {
    this.value = sanitizeVelocityProgress({ completed: [...this.value.completed, getVelocityChapter(value).id] });
    try {
      if (!this.readFailed) this.storage?.setItem(VELOCITY_PROGRESS_KEY, JSON.stringify(this.value));
    } catch { /* Private browsing can still retain progress for this session. */ }
    return this.value;
  }
}
