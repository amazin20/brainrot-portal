/** Per-room hint transactions. The platform owns the actual rewarded-video
 * callbacks; this owner only turns one confirmed reward into one saved hint.
 * Reading an already unlocked hint never requests another advert. */
export function createHintProgress({platform, preferences, hintsFor, isAvailable = () => true}) {
  if (!platform || typeof platform.hint !== 'function' ||
      !preferences || typeof preferences.unlockHint !== 'function' || typeof hintsFor !== 'function') {
    throw new TypeError('Hint progress requires the platform, preferences and room hints');
  }
  let disposed = false;
  let pending = null;

  function progress(index) {
    const validIndex = Number.isInteger(index) && index >= 0 && index < 100;
    const source = validIndex ? hintsFor(index) : null;
    const hints = Array.isArray(source)
      ? source.filter(text => typeof text === 'string' && text.trim()).slice(0, 3) : [];
    const saved = preferences.value?.hints?.[index];
    const count = Math.min(hints.length, Number.isInteger(saved) && saved > 0 ? saved : 0);
    return {index, total: hints.length, count, revealed: hints.slice(0, count)};
  }

  function read(index) {
    const value = progress(index);
    return {...value, busy: Boolean(pending), canUnlock: !disposed && !pending &&
      value.total > value.count && Boolean(isAvailable(index))};
  }

  async function request(index) {
    const before = progress(index);
    const answer = (reason, extra = {}) => ({index, rewarded: false, rewardConfirmed: false,
      unlocked: false, reason, count: progress(index).count, ...extra});
    if (disposed) return answer('disposed');
    if (!before.total) return answer('unavailable');
    if (before.count >= before.total) return answer('already-unlocked');
    if (pending) return answer('busy');
    if (!isAvailable(index)) return answer('inactive');

    // Capture both room and ordinal before opening the ad. A room change or a
    // second click cannot redirect this reward to a different room or tier.
    const transaction = {index, count: before.count};
    pending = transaction;
    let claimed = false;
    let unlocked = false;
    try {
      const result = await platform.hint(() => {
        if (disposed || pending !== transaction || claimed) return;
        claimed = true;
        if (progress(index).count !== transaction.count) return;
        preferences.unlockHint(index);
        unlocked = progress(index).count === transaction.count + 1;
      });
      const rewardConfirmed = result?.rewarded === true;
      return answer(disposed ? 'disposed' : unlocked ? result.reason :
        rewardConfirmed ? 'already-unlocked' : result?.reason || 'unavailable',
      {rewarded: unlocked, rewardConfirmed, unlocked, demo: result?.reason === 'free-demo'});
    } catch {
      // An SDK/request failure is recoverable; do not turn it into an
      // unhandled UI promise rejection or spend an unopened hint.
      return answer(unlocked ? 'rewarded' : 'error', {rewarded: unlocked, unlocked});
    } finally {
      if (pending === transaction) pending = null;
    }
  }

  return {read, request, get busy() { return Boolean(pending); }, dispose() { disposed = true; }};
}
