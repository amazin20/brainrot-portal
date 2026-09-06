# V14 — corrective update to the existing ten rooms

Base: 9d256df937a8339ddcce50f86ac548c68e9b9213. This is code work responding to the open-surface, jumping and softlock feedback, NOT an image-generation delivery.

## Implemented

- Every existing chamber gains at least two continuous ceramic areas for placing portals. The first chamber has six portal surfaces instead of two. Several fixed authored panels are expanded; moving apparatus keeps its physical dimensions. A seam is visual, not a forced placement slot. The full front wall in the tenth chamber accepts independently chosen, widely separated placements.
- Portalable surfaces share a visibly light ivory ceramic finish. Structural wall and floor panels use darker graphite finishes. Original authored tile geometry remains, but gray textures no longer disguise the portalable areas. This makes a surface rule, not a marker for the one correct solution.
- The seventh chamber keeps the lever and counterweight. Its fixed intermediate gallery no longer is the final destination: a separate upper dock is outside the full lever tilt plus normal jump envelope. Reach it by sending the companion and then repurposing the portal entry. No invisible progress flag requires a specific checklist of actions.
- The tenth chamber has large lower-to-upper ceramic walls and a real open stairwell cut into the western observation ring. Falling without a preplaced pair does not force a restart. The stair returns to the entrance ring rather than bypassing the sealed companion maze. The ordinary-control recovery route starts at the real spawn, falls into the lower area, and walks back to the ring without a teleport, respawn or cargo reset.
- Existing full-inset pressure contacts, optical/air/impact/lever/maze rules, model cache and character rigs are retained.

## Executed verification

Successful complete source/build/Node/Chromium run: https://github.com/amazin20/nesi-brainrot/actions/runs/34014673622
Verified runtime commit: d71a9d5f1f1a979ebe6b5ad33cfa935f306bae5c.
Actual rendered evidence: artifact 9983587536, reviewed after the run.

263 tests pass. All ten ordinary-control physics routes complete in Node and Chromium with zero respawns and cargo resets. The browser report has no page errors; actual menu/level loop, audio/preferences persistence and the SDK callback-contract stub pass. Sixty rendered animation frames are retained, not claimed as new animation work.

Negative checks: 180 introductory jump attempts, 108 existing mechanism-specific jump attempts, 45 through-cover grab probes, 12 weak-impact cases and nine wrong balance configurations. Added 32 seventh-room no-portal jump/repeated-jump cases, with carried/unladen states and an extra 0.9 m height allowance. Negative fixtures are not presented as solution playthroughs.

A new positive recovery route in Node and Chromium walks from the real tenth-room spawn, falls into the lower area with no portal pair, and returns via the staircase: zero respawns, cargo resets and portal traversals. The recovered gameplay frame and JSON report are in the evidence artifact.

Permanent PR/Pages workflows retain these checks. Publication must separately confirm the exact public commit and build-info version v14-open with ten levels. Software CI is not a user-GPU FPS measurement. Bounded bypass tests do not establish exhaustive correctness or prove human-perceived nonlinearity. The SDK stub does not verify real ads.

## Still pending — do not claim complete

The ten newly supplied optimized GLBs have been inspected as input files but are NOT imported into this runtime. No new object animation from these files is shipped. Levels 11–15 have NOT been implemented in this correction. There are still ten playable levels, not fifteen. Five genuinely different new chambers and gradual functional GLB integration remain unfinished work from the larger request.
