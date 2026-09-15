# Room 21: clean-slate cassette prototype

User rejected the complete previous room, not just one bypass. This replacement starts from published a8f23d2 and discards the fan, turbine, bridge gantry, doubled stairs, guard and second launch surface. It is a technical prototype until complete routes, failure states and actual images have been reviewed. No acceptance or first-solve duration is claimed.

Design change from master spec §8.1: the original static incline/pocket is replaced by one vertical counterweighted portal cassette. The same fixed-angle face has two heights. Retrieving the sole cargo raises the already-installed exit; the second fall is from the permanent service pocket, not another run through the starting staircase. Independent brake release and cargo delivery are real, reversible preparations. Whether the brake excursion is interesting rather than busywork remains a playtest question.

## Plan / section
- South: departure balcony at y10, open fall lip and entry to inspection bay.
- West: inspection bay at y4 and one tall counterweight casing with two output mouths.
- Centre: broad common floor portal at y0; lower floor connects recovery routes.
- East: covered graphite cargo receiver at y3.1, service pocket at y7 and arrival balcony at y18.
- One short east service stair connects receiver and service pocket; one south stair is failure recovery, not the intended repeated main route.

## Dependency graph
Brake release A and real cargo delivery B can be done in either order. A+B lowers the inaccessible upper ceramic into the lower mouth. Set an exit on that face; the higher first fall enters the permanent service pocket. Retrieve the same companion by the short east stair. Without resetting either portal, the empty receiver lets the counterweight lift the exit. The lower service-pocket fall now enters a higher exit and lands at the top balcony. The joint-grounded goal has no checklist.

## Explicit physics contract
The load uses the existing cargo contact predicate, and the vertical cassette uses a reduced, fixed-speed counterweighted actuator with a mechanical brake. This is not a multibody counterweight-energy simulation. Portal placement, rigid world frame, impulse transport, gravity, player movement and the original cargo body are production systems. No level-dependent velocity compensation is added.

## Required adversarial checks
Shoot the high face from every reachable start corner/jump and the inspection bay; use the service-entry pair as a launch pair; carry cargo on every initial fling; jump onto the cargo casing; fall too early, before the cassette settles; replace and erase portals from each stable state; drop cargo off both service edges; recover from the lower basin. Finite probes do not prove an exhaustive absence of alternatives. Preserve any physically valid route; revise visible geometry or the dependency design rather than the victory predicate.
