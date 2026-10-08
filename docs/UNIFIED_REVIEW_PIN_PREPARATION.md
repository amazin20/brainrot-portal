# Prepare exact CI pins after completion

`scripts/prepare-unified-review-pins.mjs` creates a reviewable accepted-CI manifest only after the target source run completes successfully. It does not publish, dispatch a workflow, modify the current accepted-review document or rebuild a package. Pending, failed, skipped, missing, foreign or rerun evidence fails before any accepted output is written. The reviewed helper base is `27822b30cd59696c1b83d35be6b2cdaf91a99150`; the current target is L. K is ineligible after its 45-minute production-resource gate cancellation.

For L, the source remains `8d2c01eacd86fe9235a35e7ec5f624ba62c3b29e`, tree `1bb0546cb29fe6919209103ece67d20a7ddb2377`, run `37733898439`, attempt one. The updater checks all 51 exact job identities, their successful status and source checkout logs, the accepted source tree and both workflow hashes, and all eleven required input artifact IDs, sizes and SHA-256 values against downloaded ZIP bytes. It paginates every job and artifact response; unrelated diagnostic artifacts cannot replace required inputs. It rechecks the completed run after collecting evidence.

Run the updater only after full CI success, using the GitHub API with `GITHUB_TOKEN` if available:

```sh
node scripts/prepare-unified-review-pins.mjs --proof-dir proof/l-review-pins --output proof/l-accepted-review.json
```

The default repository documents supply the exact source/run/workflow expectations. API reads have no write effects. The output must be reviewed before copying its contents into `docs/accepted-unified-review.json` and committing that explicit acceptance. The deployment workflow independently rechecks the live API, all checkout logs and downloaded archive bytes again.

When a connector has already fetched the API evidence, a complete local bundle can replace live API reads:

```sh
node scripts/prepare-unified-review-pins.mjs --evidence-dir /absolute/path/l-api-bundle --proof-dir proof/l-review-pins --output proof/l-accepted-review.json
```

The connector rejects the independent `/actions/artifacts/ID` endpoint. It does allow a separate raw named query for each required input, for example `/actions/runs/37733898439/artifacts?name=campaign-browser&per_page=100&page=1`. To use those separately fetched responses, select the explicit offline adapter:

```sh
node scripts/prepare-unified-review-pins.mjs --evidence-dir /absolute/path/l-api-bundle --artifact-metadata-mode filtered-run --proof-dir proof/l-review-pins --output proof/l-accepted-review.json
```

The default online updater uses per-ID API reads. The publisher's live per-ID validation remains unchanged. The filtered adapter is available only with a supplied evidence bundle. It requires the real server `total_count` to equal one and exactly one returned row for every independent named request; it checks the row's ID/name/source/run/digest/size/expiry against the separate complete paginated list and the actual downloaded outer ZIP. The convenience named wrapper omits `total_count`, so the collector must use `github_fetch` with the raw named URL. It must retain the actual count from that response.

The bundle contains API JSON and downloaded bytes under these names:

| File | API origin or bytes |
| --- | --- |
| `run.json`, `run-final.json` | `/repos/amazin20/brainrot-portal/actions/runs/37733898439`, fetched before and after evidence collection |
| `commit.json` | `/repos/amazin20/brainrot-portal/git/commits/8d2c01eacd86fe9235a35e7ec5f624ba62c3b29e` |
| `source-workflow.json`, `review-workflow.json` | Contents API for `verified-build.yml` and `unified-campaign-review.yml`, with `ref` equal to the full L SHA and base64 contents retained |
| `jobs-page-N.json` | `/actions/runs/37733898439/attempts/1/jobs?per_page=100&page=N` |
| `artifacts-page-N.json` | `/actions/runs/37733898439/artifacts?per_page=100&page=N` |
| `artifact-ID.json` | `/actions/artifacts/ID`, independently fetched for each required input |
| `artifact-name-DIRECTORY.json` | Alternative only in `filtered-run` mode: separate raw `/actions/runs/37733898439/artifacts?name=NAME&per_page=100&page=1` response envelope, as described below |
| `job-ID.log` | Complete `/actions/jobs/ID/logs` bytes for every one of the 51 jobs |
| `archives/DIRECTORY.zip` | Downloaded `/actions/artifacts/ID/zip` bytes; directory names derive from the current target |

Each named response envelope retains these fields. The filename uses the target's directory, not an invented per-ID response name.

| Envelope field | Required value |
| --- | --- |
| `adapterProvenance.method` | `github_fetch` |
| `adapterProvenance.repo_full_name` | `amazin20/brainrot-portal` |
| `adapterProvenance.run_id` | `37733898439` |
| `adapterProvenance.name` | Exact required artifact name from the target |
| `adapterProvenance.request_url` | `https://api.github.com/repos/amazin20/brainrot-portal/actions/runs/37733898439/artifacts?name=` + encoded exact name + `&per_page=100&page=1` |
| `adapterProvenance.projection` | `unmodified-json-content` |
| `originalProviderResponse` | Exact UTF-8 JSON string from the independent `github_fetch` response's `structuredContent.content` |
| `providerResponse` | `JSON.parse(originalProviderResponse)`, without any changed fields or inferred counts |

The helper rejects any difference between the original JSON and its parsed projection. The accepted proof retains every named response and the hash of each original JSON string, plus its explicit request provenance. Full-list rows are not substituted for these independent named reads.

Run, commit, job and artifact responses retain their API fields. A connector may project a workflow file response to base64, encoding and Git blob SHA while omitting its path. In that case, retain the provider fields and add `path` from the explicitly requested file path, plus `adapterProvenance` naming the connector, full source ref, requested path and response projection. The updater still checks the decoded workflow bytes against the immutable source SHA-256 pin. Record this projection in the collector's evidence; do not describe it as an unmodified full Contents API response.

Local-bundle validation establishes consistency and byte identities of those supplied API snapshots. Its API provenance must be retained by the collector. The publisher's independent live API checks remain required. The CI evidence agent also retains `checkpoint/l-ci-evidence/final-accepted.json`, `run-final.json`, `jobs-attempt1-final.json`, `artifacts-final.json`, complete logs and final TAP counts; that summary is supporting evidence, not a replacement for the raw bundle.

All raw API responses and checkout-log hashes are retained in the proof directory. Online mode also retains the exact downloaded ZIPs. The accepted manifest records the source tree/workflow hashes, target and publication workflow hashes, job-log hashes and the explicit scope. It claims automated CI identity and artifact acceptance only. Package/media validation, F's 977-file/104-movie preservation, the 48 native prepublication scenarios, single deployment and 48 postpublication scenarios remain subsequent mandatory gates.
