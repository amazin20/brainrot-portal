import assert from 'node:assert/strict';

export function selectCurrentSourceRun(runs, {source, branch, repository}) {
  return runs.filter(run => run.head_sha === source && run.head_branch === branch
    && run.head_repository?.full_name === repository
    && run.path === '.github/workflows/tz-completion-review.yml'
    && ['push', 'workflow_dispatch'].includes(run.event))
    .sort((a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt)[0] ?? null;
}

export function assertCompleteSourceJobs(run, jobs) {
  assert.equal(run.status, 'completed'); assert.equal(run.conclusion, 'success');
  assert.ok(Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0);
  const suites = jobs.filter(job => /^Active source regressions \d+\/16$/.test(job.name));
  assert.equal(suites.length, 16);
  for (let index = 1; index <= 16; index++) {
    const matching = suites.filter(job => job.name === `Active source regressions ${index}/16`);
    assert.equal(matching.length, 1); assert.equal(matching[0].status, 'completed'); assert.equal(matching[0].conclusion, 'success');
  }
  const aggregate = jobs.filter(job => job.name === 'Verify no missing, repeated or unfinished regression shard');
  assert.equal(aggregate.length, 1); assert.equal(aggregate[0].status, 'completed'); assert.equal(aggregate[0].conclusion, 'success');
}

export function assertCompleteSourceSummary(summary, {source, runId, runAttempt, activeFileCount}) {
  assert.equal(summary.sourceCommit, source); assert.equal(summary.runId, String(runId)); assert.equal(summary.runAttempt, Number(runAttempt));
  assert.equal(summary.pass, true); assert.equal(summary.shardCount, 16);
  assert.ok(Number.isSafeInteger(activeFileCount) && activeFileCount > 0); assert.equal(summary.activeFileCount, activeFileCount);
  assert.equal(summary.rows.length, 16);
  for (let index = 1; index <= 16; index++) assert.equal(summary.rows.filter(row => row.index === index).length, 1);
  for (const row of summary.rows) {
    assert.ok(Number.isSafeInteger(row.files) && row.files > 0);
    for (const key of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) assert.ok(Number.isSafeInteger(row[key]) && row[key] >= 0);
    assert.ok(row.tests > 0); assert.equal(row.pass, row.tests);
    for (const key of ['fail', 'cancelled', 'skipped', 'todo']) assert.equal(row[key], 0);
  }
  assert.equal(summary.rows.reduce((sum, row) => sum + row.files, 0), activeFileCount);
  for (const key of ['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']) {
    assert.ok(Number.isSafeInteger(summary.totals[key]) && summary.totals[key] >= 0);
    assert.equal(summary.rows.reduce((sum, row) => sum + row[key], 0), summary.totals[key]);
  }
  assert.ok(summary.totals.tests > 0); assert.equal(summary.totals.pass, summary.totals.tests);
  for (const key of ['fail', 'cancelled', 'skipped', 'todo']) assert.equal(summary.totals[key], 0);
  return {pass: true, sourceCommit: source, runId: String(runId), runAttempt: Number(runAttempt),
    activeFileCount, shardCount: summary.shardCount, totals: summary.totals};
}
