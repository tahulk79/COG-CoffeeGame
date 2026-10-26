# Cozy counter and tool discovery — v0.20.0

Continue the approved webtoon/Rebirth direction with a tangible first brewing station. This is a visual and interaction refinement of the existing seven-shift campaign, not a replacement game or new scientific simulation.

## What players see

- Shift 1 has a cozy wooden worktop. Correct scale/kettle/V60 choices appear in its three slots. The three choice positions stay fixed during an attempt; their order varies with the existing incident seed, so the answer is not always the next card from left to right.
- Short contextual feedback explains why a mismatched tool does another job. It appears in the reserved coaching area, rather than below the screen. Previously placed choices receive an explicit reminder. Wrong selections remain recoverable and still affect the existing excellent stamp.
- A completed counter and a clear unlocked-order message appear before Duy's order. This is not a second XP payout; the existing proof/replay rules remain authoritative.
- Optional **Look closely at the tools** opens four illustrated tool cards. Returning players can access the same kit from the first item in the Book, without replaying or resetting progress.
- The opening's first pulse and shift-2 full cup use the new room behind the existing live rig. Streams, drips, kettle motion, scale/time and 600 ml visual fill mapping remain the original DOM/SVG/model behavior.

## Actual graphics pipeline

The five original assets in `public/art/counter/` were built by `tools/art/build_counter.py` in Blender 5.1.2, invoked through the official Blender Lab MCP 1.0.3 `execute_blender_code` tool. The original Image Gen webtoon owner panel is mapped onto the framed picture inside the modeled café. The stage, lamp, shelf, plant and equipment are modeled with code. The authoring source creates only its own `C6S_Asset_` scenes; it does not clear an artist's unrelated scene.

The deliverables are a 960×540 room and four 256×256 transparent tool portraits (scale, gooseneck kettle, conical V60 and approximately 600 ml server). Total additional PNG payload is about 570 KiB; filenames/sizes are recorded in `manifest.json`. These are approximate visual proportions and individually normalized portraits, not measured commercial CAD models or a calibrated volume calculation. The V60 holds filter/grounds, the scale measures mass, and the server receives liquid; the guide preserves those distinctions.

The game loads these pre-rendered images from Pages. No Blender process, MCP service, WebGL engine, new dependency, API key or paid model runs in the player's browser. The current cloud can call Blender through its tested programmatic MCP client; native chat-tool registration is still a separate host capability and is not claimed by this game release.

## Reproduction

With Blender 5.1+ installed, run `blender --background --python tools/art/build_counter.py` from a checkout. It writes the PNGs/manifest under `public/art/counter` and an intermediate `.blend` under the system temp directory's `c6s-blender-art` folder. In the prepared cloud, start the retained `start-bridge.sh`, then call the official MCP execution tool with the script's real `__file__` set. Keep working `.blend` files outside published frontend assets.

The standalone builder copies the whole `public/art` tree into `docs/art`; Vite handles the public tree normally. Source art, generated art and prior webtoon imagery are preserved.

## Compatibility and checks

There are no profile migrations, new progress keys, new XP rules, changed recipes, taste calculations or schema changes. Existing 168 unit/model checks and standalone/Vite builds pass. Chromium checks exercise 320×568, 390×844, 844×390 and 1280×800 layouts, actual art loading, keyboard tool selection, stable choice positions, placed-object persistence, English/VI, guide/Escape/Book access, first-order feedback, pouring/draining animation and cozy pause preservation. A failed-image path verifies that the original SVG choices remain usable and a mistaken choice does not manufacture an excellent stamp.

The webtoon opening, original full-cup/café preservation, and seven-shift continuation regressions pass. New release evidence belongs in SYNC_STATUS.md. Physical iPad/Safari, constrained-network performance, human enjoyment and retention have not been measured. This release does not claim to make all seven shifts newly animated or replace the original brewing apparatus with runtime 3D.
