import { terminalAccessible } from './LabPuzzleMechanics.js';

/** Observable state only. Do not reveal the route or write actuator/progress state. */
export function pocketBrakeFeedback(cassette, loaded) {
  if (typeof cassette?.braked !== 'boolean' || typeof loaded !== 'boolean') {
    throw new TypeError('Brake and receiver states must be booleans');
  }
  const brake = cassette.braked ? 'Тормоз зажат.' : 'Тормоз отпущен.';
  const receiver = loaded ? 'На приёмнике есть груз.' : 'Приёмник пуст.';
  const action = cassette.braked ? 'Отпустить тормоз.' : 'Зажать тормоз.';
  return {
    id: 'room21-cassette-brake', key: 'E',
    text: `${brake} ${receiver} ${action}`,
  };
}

/** Room-local context; shares the exact reach/occlusion test with interaction.
 * Read the live contact predicate, not a value cached before pickup/reset.
 * No timers, listeners, additional assets, colliders or permanent HUD elements. */
export function createPocketBrakeFeedback(game, cassette, seat, terminal) {
  const read = () => pocketBrakeFeedback(cassette, seat.loaded());
  Object.defineProperty(terminal, 'lesson', {
    configurable: true,
    get: () => read().text,
  });
  return {
    read,
    contextLesson() {
      if (!terminalAccessible(game, terminal)) return null;
      const { id, key, text } = read();
      return [id, key, text, false];
    },
  };
}
