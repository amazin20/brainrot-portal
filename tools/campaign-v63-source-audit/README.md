# Internal v63 Source audit draft

This tool audits downloaded provider bytes. It does not download, rebuild, run
routes, modify Source/evidence, publish, or issue an acceptance receipt. A passing
output remains `sourceAccepted:false` and `publicationAccepted:false`. Root reviews
the actual result before issuing a separate Source receipt.

The audit uses the final commit and run supplied by Root on the command line.
This portable package pins no eligible candidate. Any failed or superseded
cohort is ineligible, even if some retained artifacts look valid. Root must
identify the exact final Source commit/tree/attempt and terminal provider
success before invocation. The auditor remains separate from Main; Main's own
game files are never assumed to be the reviewed Source checkout.

## Input contract

`--source` is the clean, real Git checkout at the requested exact commit and
tree, including the committed scripts/tests/vendor checker and installed Node
dependencies. A source ZIP without `.git` is insufficient.

`--input` contains only downloaded provider records and exact artifact bytes:

```text
provider/run.json
provider/commit.json
provider/workflow.json           # actual metadata OR explicit rejection below
provider/workflow-metadata-unavailable.json # only when the actual GET was rejected
provider/jobs/page-001.json
provider/jobs/page-002.json       # only if needed
provider/artifacts/page-001.json
provider/artifacts/page-002.json  # only if needed
provider/logs/JOB_ID.log          # every actual job, raw log bytes
archives/ARTIFACT_ID.zip          # every exact Actions artifact download
evidence/ARTIFACT_NAME/...        # exact extracted ZIP closure
```

- `run.json`: raw Actions run object for the exact current attempt.
- `commit.json`: raw Git commit object with `sha`, `tree.sha`, `parents[].sha`.
- Provide **one** workflow record. `workflow.json` is the raw Actions workflow
  object with matching `id`, `path` and active state. If the provider tool
  actually rejects that metadata endpoint, the explicit alternative is
  `workflow-metadata-unavailable.json`, using Root's captured shape:

  ```json
  {
    "schemaVersion": 1,
    "kind": "workflow-metadata-get-unavailable",
    "requestedUrl": "ACTUAL_RUN_WORKFLOW_URL",
    "tool": "mcp__codex_apps__github_fetch",
    "actualToolResponse": "FULL ORIGINAL REJECTION OBJECT, NOT THIS PLACEHOLDER",
    "sourceWorkflow": {"path": ".github/workflows/player-access-review.yml", "bytes": 0, "sha256": "ACTUAL_SHA256", "gitBlob": "ACTUAL_GIT_BLOB"},
    "independentWorkflowMetadataGet": false,
    "workflowDefinitionFromExactSourceTree": true
  }
  ```

  The rejection must be the exact observed tool HTTP400 `INVALID_ARGUMENT`
  response that says the URL is not an allowed public GitHub repository or
  search endpoint. Its requested URL must equal the actual run's `workflow_url`,
  including the same numeric `workflow_id`. Source workflow bytes, SHA256 and
  Git blob must match `git show COMMIT:.github/workflows/player-access-review.yml`.
  Missing records, fake metadata state, a different error, mismatched URL/hash,
  or both alternatives fail closed. The draft reports
  `independentWorkflowMetadataGet:false` and
  `workflowDefinitionFromExactSourceTree:true` for this explicit capability
  limitation; it does not claim that workflow state was independently fetched.
- Job pages must come from the **attempt-specific jobs endpoint** and retain
  `total_count` and `jobs`. Artifact pages retain `total_count` and `artifacts`.
  Consecutive `page-NNN.json` files are required. The full listed total must be
  present with no duplicates. Do not save connector envelopes or truncated text.
- Logs are the actual raw job-log responses, keyed by job ID. Every successful
  upload must bind artifact name, ID, byte count, ZIP SHA256, and the exact
  run/artifact download URL in that same producer log.
- ZIP digest and size must equal the API artifact record. Reading every member
  to EOF verifies CRC. Unsafe, duplicate, encrypted, linked or special members,
  directory collisions, extra/missing extracted bytes and excessive expansion
  are rejected. A single consistent provider wrapper directory can be removed
  during extraction; no arbitrary path rewriting is accepted.
- Do not add notes or derived files inside `archives/` or `evidence/`.

The job/artifact inventory is expanded from the frozen workflow's matrix. The
current workflow expands to **44 jobs / 57 artifacts**. The audit does not reuse
an old release's totals. Every job and step must have completed successfully;
skipped, cancelled, expired, duplicate and missing records fail closed.

## Invocation

Dependencies: Python 3 with PyYAML and Pillow, Node with the frozen Source
dependencies installed, Git, FFmpeg and FFprobe. Run from any directory:

```bash
python3 /ABSOLUTE/AUDITOR/audit-source.py \
  --source /ABSOLUTE/EXACT_FROZEN_SOURCE_GIT_CHECKOUT \
  --input /ABSOLUTE/DOWNLOADED_CURRENT_SOURCE_BYTES \
  --commit CURRENT_40_CHARACTER_COMMIT \
  --run ACTUAL_RUN_ID --attempt ACTUAL_ATTEMPT \
  --output /ABSOLUTE/NEW_OUTPUT/actual-draft-audit.json
```

The output path must be new. On rejection the script exits nonzero and does not
write a passing result. Production ZIP extraction occurs in an automatically
removed temporary directory; Source and evidence remain untouched.

## Gates and scope

The audit independently checks:

- Current Git/provider commit, tree, parents, branch, event, workflow, attempt,
  all jobs/steps, raw logs, all API artifact digests and extracted closures.
- All 12 CPU file partitions, exact current file list, disjointness, complete
  TAP counts with no skipped tests, and every TAP line in actual producer logs.
- Exact consumer, review and production packages against current committed
  release metadata and Source inputs. Production omits route/checker hooks.
- All 51 headless ordinary and 51 compiled consumer route wins, actual final
  images and the specialized physical proofs; 10 balanced Optics interiors.
- The original checker on all 51 review routes and ten native movies, retaining
  original `WARN`/`NOT VERIFIED` and rejecting positive-session hard failures.
  The known model URL `models/runtime/FILE.glb?v=PREFIX` is allowed only when
  exactly one `v` equals that inventory file's first 12 SHA256 characters.
  Other files, missing models, wrong/full/duplicate prefixes and unknown query
  keys fail. Every response still requires the full expected byte count and
  SHA256; the version prefix is never substituted for a body check.
- All 51 actual paused hint UI close/error/reward transactions, duplicate reward
  protection, reread without ads, pause/audio/hold behavior and resumed physics.
- Real consumer access/menu proof, four canonical v62 migration phases, genuine
  first-room victory, Next/reload/replay, Atlas return, and decoded phone PNGs.
- Every retained consumer HTTP body is matched by request ordinal, actual CDP
  request ID and document generation to the same complete verified body, with
  final drains at zero pending/in-flight requests. Chrome `net::ERR_ABORTED` is
  accepted only for that same independently verified request; missing bodies,
  other network failures and duplicate-URL-only matches fail. Finished and
  complete-body-abort counts remain separate in the draft result.
- The actual production ZIP under explicit SDK mock: rejected startup as an
  intentional negative fixture, positive desktop/mobile lifecycle, absence of
  hooks under forged queries, restart cooldown and interstitial/focus behavior.
  Expected original negative-session findings are preserved, never promoted.
- Ten exact 13-file Optics native packets, independent full MP4 decodes,
  telemetry, keyframes, same Source/controller/run and distinct consumer/review
  bindings, with checker/context/link evidence outside each closed film packet.

The ordinary/native 51-room route counters retain their existing scope:
**reported journey counters after legacy fixture initialization; the initial
fixture reset is outside these counters; specialized drivers retain their own
stricter proofs**. The draft explicitly reports
`normalUiZeroStepStartProven:false` for that general cohort. It does not claim a
fresh guest sequential 51-room playthrough, live SDK/ad delivery, human puzzle
discovery, physical phone FPS, all bypasses or moderation/public acceptance.

## Root receipt handoff

The successful audit output is a draft, not the publisher's Source receipt.
Root first reviews its actual provider records, ZIP/log bindings, final Source
identity and all recorded limitations. This document does not authorize a
failed draft, an old run, or mutation of evidence into a passing report.

The publisher's accepted receipt path is
`tools/campaign-v63-root-source-acceptance.json`. Preserve the complete audited
provider/log/artifact pins and point back to the exact draft file SHA256 and
auditor inventory SHA256. Root supplies a clearly named receipt kind and its
decision timestamp. The required fields map as follows:

| Accepted receipt field | Exact source/value |
| --- | --- |
| `schemaVersion` | `1` |
| `sourceAccepted` | Root's final independent decision; remains `false` in every draft/proposal |
| `publicationAccepted` | `false` |
| `baselineSourceC` | `8102e724cafff008faf57316fcd82f03ed6f4072` |
| `sourceCommit`, `sourceTree` | Exact values from the successful final draft |
| `run`, `runAttempt`, `sourceReview` | Copy actual numeric run/attempt and `{runId,runAttempt}` unchanged |
| `candidateFiles`, `candidateBytes`, `candidateInventorySha256` | Copy the full original provider consumer inventory unchanged, including its original `build-info.json` |
| `checks.cpu` | Copy the actual counts/file partitions; `tests == passed > 0`, `failed == 0`, no skipped/cancelled/todo |
| `checks.nativeRoutes` | Copy `gameplayPassed:51`, `capturesPassed:51`, `normalUiZeroStepStartProven:false` and the exact reset-counter scope |
| `checks.playerAccess`, `checks.rewardedUI` | Copy the passed proofs, including honest request outcomes and explicit mock-ad scope |
| `checks.platformChecker` | Copy `pass:true`, `rooms:51`, `liveSdkAccepted:false`, `moderationAccepted:false` and every original WARN/NV finding |
| `checks.architecture` | Copy passed proof with numeric `rooms:10` |
| `checks.provider` | Copy all provider facts and the actual workflow-GET capability limitation without promoting it |
| Other checks, pins and limitations | Retain the complete audited observations and open scopes |

One normalization is necessary: the draft's `checks.opticsNative.rooms` is the
full array of ten per-room audits, whereas the publisher expects a numeric room
count. After verifying its exact room set is 31–40 and its `pass` is true,
Root's receipt uses:

```text
checks.opticsNative = {
  pass: draft.checks.opticsNative.pass,
  rooms: draft.checks.opticsNative.rooms.length,
  evidence: draft.checks.opticsNative
}
```

The evidence stays intact, including original checker counts and false
native/human/live/platform acceptance scopes. Do not replace the array with
an unexplained literal or discard its diagnostics. Similarly, the 153 observed
rewarded-UI transactions are close/error/reward on each of 51 rooms; they are
not 153 confirmed rewards or live advertisements.

Before Root's final decision, keep `sourceAccepted:false`. Once Root separately
issues the accepted receipt, compute its actual file SHA256 and put that exact
path/hash into the publisher configuration's `sourceAcceptance`. Source
acceptance does not change `publicationAccepted` or grant public/live SDK,
moderation, human or physical-device acceptance. This package includes no
command that issues an accepted receipt.

## Draft tests

The tests require an explicit, independently checked out Source with `.git` and
its own pinned checker helper. Set `SOURCE_DIR`; do not point it at Main just
because the auditor is stored under Main's `tools/campaign-v63-source-audit/`.
Relative imports remain inside this auditor package after relocation.

```bash
cd /ABSOLUTE/AUDITOR
SOURCE_DIR=/ABSOLUTE/EXACT_FROZEN_SOURCE_GIT_CHECKOUT python3 -m unittest -v test_audit_source.py
SOURCE_DIR=/ABSOLUTE/EXACT_FROZEN_SOURCE_GIT_CHECKOUT node --test audit-*.test.mjs
```

These synthetic mutation/decode tests validate audit mechanics. They are not
provider evidence and do not establish current Source acceptance. The first
complete positive invocation must use Root's actual downloaded provider bytes.
