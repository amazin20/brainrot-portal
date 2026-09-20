# Campaign rooms 22 and 23

These are ordinary campaign puzzles. Both retain the original player mesh, cargo body, portal projectile, carry interaction and grounded joint-arrival win rule. Their successful route drivers write only ordinary input, aim and interaction; they never assign actor poses, actuator targets or completion state.

## 22 — Обратная сторона шлюза

A freight load operates two opposed hydraulic shutters. Loading the west ceramic floor opens the ground crossing and closes the east upper passage. Lifting or transporting that same load reverses both shutters. The source of progress is permanent architecture: the 7 m gallery remains accessible after the first crossing closes, and its steep sight window reveals the original load-bearing floor.

The player must distinguish three uses of the same pair: leave cargo as live support, retrieve it through its own supporting floor, and use the now-open upper inspection route to discover the reverse receiving chamber. The final view is reached by a further stair to 10 m; the receiving chamber stands at 14 m. A ceramic return face on the lower recovery court supports experimentation and return trips.

Portal roles:

- `freight-weight`: live cargo support, then outgoing retrieval aperture.
- `upper-return`: receiving cargo on permanent ground, then carrying the player and friend to the final chamber.
- `reverse-receiver`: upper goal face, inaccessible to a valid early shot from the lower occupied routes.
- `lower-return`: lower recovery connection.

Critical sightlines: the retrieval view crosses the central spine at x=0, z=-4…4, y=2.9…8. The final view crosses x=0, z=-21.5…-14.5, y=11.3…16. Structural blocks and receiver foundations intentionally prevent lower views. Do not add decorative collision or opaque detail to these windows.

`runRoom22` supports `weight-first`, `portal-first`, and clearing the portal pair after the retrieval. Empty and carried cargo do not hold the shutter open. Headless tests include an ordinary running/jumping attempt through the closed ground throat. The default reviewed input route uses one player traversal and one actual free-cargo portal transfer.

## 23 — Вес возвращения

Two cars share one mechanical displacement: the west car spans 0–10 m, the east car spans 20–10 m. The original cargo is sent from the west car's ceramic floor through the high freight throat onto the east car. Its live load drives the first ascent. The transmission has a visible common brake; permanent intermediate galleries preserve altitude while the cars are parked.

The cargo must leave both cars and rest in a permanent 10 m pocket before the east car can return to 20 m carrying the player. Holding the cargo while standing on the east car still counts as its load; lifting it in place cannot cheat the mechanism. From the upper reverse gallery, a portal under the middle pocket retrieves the same body.

Portal roles:

- `west-load-car`: first outgoing freight aperture on an actually moving car.
- `east-load-car`: a real portal-bearing car, available for experiments/recovery.
- `freight-throat`: cargo delivery into the high shrouded end of the car shaft.
- `middle-pocket`: permanent storage and final outgoing retrieval aperture.
- `high-return`: final receiver recessed behind the upper U-shaped enclosure.

The freight throat is not an invisible player filter. Its ceiling and cheeks are ordinary solid collision geometry. A standing traveller can appear in the front freight pocket or fall to the lowered car, but cannot walk or jump from there onto the high exit apron. Cargo retains its usual physical dimensions. The ordinary upper return boards the unshrouded rear of the east car.

The upper receiver faces east at (-4.85,22.3,-20). Its opaque front and side casings prevent early shots from the low and middle routes. Upper cargo retrieval is aimed from the exposed south lip at approximately (10,20,-17.1), outside that casing.

`runRoom23` supports `receiver-first`, `floor-first`, and erasing both portals while cargo is safely stored and the cars are parked. An additional visible ground release frees an accidentally engaged common brake. There are no hidden progress flags, invented companion bodies or cargo relocation shortcuts.

## Validation and cost

`tests/lab-room22-23.test.js` exercises the successful routes in both preparation orders, erased-pair recovery, live weight/held-weight behavior, physical goal requirements, shutter bypass and unweighted freight-throat passage. Campaign QA separately scans actual valid early portal placement rays and attempts freight-throat traversal at three vertical offsets with forward and sideways steering.

Both rooms use the existing shared tile and mechanism art with no new GLB download. Moving collider updates cover two shutters or two car surfaces plus their backing geometry. Decorative elements do not create gameplay proxies. There are no continuous optical ray traces, screen-space effects or additional per-room render targets.
