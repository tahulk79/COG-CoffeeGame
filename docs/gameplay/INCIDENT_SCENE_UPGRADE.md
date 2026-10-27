# Incident scene and interaction fixes — 2026-10-27

- The incident map now uses an outdoor street palette, rather than the café's indoor floor/wall treatment. The surrounding debug checkerboard is removed for this scene.
- Original procedural art adds shopfronts, lit windows, street lamps, crosswalk, lane markings, puddles and rain. Cars, construction barriers, the kitten and player have recognizable silhouettes. Collision footprints and navigation remain unchanged.
- A contextual rescue button sends the player through the existing navigation and timed rescue action. The kitten itself remains clickable and has a target halo/heart. The camera looks further along the street on portrait phones.
- All world object names stay visible from initial rendering, across all maps. Proximity and hover no longer control label visibility; readable backgrounds separate labels from scenery.
- Story dialogue buttons are positioned after their labels resize, keeping the final action inside the panel on small screens.
- The hidden bottom toolbar now disables its interactive descendants during the story, using the existing panel visibility helper.
- Reloading after the kitten was rescued restores the outro dialogue, so the chapter cannot become stuck before its transition.

Verification: headless tests cover dialogue gating, physical rescue/navigation, timeout retry, checkpoint save/load and saving after rescue. Browser tests cover mouse clicks on the kitten, the rescue button, dialogue actions, always-visible labels and transition to the next map on desktop, portrait touch and landscape touch. Existing café and regional world E2E are included in regression testing. Screenshots: `docs/screenshots/incident-*.png`.

Limits: the street art is code-drawn and replaceable; traffic remains parked, as in the existing navigation/collision model. This change does not add traffic damage or a new driving simulation.
