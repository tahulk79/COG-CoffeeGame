# Café listening corner and idle rest — v0.16

YouTube remains the owner's preferred source. The earlier floating/docked player has been replaced by a dedicated cozy screen so gameplay has its full viewport. The header and music notebook both open “Ngồi chill”. The original animated café window/rain/lamp art accompanies the player; no external graphics dependency is added.

## Listening

- The owner-supplied Rico Latino video is directly selectable: https://www.youtube.com/watch?v=m95-M7a59MI.
- Bossa nova café, cheerful Latin jazz and rainy café lo-fi suggestions open clearly labeled YouTube searches. They are not verified, directly playable playlists. This workspace cannot browse YouTube to curate more exact playlist IDs.
- A user can paste an HTTPS YouTube video or playlist URL. Only supported official hosts and bounded video/playlist IDs are used to construct the privacy-enhanced official embed URL; arbitrary URL parameters/HTML are never forwarded. The last valid source link is remembered locally, with a “Play recent selection” button on the next visit to the lounge. No listening history or remote storage is added.
- Player controls remain visible, at least 200×200. No new video request occurs until the user clicks a source or submits a link. By default AFK does not start YouTube without that action. A separate unchecked-by-default option “On idle, restart my chosen music” lets the user explicitly permit restarting their last valid source when automatic rest opens. The preference is local; provider autoplay can still require a Play click. Switching to the local cozy loop removes the iframe; starting YouTube suspends local audio. The original cozy volume slider still controls only local audio.
- A video already playing in the lounge is retained during continued inactivity. Returning to gameplay removes YouTube rather than hiding an active video; the local cozy loop can continue over gameplay. Hiding the tab removes the iframe as before. Playback/ads/embed and region availability remain provider-controlled.

## Automatic rest

After 90 seconds without interaction in the café, the game pauses and opens the cozy screen. The music notebook offers 30 seconds, 90 seconds, 3 minutes or Off; the setting is remembered locally. The game never invents progress or advances brewing while resting. Return is explicit using “Resume game” or Escape from the lounge's own controls, avoiding accidental return while choosing music.

The original game DOM, dialogue page, visit and scroll state remain mounted, hidden and inert. Existing pause/checkpoint events flush the cup before switching screens. Open notebook dialogs are temporarily closed and restored on return, along with the previous focus. This is tab-local rest, not operating-system background playback or a guarantee against device sleep. No idle mode takes over while the tab is hidden or the separate studio is open.

## Validation and limits

148 unit/model checks cover parsing, malicious/malformed links, bounded preferences and existing game models. Chromium at 320×568 VI, 390×844 EN, 844×390 VI and 1280×800 VI checks full game restoration, exact paused checkpoints, video/playlist controls, wrong-link rejection, unchanged playing iframe during inactivity, remembered source, 90-second idle without unsolicited autoplay, explicitly enabled idle-source restart, Off preference, restored notebook/focus and exclusive sources. Existing welcome and notebook/save-retry/source regressions pass. Provider responses are stubbed: actual YouTube audio/ads are not claimed from these tests. No backend, keys, dependency, season schema change or owner-story rewrite is included. Exact release evidence belongs in SYNC_STATUS.md.
