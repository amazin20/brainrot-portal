import assert from 'node:assert/strict';

export const CROSSFLOW_BASELINE_COMMIT = 'b71e8dc2d2bc62281f62eb7dc7c2da823470b9c9';
const witnesses = Object.freeze({
  player: [-20.24940038134421, 16, 11.852195497630987],
  cargo: [-16.82116803631819, .5149981471550285, 20.384053626834756],
  impact: [-22.370422866809747, 16.000000001490115, 9.150404202807888],
  markers: ['the original load opens a real air shutter', 'the first permanent gallery preserves height', 'crossing streams expose the upper retaining dock'],
});
const near = (actual, expected) => Array.isArray(actual) && actual.length === expected.length
  && actual.every((value, i) => Number.isFinite(value) && Math.abs(value - expected[i]) < 1e-6);

/** A retained negative control, never a successful route. Match only the
 * independently recorded native portrait failure of this exact old source.
 * A new failure, candidate failure, reset or substituted actor must fail QA. */
export function assertKnownCrossflowBaselineFailure(row, {baselineCommit, route}) {
  assert.equal(baselineCommit, CROSSFLOW_BASELINE_COMMIT);
  assert.ok(['retrieve-first', 'air-freight'].includes(route));
  assert.equal(row.version, 'before'); assert.equal(row.view, 'portrait');
  assert.deepEqual(row.viewport, {width: 390, height: 844});
  assert.equal(row.pass, false);
  assert.deepEqual(row.errors, []); assert.deepEqual(row.consoleErrors, []);
  const result = row.route;
  assert.equal(result.state, 'playing'); assert.equal(result.updates, 11090);
  assert.equal(result.sameOriginal, true);
  for (const key of ['resets', 'respawns', 'cargoResets', 'deletions']) assert.equal(result[key], 0);
  assert.ok(near(result.player, witnesses.player)); assert.ok(near(result.cargo, witnesses.cargo));
  assert.deepEqual(result.pictures.map(picture => picture.mark.name), witnesses.markers);
  const firstLine = result.error?.split('\n')[0];
  const prefix = 'Error: Portal impact rejected at -17,0.12500000000000003,21: ';
  assert.ok(firstLine?.startsWith(prefix), 'Unrecognized historical failure');
  const impact = JSON.parse(firstLine.slice(prefix.length));
  assert.equal(impact.valid, false); assert.equal(impact.index, 0); assert.equal(impact.sequence, 2);
  assert.equal(impact.surface, 'Return observation arm / collision'); assert.equal(impact.reason, 'surface');
  assert.ok(near(impact.position, witnesses.impact));
  return {matched: true, baselineCommit, kind: 'retained-portrait-return-deck-obstruction',
    routePassed: false, error: result.error};
}

export function acceptCrossflowComparison(rows, options) {
  assert.equal(rows.length, 4);
  for (const version of ['before', 'after']) for (const view of ['wide', 'portrait'])
    assert.equal(rows.filter(row => row.version === version && row.view === view).length, 1);
  for (const row of rows.filter(row => row.version === 'after')) assert.equal(row.pass, true, `Candidate ${row.view} route did not pass`);
  assert.equal(rows.find(row => row.version === 'before' && row.view === 'wide').pass, true);
  const negative = rows.find(row => row.version === 'before' && row.view === 'portrait');
  const expectedFailure = assertKnownCrossflowBaselineFailure(negative, options);
  assert.equal(negative.baselineExpectation?.matched, true);
  return {pass: true, candidateRoutesPassed: 2, baselineRoutesPassed: 1, baselineRoutesFailed: 1,
    expectedBaselineFailure: expectedFailure.kind, allRoutesPassed: false};
}
