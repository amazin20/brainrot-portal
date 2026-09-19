import * as THREE from 'three';

const require = (value, message) => { if (!value) throw new Error(message); };
const wrap = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
const plain = v => v?.toArray?.() ?? null;

/** Input-only playthrough of either speed chapter. The controller can inspect
 * authored targets, as the on-screen route marker does, but changes only keys,
 * camera yaw/pitch and ordinary interaction/fire requests. Production 120 Hz
 * physics alone moves both characters, crosses portals and earns checkpoints.
 */
export async function runVelocityJourney(game, {
  onFrame = null, renderFps = 60, maxSeconds = 90, coarseAimDegrees = 5,
  retryCheckpoint = false, missAtCheckpoint = false, forgetFirstExit = false,
} = {}) {
  require(game.epicMode && game.firstLevel?.segments?.length, 'A speed chapter must be loaded first');
  require([30, 40, 60, 120].includes(renderFps), 'renderFps must divide 120');
  game.renderer?.setAnimationLoop(null); game.restart();
  const level = game.firstLevel, companion = game.cargo, body = game.physics.cargoBody;
  const dt = 1 / 120, renderEvery = 120 / renderFps, coarse = THREE.MathUtils.degToRad(coarseAimDegrees);
  const requests = [], impacts = [], stages = [], frames = [], retries = [];
  let previousSegment = 0, previousTeleports = 0, lastImpact = null, requested = -1;
  let retryDone = false, mistakeActive = false, mistakeDone = false, mistakeStart = 0, mistakeRespawns = 0;
  let connectRequested = false;
  let forgotDone = !forgetFirstExit;
  const readSegment = () => game.velocityRun.segment ?? game.velocityRun.checkpoint ?? 0;
  const readRecoveries = () => game.velocityRun.recoveries ?? game.velocityRun.retries ?? 0;

  function aimAt(point, offset = 0) {
    const desired = point.clone().sub(game.camera.position).normalize();
    const forward = game.camera.getWorldDirection(new THREE.Vector3());
    const yawError = wrap(Math.atan2(-desired.x, -desired.z) - Math.atan2(-forward.x, -forward.z) + offset);
    const pitchError = Math.asin(THREE.MathUtils.clamp(desired.y, -1, 1)) - Math.asin(THREE.MathUtils.clamp(forward.y, -1, 1));
    game.yaw += THREE.MathUtils.clamp(yawError * .65, -9 / renderFps, 9 / renderFps);
    game.pitch = THREE.MathUtils.clamp(game.pitch + pitchError * .65, -1.15, 1.15);
  }

  for (let tick = 0; tick < 120 * maxSeconds; tick++) {
    let segmentIndex = readSegment(), segment = level.segments[Math.min(segmentIndex, level.segments.length - 1)];
    game.input.keys.clear();
    if (!game.velocityCompanion.connected && !connectRequested) {
      game.interactQueued = true; connectRequested = true;
    }
    if (!forgotDone && readRecoveries() > 0) {
      require(readSegment() === 0 && game.teleportCount === 0, 'An unlinked intake advanced the route');
      require(game.velocityCompanion.connected, 'An unlinked intake lost the companion');
      retries.push({ kind: 'unlinked-intake', segment: 0, after: level.diagnostics() });
      forgotDone = true;
    }
    if (segmentIndex === 1 && retryCheckpoint && !retryDone) {
      const before = level.diagnostics(), count = game.teleportCount;
      require(game.restartCheckpoint(), 'The checkpoint retry action must succeed');
      require(readSegment() === 1, 'Retry discarded a completed flight');
      require(game.teleportCount === count, 'Retry erased earned transfers');
      require(game.velocityCompanion.connected, 'Retry disconnected the companion');
      retries.push({ kind: 'manual', segment: segmentIndex, before, after: level.diagnostics() });
      retryDone = true; requested = -1;
    }
    if (segmentIndex === 1 && missAtCheckpoint && !mistakeDone && !mistakeActive) {
      mistakeActive = true; mistakeStart = tick; mistakeRespawns = readRecoveries();
    }
    if (mistakeActive) {
      // Walk off the real platform's open rear, away from its intake. The ordinary
      // failure volume, not this controller, restores the earned checkpoint.
      const side = segment.runway.forward.clone().negate();
      game.yaw = Math.atan2(-side.x, -side.z); game.pitch = -.15;
      game.input.keys.add('KeyW'); game.input.keys.add('ShiftLeft');
      if (readRecoveries() > mistakeRespawns) {
        require(readSegment() === 1, 'A missed flight erased the previous checkpoint');
        require(game.velocityCompanion.connected, 'A missed flight lost the connected companion');
        retries.push({ kind: 'missed-route', segment: segmentIndex, seconds: (tick - mistakeStart) * dt,
          checkpoint: level.getCheckpoint?.(), after: level.diagnostics() });
        mistakeActive = false; mistakeDone = true; requested = -1; game.input.keys.clear();
      }
    } else if (game.velocityCompanion.connected && game.playerGrounded) {
      const phase = game.velocityRun.phase;
      if (['attach', 'prepare', 'dive'].includes(phase)) {
        const installed = game.portals.portals[1];
        const ready = installed?.panel === segment.exit.mesh || installed?.surfaceId === segment.exit.mesh.uuid
          || game.portalSurfaceIds?.[1] === segment.exit.mesh.uuid;
        if (ready || !forgotDone) {
          const toward = segment.intake.group.position.clone().sub(game.playerPosition); toward.y = 0;
          game.yaw = Math.atan2(-toward.x, -toward.z); game.pitch = -.18;
          game.input.keys.add('KeyW'); game.input.keys.add('ShiftLeft');
        }
      }
    }

    game.updatePlaying(dt);
    const time = (tick + 1) * dt;
    segmentIndex = readSegment(); segment = level.segments[Math.min(segmentIndex, level.segments.length - 1)];
    if (segmentIndex !== previousSegment || game.teleportCount !== previousTeleports) {
      require(segmentIndex >= previousSegment, `Unexpected full restart at ${time.toFixed(3)} s`);
      stages.push({ segment: segmentIndex, teleports: game.teleportCount, phase: game.velocityRun.phase, time,
        position: plain(game.playerPosition), velocity: plain(game.playerVelocity), companion: plain(game.cargo.position) });
      previousSegment = segmentIndex; previousTeleports = game.teleportCount;
    }
    if (game.portalShots.lastImpact && game.portalShots.lastImpact !== lastImpact) {
      lastImpact = game.portalShots.lastImpact; impacts.push({ ...lastImpact, time });
      require(lastImpact.valid, `Actual projectile failed: ${lastImpact.reason}`);
    }

    if (tick % renderEvery === 0 || game.state === 'won') {
      const phase = game.velocityRun.phase;
      const wantsShot = forgotDone && !mistakeActive && game.velocityCompanion.connected && game.playerGrounded
        && ['attach', 'prepare'].includes(phase) && requested !== segmentIndex;
      if (wantsShot) aimAt(segment.exit.group.position, coarse);
      else if (!game.playerGrounded && !mistakeActive) {
        const v = game.playerVelocity, speed = Math.hypot(v.x, v.z);
        if (speed > 2) game.yaw += wrap(Math.atan2(-v.x, -v.z) - game.yaw) * (1 - Math.exp(-5 / renderFps));
        game.pitch = THREE.MathUtils.damp(game.pitch, -.24, 5, 1 / renderFps);
      }
      game.updateVisuals(1 / renderFps, 1);
      if (wantsShot && game.portalShots.cooldown <= 0) {
        const assisted = game.portalShots.getAssistTarget?.(1);
        if (assisted?.panel === segment.exit.mesh) {
          const target = segment.exit.group.position.clone().sub(game.camera.position).normalize();
          const angle = Math.acos(THREE.MathUtils.clamp(game.camera.getWorldDirection(new THREE.Vector3()).dot(target), -1, 1));
          if (Math.abs(angle - coarse) < THREE.MathUtils.degToRad(1.2)) {
            require(game.firePortal(0), 'Ordinary primary fire request was rejected');
            requests.push({ segment: segmentIndex, slot: 1, button: 0, time, airborne: !game.playerGrounded,
              aimDegrees: THREE.MathUtils.radToDeg(angle), position: plain(game.playerPosition) });
            requested = segmentIndex;
          }
        }
      }
      if (onFrame) await onFrame({ time, frame: Math.floor(tick / renderEvery), stage: game.velocityRun.stage,
        segment: segmentIndex, game });
      if (!frames.length || time - frames.at(-1).time > .24) frames.push({ time, segment: segmentIndex,
        position: plain(game.playerPosition), speed: game.playerVelocity.length(), companion: plain(game.cargo.position) });
    }
    if (game.state === 'won') break;
  }
  game.input.keys.clear();
  const diagnostics = level.diagnostics();
  require(game.state === 'won' && diagnostics.finished, `Chapter did not finish: ${JSON.stringify(diagnostics)} at ${plain(game.playerPosition)}`);
  require(game.teleportCount === level.segments.length, 'Each flight must cross an actual portal once');
  require(requests.length === level.segments.length && impacts.length === requests.length, 'Each flight needs one actual projectile placement');
  require(game.cargo === companion && game.physics.cargoBody === body, 'Companion identity changed');
  require(game.velocityCompanion.connected && game.velocityCompanion.isNear(), 'The actual companion must arrive beside the player');
  if (retryCheckpoint) require(retryDone, 'Checkpoint retry scenario was not exercised');
  if (missAtCheckpoint) require(mistakeDone, 'A real missed-route recovery was not exercised');
  if (forgetFirstExit) require(forgotDone, 'An unlinked-intake recovery was not exercised');
  return { pass: true, mode: 'velocity', chapter: game.velocityChapter, simulation: 'production 120 Hz',
    controls: 'E connects the existing companion; coarse camera aim + primary click; W + Shift toward the marked intake; no pose or velocity fixtures',
    seconds: diagnostics.elapsed, peakSpeed: diagnostics.peakSpeed, teleports: game.teleportCount,
    airborneShots: diagnostics.airborneShots, requests, impacts, stages, frames, retries, companionRetained: true,
    companionFinishedTogether: true, finish: plain(game.playerPosition), companionFinish: plain(game.cargo.position), diagnostics };
}
