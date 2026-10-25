# Minimal-change roadmap — v0.12 baseline

Status: **implementation proposal; waiting for Product Owner approval**. On 25 October 2026 the owner authorized synchronizing and publishing the planning documents against v0.12. This authorizes documentation publication only, not application/schema changes, dependencies, feature implementation or deployment.

The current application release is **v0.12.0**, release-baseline commit `0ae226764d6248501ec576b343e14c369cba9eec`. This roadmap evaluates future work against that baseline. It does not describe features already delivered in v0.12 or approve a new release number. `ROADMAP_V011.md` remains a compatibility pointer for the earlier handoff; this file is the current planning reference. Do not bump a version before approval.

## What has already shipped

[CURIOSITY-LOOP.md](CURIOSITY-LOOP.md) covers v0.11: varied first visits, optional early handling, flow/scale/quiet goals, a personal cup and the owner's fact-based memory. [PLAY-SCREEN.md](PLAY-SCREEN.md) covers v0.12: one main viewport, paged dialogue, fixed controls and separate notebooks/prompts. Preserve both. The minimal next task is not to implement these changes again.

## Recommended increment: one optional mystery inside the café

Test whether a player who does not like coffee enjoys resolving a small mystery through the existing equipment. Retain the 14 owner-led visits and their normal self/watch/listen paths. Do not rebuild the game, replace its story database, add a new engine or make a world map first.

### Pilot case: “The frozen scale and the moving drops”

Proposed owner invitation, not final dialogue: “I stopped adding water, but the cup is still filling. Has the scale stopped working? Want to investigate?” The scene must show the anomaly before explaining its cause. Avoid another immediate reading-comprehension question whose answer the owner just stated.

| Loop stage | Player experience | Reuse / required addition |
| --- | --- | --- |
| Mystery | Notice the scale holding while coffee continues to transfer | Existing apparatus, scale and drip animation; a brief unresolved owner line. |
| Hypothesis | Predict whether the whole-setup scale rises, falls or stays steady after pouring stops | Structured, optional-to-write choice; no prior coffee terms required. Record before the revealing observation. |
| Experiment | At a fixed cumulative-water target, compare an immediate observation with one after a chosen rest | Existing pause/next flow and collected/input state. Capture two bounded snapshots; keep recipe, scale placement and input constant. The changed factor is elapsed rest, not a hidden temperature/grind effect. |
| Surprise | The receiver gains illustrated water while cumulative input/whole-setup mass stays steady | Display both observations. Duration/transfer amount are explicitly game dynamics, not real brewer yield or timing. |
| Discovery | Choose which explanation the observations support; inspect a hint or retry freely | An evidence-based resolution rule, not “finish brewing” or repeat a fact quiz. Incorrect predictions are useful comparisons, not punishment. |
| Reward | Reveal an optional inspection lens showing the input/transfer path, plus a case memento | Reuse existing SVG states/counters. The lens changes what can be inspected; it is not a decorative XP number or a paid advantage. Exact presentation requires design review. |
| New mystery | A short owner teaser asks what would differ if only the server were weighed | Narrative follow-up only in the first increment. Do not claim an unimplemented second experiment or change the current scale placement silently. |

Scientific scope: the whole setup stays on a tared scale, no water is added/removed during the rest, and spill/evaporation/external contact are excluded in this illustration. Internal transfer does not change total mass. The existing tasting model omits real retention and uses shortened time; state that in the notebook and keep game-unit/time labels visible. Do not call the collected game amount real extraction or predict flavor.

The hypothesis must affect the feedback/evidence comparison. Choosing a rest must produce a visible trace difference where transfer is still occurring; if it has already finished, explain that observation or offer another attempt rather than fabricate a change. Evidence resolution should work with assistance/observation as well as manual motor input, with the participation role retained.

## Work packages, in dependency order

| Package | Proposed scope and likely reuse | Acceptance / stop condition |
| --- | --- | --- |
| A. Case contract and science review | Write final clue, predictions, observable variables, supported conclusion, reward and role handling. Reuse one existing visit and model. | Owner approves the case. Each scientific sentence has a basis/limit. No unsupported taste or grind/temperature consequence is promised. |
| B. Additive case state and evidence adapter | A small model/controller around the existing season/tasting APIs; bounded snapshots of the selected case, not all frame events. Review a new optional persistence design before code. | Existing stores/validators/routes/completed books remain readable and untouched. Failed saving cannot grant a durable duplicate unlock. Resume and raw recovery are specified. No database migration or model rewrite. |
| C. In-scene mystery interaction | Reuse `cafe-season-ui`, `cafe-tasting-ui`, `cafe-screen`, SVG and pause/focus conventions. Replace only the selected invitation/prompt when opting into the case. | Self/watch/listen/quiet routes still work; story keepsakes unchanged. Prediction precedes evidence; controls remain fixed; no compulsory lecture, typing or separate tutorial campaign. |
| D. One discovery-linked reward | One idempotent first-case completion, inspection-lens unlock and memento; keep legacy XP as legacy. | Replaying gives practice/feedback but no duplicate first-discovery reward. Unlock visibly changes available inspection, is free and does not gate existing story access. |
| E. Journal link/view | Reuse existing baseline comparison and record IDs. Add a compact hypothesis → observations → conclusion card with links to existing relevant history. | No destructive merge. Label illustrative traces, personal reflections and real observations separately. Missing/deleted baselines are shown honestly. Writing a note is optional. Preserve exports and photos. |
| F. Minimal measurement, if separately approved in the implementation scope | Event definitions below; a bounded local diagnostic log can validate event correctness without a collection service. | No network upload unless destination, data handling and consent are approved. No photo, OCR text, personal journal text or sensory report in analytics. |
| G. Verification and human review | Current model tests plus focused browser flows, then observed player sessions. | Functional acceptance first, qualitative review second. Human feedback determines whether to refine or expand; no marketing/deployment is implied. |

No calendar estimate is asserted before case/persistence/measurement scope is approved. Packages A–E and G form the gameplay pilot; an analytics collector, payments, co-op and a hosting move are separate scopes.

## Progression: prove one unlock before defining ten levels

Existing XP levels must retain their values and meaning. Do not subtract earned XP, relabel it scientific skill, or silently restart players at a new “Level 1.” A discovery milestone can be derived from a distinct case receipt while a future mapping to player level is reviewed.

Proposed progression sketch, **not three cases authorized for immediate development**:

| Milestone | Concrete change | What would justify expansion |
| --- | --- | --- |
| First supported discovery | Inspection lens opens a new evidence view and owner response | Players understand its effect and want to use it. This is the only full case in the recommended increment. |
| Controlled comparison | A later case enables choosing/comparing two observation conditions | A second genuinely different experiment is designed and supported, not another pour quota. |
| Apply a prior finding | A later linked mystery permits a new object/branch or lab customization | The earlier discovery helps solve a new situation; reward is meaningful to non-drinkers. |

If an MVP needs roughly ten levels, each row in its approved level map must name the trigger, first-time proof, newly available action/story/customization and replay rule. Merge/remove levels that change nothing. Discovery Rank, Skill Tree and World Progression are separate design choices; do not implement all three just to satisfy a list. Sixty levels/six chapters remains a long-term concept.

## Measurement proposal — no telemetry installed

Keep game engagement, coffee curiosity and payments as separate funnels. Existing records/First Shift feedback are useful local artifacts, not a central analytics system.

| Question / metric | Proposed events and definition | Interpretation limit |
| --- | --- | --- |
| First Mystery completion | `mystery_started`, `mystery_completed`; unique eligible first-case players completing / starting, segmented by role and new/returning browser | “Started” is an intentional case start, not page load. Completion requires the case's evidence rule, not merely a served cup. |
| Time to First Discovery | `mystery_started` → first `discovery_unlocked`; retain elapsed wall time and foreground-active duration separately | Pause/hidden time and abandoned/right-censored attempts must be reported, not discarded. Automated clock time is not human play time. |
| Hypothesis/experiment activity | `hypothesis_selected`, `experiment_started`, `experiment_completed`, `evidence_compared`; count completed experiments per active player/session and distinct conditions | More repetitions alone do not prove engagement or learning. Distinguish manual, assisted and demonstration roles. |
| Progression/rewards | `discovery_unlocked`, `reward_granted`, eventual `level_up`; distinct stable case/reward IDs | Emit once for a first completion. Page reload, retry and duplicate UI events must not inflate counts. No level events before meaningful level rules exist. |
| Journal value | `journal_case_opened`, `evidence_compared`, `experiment_revisited` | Log IDs/actions, not written conclusions or tasting content. An open panel is not evidence of learning. |
| D1/D7/D30 | Cohort by first intentional play UTC date; a qualifying return is an intentional mystery/experiment/journal interaction on exact day +1/+7/+30 | Use only matured cohorts; report sample size and identity loss. Local browser IDs cannot reliably deduplicate people or devices. Returning from a reminder differs from voluntary return. |
| Sharing | Future `challenge_share_requested`, `challenge_payload_created`, recipient `challenge_opened`/`challenge_completed` | Share-button intent or payload creation is not proof that another person received or played it. A collector/attribution design is needed for reliable recipient conversion. |
| Invitation conversion | Future recipient challenge starts/completions / unique eligible recipient opens, with bounded attribution and bot/self/duplicate rules | Unimplemented now. Local-only storage cannot verify cross-player referral rewards or defeat cheating. Do not promise it can. |
| Coffee curiosity | Optional `bean_detail_opened`, `recipe_source_opened`, `real_brew_form_started` and an optional self-report | Track post-discovery, voluntary actions separately from required UI clicks. These are indicators, not proof of new coffee consumption, purchase or expertise. |
| Payment conversion | Future eligible players purchasing / exposed eligible players | Not applicable in the pilot. Do not report zero as an observed failed funnel when payment is unavailable. No payment events/integration now. |

Proposed minimal envelope: event ID, schema/event version, app/case version, anonymous browser/session ID if approved, timestamp, case/experiment/reward IDs, interaction role and locale. Add monotonic active-duration information where needed. Define retention, consent, export/delete behavior, log bounds and the collection destination before transmitting anything. Do not use a permanent personal identifier or include free text, photos, OCR output, raw sensory reports or API secrets.

An in-memory/local export pilot can check event semantics, deduplication and timing. It cannot establish a reliable population funnel or cross-device D30. Central analytics is a separately approved delivery step, not a hidden backend dependency in the gameplay work.

## Social discovery follow-up — after the case is fun

The smallest useful future social test is a guest-playable challenge with the same case/version and a bounded set of conditions. The sender invites a friend to predict/explain the observation; both can compare their discoveries. Keep private journal contents out of the payload. Validate IDs/ranges/version and handle unsupported links safely. A static versioned link is a possible prototype, not verified referral or competitive infrastructure.

No inviter reward, co-op room, guild, leaderboard or marketplace is needed for this test. If rewards later depend on genuine recipient actions, review identity, abuse prevention and shared state first. Give social play value beyond the referral bonus.

## Acceptance and evidence plan

Before requesting implementation review/release approval:

1. Existing 129 model tests continue to pass; add meaningful case tests for hypothesis timing, observed differences, evidence resolution, assistance, idempotent rewards, reload and failed/corrupt storage. Do not test only static copy.
2. Validate Vite and standalone Pages artifacts using existing dependencies/workflows in the approved implementation phase. Keep five-pour guides, provenance, real-time timers, OCR and saved model versions intact.
3. Browser-check narrow portrait, landscape, tablet and desktop in VI/EN with actual pointer/keyboard actions: fixed pour controls, apparatus proportions, visible cumulative mass/game-time labels, optional prompt pausing, Escape/focus return and reduced motion.
4. Exercise fresh/classic/completed books, ongoing cups, legacy A/B pairs and a real-brew draft across notebook/language/navigation changes. Compare original stored bytes where immutability is promised.
5. Observe approximately 6–8 volunteers spanning non-drinkers/cozy-game players and coffee-curious players; keep experienced brewers as a separate optional perspective. Do not lead them through the case or require real coffee. Record where they hesitate, whether they choose a prediction, notice the consequence, explain it in their own words and voluntarily start another activity.
6. Ask separately about enjoyment, coffee curiosity and interest in returning. With appropriate agreement, observe voluntary return after 1–3 days and distinguish it from reminder-driven return. This small sample diagnoses usability/motivation; it cannot estimate population D1/D7/D30 reliably.
7. Decide: refine if players still see a quiz/lecture, cannot see their experiment's consequence, or do not understand the unlock; expand only if the interaction provides a credible reason to try another mystery. Numeric success thresholds need an agreed baseline/cohort plan, not invented industry certainty.

The USD 3,000 marketing budget remains unspent and no campaigns are launched. Functional tests alone do not make the MVP marketing-ready. Payment conversion and paid content remain outside this increment.

## Approval requested after analysis

Recommended decision: approve the **single optional mystery + one useful unlock + linked journal evidence** pilot on top of v0.12, retaining Pages and all existing paths/data. Confirm the next release label, case contract, role/reward treatment and whether measurement is local-only or has a separately approved collection plan before dependent work starts.

The initial analysis produced four local documents. The owner subsequently authorized aligning them with v0.12 and publishing this documentation package, including a README index and the old-roadmap compatibility pointer. The proposed root AGENTS instructions remain in [STRATEGIC_HANDOFF.md](STRATEGIC_HANDOFF.md); no AGENTS file or application file is changed. Feature implementation, schema changes, installations and deployment remain unapproved for this planning task. Wait for explicit Product Owner approval of the implementation plan.
