# Room23 authored constraint definition review

This candidate hardens the explicitly enabled Room23 physical prototype. The
default R4 room builder remains unchanged. The diagnostics corrupt actual
in-memory Cannon components; they do not demonstrate an ordinary-input exploit,
a completed normal Play route, native-browser acceptance, or publication readiness.

## Frozen source provenance

The isolated checkout was cloned from the ownership checkpoint
`85110688317bd150f93d31fad144dacc24c7502e`, tree
`ad85efeb91897721524169bc72825f9f21ad53a1`, with a clean source worktree.
All 1,176 tracked/untracked non-ignored source files were read and hashed twice
while making the snapshot. The sorted file manifest digest is
`22b4bec3b54ab2a2c0df29827faf4a4cb0897cbc7ad2a2ea95e7fda04920d3dc`.
The original checkouts were not edited by this review.

## Reproduced failure and change

After one second in `room23PhysicalFixture`, changing the western
`WindingEquation.home` by +10 left `ownershipValid()` true. Another 0.1 seconds
advanced actuator force count from 120 to 132 and moved the western cabin from
approximately zero to 7.10409 metres. The original body and shape identities
were unchanged. Identity and membership checks alone missed a changed local
constraint definition.

The machine now supplies explicit authored capture contracts. Winding equations
retain their sign, radius, home, angle callback identity, constant Jacobians, and
fixed force bounds. Shaft guides retain their keys, anchors, constant Jacobians,
and fixed force bounds. Both bearings retain fixed pivot and axis identities and
values, together with fixed force bounds. A mismatch is detected before further
actuator work; the existing fault path detaches malformed owned constraints.

The changing return value of the live angle callback remains allowed.
Contact-driven clutch/brake force bounds remain live. Bearing and hand Jacobians
written by Cannon are not captured as constants. The powered hand's moving pivot
continues to use the traveller's existing owner checks.

## Focused validation

The added contract test includes the exact home corruption, changed winding and
shaft facts, both bearings' pivot/axis mutation and replacement, static force
bound changes, and a normal component ascent with a changing angle and real
contact-driven friction limits. The prior body, shape, equation, hand, disposal,
public-input partial-route, and default R4 regressions are included in this run:

```sh
node --test tests/lab-room23-constraint-contract.test.js \
  tests/lab-room23-physical-ownership.test.js \
  tests/lab-room23-physical-prototype.test.js \
  tests/lab-room23-coupling-alternate.test.js
npm run build
```

All 32 focused tests passed with zero failures, cancellations, skips, or TODOs
(71.67 seconds). The build passed in 4.41 seconds; its existing chunk-size warning
remains. The campaign output reported 6.92 MB of complete files before ZIP.

Full ordinary-route, native-browser, public, and unique-master acceptance remain
false. This isolated candidate adds no publication or default activation change.
