/** A tab may lose focus before the game's own input handlers run. Pause the
 * puzzle while controls still permit a state change, then apply the external
 * lock. Clearing that lock on return must never resume the room implicitly. */
export function holdInterruptedGame(game, hold, reason) {
  const deferPause = game.state === 'playing' && game.externalBlocked;
  if (game.state === 'playing' && !deferPause) game.togglePause(true);
  // An SDK modal may already block togglePause. The final released hold will
  // apply this pending pause before gameplay can advance again.
  hold(reason, true, deferPause);
}

export function settleInterruptedGame(game, blocked, pendingPause) {
  if (blocked) return pendingPause;
  if (pendingPause && game.state === 'playing') game.togglePause(true);
  return false;
}
