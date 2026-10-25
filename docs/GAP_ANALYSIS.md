# Strategic gap analysis — 25 October 2026

Analysis baseline: v0.12.0, main `0ae226764d6248501ec576b343e14c369cba9eec`. See [CURRENT_STATE.md](CURRENT_STATE.md) for source evidence and classifications, and [STRATEGIC_HANDOFF.md](STRATEGIC_HANDOFF.md) for decisions/conflicts. Recommendations here are unapproved.

## Assessment

C6S already has a recognizable café, a collector/storyteller owner, tactile equipment, comfortable optional play, three real method introductions and substantial local memory/experiment tooling. These are a credible setting and interaction foundation for Hybrid Discovery. They are not yet an integrated adventure/mystery progression game.

The largest gap is the connection between actions, evidence, discoveries and new possibilities. Adding more bean introductions, XP numbers or fantasy art alone would leave that gap intact. One short mystery built around an existing observable relationship is a more useful next test than replacing the café or building ten nominal levels.

This is a source/design assessment. It does not establish whether non-coffee players will enjoy it, whether coffee learning transfers to real brewing, or whether a mass audience will return.

## Alignment and gaps

| Strategic requirement | Existing implementation to reuse | Remaining gap | Priority / proposed response |
| --- | --- | --- | --- |
| Enjoyable without coffee knowledge | Owner welcome, guest mode, early hands-on route, self/watch/listen choices, cozy feedback | The main motivation still centers on hearing coffee explanations and repeating prescribed brewing | **P0:** an understandable anomaly and a player-chosen prediction before the explanation. Test with non-drinkers. |
| Adventure + mystery | Authored titles/objects, map/seed/label inspection, guest questions and finite story arc | No case state, clue dependencies, evidence-based resolution or mystery-linked next possibility | **P0:** one optional case over an existing visit, preserving its normal story path. |
| Hypothesis → experiment → meaningful feedback | First Pour baseline links, recipe differences, counter comparison, three-decision cue game, recorded pauses | These are separate modes. The main tasting commonly reaches the same targets/result irrespective of choices | **P0:** capture comparable observations and ask which prediction they support; show actual state differences, not generic completion. |
| Coffee essential to gameplay | Brewing apparatus, cumulative mass/time, methods, water movement | Clue/memory/order games can often be solved as reading recall; most bean tastings share a template | **P0:** resolve a mystery through the coffee setup's observable behavior. Do not substitute unrelated trivia or invented flavor. |
| Scientifically grounded mechanics | Evidence register, conservation checks in counter, exact mass arithmetic, separated real observations | Active models are illustrative, not physically calibrated; different stations use different assumptions | **P0:** use a narrowly supported relationship, label game timing/approximations, keep existing models separate. No universal chemistry rewrite. |
| Magical experience | Original story, scene/prop SVG, music, personal cup, postcard variants | Little exploration beyond the café; no fantasy-world mechanics or persistent cosmetic collection | **P1:** a narrative/object reveal tied to a discovery. New worlds are optional later work, not a prerequisite. |
| Every level changes something | Legacy XP/levels, proof-based counter lessons, missions, badges, cabinet | Level numbers currently do not define new play; main café discoveries do not feed legacy XP | **P0:** specify one first-discovery unlock and its effect. Preserve old XP; do not add a second unexplained grind meter. |
| Discovery Rank / skill tree / chapter progression | Existing prerequisite lesson proofs and finite episode IDs | These distinct systems are absent; there is no approved ten-level or six-chapter graph | **P1/later:** validate a small milestone sequence, then decide which progression systems are actually necessary. |
| Meaningful rewards | Story cards, keepsakes, personal cup colors, first-lesson bonuses | Most rewards record completion, rather than open a new action or investigation | **P0:** one reusable functional/narrative reward for a distinct finding; equal story cards remain. |
| Personal Discovery Journal | Saved sessions, notes/next change, A/B pairs, radar/search/rebrew, real-brew records | Fragmented tools; no shared hypothesis/evidence/conclusion view or retrieval across mysteries | **P0:** an additive view linking existing IDs and contexts. Do not merge raw stores or auto-promote reflections to evidence. |
| Sustainable return | Fourteen visit teasers, finite daily shelf, owner memory, cabinet, replay | Finite content, repeated motor loop, no weekly expedition/content operations; human return unmeasured | **P1:** a new question unlocked by the first case, with no date punishment. Test voluntary return before expanding content volume. |
| Social discovery | No-login play and JSON export | Export is not a playable challenge, co-op or referral system | **P1 after core validation:** a bounded versioned guest challenge, comparing predictions/evidence rather than inviting solely for a bonus. |
| Ethical F2P | Free local play; no paywall or payment code | No economy, transactions, premium content entitlement or commerce/marketplace operations | **Defer:** preserve free access. Currency and monetization are not required to prove the pilot. |
| Three distinct conversions | Optional First Shift fun/return-intent fields and local visit/session history | No event pipeline, cohort denominators, curiosity funnel or payment funnel | **P0 design / approved implementation later:** define minimal events and consent/data handling. Payment conversion stays unavailable until a separately approved payment release. |
| Millions of players | Static CDN-compatible delivery, local guest play, lightweight drawing | No observed product-market fit, load/operations evidence for shared services, localization beyond VI/EN or safety/operations plan for UGC | **Later:** validate appeal first; address actual shared-service needs separately. Static delivery reach is not evidence of retention or scalable multiplayer. |

## Proposed science boundary

Preserve the distinction between four kinds of result:

1. **Established relationship:** for example, transferring water from dripper to server while both remain on a tared scale does not add/remove mass from that scale, assuming no addition, spill, evaporation or external force/contact. This is suitable for an initial mystery.
2. **Illustrative game dynamics:** current shortened flow/drain timing, assumed retention, strength bands and target-distance scores. These can support game feedback if named correctly, but do not establish real brewer response or taste.
3. **Authored fiction:** characters, acquisition adventures, magical display/rewards and fictional guest preferences. These may be imaginative without being laboratory evidence.
4. **Self-reported real observations:** measurements, provenance and sensory reports entered through the real-brew form. They remain unverified and separate from all game traces.

The supplied Batali et al. 2020 paper is conditional evidence from one lot and batch-drip conditions with matched TDS/extraction, not a universal hand-pour flavor equation. S1/S5 are summaries/marginals, not independent raw sensory trials. WCR vocabulary and SCA/SCAE equipment/chart materials do not calibrate current coefficients or make an “optimal” cup universal. The evidence review in [SCIENCE.md](SCIENCE.md) remains authoritative for these limits.

For the first case, use input/transfer/time traces that the existing model actually records. Do not make grind, temperature or Washed/Natural appear to produce causal sensory differences that the current tasting model does not compute. Promising “a scientifically accurate extraction simulator” would require a separate modeling and experimental-validation workstream.

## Architectural risks and proportionate mitigation

| Risk / inspected basis | Consequence | Minimal mitigation proposed |
| --- | --- | --- |
| Several distinct simulators: `game.js`, `first-pour-model.js`, `cafe-model.js`, `cafe-tasting.js` | Similar-looking cups can expose different assumptions and scores; a unified science claim would be misleading | Attach context/model identity to any new evidence view; reuse a single existing model for the pilot. Do not merge/recalibrate them during a narrative feature. |
| Hard-coded linear 14-episode validation, protocol IDs and old/fresh routes in `cafe-season.js` | Adding arbitrary world nodes or reordering episodes can invalidate old saves or change completed stories | Keep episode/route IDs/order unchanged. Propose separate optional case state; review persistence design before implementation. |
| Progress spread across independent stores with no cross-store transaction | Duplicate rewards or partial saves if a new completion writes journal, XP and unlock separately | Make one authoritative case-completion receipt with stable IDs in an approved additive design; derive views/rewards idempotently. Do not award a durable unlock for a failed save. |
| Different completion meanings: listened, watched, partial, brewed, solved | A story card could be misread as science mastery; a demonstration as personal motor skill | Preserve roles and equal story keepsakes. Discovery reasoning and physical technique achievements need distinct criteria/labels. |
| Legacy XP rewards count and notes; repeated-score mission | Farming can outpace actual discovery; “level” lacks a gameplay consequence | Keep earned XP/history. Version future reward rules and use first-time case proof; do not relabel old XP as Discovery Rank. |
| LocalStorage/IndexedDB, photos and all-history serialization | Quota/write failures, browser clearing, eventual history/performance limits | Preserve existing recovery/export behavior; store bounded new traces, not per-frame logs or duplicated photos. Profile before selecting new storage. |
| Origin-bound saves and proposed domain/VPS | A successful site move can look like total data loss | No migration now. A future origin change needs a tested export/import or other transfer plan, including photos; present limits before switching users. |
| UI closures, full `innerHTML` redraws, DOM reparenting and global `c6s-*` coordination | A new overlay can lose held inputs, drafts, focus or pause ownership | Reuse the existing modal/pause conventions; keep apparatus/control identity across stages and test active cups, drafts and language changes. |
| Standalone builder concatenates a fixed module list and strips import/export lines | A new import style/module can work in Vite but fail on Pages | Add any approved module to the existing build list; validate both artifacts. A bundler rewrite is not required for the pilot. |
| Large cumulative CSS and legacy screens | A generic rule can stretch the apparatus or reintroduce control movement | Scope new UI styles and keep ratio/no-scroll/control-anchor regression checks. Do not replace existing art to hide layout defects. |
| Older smoke scripts assume older navigation/visibility; CI has unit/build checks | A passing unit suite may miss a modal/navigation regression; synthetic dispatch can bypass touch constraints | Select current-screen browser checks and add real pointer/keyboard paths for the pilot. Label inherited test reports accurately. |
| No backend, remote content validation, central analytics or competitive authority | Signed rewards, accounts, verified referrals, moderation and anti-cheat cannot be assumed | Pilot stays local/guest/noncompetitive. Design shared services only when a separately approved feature needs them. |
| Creator recipes verified from user summaries; one exact-timing discrepancy remains | Inflated claims of source verification or endorsement | Preserve source status and uncertainty; obtain permitted primary transcript/source evidence before claiming exact replication. |

## Scope traps to avoid

- Replacing the café with a new adventure engine before testing whether a short case is fun.
- Treating ten or sixty levels as an approved requirement, or filling them with more water-volume quotas.
- Making story/listen/quiet play lose its existing cards or access in order to force a skill funnel.
- Calling every saved brew a discovery, every correct trivia answer an experiment, or exports a social network.
- Requiring a coffee purchase, real equipment, caffeine consumption, account, written note or payment to solve the first mystery.
- Adding a magical bean bonus that changes real-science claims, or calling fictional taste scores biochemical validation.
- Uploading personal notes/photos or using casual ordinal ratings as an ML training set without an approved data/validation plan.
- Introducing Discovery Coins, Six Gems, payments or marketing just to make rewards appear meaningful.

## Uncertainties and decisions for the next approval

| Question | Current evidence | Proposed default for review |
| --- | --- | --- |
| Next version name? | v0.11 and v0.12 are released | Use ROADMAP_V012 as the current-baseline roadmap and preserve ROADMAP_V011 as a pointer. Approve the future release number separately; do not change package/version now. |
| Pages or VPS/custom domain? | Pages release verified via GitHub; VPS provisioning/DNS not audited | Retain Pages for the pilot; resolve hosting separately. |
| Which first mystery? | Transfer/scale relationship is supported and visible; temperature/grind sensory behavior is not validated | Pilot the scale/continuing-drips case described in the roadmap. |
| How much progression first? | Existing legacy XP and story cabinet; no integrated unlock graph | One first-discovery reward and a teaser; sketch three distinct milestones before committing to ten levels. |
| Can watch/accessible play earn a discovery? | Current story cards are inclusive; motor-skill claims must be honest | Allow assisted evidence reasoning to resolve the case, label role, and keep physical-skill achievements separate. |
| Where does analytics data go? | No telemetry/backend exists | Local bounded diagnostic prototype first if approved; collection service, identity, consent, retention and export policy require an explicit decision before transmission. |
| Does the new loop retain non-coffee players? | Only prior synthetic/persona reviews; no representative D1/D7/D30 results | Run an observed non-drinker/curious-player pilot, then a measured cohort if justified. |

None of these uncertainties blocks delivering this analysis. They are decisions to approve before dependent implementation or release, not reasons to reset current progress.
