# Offline v63 Public terminal audit draft

This folder is an independent, local audit tool. It performs no GitHub request,
HTTP request, browser run, build, publication, or acceptance action. Both
`sourceAccepted` and `publicationAccepted` remain `false`, including after a
passing audit. Root must separately review the evidence and make any acceptance
decision.

The current frozen publisher workflow has eleven jobs and twelve artifacts.
The large `github-pages` ZIP is intentionally **not downloaded or read**. Its
original provider metadata is checked against the raw successful upload log and
the original deployment lease artifact. The other eleven provider ZIPs must be
downloaded and extracted. The auditor verifies their provider length and
SHA-256, safe ZIP members, CRC32 through EOF, and the complete extracted file and
directory closure. No missing archive can be replaced with a report or metadata.

Use the actual terminal successful Public attempt. Preserve raw response JSON,
without reducing fields or reformatting the response before saving it:

```text
PUBLIC_INPUT/
  provider/
    run.json
    commit.json
    workflow.json
    jobs/page-001.json
    artifacts/page-001.json
    logs/JOB_ID.log
  archives/SMALL_ARTIFACT_ID.zip
  evidence/SMALL_ARTIFACT_NAME/...
```

There must be all eleven exact job-ID log files, eleven small ZIPs and eleven
extracted artifact directories. Keep additional numbered pagination response
files if the real API response requires them. Do not place the `github-pages`
archive or an extracted `github-pages` directory here. The auditor rejects
missing, duplicate, aliased, or extra provider pages/logs/archives/artifacts.

The original provider endpoints are:

- `repos/amazin20/brainrot-portal/actions/runs/PUBLIC_RUN_ID`
- `repos/amazin20/brainrot-portal/git/commits/PUBLISHER_COMMIT`
- the exact `workflow_url` returned in `run.json`
- `repos/amazin20/brainrot-portal/actions/runs/PUBLIC_RUN_ID/attempts/ATTEMPT/jobs?per_page=100&page=N`
- `repos/amazin20/brainrot-portal/actions/runs/PUBLIC_RUN_ID/artifacts?per_page=100&page=N`
- `repos/amazin20/brainrot-portal/actions/jobs/JOB_ID/logs`
- the actual artifact archive URL for each of the eleven small artifacts.

If the GitHub tool rejects the independent workflow metadata endpoint, do not
invent `workflow.json`. Retain the **actual original rejection** instead as
`provider/workflow-metadata-unavailable.json`, using the explicit schema checked
by `workflow_record()` in the Python auditor. It includes the exact rejected
URL, original tool response, and actual committed publisher workflow
`path/bytes/sha256/gitBlob`. The output then explicitly records that independent
workflow metadata/state was not fetched. This does not excuse any missing job,
artifact, log, archive, or Git-tree evidence.

The `--publisher` directory must be a clean checkout of the actual Public
publisher commit. A legitimate sparse checkout is supported: only the committed
workflow, publisher/observer scripts, frozen release config, Root Source receipt
and accepted baseline catalog are read. Its actual Git commit, tree and single
controller parent must match the raw provider Git commit response and frozen
config. The `--source` directory must be the exact clean frozen Source checkout.
The `--consumer` directory must contain the separately authenticated accepted
Source `v63-dist` bytes; its complete inventory is rehashed against the frozen
Root Source receipt and retained Public preparation.

Run with Python 3, PyYAML, Pillow and Node installed. The frozen Source checkout
must have its normal dependencies installed for its pure JavaScript validators.
The auditor does not install dependencies:

```bash
python3 -B /workspace/scratch/4668c0c884c8/v63-public-audit/audit-public-terminal.py \
  --publisher /ABSOLUTE/EXACT_MAIN_CHECKOUT \
  --source /ABSOLUTE/EXACT_SOURCE_CHECKOUT \
  --consumer /ABSOLUTE/ACCEPTED_SOURCE_DIST \
  --input /ABSOLUTE/PUBLIC_INPUT \
  --commit ACTUAL_PUBLIC_PUBLISHER_SHA \
  --run ACTUAL_PUBLIC_RUN_ID --attempt ACTUAL_ATTEMPT \
  --output /ABSOLUTE/FRESH_PUBLIC_DRAFT.json
```

The output path must be fresh and outside all immutable inputs; existing receipts are never overwritten. Audit
code hashes are retained in the draft. Do not use the unfrozen proposal as an
actual publisher checkout: it is deliberately rejected.

The proof helper reexecutes only the frozen publisher's pure local validators
in a temporary controlled view, with Python network, filesystem writes and
subprocesses denied. It checks exact preparation/final artifact copies,
unchanged accepted baseline of 2,605 files and 690,702,631 bytes, complete append
union and original consumer package, actual browser response hashes/build
stamps, gated player UI and migration contracts, all 51 native route/capture
proofs, actual decoded screenshots, and the final original CI deployment API
snapshot. Every native route and capture completion must also appear in its
actual producer stdout. The snapshot's raw paginated API files, their hashes,
complete closing pagination and owning Public run/deployment are checked.

An explicit frozen recovery configuration with kind
`byte-identical-republish-after-public-observer-failure` has a separate path.
The initial failed publisher/run remains ineligible. The recovery must be a
direct successor of publisher `7feee7351bc2be2cdee708cae0e7a305bca6567c`, lease
the successful first-exposure deployment `7198668659`, and restore and redeploy
the identical 2,686-file union. The accepted historical baseline remains 2,605
files. The original publication-provenance bytes retain their original
publisher/run; fresh preparation, player/native observations, HTTP proof and
final deployment belong to the new publisher/run. The original provider
snapshot and two original small artifact ZIPs/extractions remain provider-bound
inside `proof/recovery/`. A fresh complete eleven-job/twelve-artifact successful
attempt is mandatory; earlier route successes cannot fill missing new checks.
The new final deployment must exceed `7198668659` and belong to that fresh run.

This establishes the scope of the retained technical CI evidence. It does not
recompute the site from the undownloaded Pages ZIP, make a new post-CI HTTP or
deployment GET, prove current live state, or establish human playtesting,
physical phone performance, live ads, or moderation.

Local guard tests, which are not actual Public evidence:

```bash
python3 -B -m unittest discover \
  -s /workspace/scratch/4668c0c884c8/v63-public-audit \
  -p test_public_terminal.py -v
node --test /workspace/scratch/4668c0c884c8/v63-public-audit/audit-public-proof.test.mjs
```
