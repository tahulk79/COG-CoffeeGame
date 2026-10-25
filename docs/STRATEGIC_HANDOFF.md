# Strategic handoff — v0.12 baseline · 25 October 2026

Status: product direction recorded; analysis completed; implementation awaiting Product Owner approval. The owner authorized synchronization and GitHub publication of this documentation package on 25 October 2026. That permission does not authorize application/schema changes, installations, deletion of features/data, deployment or marketing.

## Baseline and authority

The supplied handoff calls the application v0.10 and requests a v0.11 plan. The repository has already advanced beyond both versions:

- Canonical repository: `tahulk79/TheCoffeeSixSense`, default branch `main`.
- Observed main: `0ae226764d6248501ec576b343e14c369cba9eec`; package version **0.12.0**.
- PR [#32](https://github.com/tahulk79/TheCoffeeSixSense/pull/32) is merged. GitHub reports successful validation and [Pages deployment](https://github.com/tahulk79/TheCoffeeSixSense/actions/runs/40152595413) for that SHA.
- Current release URL: https://tahulk79.github.io/TheCoffeeSixSense/?v=0.12.0.
- Local application source and selected build metadata were checked against the remote Git tree: 41 files matched. The local Git HEAD is older and the workspace already contains many modified/untracked files; that status does not mean those features are absent from canonical main.

Preserve v0.11 curiosity improvements and v0.12 screen improvements. Do not downgrade to v0.10, recreate completed work or reuse an already released version number. The current roadmap is [ROADMAP_V012.md](ROADMAP_V012.md), based on the released v0.12. [ROADMAP_V011.md](ROADMAP_V011.md) is retained as a compatibility pointer for the incoming handoff. Future implementation and its release number still require approval.

The analysis-only boundary still applies to gameplay and infrastructure. The subsequent owner instruction permits synchronizing and publishing documentation. Earlier permission to implement or deploy does not authorize implementing this new strategy; proposed work below remains unapproved.

## Confirmed product decisions

**Game First. Discovery First. Coffee as the Medium.** C6S should be enjoyable for someone who does not know, drink or initially like coffee. Reaching millions is an ambition to validate, not an established audience or forecast. Becoming a coffee drinker or paying customer is optional.

The selected direction is **C — Hybrid Discovery**: **Real Science. Magical Experience. Endless Discovery.**

- Entertainment precedes instruction. Let players notice, predict, try and discover; explanations should answer their curiosity rather than delay play.
- Ground scientific statements in evidence with explicit conditions. Real-world mass, units and established relationships must remain coherent. The current illustrative models are not validated extraction or sensory predictors.
- Fantasy is welcome in characters, mysteries, staging, worlds and rewards. It must not silently change scientific relationships or present a fictional result as measured coffee science.
- Preserve the owner's role as storyteller and collector of unusual beans, tools and methods. Do not require players to supply the story, own equipment, drink coffee or write tasting notes to participate.
- Preserve optional self-brew, owner demonstration and listen-only visits, accessibility, comfortable pacing and the existing story keepsakes.

## Proposals to evaluate, not implementation mandates

| Area | Direction | Approval boundary |
| --- | --- | --- |
| Gameplay | Adventure + Mystery + Experimentation; `Mystery → Hypothesis → Experiment → Surprise → Discovery → Reward → New Mystery` | Test a small addition within the café, not a replacement of existing gameplay. |
| Progression | Player level/XP, Discovery Rank, Skill Tree, World Progression, collections and achievements | Components are candidates. Approximately 10 MVP levels and 60 levels across six chapters are preliminary targets, not a content quota. **Every level must change something.** |
| Rewards | Functional, cosmetic, narrative, collectible and achievement rewards | Reward a new discovery/problem solved, not repeated brewing or attendance. Keep story cards independent of mastery claims. |
| Economy | Possible earned Discovery Coins; optional future Six Gems | Neither currency is required for the next increment. No premium currency or transactions without a separately approved plan. |
| Monetization | Free-to-Play + Social Discovery + Ethical Monetization | Possible cosmetics, passes, premium adventures, real-world commerce and creator marketplace are future options. No Pay-to-Win, sold mystery solutions or paid competitive advantages. Essential discovery remains accessible. |
| Retention | Daily Discovery, Weekly Expeditions, levels, personal lab/collection, seasons and mysteries/worlds | Favor returning out of curiosity. No punitive streaks, forced repetition or fear of missing content. Fourteen existing visits are finite, not an endless/live-content service. |
| Social | Shareable challenges, guest play, invitations, co-op mysteries, guilds and referral rewards | Prioritize `Play → Discover → Challenge → Share → Friend Plays → Reward`; first establish a challenge worth playing together. No invitation reward system is authorized now. |
| Journal | Persistent Personal Discovery Journal | Extend existing brewing, tasting, history, A/B comparison and exports. Do not discard or combine incompatible data as if equivalent. |
| Lifecycle | Stranger → Player → Explorer → Enthusiast → Resident → Supporter → Ambassador | A conceptual journey, not a forced sequence or a prerequisite for enjoyment. |
| Measurement | Separate game engagement, coffee curiosity and payment conversion | Instrumentation is proposed, not installed. Do not infer curiosity from a required tutorial or payment intent from engagement. |
| Marketing | Initial test budget USD 3,000 | No campaigns or spending before an MVP readiness decision and a separate execution approval. |

## Reconciliation with existing documentation

Older documents remain intact as historical records. For decisions explicitly superseded here, this handoff records the new product direction; actual implementation facts come from source and release evidence.

| Existing statement | Evidence/conflict | Reconciled treatment |
| --- | --- | --- |
| v0.10 is current; v0.11 is next | `package.json`, merged PR #32, main SHA and successful workflows establish v0.12.0 | Analyze current code. [CAFE-TASTING.md](CAFE-TASTING.md) remains the v0.10 history; [CURIOSITY-LOOP.md](CURIOSITY-LOOP.md) and [PLAY-SCREEN.md](PLAY-SCREEN.md) describe subsequent increments. |
| Ubuntu VPS hosting in the new handoff | Latest operating release uses Pages. `production.yml`, Nginx templates and release tooling exist, but do not establish a provisioned/live VPS. Earlier owner instruction explicitly selected Pages. | Keep current Pages architecture. Record VPS as a stated future hosting direction needing explicit reconciliation/approval before any migration. No server/DNS/SSH action in this phase. |
| Planned domain `cf.ta79.com` | Domain appears in historical deployment templates; it is not evidence of active service | Preserve the intended domain. Do not claim DNS, certificate, ownership or production readiness was verified. Cross-origin local data would require an explicit transfer plan. |
| [DEPLOYMENT.md](DEPLOYMENT.md) says no Vietnamese or progression and deploys only `dist/` | Source contains VI/EN, progression and Pages standalone generation | Treat that file as a historical first-VPS runbook, not a current feature inventory. Propose a dated status banner/update in a later approved documentation change. Do not execute its setup commands. |
| Master GDD emphasizes education/better real brewing and `Select → Brew → Taste → Serve → Earn` | New vision puts enjoyable discovery first, including non-drinkers | Retain useful brewing/journal work as optional depth. Pilot mystery/experimentation as an additional way to play, not an immediate rewrite. Preserve the metaphorical, non-physiological meaning of “Sixth Taste.” |
| Master GDD mentions Supabase/Cloudflare and an analytics map | These are design options, not implemented backend/telemetry | Do not install or provision them. Static Pages remains sufficient for a single-player pilot. Backend/social data handling needs a separate plan. |
| Earlier scientific source review was pending | [SCIENCE.md](SCIENCE.md) and its evidence review record supplied documents subsequently reviewed | Use the reviewed-source status, while retaining limitations: no calibrated simulator, raw sensory trial dataset or validated ML model. |
| Earlier daily-shelf documentation says 12 entries | `dailyDiscoveries` now contains 13, including the later Hoffmann recipe entry | Use 13 for the current shelf; retain 12 as the historical first-edition count. This shelf is separate from the 14-visit cabinet. |
| Master GDD gives D1/D7 and other percentage targets | These were explicitly hypotheses; previous persona reviews are synthetic | Do not present targets as benchmarks achieved. Establish a human-test baseline first. USD 300 tooling budget in the GDD is distinct from USD 3,000 marketing. |

## Proposed AGENTS.md addition — not installed

No `AGENTS.md` was found in repository main, the workspace repository, or the checked parent locations. The following is proposed content for a new root file **only after approval**. If instructions appear before implementation, read them and append/reconcile this section; do not overwrite them.

```markdown
## C6S product and preservation guardrails

- Read docs/STRATEGIC_HANDOFF.md, docs/CURRENT_STATE.md and the approved roadmap.
  Verify the actual main/package version; historical handoff filenames are not
  authority to downgrade or rebuild existing features.
- Game First. Discovery First. Coffee as the Medium. Support non-drinkers and
  novices; prefer meaningful experiments to lectures, repetition or attendance.
- Hybrid Discovery: fantasy may shape stories/worlds/rewards, never disguise
  unsupported coffee science as fact. Keep evidence, assumptions, game results,
  personal reflections and self-reported real brews distinct and versioned.
- Preserve the owner's stories, existing episode IDs/routes, journals, photos,
  saved records, exports, recovery behavior, optional play paths and accessibility.
  Do not rewrite old results with new model coefficients or reset saved books.
- Every new level/unlock must name a concrete change in play. Prefer first-time
  discoveries and evidence-based problem solving to repeat-action XP farming.
  Do not retroactively remove earned legacy XP or mislabel it as validated skill.
- Keep current code-drawn cozy equipment, correct proportions, pouring/dripping
  animations, opt-in audio, fixed controls and the main viewport experience.
- Use the existing modular JavaScript/Vite and Pages builds. Do not introduce
  a new engine, backend, hosting migration or broad refactor without justification
  and approval. Inspect pre-existing dirty/untracked work before editing.
- Do not upload photos, journal text or sensory reports as analytics. Analytics,
  sharing and cloud sync need an explicit data/consent plan and a bounded payload.
- No Pay-to-Win, sold mystery answers, premium currency, payment integration,
  campaign spending or live marketing without a separately approved plan.
- Never ask for SSH passwords, private keys or provider secrets in chat.
- Respect the active task's authorization boundary. Analysis-only means no app
  or schema edits, installations, deletions, commits, pushes or deployments.
  After analysis, present a concrete implementation plan and wait for approval.
- Report tests actually run separately from inherited reports and human studies.
  Synthetic personas/browser passes do not establish enjoyment, learning or D1/D7.
```

## Review package

- [CURRENT_STATE.md](CURRENT_STATE.md): inspected systems, classifications and data boundaries.
- [GAP_ANALYSIS.md](GAP_ANALYSIS.md): strategic gaps, architectural risks and evidence limits.
- [ROADMAP_V012.md](ROADMAP_V012.md): minimal future pilot, acceptance criteria and measurement proposal, using v0.12 as the application baseline.

The publication package contains these four current planning documents, a historical ROADMAP_V011 pointer and a README index. The proposed AGENTS text is contained above; no instruction file was created or replaced. Documentation publication is authorized; implementation and release of the proposed features remain paused for Product Owner approval.
