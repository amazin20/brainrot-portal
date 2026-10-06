/** Explicit recovery of successful captures from the interrupted, immutable
 * Expedition publication. The failed publisher is never called successful.
 * Game/capture bytes and every existing media/source gate remain unchanged. */
import assert from 'node:assert/strict';
import {
  assertPublishableExpedition, assertSupplementalPublicationProof,
  expeditionSupplementalRecordingLevels, expeditionSupplementalJobName,
  expeditionSupplementalArtifactName, expeditionSupplementalStepName,
} from './expedition-proof.mjs';

export const RECOVERY_CAPTURE_RUN = 37297389151;
export const RECOVERY_CAPTURE_SHA = 'fd2e7ad64d1dec04fa4a733ff140ed0d065c609c';
export const RECOVERY_SOURCE = '6f1eec54d47fed7916f5346a218525292d15fd62';
export const RECOVERY_CANDIDATE_RUN = 37290872843;
export const RECOVERY_WORKFLOW = '.github/workflows/recover-expedition.yml';
const hash = /^[a-f0-9]{40}$/;
const digest = /^sha256:[a-f0-9]{64}$/;
const positiveID = value => assert.ok(Number.isSafeInteger(value) && value > 0);
function assertTarget(config) {
  assertPublishableExpedition(config);
  assert.equal(config.sourceCommit, RECOVERY_SOURCE, 'Recovery is limited to the accepted frozen game');
  assert.equal(config.candidateRun, RECOVERY_CANDIDATE_RUN);
}

export function resolveSupplementalProof(proof, config, options = {}) {
  if (!options.recover) return assertSupplementalPublicationProof(proof, config, options);
  assertTarget(config);
  const {publicationRun, controllerSHA} = options;
  positiveID(publicationRun); assert.match(controllerSHA, hash);
  assert.notEqual(publicationRun, RECOVERY_CAPTURE_RUN);
  const current = proof.recoveryRun;
  assert.equal(current?.id, publicationRun);
  assert.equal(current.head_sha, controllerSHA);
  assert.equal(current.head_branch, 'main');
  assert.equal(current.path, RECOVERY_WORKFLOW);
  // Aggregate run status can lag behind the executing job. Actual accepted
  // capture steps and immutable artifact identities, not that status, gate reuse.
  const run = proof.publicationRun;
  assert.equal(run.id, RECOVERY_CAPTURE_RUN);
  assert.equal(run.head_sha, RECOVERY_CAPTURE_SHA);
  assert.equal(run.head_branch, 'main');
  assert.equal(run.path, '.github/workflows/publish-expedition.yml');
  assert.equal(run.status, 'completed');
  assert.equal(run.conclusion, 'failure', 'Only the known interrupted publisher can be recovered');
  const acceptedJobs = [], artifactManifest = [];
  for (const level of expeditionSupplementalRecordingLevels(config)) {
    const matches = proof.publicationJobs.filter(job => job.name === expeditionSupplementalJobName(level));
    // The all-attempts API includes synthetic inherited jobs. Reuse an actual
    // successful execution, with its successful recorder step and original ID.
    const successful = matches.filter(job => job.status === 'completed' && job.conclusion === 'success'
      && job.steps?.some(step => step.name === expeditionSupplementalStepName(level) && step.conclusion === 'success'));
    assert.ok(successful.length, 'No successful original capture for room ' + level);
    successful.sort((a,b) => (a.run_attempt || 0) - (b.run_attempt || 0) || a.id - b.id);
    const job = successful[0];
    positiveID(job.id); assert.equal(job.run_id, RECOVERY_CAPTURE_RUN);
    assert.equal(job.head_sha, RECOVERY_CAPTURE_SHA);
    assert.ok(job.steps.length && job.steps.every(step => ['success','skipped'].includes(step.conclusion)));
    const steps = job.steps.filter(step => step.name === expeditionSupplementalStepName(level));
    assert.equal(steps.length, 1); assert.equal(steps[0].conclusion, 'success');
    assert.ok(job.started_at && job.completed_at && Date.parse(job.completed_at) >= Date.parse(job.started_at));
    acceptedJobs.push({id:job.id,name:job.name,conclusion:job.conclusion,runAttempt:job.run_attempt});
    const artifacts = proof.publicationArtifacts.filter(a => a.name === expeditionSupplementalArtifactName(level));
    assert.equal(artifacts.length, 1, 'Missing or duplicate original capture artifact');
    const artifact = artifacts[0];
    positiveID(artifact.id); assert.match(artifact.digest, digest); assert.equal(artifact.expired, false);
    assert.equal(artifact.workflow_run.id, RECOVERY_CAPTURE_RUN);
    assert.equal(artifact.workflow_run.head_sha, RECOVERY_CAPTURE_SHA);
    assert.equal(artifact.workflow_run.head_branch, 'main');
    artifactManifest.push({id:artifact.id,name:artifact.name,digest:artifact.digest,publicationRun:RECOVERY_CAPTURE_RUN,controllerSHA:RECOVERY_CAPTURE_SHA});
  }
  assert.equal(new Set(acceptedJobs.map(j=>j.id)).size, acceptedJobs.length);
  assert.equal(new Set(artifactManifest.map(a=>a.id)).size, artifactManifest.length);
  return {
    mode:'recovered-publication-captures', sourceCommit:config.sourceCommit, candidateRun:config.candidateRun,
    publicationRun:RECOVERY_CAPTURE_RUN, controllerSHA:RECOVERY_CAPTURE_SHA, acceptedJobs, artifactManifest,
    recovery:{publicationRun,controllerSHA,workflow:RECOVERY_WORKFLOW,captureRunStatus:run.status,captureRunConclusion:run.conclusion},
  };
}

export function assertRecoveredRecordingOrigin(proof, release, config, {publicationRun,controllerSHA} = {}) {
  assertTarget(config);
  assert.equal(proof.mode, 'recovered-publication-captures');
  assert.equal(proof.publicationRun, RECOVERY_CAPTURE_RUN);
  assert.equal(proof.controllerSHA, RECOVERY_CAPTURE_SHA);
  const recovery = proof.recovery;
  positiveID(recovery?.publicationRun); assert.match(recovery.controllerSHA, hash);
  assert.notEqual(recovery.publicationRun, RECOVERY_CAPTURE_RUN);
  assert.equal(recovery.workflow, RECOVERY_WORKFLOW);
  assert.equal(recovery.captureRunStatus, 'completed');
  assert.equal(recovery.captureRunConclusion, 'failure');
  assert.equal(String(release.publicationRun), String(recovery.publicationRun));
  if (publicationRun !== undefined) assert.equal(String(recovery.publicationRun), String(publicationRun));
  if (controllerSHA !== undefined) assert.equal(recovery.controllerSHA, controllerSHA);
  return recovery;
}
