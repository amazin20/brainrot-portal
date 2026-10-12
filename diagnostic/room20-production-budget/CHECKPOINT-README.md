# Room20 unilateral cable research checkpoint

This is an unintegrated diagnostic based on the accepted source and the previous frozen research checkpoint. Source, ordinary-player, full-room and production force-budget acceptance remain false. Run only the dedicated diagnostic, not an ordinary route:

    node scripts/qa-room20-production-budget-c08.mjs

The final runner and the independent full-trace read verify zero tension and both endpoint forces for all 958 geometrically slack intervals, the first real taut unloading, 600 captive gravity steps before the same finite E, and bounded repeated-input cases. Old rejected versions, including the real slack-damper forces, retain their own revision evidence. A transient opening of 7.223535 m does not establish a settled stop or a full-room traversal. Actual portal reachability, the lower guard bar, hanging support, far retention, actor access, bypasses and CCD remain open.

`checkpoint-storage.json` maps every original byte sequence to its stored representation. Files larger than 1 MB are losslessly stored as gzip base64 text to keep the repository checkpoint small. Restore them in a separate checkout before rerunning a script that reads an original trace:

    raw = gzip.decompress(base64.b64decode(Path(storedPath).read_bytes()))

Verify `originalBytes` and `originalSha256` before writing `originalPath`. The stored hashes also bind the complete gzip base64 text. All other files are unchanged UTF-8. Historical manifests retain their original filenames and scopes. The actual Node Cannon CJS digest is after-only; the earlier ESM before/after capture is not relabelled as a CJS capture. Package, lock, production room and publisher are unchanged.
