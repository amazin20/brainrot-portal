// Preserved prototype data for the future numbered room 30. No public mode or
// interlude is registered. Keep legacy progress isolated and readable; publishing
// the future room must not silently mark it complete from these old records.
export const VELOCITY_CAMPAIGN_RESERVATION = Object.freeze({
  level: 30, title: 'ПРЕДЕЛ', status: 'reserved', publicMode: false,
});
export const VELOCITY_PROGRESS_KEY = 'brainrot-portal.velocity-chapters.v1';
export const VELOCITY_CHAPTERS = Object.freeze([
  Object.freeze({ chapter: 1, id: 'velocity-flow-v1', title: 'Вместе в поток',
    description: 'Освой первый разгон вместе с другом. Широкие порталы, световой маршрут и площадки для передышки.' }),
  Object.freeze({ chapter: 2, id: 'velocity-cascade-v1', title: 'Каскад',
    description: 'Длиннее пролёты, выше скорость. Открывай выходы с площадок и разгоняйся — друг летит рядом весь маршрут.' }),
]);

export function getVelocityChapter(value = 1) {
  return VELOCITY_CHAPTERS.find(chapter => chapter.chapter === Number(value)) || VELOCITY_CHAPTERS[0];
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
