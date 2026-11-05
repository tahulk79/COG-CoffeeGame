# Farm & Café V3 — Architecture & module contracts

Code is the source of truth; this file fixes the seams between modules so they can be built in parallel.

## Layers

| Layer | Path | Rules |
|---|---|---|
| Config (data-driven economy, layout, world) | `src/core/config/*.js` | Only place with numbers (prices, timers, sizes, positions). UI/scene read from here. |
| Core logic (pure, Node-testable) | `src/core/{state,derive,game,tutorial,migrate,store}.js` | No DOM, no Three. `store.dispatch(type, payload, {txId})` is the ONLY way to change the save. |
| 3D world | `src/features/realm/` | Renders the save, turns taps into store actions, camera, placement preview. |
| HUD / UI | `src/features/hud/` + `src/ui/styles/v3.css` | DOM only. Minimal HUD, contextual action bar, sheets, confirm modal, toasts, tutorial bubble + hand. |
| Story & app shell | `src/app/game.js`, `src/features/teacher/`, `src/features/atlas/`, existing `selection/`, `intro/` | Phase state machine driven by `store.state.story.phase`. |
| Tests | `tests/core/*.test.mjs` (`npm test`), `scripts/economy-sim.mjs` | |

## Save & store

- Key `godbean-v3` (`V3_KEY` in `src/state/storage-keys.js`; dev `?profile=test` → `godbean-v3@test`, isolated from real data).
- Old v1 keys are read once for migration and never written by V3. Settings stay in the v1 key (`src/state/progress.js` `readSettings/saveSettings`).
- `createStore({ key: V3_KEY, legacyKeys: { progress: PROGRESS_KEY, player: PLAYER_KEY }, dev: DEV_PROFILE })`.
- `store.state` (read-only!), `store.dispatch(type, payload, opts)` → `{ ok, error, data, events, noop, duplicate }`, `store.subscribe((state, events, type) => …)`.
- Actions (see `src/core/game.js`): `character/set`, `story/introDone`, `story/teacherDone`, `story/seen`, `world/enterRegion`, `country/unlock`,
  `farm/plant {plotId, crop}`, `farm/harvest {plotId}`, `shop/spawnCustomer {roll, look}`, `shop/customerLeft {orderId}`, `shop/takeOrder`, `shop/brew`, `shop/serve`,
  `build/place {type,x,z,rot}`, `build/move`, `build/upgrade {uid}`, `land/buyParcel {parcelId}`, `land/openRoad {roadId}`,
  `staff/hire {type}`, `staff/assign {uid}`, `staff/unassign {uid}`, `round/unlock {round}` (+txId), `expiry/execute`, `rebirth/perform {blessing}` (+txId),
  `tutorial/set`, `dev/grant {coins,xp,beans}`, `dev/ripen`.
- Events emitted (in subscribe): `levelUp, expiryTriggered, regionExpired, regionEntered, regionFirstVisit, planted, harvested, customerArrived, customerLeft, orderTaken, brewStarted, served, built, moved, upgraded, parcelBought, roadOpened, hired, assigned, unassigned, roundUnlocked, countryUnlocked, reborn, creditsGranted, creditsAdded`.
- Error codes (`result.error`): `coins` (data.missing), `level`, `round`, `roundCap`, `maxLevel`, `limit`, `locked`, `notOwned`, `occupied`, `notReady`, `storageFull`, `beans`, `busy`, `noCustomer`, `noOrder`, `queueFull`, `outside`, `wrongZone`, `overlap`, `blocked`, `road`, `slotsFull`, `noCredits`, `maxStacks`, `expired`, `countryLocked`, `paused`, `notPlaying`, `unknown`.
- Selectors: `src/core/derive.js` (level, levelProgress, region, capacity, plotState, drinkPrice, brewMs, queueCap, arrivalMs, placementError, buildError, upgradeError, upgradeCost, parcelError, roadError, staffError, freeSlots, roundStatus, regionAccess, rebirthError, unlockedCrops, unlockedDrinks, seedCost, graceActive, footprint, snapPosition, ownedPlots, assignedUnits, levelCap, buildingLevel).
- Tutorial: `currentStep(state)` from `src/core/tutorial.js` → `{index, step:{id, target}}` or null.

## Story phases (`state.story.phase`)

`select` → (character chosen) `intro` → (intro cinematic ends/skip) `teacher` → (Teacher explains rebirth, grants 3 credits) `gate` → (World Gate → atlas, pick country+region) `play`
→ Level 10 first time: `expiry` (gameplay paused; cinematic; `expiry/execute`) → `chooseRegion` (atlas) → `play`. Reload in any phase resumes that phase.

## Target descriptor (shared by realm, HUD, tutorial)

```js
{ kind: 'plot', id: 'F1-1' } | { kind: 'building', uid, type } | { kind: 'parcel', id: 'F2' } | { kind: 'road', id: 'southWest' } | { kind: 'gate' }
```

## Realm API (`src/features/realm/index.js`)

```js
const realm = await createRealm({ renderer, store, gender, hooks });
// hooks: { onSelect(target|null), onResult(actionType, result), onWalkToGate() }
realm.scene; realm.camera;
realm.update(dt, time); realm.resize(w, h); realm.dispose();
realm.handleKeyDown(e); realm.handleKeyUp(e); realm.clearInput();
realm.setInputLocked(bool);
realm.select(target|null);          // Area Focus camera + highlight; null → back to Exploration
realm.focus(target, { zoom }); realm.resetCamera();
realm.cinematic(name) → Promise;    // 'expiry' | 'round' | 'country' | 'rebirth' | 'arrive'
realm.setActiveCrop(cropId); realm.activeCrop;
realm.startPlacement(type, { uid }) ; realm.rotatePlacement(); realm.confirmPlacement() → result; realm.cancelPlacement();
realm.placement;                    // { type, x, z, rot, valid, error } | null — HUD shows ✓ / ↻ / ✕ buttons
realm.setTutorialTarget(target|null);
realm.screenPoint(target) → { x, y, visible };   // CSS px, for DOM labels / tutorial hand
```
Tap rules (no modal): empty owned plot → plant with active crop; ready plot → harvest; drag across plots → plant/harvest all in the drag (mode from first plot);
order counter → `shop/takeOrder` (if a customer waits) else select; brew counter → `shop/serve` if a cup is ready, else `shop/brew` if an order is taken, else select;
other building / for-sale parcel / locked road / gate → select (HUD shows the action bar); ground → walk there.
The realm owns customer spawning (timer = `arrivalMs`, patience = `SHOP.patienceSeconds`) and spawns one immediately when the tutorial needs a customer.

## HUD API (`src/features/hud/index.js`)

```js
const hud = createHud({ store, realm, dev, onOpenAtlas, onOpenSettings });
hud.setSelection(target|null); hud.toast(text, tone); hud.update(dt); hud.dispose();
hud.confirm({ title, body, cost, confirmLabel }) → Promise<boolean>;   // only for Round/Country unlock and Rebirth
hud.dialogue(lines) → Promise;     // Teacher speech bubble overlay (used by expiry/round cinematics)
```

## Locale packs (each owner adds its own file; registered in `src/i18n/index.js`)

`src/i18n/locales/v3-realm.js` (`realm.*`), `v3-hud.js` (`hud.*`, `err.*`, `crop.*`, `drink.*`, `building.*`, `staff.*`, `blessing.*`, `tut.*`), `v3-story.js` (`story.*`, `atlas.*`, `country.*`, `regionName.*`). Every key needs `en` and `vi`.
