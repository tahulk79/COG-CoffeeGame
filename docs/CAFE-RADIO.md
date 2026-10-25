# Café radio — implementation notes

Owner-selected source for Vietnamese UI: Rico Latino channel, supplied video https://www.youtube.com/watch?v=m95-M7a59MI. The exact title, embed availability, ads and regional restrictions have not been verified: this workspace cannot reach YouTube. Do not invent a track title or claim a playable playlist.

The Vietnamese header opens a nonmodal, visible official YouTube privacy-enhanced embed after a click. English keeps the existing synthesized cozy-loop shortcut. Both languages can choose either source in the music notebook. Opening radio stops the local loop; starting the local loop destroys the video iframe. Closing radio, Escape inside its panel, hiding the document or rerendering the café removes the iframe. No video is requested on page load. Provider controls handle actual play/pause/seek/volume; a user may need to press Play inside the player if autoplay is blocked. External YouTube link is provided if embedding fails. The existing volume slider controls only the cozy loop.

Only one owner-selected video exists. No shuffle/next-track claim, YouTube Music integration, downloaded audio, hidden player, API key, dependency or backend is introduced. The radio panel is nonmodal so play can continue, but is not draggable; users can close it if it obscures the scene.

Verification: build:pages, npm test (145 checks), Vite build and scripts/smoke-cafe-radio.mjs. Chromium smoke at 320/390 pixels stubs the provider response and checks lazy loading, visible minimum 200×200 player, close/Escape, notebook access, source exclusion and language changes. This does not verify actual YouTube playback or audio quality. Approved for v0.15 publication; actual deployment evidence is in SYNC_STATUS.md.
