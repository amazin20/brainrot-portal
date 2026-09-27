# Deck finish and shadow preservation — 26 September 2026

Based on published revision `9c91806585a2b9f85e6e67130af83c609e50f337`.

Two rendering defects are corrected:

- Deck UV generation previously used only local position plus mesh translation. Vertical rims lost one UV dimension, and nested carrier transforms were omitted. The finish now uses triangle-face projection in the initial world pose; the baked UVs travel with the carrier.
- `OpenChamber.flush()` previously made every merged material batch cast shadows, including explicitly non-casting trim and lighting inserts. Batches now preserve both authored shadow flags.

The six-metre finish, mipmaps, material palette, geometry and physics are retained. Static batching needs one or two extra visible batches per introductory room to separate structural and decorative surfaces. This is a correctness tradeoff, not a measured FPS claim.

## Structural measurements

Headless inspection of manufactured architecture only, before/after on the same five foundation rooms:

| Room | Triangles (unchanged) | Shadow triangles before | Shadow triangles after | Batches before / after | Colliders (unchanged) |
|---|---:|---:|---:|---:|---:|
| 1 | 14,904 | 14,904 | 5,832 | 9 / 11 | 77 |
| 2 | 20,220 | 20,220 | 8,532 | 8 / 9 | 226 |
| 3 | 19,896 | 19,896 | 7,776 | 9 / 11 | 146 |
| 4 | 26,616 | 26,616 | 10,584 | 8 / 10 | 300 |
| 5 | 19,980 | 19,980 | 7,884 | 8 / 10 | 180 |

These are geometry counts, not GPU timing or whole-frame render statistics. Shadow geometry totals decrease from 101,616 to 40,608 triangles. Floor counts are unchanged as well.

## Verification

- Three focused regressions pass: nondegenerate UVs on all faces, transformed carrier texture scale, and preserved shadow flags after batching.
- Production build passes (the existing large-entry-chunk warning remains).
- Full `npm run check`: 1048/1048 tests pass and production build passes. Separate foundation/indoor/deck regression suite: 37/37 pass. Native visual acceptance remains outstanding.
- Native WebGL capture is not completed. The local browser was denied a required socket by the execution environment. The existing foundation-review workflow now also watches the three shared files changed here, so the same revision can receive native captures after upload.
- GitHub upload was blocked by automatic approval review, requiring explicit authorization for public repository disclosure. No new public build is claimed.
