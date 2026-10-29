import test from 'node:test';
import assert from 'node:assert/strict';
import { Flywheel } from '../src/game/LabWorkshopKit.js';
import { WindClutchDrive, windDoorParameter } from '../src/game/LabWindClutchDrive.js';

const make = () => new WindClutchDrive(new Flywheel({ drag: .06 }));
function advance(drive, seconds, flow, hz = 120) {
  for (let frame = 0; frame < Math.round(seconds * hz); frame++) drive.step(flow, 1 / hz);
}

test('room11 bearings retain useful energy through an ordinary thirty-second approach', () => {
  const drive = make();
  advance(drive, 8, 1); const charged = drive.wheel.energy;
  assert.ok(charged > 5000 && drive.stroke === 0);
  advance(drive, 30, 0);
  assert.ok(drive.wheel.energy > 1500 && drive.wheel.energy < charged);
  assert.equal(drive.toggleClutch(), true);
  advance(drive, 20, 0);
  assert.equal(drive.stroke, 1);
});

test('short charge gives only a partial hinge stroke and never manufactures more energy', () => {
  const drive = make(); advance(drive, 1, 1); advance(drive, 3, 0);
  const initialEnergy = drive.wheel.energy, initialWork = drive.wheel.work;
  assert.ok(drive.leverClear()); drive.toggleClutch(); advance(drive, 15, 0);
  assert.ok(drive.stroke > 0 && drive.stroke < .23);
  assert.equal(drive.wheel.omega, 0);
  const useful = drive.wheel.work - initialWork;
  assert.ok(useful > 0 && useful <= initialEnergy);
  assert.ok(Math.abs(useful - drive.stroke * drive.energyPerStroke) < 1e-8);
});

test('partial hinge stroke is physically held, then a fresh isolated charge completes it', () => {
  const drive = make(); advance(drive, 1, 1); advance(drive, 3, 0);
  drive.toggleClutch(); advance(drive, 15, 0); const partial = drive.stroke;
  assert.ok(partial > 0 && partial < 1);
  advance(drive, 10, 0); assert.equal(drive.stroke, partial);
  advance(drive, 8, 1); assert.equal(drive.clutch, false); assert.equal(drive.stroke, partial);
  advance(drive, 4, 0); assert.ok(drive.toggleClutch()); advance(drive, 10, 0);
  assert.equal(drive.stroke, 1);
});

test('connecting an empty rotor before live feed closes the inlet until the cover ejects the fork', () => {
  const drive = make(); assert.ok(drive.toggleClutch());
  for (let n = 0; n < 1200; n++) {
    drive.step(1, 1 / 120);
    if (drive.clutch) assert.equal(drive.inputTorque, 0);
    assert.equal(drive.stroke, 0); assert.equal(drive.wheel.work, 0);
  }
  assert.equal(drive.clutch, false); assert.equal(drive.cover.opening, 0);
  assert.ok(drive.wheel.energy > 5000);
});

test('cover displacement follows actual pressure, including a coasting source and interrupted path', () => {
  const drive = make(); advance(drive, 2, 1);
  assert.equal(drive.cover.opening, 0); assert.equal(drive.toggleClutch(), false);
  drive.step(.8, 1 / 120); assert.equal(drive.cover.opening, 0);
  // The drive receives no fan-switch boolean. A live fan redirected elsewhere
  // is the same zero inlet pressure as a stopped fan after its coast.
  advance(drive, 3, 0); assert.ok(drive.cover.opening > 2.19);
  assert.ok(drive.leverClear());
});

test('critically damped cover integration agrees at 30, 60 and 144 Hz', () => {
  const values = [30, 60, 144].map(hz => {
    const drive = make(); advance(drive, 2, 1, hz); advance(drive, 1, 0, hz);
    return [drive.cover.opening, drive.cover.velocity];
  });
  for (const value of values) value.forEach((v, i) => assert.ok(Math.abs(v - values[0][i]) < 1e-10));
});

test('forging the old cumulative work counter cannot turn the output hinges', () => {
  const drive = make(); drive.wheel.work = 1e12;
  advance(drive, 10, 0); assert.equal(drive.stroke, 0);
  drive.toggleClutch(); advance(drive, 10, 0); assert.equal(drive.stroke, 0);
});

test('end stop ceases taking shaft work and reset restores the physical transmission', () => {
  const drive = make(); advance(drive, 8, 1); advance(drive, 3, 0);
  drive.toggleClutch(); advance(drive, 10, 0); assert.equal(drive.stroke, 1);
  const work = drive.wheel.work; advance(drive, 5, 0); assert.equal(drive.wheel.work, work);
  drive.reset();
  assert.equal(drive.stroke, 0); assert.equal(drive.previousStroke, 0);
  assert.equal(drive.clutch, false); assert.equal(drive.wheel.energy, 0);
  assert.equal(drive.cover.opening, drive.cover.travel); assert.equal(drive.cover.velocity, 0);
});

test('door animation parameter preserves proportional hinge angle and bounded endpoints', () => {
  for (const stroke of [0, .001, .1, .25, .5, .75, .9, .999, 1]) {
    const p = windDoorParameter(stroke), angle = p * p * (3 - 2 * p);
    assert.ok(Math.abs(angle - stroke) < 1e-12);
  }
  assert.ok(Math.abs(windDoorParameter(-1)) < 1e-12);
  assert.ok(Math.abs(windDoorParameter(2) - 1) < 1e-12);
});

test('configurable inertia and drag preserve the old default analytic flywheel exactly', () => {
  const a = new Flywheel(), b = new Flywheel({ inertia: 3, drag: .32 });
  // Frozen outputs from the actual A2 implementation, not a second copy of
  // the new integrator. Columns: output, omega, angle, energy, cumulative work.
  const expected = [
    [.0007990492016893392, .07262792488718617, .00036320418258606324, .007912223210128133, .0007990492016893392],
    [65.25321779234967, 18.708835547076298, 29.66091674615971, 525.0307912913185, 65.25401684155136],
    [38.261546940592304, 16.120396907532427, 47.052528991883484, 389.8007946845716, 103.51556378214366],
    [161.2772964933507, 0, 120.3603910343156, 0, 264.7928602754944],
  ];
  const inputs = [[24, 2.2, .01], [24, 2.2, 3], [0, 2.2, 1], [0, 2.2, 20]];
  for (let i = 0; i < inputs.length; i++) {
    const output = a.step(...inputs[i]); assert.equal(output, b.step(...inputs[i]));
    assert.equal(a.omega, b.omega); assert.equal(a.angle, b.angle); assert.equal(a.energy, b.energy);
    [output, a.omega, a.angle, a.energy, a.work].forEach((v, j) => assert.ok(Math.abs(v - expected[i][j]) < 1e-10));
  }
  for (const options of [{ inertia: 0 }, { inertia: NaN }, { drag: -1 }, { drag: Infinity }])
    assert.throws(() => new Flywheel(options), RangeError);
});

test('invalid input cannot mutate pressure, motion, energy or output work', () => {
  const drive = make(); advance(drive, 1, .5);
  const before = JSON.stringify(drive);
  for (const [flow, dt] of [[-1, 1], [1.1, 1], [NaN, 1], [1, -1], [1, Infinity]]) {
    assert.throws(() => drive.step(flow, dt), RangeError);
    assert.equal(JSON.stringify(drive), before);
  }
});
