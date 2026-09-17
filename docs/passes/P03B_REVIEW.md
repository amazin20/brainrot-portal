# P03B — native-review correction

The first browser comparison of `77def742` exposed a coplanar metal/glass border introduced by the thinner rear profile. Move only the four glazing rails 0.025 m outward, together with their actual colliders. Their inner faces remain farther from the moving panel than the glass. Add a regression requiring separated depth planes and actual edge overlap.

The original candidate's complete local check continues on an immutable worktree. The follow-up has its own targeted tests, source tree, browser comparison and full CI; the first candidate's test count must not be attributed to the new source. Do not claim the first comparison was visually accepted. Gameplay routes, panel pose, actor models and all other source modules remain unchanged by this follow-up.
