# Room 11: requested roles and soft airflow

Based on main 218baac2. The user clarified that the previous assignment of the two machine models was reversed. This change is limited to room 11.

- Model 31 (round impeller) is now the fan/source. Its existing correctly partitioned front rotor spins; painted rim, housing, feet and rear cap stay fixed. It is grounded and shifted left slightly to keep the console accessible.
- Model 35 (louvred assembly) is the receiving door drive. Its casing and grille do not spin as if they were a propeller. The existing drive/clutch and exit mechanism retain their rules. Cable begins at the actual new drive housing, not the old machine outline. Hints use fan/drive terms matching the models.
- Replaces 72 opaque spheres with a single instanced mesh of feathered, curved translucent wisps: up to 180 strands, 99 on low graphics. No downloaded texture, new asset, vector arrow, wall label, fog volume, screen shake or change to any other chamber.
- Drift uses metres per second, not segment-relative speed. One emitter phase runs along cumulative path length; each strand stays entirely in one traced segment and no streak connects across the space between portals. Its transverse basis uses the same portal rotation as gameplay. Paths update after portal changes; trails fade near traced boundaries. Depth testing stays on and depth writes stay off.
- Source impeller accelerates and coasts. Air strength follows its speed; a small residual stream also decays after switching off. The receiving drive gets proportionally less torque, not a hidden full-power source after shutdown. Reset stops it immediately. Rendering uses committed physical time and interpolation, so repeated renders/portal-camera views do not advance the effect.

## Verification
Existing room tests now assert the requested role mapping, correct grounded fronts, preserved source triangles/rim, unpowered controls not opening the door, coasting/reset and the same ordinary-control solution. New visual-buffer regressions cover budget, fixed world speed, portal gaps/twists, boundaries, vertical flow, path replacement, freeze and invalid inputs. The existing full campaign CI still runs all twenty routes and negative/recovery checks. A focused Chromium script captures real source/receiver/portal views and 90 animation frames while using the normal route, and fails on page/shader errors.

The wisps visualize existing traced air; they are not computational fluid dynamics. Finite regression checks do not establish subjective perfection, universal absence of bugs or FPS on the user's hardware.
