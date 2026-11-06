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
- Actions (see `src/core/game.js`): `character/set`, `story/introDone`, `story/teacherDone`, `story/seen`, `world/unlockRegion {regionId}` (coins; free for the first region and once after the Level-10 expiration), `world/enterRegion {regionId}` (owned regions only),
  `farm/plant {plotId, crop}`, `farm/harvest {plotId}`, `shop/spawnCustomer {roll, look}`, `shop/customerLeft {orderId}`, `shop/takeOrder`, `shop/brew`, `shop/serve`,
  `build/place {type,x,z,rot}` (café buildings only — BUILD_MENU; the retired dryer is refused), `build/move`, `build/upgrade {uid}`, `land/buyParcel {parcelId}` (fields F1–F14, café lots S/C2/C3 — coins only, no Round),
  `staff/hire {type}`, `staff/assign {uid}`, `staff/unassign {uid}`, `round/unlock {round}` (+txId), `expiry/execute`, `rebirth/perform {blessing}` (+txId),
  `tutorial/set`, `dev/grant {coins,xp,beans}`, `dev/ripen`.
- Events emitted (in subscribe): `levelUp, expiryTriggered, regionExpired, regionUnlocked {regionId, cost}, regionEntered, regionFirstVisit, planted, harvested, customerArrived, customerLeft, orderTaken, brewStarted, served, built, moved, upgraded, parcelBought, hired, assigned, unassigned, roundUnlocked, reborn, creditsGranted, creditsAdded`.
  (`country/unlock`, `countryUnlocked`, `land/openRoad` UI and Round-gated land are gone: every road is open, every region is bought with coins.)
- Error codes (`result.error`): `coins`, `level`, `round`, `roundCap`, `maxLevel`, `limit`, `locked`, `notOwned`, `occupied`, `notReady`, `storageFull`, `beans`, `busy`, `noCustomer`, `noOrder`, `queueFull`, `noSeat`, `outside`, `wrongZone`, `overlap`, `onField`, `blocked`, `slotsFull`, `noCredits`, `maxStacks`, `expired`, `paused`, `notPlaying`, `unknown`.
- Selectors: `src/core/derive.js` (level, levelProgress, region, capacity, plotState, drinkPrice, brewMs, brewSlots, queueCap, arrivalMs, placementError, buildError, upgradeError, upgradeCost, parcelError, staffError, freeSlots, roundStatus, ownsRegion, regionUnlockCost, regionAccess (→ `{ok, owned, current, expired}` or `{ok:false, reason:'locked', cost, free, affordable, missing}` / `reason:'expired'` in chooseRegion), seatCount, seatsUsed, rebirthError, unlockedCrops, unlockedDrinks, drinkUnlocked, seedCost, graceActive, footprint, snapPosition, ownedPlots, assignedUnits, levelCap, buildingLevel).
- Tutorial: `currentStep(state)` from `src/core/tutorial.js` → `{index, step:{id, target}}` or null.

## Story phases (`state.story.phase`)

`select` → (character chosen) `intro` → (intro cinematic ends/skip) `teacher` → (Teacher explains rebirth, grants 3 credits) `gate` → (World Gate → atlas, pick country+region) `play`
→ Level 10 first time: `expiry` (gameplay paused; cinematic; `expiry/execute`) → `chooseRegion` (atlas) → `play`. Reload in any phase resumes that phase.

## Target descriptor (shared by realm, HUD, tutorial)

```js
{ kind: 'plot', id: 'F1-1' } | { kind: 'building', uid, type } | { kind: 'parcel', id: 'F2' } | { kind: 'field', id: 'F2' } (realm-internal: sickle badge → harvest the field) | { kind: 'gate' }
```

## Realm API (`src/features/realm/index.js`)

```js
const realm = await createRealm({ renderer, store, gender, hooks });
// hooks: { onSelect(target|null), onResult(actionType, result), onWalkToGate() }
realm.scene; realm.camera;
realm.update(dt, time); realm.resize(w, h); realm.dispose();
realm.handleKeyDown(e); realm.handleKeyUp(e); realm.clearInput();
realm.setInputLocked(bool);
realm.view;                         // 'farm' | 'cafe' — the area on screen (layout AREAS); the other area is hidden
realm.setView(view, { instant }) → Promise<view>; // fade, player + camera to AREAS[view].spawn, clears selection/placement
realm.switching;                    // true while the view fade runs (input locked)
realm.areaOf(target) → 'farm'|'cafe'|null;
realm.select(target|null);          // Area Focus camera + highlight; null → back to Exploration. Other-area target → setView first (Promise)
realm.focus(target, { zoom }) → Promise; realm.resetCamera();   // other-area target → setView first
realm.cinematic(name) → Promise;    // 'expiry' | 'round' | 'country' | 'rebirth' | 'arrive'
realm.setActiveCrop(cropId); realm.activeCrop;
realm.startPlacement(type, { uid }) ; realm.rotatePlacement();   // everything buildable (shop + decor) → café view (switches first, returns a Promise of the info) realm.confirmPlacement() → result; realm.cancelPlacement();
realm.placement;                    // { type, x, z, rot, valid, error } | null — HUD shows ✓ / ↻ / ✕ buttons
realm.setTutorialTarget(target|null);
realm.notices;                      // object notices on screen: [{ key, kind: 'up'|'order'|'noSeat'|'brew'|'serve'|'harvest'|'buy', up, target }]
realm.screenPoint(target) → { x, y, visible };   // CSS px, for DOM labels / tutorial hand; visible:false for other-area targets
```
Views: farm and café are two areas of the same scene (`AREAS` in layout.js); `setView` toggles group visibility (world, buildings, staff, plots, customers) so only one area is drawn. Camera + avatar clamp to `AREAS[view].bounds`. Plots / gate are picked only in the farm view, counters / customers only in the café view. Farm area = fields + storehouse + gate (world.js); café area = Vietnamese city street (city.js) + lots S/C2/C3.
Seats (`seats.js`): CAFE_SEATS terrace stools + 2 chairs per Tables building, same count/order as `derive.seatCount`; taken/brewing customers walk to their seat and sit (`person.userData.seated`), served → cup on the table, customer leaves.
Navigation (`nav.js`): one grid per area (0.5 m, agent radius .45), obstacles = city houses/props + non-walkable building footprints, rebuilt in `syncAll` when the building set changes; `navigate(sx,sz,tx,tz,{exact})` used by `avatar.walkTo`, staff and customers (`exact` lets a customer step onto a chair inside a Tables footprint).
Staff (`staff.js`): per-unit job loop (farm: harvest → replant / plant; barista: deliver ready cup → take order → brew; brewBot: take order → brew), pre-checked with derive helpers and dispatched straight to the store; claims on plots / orders / counter stations (`staff.isClaimed(orderId)` keeps the player off a cup a barista carries); `realm.staffStatus(uid)` for the HUD.
Seated patience: cafe.js dispatches `shop/customerLeft` when `seatPatienceOver`; `customerLeft {angry}` → swear bubble, carried cup dropped, warn toast.
Auto play: realm `updateAuto` (autopilot state machine: decide → walk → act → pause; captions `auto.*`, `realm.autoStatus = { on, caption, target }`), player input / `autoNear` blocked while `state.autoplay.active`; HUD `ctx.isAuto()` / `ctx.blockedByAuto()` gate actions, the tutorial overlay shows the captions, the HUD dispatches `auto/stop {reason:'timeout'}` when `endsAt` passes.
Staff breaks: staff.js dispatches `staff/stop` (slack roll / battery time while working); tap target `{ kind: 'staff', uid }` (fee bubble or body) → `staff/resume`.
Queue: `cafe.queuedOrder(state)` = first waiting order whose customer stands at its queue slot; every takeOrder passes that `orderId`.
Café pads (`pads.js`): two floor pads in the counter lane (PADS in realm index.js); `autoNear` (every 0.2 s) fires takeOrder / pickUp / brew when the player is within NEAR_PAD (1.4 m) of a pad and the action will succeed, and serves when within 1.8 m of the carried cup's customer; counter taps act + walk to the pad and share the cooldown.
Terrace (`buildings.js`, procedural, `walkable` → no collider and no body pick; reached by its ▲): stools/tables of the first `terraceSeats(level)` CAFE_SEATS, rebuilt on level change. Seat order in `seats.js` = active terrace seats, then Tables chairs (matches `derive.seatCount`).
Labels (`util.makeLabel`): the canvas width is rounded to 32 px and the texture is recreated when it changes (three.js keeps the uploaded texture size: a resized canvas silently failed to upload — the old “level not shown after upgrade” bug).
Object notices (`badges.js`): pooled constant-screen-size sprites (sizeAttenuation off, depthTest off), refreshed ~4×/s and on store changes; picked before anything else (tap = tap the object; the sickle pin harvests its whole field). Customers spawn and run patience in either view (rendered only in the café). Region entry and reload start in the farm view. HUD: the toolbar's middle button switches views (`☕ Café` / `🌱 Farm`, badge = waiting customers while on the farm); the tutorial points at it when the step's target is in the other area.
Tap rules (no modal): empty owned plot → plant with active crop; ready plot → harvest; drag across plots → plant/harvest all in the drag (mode from first plot);
order counter body → `shop/takeOrder` (toast on noCustomer / noSeat; never a card); brew counter body → pick up a ready cup and auto-walk it to its seated customer (`shop/serve {orderId}` on arrival; `realm.carrying` = order id in hand), else `shop/brew`, else resume the delivery, else hint toast; seated customer → deliver / pick up their ready cup; ▲ badge → select `{ kind:'building', uid, type, upgrade:true }` (the only way to the Upgrade button, plus the farm Storage button);
other building / for-sale parcel / gate → select (HUD shows the action bar); ground → walk there.
The realm owns customer spawning (timer = `arrivalMs`, patience = `SHOP.patienceSeconds`) and spawns one immediately when the tutorial needs a customer.

## HUD API (`src/features/hud/index.js`)

```js
const hud = createHud({ store, realm, dev, onOpenAtlas, onOpenSettings });
hud.setSelection(target|null); hud.toast(text, tone); hud.update(dt); hud.dispose();
hud.confirm({ title, body, cost, confirmLabel }) → Promise<boolean>;   // only for Round unlock and Rebirth (the atlas has its own inline confirm card for paid regions)
// Toolbar per view: farm = seeds, storage, [view], staff, world, progress; café = build, menu, [view], staff, progress (buttons #hud-btn-<id>).
hud.dialogue(lines) → Promise;     // Teacher speech bubble overlay (used by expiry/round cinematics)
```

## Locale packs (each owner adds its own file; registered in `src/i18n/index.js`)

`src/i18n/locales/v3-realm.js` (`realm.*`), `v3-hud.js` (`hud.*`, `err.*`, `crop.*`, `drink.*`, `building.*`, `staff.*`, `blessing.*`, `tut.*`), `v3-story.js` (`story.*`, `atlas.*`, `country.*`, `regionName.*`). Every key needs `en` and `vi`.
