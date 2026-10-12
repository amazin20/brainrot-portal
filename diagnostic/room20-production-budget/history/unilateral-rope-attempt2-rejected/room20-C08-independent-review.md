# Independent C08 candidate review

The recorded narrow unit outcomes are consistent with the inspected source and raw trace. A concrete physical cable-law gap remains OPEN: the damping term transmits substantial force while the cable is geometrically slack. This candidate is not accepted as an ordinary/source/full-room mechanism.

Exact input SHA-256 values:

| File | SHA-256 |
|---|---|
| ProductionBudgetPrototype | `5ef65507a8deb1e3823f6728cf0c3e9ebc40314c8bdfe69e800023f1bd0612d4` |
| ProductionBudgetSlipPrototype | `10b3f92429a50a3ce53509d517bc5e24cda449f296fb77d7609292a35f577187` |
| Fixture | `9ff10a791038a3829ee79e27961ecad9c460822ffdc114772ad1f565126a075e` |
| QA runner | `82c657477476a7ec0fda06160bfe0394c038ff57a9b7f155cfe076c0e1a93be2` |

All four match the actual run's before/after inputs. Actual result SHA is `cd61de80375d95acb1e7f3ba3d9360339b133a4a6ffb5098a5561899d40eb1cb`; the 3,583-row causal trace SHA is `2cef3a5c92f0a606cf1be0d3b007413dc1a9d599793fe82042201cc5346521a6`; final manifest SHA is `014b8a61448e0fee9f021a447b40ed8a1e7bc3915144d1152130b03c8dee2694`.

The mirror is consistent: eye `(3-q,3,1.36)`, near point `(-9,.98,18)`, far point `(-16,7.2,-20.68)`, opening −X and actual signed rotor input −0.7 Nms. The original body/tray positions are authored unit initialization; no subsequent actor pose writes were found in the measured runner. Body and original shape IDs remain the same across causal stages. Every recorded completed contact step is current; every slip force witness uses its actual preceding solver interval. All 3,583 recorded intervals retain free original identity, world membership and live registry flags. Coupling remains bounded at 4 Nm with torque-sum error below 4.45e−16 and maximum combined power only 1.34e−31 W roundoff. Cable endpoint-power identity error is below 1.14e−13 W. No load-readiness E gate, motor or target pose was found.

The same finite E remains closed under the 8 N bearing; actual tray withdrawal lets the original fall and reach the captive 0.620273 m state with stretch 0.563256 m; the next identical E permits a transient 7.221391 m opening; explicit unit cable cut returns to −0.05 m. The owner's two reached cut-zero-traction rate cases record all 900/3,600 inputs at 30/120 Hz over 30 seconds, with maximum opening 0.000259 m and hook angle 0.002695 rad. These are observed unit bounds, not a rerun or an ordinary route.

The material defect is in `stretch=max(0,L−24.8)` followed by `T=max(110*stretch+8*rate,0)`. Positive path rate still generates tension when L is below the resting length. At completed step **936**, actual force interval 935 has length **23.479100 m**, stretch **0**, tension **28.245802 N**, and opening pull **16.437545 N**. The near bearing is already unloaded, opening is 0.005744 m, and cable work is positive. At step 969, still-slack tension reaches 43.518209 N and gate pull 25.213756 N. There are 64 such post-tray intervals with T>1 N and L<24.79 m. Passivity does not make this a physical massless slack cable: it dissipates cargo fall energy while transmitting some to the train before geometric tautness. The later captive state is genuinely taut, but that does not erase the earlier false slack traction.

The defect is inherited from the existing production cable law; protected source was not changed. A physically unilateral slack cable correction needs a separately frozen followup before Room20 acceptance. No automatic retuning, source edit or new long matrix was performed by this reviewer.

Other scope limits remain explicit: actual portals/obstructions and broad offsets are absent; the recovery floor is at top y=−6 rather than production 0; the low guard bar is absent; the toy train omits the full pair of production leaves/tie/tooth; the 7.221391 m threshold is not a settled stop or moving-train CCD proof; and `cutCable()` is not an ordinary portal reroute. The final full-stroke cargo COM near y=0.936 therefore proves no clearance of the production guard bar. All ordinary/native/source/full-room acceptance stays false.

The compact independent receipt is `room20-C08-independent-review.json`. Previous v2/source/main, publisher, plan and union reconstruction tool remain untouched.
