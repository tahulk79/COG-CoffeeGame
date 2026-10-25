# Scale mystery pilot — v0.13.0

Task: `C6S-SCALE-MYSTERY-01`. The owner approved publication, merge and GitHub Pages release after reviewing the local pilot. Version **0.13.0** builds on main `27426f67c4cd451c71e4b4340230d2166b8acb7a`, preserving PR #34's save-retry fix. Source/deployment/runtime evidence is tracked in [SYNC_STATUS.md](SYNC_STATUS.md). The wider roadmap, currency, skill trees, telemetry and hosting changes remain outside scope.

## What changes for the player

During preparation of the Yemen cup, “The scale mystery” offers an optional owner-led investigation. The player predicts whether the whole-setup scale rises, falls or stays steady when pouring stops. Starting the cup uses the same existing input targets, tactile apparatus and clock. At 30 g*, the case holds the simulation so the player can choose an early look (0.25 game seconds) or a one-game-second rest.

Both snapshots come from the existing `tickTasting()` state: input stays fixed while water transfers from dripper to server. An early look and longer rest produce different transferred amounts; no alternative result is invented to match a prediction. The player compares the two traces and selects the conclusion they support. A wrong prediction/conclusion costs nothing; the latter can be corrected without brewing again. Self and owner-demonstration roles remain identified.

A supported conclusion opens an inspection lens. In later café cups it exposes input, water in the server and water remaining in the setup, using that station's existing model. This changes what the player can inspect; there is no new XP, level, currency or repeated reward. The first completion receipt is retained on replay. A final question asks what would happen if only the server were weighed; it does not claim a second case or scale-placement mechanic has shipped.

The case may be abandoned, including in watch mode, without blocking normal pouring, story endings or keepsakes. Listen-only, quiet and ordinary brewing paths remain available. Completed books can access the case through Yemen cabinet practice without rewriting their old story records.

## Scientific boundary

This case demonstrates internal mass transfer with the entire tared setup on the scale and no added/removed water during the observation. The illustration omits evaporation, spill, external hand forces and real grounds retention. Input/collection timing is the existing shortened game model, not measured physical brewer behavior. `g*` remains a game convention. Neither snapshots nor the lens predict taste, pressure, TDS, extraction yield or real skill. A larger reading or longer rest is not a quality score.

The new discovery journal/export is explicitly labeled game evidence and is separate from actual-brew observations, personal sensory reports and old hypothetical journals. No data is uploaded; no analytics or ML training is introduced.

## Implementation and persistence

- `src/discovery-case.js`: pure bounded case reducer, snapshot checks, conclusion/reward and protected loader.
- `src/discovery-case-ui.js`: optional dialogue, observation choices, journal/export and lens, integrated with the current tasting controller.
- Existing recipe quantities, flow/collection model, artwork, episode order, routes and old storage schemas are unchanged.
- New independent key: `c6s.discovery-lab.v1`, schema 1. It holds one active attempt and one first-discovery receipt; no per-frame history or growing reward ledger.
- Context includes the visit/review identity and role checks. Observations are captured at case boundaries; the existing tasting checkpoint is also saved at those boundaries. Reload holds the current cup until explicit input.
- Case receipt and reward are saved in one write. A failed write keeps the session state and reveals a main-screen notice, retry and session download; it does not pretend a durable journal receipt exists. Corrupt/unknown data is retained for recovery rather than overwritten.
- Controls/art/scale stay mounted. Case dialogue uses a native modal; opening it pauses the cup. The inspection panel occupies the coaching area rather than covering scale readings or stretching equipment. Its toggle pauses rather than silently advancing the experiment.

## Verification

135 unit/model tests pass, including six new case tests: both roles and observation durations, wrong/correct conclusions, first-reward idempotence, mismatched/insufficient traces, protected data and a real difference between early/late observations.

The standalone Pages artifact and Vite build pass. `scripts/smoke-discovery-case.mjs` covers five viewport sizes (320×568, 390×844, 820×1024, 1440×900, 844×390), VI/EN, both roles, actual pointer clicks, fixed control positions, optional choices, lens, reload and JSON export. Additional checks cover rest checkpoint/language changes, abandoning watch-mode investigation, quota/retry/corrupt storage, a byte-identical completed fourteen-visit notebook, finishing the cup and using the unlocked lens during the next AeroPress/quiet visit.

Current-screen layout regression checks pass at six viewport sizes in both languages. The updated PR #34 notebook regression has now also been executed here: mid-brew save failure/retry, reloadable checkpoints, source navigation, draft/language retention and archive integrity pass. These are Chromium browser checks, not Safari/device or human enjoyment studies. Earlier source-audit documents remain dated snapshots.

Reproduce with existing dependencies:

```sh
npm test
npm run build:pages
npm run build
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/smoke-discovery-case.mjs
C6S_SCREEN_SKIP_VISITS=1 PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/smoke-cafe-screen.mjs
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/smoke-cafe-screen-notebooks.mjs
```

## Release and follow-up

Review captures: [prediction](review/discovery-case/320-prediction.png), [evidence and reward](review/discovery-case/320-evidence.png), [unlocked lens](review/discovery-case/390-lens.png), [landscape](review/discovery-case/844-lens.png).

Publication and test-site release of this bounded pilot are approved. Verify the exact deployment/artifact before marking it deployed in the shared status. A small observed non-drinker/curious-player study remains necessary to assess whether this is enjoyable and motivates a second discovery; synthetic passes do not establish retention. Future cases and broader progression remain separate product decisions.
