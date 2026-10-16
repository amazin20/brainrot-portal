# Camera readability v58 publication protocol

The release configuration pins one independently accepted SOURCE commit, tree,
run, set of provider archives and source-acceptance digest. Until actual SOURCE
acceptance it remains `frozen: false` with placeholders. The release owner seals
those pins only after independently accepting the actual SOURCE attempt. Local
test fixtures are never publication evidence.

The SOURCE contract is one successful attempt with 24 jobs and 26 original
provider artifacts, including the `room25` and `castle` causal packets. The
independent source receipt must contain exactly those two keyed
`checks.mechanismCausal.cases`, each passing geometric visibility while leaving
human, complete camera and hardware FPS acceptance false.

The publisher downloads every pinned SOURCE artifact and appends the unchanged
candidate package to `campaign-v58/`. It preserves all 2,200 accepted baseline
members (654,907,147 bytes; inventory SHA-256
`a6e90e3d222eed87c3fa0c616426ec108ab3071ce703904a61686ad27887d5c5`). The
baseline catalog's exact raw SHA-256 is
`42310ad6335cb784a07d27cac43d09ee689a73911c209b145eeb7e4a1b1c0f58`.
The new union contains `2200 + actual accepted candidate member count + 1`
members. Only the additional `publication-provenance.json` is generated; the
SOURCE build stamp remains unchanged.

PUBLIC has 13 jobs and 14 artifacts: prepare, deploy, complete public HTTP GET,
entry, six native route groups, two causal cases and the final verifier. The
causal jobs download `camera-readability-dist` from the exact accepted SOURCE
run into `source/dist`; they never rebuild the game. The unchanged source runner
uses one fresh page per case. The public observer wraps its actual Puppeteer ESM
instance and records exact HTTP response bytes, build-stamp reads and retained
image bytes.

In each causal report, `source` and `controller.commit/tree` identify the frozen
SOURCE checkout. `source.sourceReview` identifies the accepted SOURCE run.
`controller.runId/runAttempt` and `controller.captureOrigin` identify the actual
PUBLIC run; its GitHub environment is preserved. The packet includes the report,
initial binding, complete served-package proof, telemetry, MP4 clips, retained
JPEG keyframes, decoder metadata and a closed original member inventory. The
public wrapper adds only `public-binding.json`.

The final producer writes `publicationAccepted: false`. Independent root review
requires terminal success for all 13 actual jobs, all 14 provider artifacts,
current source/main/deployment leases and the exact final provider ZIP. It
reconstructs the entire append, authenticates both causal packets, decodes every
MP4 and retained JPEG, and runs the frozen source's current causal validator on
the actual telemetry and freshly measured media metadata. Receipt and catalog
files are written only after every gate succeeds.

Root review uses explicit immutable inputs, for example:

```sh
python3 audit-public-v58.py \
  --controller v58-release-controller --source camera-upgrade \
  --controllercommit ACTUAL_PUBLISHER_SHA --run ACTUAL_PUBLIC_RUN \
  --provider v58-public-provider --evidence v58-public-evidence \
  --output-root-acceptance v58-release-controller/tools/campaign-v58-root-public-acceptance.json \
  --output-catalog v58-release-controller/tools/campaign-v58-public-files.json
```

The provider directory contains actual JSON responses named `run`, `jobs`,
`artifacts`, `controller-commit`, `controller-tree`, `main`, `source`,
`source-commit`, `source-run`, `source-jobs`, `source-artifacts`, `deployments`
and `statuses`, each with a `.json` suffix. Evidence contains
`v58-final-public-proof.zip` and its exact extracted directory
`v58-final-public-proof/`.

Local checks:

```sh
python3 -m unittest discover -s scripts -p test_campaign_v58.py -v
python3 tools/test-audit-public-v58.py -v
node --check scripts/observe-campaign-v58-public.mjs
```

These remain automated software WebGL observations. They do not accept human
puzzle discovery, the complete camera experience, physical-device performance,
live Yandex SDK/ads/moderation, a 500-stage castle or a proved human speedrun.
