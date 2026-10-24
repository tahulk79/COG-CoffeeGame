# C6S v0.9.0 · The fourteen-drawer cabinet

Season one replaces the calendar-selected guest story as the primary experience.
The café owner collects objects and tells an authored story; the player visits,
listens, looks and optionally plays. The visitor never supplies the missing story.
All fourteen episodes are fully authored in Vietnamese and English and bundled
with the static GitHub Pages build. No server, AI request or API key is required.

## Episode database

The editable content database is `src/cafe-season-data.js`. The same episode owns
its story, physical item, guest, facts, mini-game variants, source references,
ending and next-visit teaser. This prevents a guest script and unrelated daily
catalog entry being paired by separate calendar rotations.

| Visit | Owner's find | Guest | Discovery |
| --- | --- | --- | --- |
| 1 | Yemen Arabica / Mocha | Linh Nguyễn · Vietnam | A place name is not an ingredient list |
| 2 | HARIO V60 | Luca Rossi · Italy | Cone, paper, outlet and preparation |
| 3 | Yirgacheffe washed / natural | Amina Njeri · Kenya | Origin and processing are separate fields |
| 4 | Hoffmann Ultimate V60 | Noah Martin · Canada | Cumulative water versus added water and beverage yield |
| 5 | Kenya SL28 | Farah Haddad · Jordan | Variety names versus scores and sizes |
| 6 | AeroPress | Mateo Cruz · Mexico | A plunger does not make a brewer an espresso machine |
| 7 | Panama Geisha | Aiko Tanaka · Japan | Variety origin versus current growing location |
| 8 | Costa Rica honey process | Camila Santos · Brazil | Mucilage retention, not added honey |
| 9 | Kasuya 4:6 | Minji Park · South Korea | Dividing total water into 40% and 60% |
| 10 | Guatemala Bourbon | Elena García · Spain | A variety name, not whiskey flavoring |
| 11 | ORIGAMI | Ella Wilson · Australia | Paper, holder and fair equipment comparisons |
| 12 | Brazil Yellow Bourbon | Kwame Mensah · Ghana | Cherry color versus roast level |
| 13 | Hoffmann A Better 1 Cup V60 | Sofia Almeida · Portugal | Same ratio, distinct five-pour protocol |
| 14 | El Salvador Pacamara | Dara Sok · Cambodia | Variety lineage, bean size and an honest finite finale |

The cabinet is introduced in episode one and completed in fourteen. Related
entries refer back to earlier encounters: the two Bourbons, the two Hoffmann
protocols and the final callback to Mocha. Each guest has a short personal vignette
and question; the owner acquires, explains and concludes the episode.

## Pace and rewards

Visits follow completion and explicit player choice, not the wall clock. The next
visit is available immediately after goodbye; it also waits through days or months
of absence. An unfinished visit resumes at its saved beat with its original
invitation and game state. There is no midnight replacement, attendance streak,
missed episode, compulsory game, inspection quota or win requirement.

The stages are arrival → owner acquisition → owner story → guest question and
owner answer → owner story with optional fact inspection → owner invitation →
optional game → owner ending → goodbye and keepsake. Listening alone earns exactly
the same episode card. The fourteen-drawer cabinet opens collected stories as
read-only recaps without changing saved completion. After fourteen there is a
finite season ending; no invented episode fifteen or automatic loop is offered.

## Optional play

Each episode has a context-compatible pool and its own card words, question,
sequence and explanations. One invitation is chosen when entering; the previous
visit's game type is excluded, then the choice and layouts are persisted. There
is no visible fixed game checklist or requirement to complete all types.

Available types: clue question, ordered story fragments, memory pairs, customizable
illustrated postcard and a protected invitation to the existing brew station.
Wrong answers allow retry without losing a card. Postcard text is already authored;
only frame/light are selected. Brew participation is recorded as a visit to the
station, never proof of a completed cup or correct technique.

Only V60 and Ultimate V60 offer the legacy station. A source/timer button opens
the appropriate existing guide for all three barista recipes. Five-pour methods
are not compressed into the three-stage game. The existing keep/replace guard
protects an active brew. Season redraws touch `#cafe-season`, preserving station
nodes, volumes and animations. Original music stays opt-in.

## Factual scope

The owner, guests, parcels and acquisition journeys are fictional C6S writing.
Bags illustrate region/variety/process combinations, not verified commercial lots,
actual café inventory or a certified specialty grade. No farmer, lot, award,
measured flavor, TDS or extraction yield is invented. Origin, variety, price and
bean size do not guarantee a taste or quality. Guest lives are personal fiction,
not national stereotypes.

Each episode exposes a knowledge/fiction panel. Background references point to
WCR, Britannica, CQI and maker resources and are explicitly marked as **not directly
reviewed for this update**; a general resource page is not a lot certificate or
claim-level validation. These are conservative educational introductions, not a
new validated scientific model. Recipe statements retain the user-provided source
summaries from 2026-10-24, original creator links and the existing timing caveats.
The 1 Cup 1:55 versus near-2:00 ambiguity remains visible. See
[recipe provenance](RECIPE-PROVENANCE.md) and the structured evidence file.

## Storage and previous versions

New key: `c6s.cafe-season.v1`; envelope version 1, seasonId `cabinet-14-v1`.
Records are an ordered episode prefix, with versioned identity, entry date,
beat, selected game, shuffled layouts, inspection and progress. An existing open
visit blocks a new one; a closed prefix cannot be edited by game actions. Unknown,
malformed or future data is preserved for recovery without overwriting it.
Quota failures allow session play with a retry and notebook export.

All prior keys remain unchanged. The previous calendar story and seven-visit
chapter are available under the earlier-chapter disclosure. Bean photos/OCR,
real-brew journals, recipe references, older memories and practice counters remain.
The notebook export includes saved progress and the authored season/source data.
Progress is local to this browser; no cross-device synchronization is claimed.

## Validation

- 111 automated tests: prior suite plus episode content/metadata, chronology,
  date gaps, fourteen listening-only completions, eligible invitations, all
  forty-two authored game variants, illegal actions, replay and malformed recovery.
- Pages and Vite builds.
- `scripts/smoke-cafe-season.mjs`: 56 scripted episode playthroughs across
  320/390/820/1440 widths. Phone/tablet listen-only routes and phone/desktop routes
  with all five game types; source-guide routing, reload, long date gaps,
  collection/archive, bilingual recaps, finite finale and no horizontal overflow.
- Existing nonempty notebook/shelf/chapter data preserved; quota/corrupt recovery;
  active station DOM/water and keep/replace guard; self-contained notebook export.
- Eight-case VI/EN pouring-layout regression retains stable controls, scroll,
  focus, artwork nodes and completion.

These are synthetic browser checks, not human retention measurements or proof
that all players find the stories engaging. Captures in `review/cafe-season/`
document the initial scene, readable fact cards and collected cabinet. The older
`smoke-cafe-scene.mjs` targets the v0.8 primary calendar flow; this season's primary
flow is covered by the new script.
