import fs from 'node:fs';
import crypto from 'node:crypto';
import { DistributorBench } from '../src/prototypes/DistributorRig.js';
const reports = [];
function trial(parameters) {
  const bench = new DistributorBench();
  try {
    bench.launch(parameters); for (let i = 0; i < 1440; i++) bench.step();
    const result = bench.snapshot(), weak = parameters.speed < 1;
    const pass = result.paddleContacts > 0 && result.maxAngle < .67 && Math.abs(result.omega) < .02
      && Math.abs(result.angle - (weak ? 0 : parameters.side * .6)) < .025;
    reports.push({ parameters, result, pass });
  } finally { bench.dispose(); }
}
for (const side of [-1, 1]) for (const speed of [4, 8, 12]) for (const lever of [1.6, 1.8, 2]) trial({ side, speed, lever, distance: .68 });
for (const side of [-1, 1]) trial({ side, speed: .5, lever: 1.8, distance: .52 });
const hashes = Object.fromEntries(['src/prototypes/DistributorRig.js', 'src/prototypes/distributor-view.js',
  'tests/distributor-prototype.test.js', 'public/models/runtime/model-02-cargo.glb'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const report = { scope: 'W02 isolated physical mechanism fixture; not a campaign playthrough, final model, hardware measurement or proof of integration with portal/carry code.',
  commit: process.env.BUILD_COMMIT || null, node: process.version, cannon: '0.20.0', physicsHz: 120,
  secondsPerTrial: 12, bodyCount: 6, cargoMass: 3.2, rotorMass: 8, detentPitchRadians: .6,
  passiveDetent: 'U=0.5*(1-cos(2*pi*angle/0.6)); torque=-dU/dangle; viscous damping=16. Physical posts, no angle assignment in runtime.',
  hashes, reports, pass: reports.every(r => r.pass) };
const out = process.env.EVIDENCE_OUT || 'smoke-artifacts/w02'; fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(`${out}/physics-matrix.json`, JSON.stringify(report, null, 2));
console.log(`${reports.length} physical fixture cases; pass=${report.pass}`);
if (!report.pass) process.exitCode = 1;
