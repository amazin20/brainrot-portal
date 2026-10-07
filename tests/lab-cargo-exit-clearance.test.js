import test from 'node:test';
import {runCargoExitClearance,runPlayerExitClearance,runRotatedTransitMomentum,runHeldExitClearance,runPermittedSkinPlacement} from '../scripts/lib/cargo-exit-clearance-cases.mjs';
test('cargo portal exit clearance cannot bypass near axis-aligned or tilted barriers',runCargoExitClearance);
test('player portal exit clearance and internal pair closing cannot bypass separate nearby barriers',runPlayerExitClearance);
test('tilted obstacle transit keeps tangent and angular momentum without an interpolated wall trail',runRotatedTransitMomentum);
test('pickup, approach, owner transfer, clear and release cannot smuggle held cargo through a destination barrier',runHeldExitClearance);
test('a production-permitted near-skin portal placement still cannot bypass its independent front barrier',runPermittedSkinPlacement);
