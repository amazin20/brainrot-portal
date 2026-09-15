import { runV8Journey } from '../src/game/LabV8Journey.js';

/** A real input route, not a placement fixture. Failed jumps return by walking.
 * Reaching the source is the exploit being measured, NOT a completed level. */
export async function runRoom21GantryAttempt(game, {
  startX = -21.3, startZ = 19.7, recover = true,
} = {}) {
  if (![startX, startZ].every(Number.isFinite)) throw new TypeError('Finite start waypoint required');
  const result = { startX, startZ, firstLanded: false, secondLanded: false,
    reachedHighSource: false, recovered: false, samples: [] };
  const route = await runV8Journey(game, { scenario: d => {
    // Approach behind the existing winding-beam post, rather than walking
    // directly into it for the northern sample. This is normal movement.
    if(startZ<18.6){d.walk(-19,21.4);d.walk(startX,21.4);}
    d.walk(startX, startZ);
    d.mark('ordinary approach from starting balcony');
    const jump = untilX => {
      game.input.keys.add('ShiftLeft'); game.input.jumpQueued = true;
      for (let n = 0; n < 100 && game.playerPosition.x > untilX; n++) {
        d.worldMove(-1, 0); d.frame();
        result.samples.push({ position: game.playerPosition.toArray(), grounded: game.playerGrounded });
      }
      d.stop(); d.wait(.45); d.mark('landing after jump attempt');
    };
    jump(-26);
    result.firstLanded = game.playerGrounded && game.playerPosition.y > 7.7;
    if (result.firstLanded) {
      d.walk(-29.1, 17.6); jump(-34);
      result.secondLanded = game.playerGrounded && game.playerPosition.y >= 7;
      if (result.secondLanded) {
        for (const [x,z] of [[-34,15.5],[-34,-5.5],[-30,-5.5],[-30,5],[-30,14],[-10,14]]) d.walk(x,z);
        result.reachedHighSource = game.playerPosition.y > 17.9;
        d.mark('upper source reached without powering bridge');
      }
    }
    result.landing = game.playerPosition.toArray();
    if (!result.reachedHighSource && recover) {
      d.until(() => game.playerGrounded && game.playerPosition.y < 1, 5, 'Safe lower landing');
      // The rear service floor is continuous; go around, not through, the housing.
      for (const [x,z] of [[-18,23],[2.9,23],[2.9,-1],[0,-1],[0,14]]) d.walk(x,z);
      result.recovered = game.playerGrounded && Math.abs(game.playerPosition.y - 7) < .05;
      if (!result.recovered) throw new Error('Walking recovery did not reach the balcony');
      d.mark('ordinary lower-floor recovery without restart');
    }
  }});
  return { scope: 'Ordinary keyboard movement/jump route from normal reset. No actor, portal or mechanism assignments; not a victory route.',
    ...result, route, sourceLatched: game.firstLevel.state.sourceDrive.latched,
    bridge: game.firstLevel.state.sourceDrive.bridge.progress,
    bypass: result.reachedHighSource && !game.firstLevel.state.sourceDrive.latched };
}
