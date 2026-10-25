# Café play screen — v0.12.0

The main fourteen-visit story and tasting use the available viewport. Dialogue has short, explicit pages with previous/next controls; the original complete passages are retained in the find notebook. Advancing the story first finishes its remaining dialogue pages. Trying a cup or leaving an optional activity remains possible without a quiz gate.

The scene, electronic scale and fixed control dock share the same stage. Pour/auto/next/session controls occupy fixed rows through pouring and rests. Portrait and landscape have separate apparatus/scale arrangements. Optional knowledge prompts open in a dialog and pause the simulation so a demonstration cannot run away while the player reads. The finished cup takes over the stage, with a short owner response; the longer personal takeaway and action record open separately.

`Mở sổ món / Find notebook` contains the full current passage, guest origin, inspected objects, cabinet, full sources and simulation limits. The header `Sổ / Book` contains attributed recipes, sound settings, older chapters, practice stations and real-brew notes, with a link to the current find/cabinet. These explicit notebooks may scroll. Native dialogs support Escape, keyboard focus and return to the opening control. The older standalone practice and bean journal retain their existing separate layouts.

No local storage schema, authored episode order, recipe quantities, fluid animation, music policy or learning claim changes. The real-brew DOM is retained across café rerenders so drafts and controller bindings survive. Opening a notebook pauses the current tasting; closing does not silently restart it. Storage notices remain visible on the main screen, with recovery/export controls in the notebook.

Validation:
- 129 automated checks, including preservation of all bilingual owner passages through pagination.
- Pages standalone and Vite builds.
- Browser viewport/control/pause/focus matrix at 320×568, 360×640, 390×844, 820×1024, 1440×900 and 844×390, VI and EN.
- Fourteen classic visits × self/watch completion, including five-pour recipes and AeroPress, at 320×568.
- Notebook discovery, source navigation, optional-question pause/answer, saved records and legacy draft checks.

These are synthetic interaction/layout checks. They do not establish real-player enjoyment or retention.
