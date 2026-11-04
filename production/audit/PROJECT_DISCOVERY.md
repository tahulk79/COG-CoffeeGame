# PROJECT DISCOVERY — COG "Chuyện một quán cà phê"

- SHA gốc: `d8fdf771cff18509aecf41a8b1f1b0ff83fcd684` (HEAD, nhánh `audit/game-studio-playtest-optimization`, 4 commit).
- Phương pháp: đọc code (working tree, gồm thay đổi chưa commit). Có một kiểm tra runtime duy nhất: `curl http://localhost:5174/` trả 200. Chưa chơi thử, chưa đo hiệu năng. Mọi dẫn chứng ghi theo `file:line`.

## 0. File chưa commit (theo `git status --porcelain` lúc audit)

Đã sửa (M): `.claude/skills/threejs-h5-performance-engineer/SKILL.md`, `.claude/skills/threejs-h5-performance-engineer/scripts/bench-init.js`, `docs/asset-pipeline.md`, `package.json`, `package-lock.json`,
`src/characters/load-player.js`, `src/features/cafe/game.js`, `src/features/farm/assets.js`, `src/features/intro/scene.js`, `src/features/selection/scene.js`, `src/shared/three/models.js`,
48 file GLB: `public/models/{girl,male}.glb`, `public/models/cafe/*` (15 file), `public/models/farm/*` (11 file), `public/models/heaven/*` (8 file), `public/models/intro/*` (8 file), `public/models/selection/{backdrop,stage}.glb`.
Chưa theo dõi (??): `.claude/skills/threejs-h5-performance-engineer/scripts/imgdiff.py`, `.../scripts/tracetop.py`, `scripts/optimize-models.mjs`.
Theo SKILL.md (dòng 51), đây là đợt nén meshopt cho mọi GLB cộng `MeshoptDecoder` trong loader dùng chung.

## 1. Công nghệ

- `three@^0.185.0` là dependency runtime duy nhất (`package.json`). Không dùng framework UI (không React/Vue): vanilla JS ES module, DOM tĩnh trong `index.html`, CSS trong `src/ui/styles/*.css`.
- Dev: `vite@^7`, `@gltf-transform/*` và `meshoptimizer` (để nén model, `scripts/optimize-models.mjs`). Script npm: `dev` (`vite --host 0.0.0.0`), `build`, `preview`. **Không có script `test`**. Có `tests/*.test.js` (dùng `node:test`, 33 test case) và `scripts/balance-sim.mjs`, chạy tay bằng `node`.
- Font Baloo 2 tải từ Google Fonts (`index.html:8-10`). Audio đi qua WebAudio, chọn ogg hoặc m4a (`src/shared/audio/index.js:5-10`).
- GLB nạp qua một `GLTFLoader` dùng chung có `MeshoptDecoder` (`src/shared/three/models.js:6`), cache theo URL (`:21-30`). Không dùng DRACO hay KTX2.
- Không có backend: mọi thứ lưu trong `localStorage`.

## 2. Kiến trúc

```
index.html → src/main.js (cài icon, chờ iconsReady) → app/game.js startGame()
app/game.js: 1 WebGLRenderer + 1 setAnimationLoop(frame) + máy trạng thái
  state ∈ loading | selection | transition | playing(intro) | heaven | farm | error
  activeScene = { scene, camera, update, resize, dispose, handleKeyDown/Up?, clearInput?, ... }
features/selection  → createSelection   (dynamic import)
features/intro      → createIntro + attachModels(INTRO_MODELS)
features/heaven     → createHeavenGame(player, onComplete)
features/farm       → createFarmGame(...)  ── lồng cafe: features/cafe/game.js (createCafeGame)
shared/world/scene.js: createAdventureScene (dùng cho heaven, farm, cafe): ánh sáng, nav, camera, slot asset
state/progress.js: đọc/ghi localStorage
```

- Mỗi màn được `import()` động (`app/game.js:73,93,187,211`), nên Vite tách chunk.
- Quán **không** là một state của app: quán nằm bên trong farm. `farm.scene` và `farm.camera` trả về của quán khi `cafeGame` đang bật (`farm/game.js:792`). Quán dựng một lần rồi giữ lại (`cafeKept`), rời quán chỉ `leave()` (`farm/game.js:768-789`).
- Model dữ liệu farm và quán là một: `createFarm()` (`farm/model.js:30`) giữ cả `progress.cafe`. Quán gọi `farm.act('cafe', …)`.

## 3. Render loop (`src/app/game.js`)

- Renderer (`:171-174`): `antialias` tắt trên máy cảm ứng có DPR ≥ 2. Có `PCFShadowMap`, `ACESFilmic`, `SRGB`. Exposure đổi theo màn: .95 / intro 1.15 / heaven 1.05.
- `frame(now)` (`:124-148`): `dt = min(raw, .1)`. Intro: tua theo `elapsed` và `PLAYBACK_RATE`. Heaven và farm: gọi `update(dt, visualTime)` rồi `watchFrame(raw)`. Selection: cập nhật CSS var `--fx/--fy/--fw/--fb`. Cuối frame luôn `renderer.render`.
- Tự hạ chất lượng (`:39-58`): khi > 60% thời gian của cửa sổ 2 s có frame chậm hơn 1/25 s, hạ high→medium→low (`ui/settings.js:124-134`). Sau mỗi lần hạ có 5 s ân hạn. Frame > 250 ms thì đặt lại bộ đếm.
- Tab ẩn: `setAnimationLoop(null)` (`:269-273`). Khi `blur` thì `clearInput`.
- Mức chất lượng (`shared/vfx/index.js:4-8`): low (DPR 1, không bóng, 120 hạt) / medium (DPR 1.25, có bóng, 400 hạt) / high (DPR 1.5, có bóng, 800 hạt). Mặc định theo máy (`state/progress.js:67-72`): `deviceMemory ≤ 2` hoặc `hardwareConcurrency ≤ 4` thì low, có cảm ứng thì medium, còn lại high.
- Shadow map 1024² ở selection, intro và world dùng chung (`selection/scene.js:31`, `intro/scene.js:58`, `shared/world/scene.js:25`). Farm tắt castShadow cho cảnh nền (`farm/game.js:38`).
- Mỗi lần vào màn có `compileAsync` để làm nóng shader (`app/game.js:77,98,194,218`). Màn cũ chỉ bị `dispose()` sau khi màn mới sẵn sàng.

## 4. Chuyển màn

| Từ → tới | Kích hoạt | Code |
|---|---|---|
| boot → farm | save có `heaven.completed` **hoặc** có `farm` | `app/game.js:179-182` |
| boot → heaven | save có `introCompleted` | `:183-186` |
| boot → selection | còn lại | `:187-200` |
| selection → intro | submit form, tên cắt còn 20 ký tự, `savePlayer` | `:203-227` |
| intro → heaven | `elapsed ≥ DURATION` (23.5 s) hoặc nút Bỏ qua → `completeIntro()` | `:108-112`, `intro/timeline.js:5` |
| heaven → farm | qua cổng sau khi chọn quà → `journey.returnHome()` → `enterFarm(gift, correctQuestionIds)` | `heaven/game.js:125-126`, `app/game.js:95` |
| farm ↔ cafe | nút HUD `cafe-play` / mục tiêu `serve` → `enterCafe()`; Esc hoặc nút thoát → `exitCafe()` | `farm/game.js:525,680,769-789` |
| lỗi | `fail()` hiện thẻ lỗi với 2 nút "Tải lại" và "Thử đồ họa thấp" (ghi `quality: 'low'`) | `app/game.js:149-166` |
| reset | Cài đặt → xoá tiến trình → `resetProgress()` + reload | `ui/settings.js:116-119` |

Lần đầu vào quán có màn loading, chờ model tối đa 4 s (`farm/game.js:783`).

## 5. Save/Load

### Key
- `cog-coffee-progress`: toàn bộ tiến trình, `version: 1` ở cấp 1 (`state/progress.js:3,10`). Nếu sai version hoặc JSON hỏng thì `{}`, coi như chơi mới.
- `cog-coffee-player`: `{gender, name}` (`state/progress.js:98-111`). **Reset không xoá key này.**

### Trường cấp 1 (`state/progress.js`)
`version`, `introCompleted`, `chapter` (2 hoặc 3), `accident` (`'sign-head-bump'`), `heaven`, `startingGift`, `farm`, `settings`.
Mọi hàm ghi đều đọc lại rồi spread để merge (`:17,30,93`). Biến `locked` chặn mọi lần ghi sau reset, trừ `saveSettings`.

### `settings` (`:72-96`)
`version, master, music, ambience, sfx, ui` (0..1), `muted`, `quality ∈ low|medium|high`. Có chuẩn hoá khi đọc.

### `heaven` (version 2, `heaven/journey.js:33-101`)
`metReaper`, `answers{expertId:[{questionId,optionId,correct}]}`, `revealed`, `gift ∈ seeds|tools|capital`, `completed`. Snapshot ghi thêm `answered` và `passed`.
Migration: save cũ không có `version 2` thì dùng `passed[expertId]`, coi như N câu đầu trả lời đúng (`:24-28`). Có 3 chuyên gia × 2 câu (`heaven/content.js`).

### `farm` (version 3, `farm/model.js:30-134`, chuẩn hoá mỗi lần tải)
Các trường chính: `version:3, timingVersion:3, deploymentVersion:1, staffRoutineVersion:1, contractVersion:1`, `gift, giftApplied`, `coins` (mặc định 200), `xp`, `fields[]`, `archivedLand`, `upgrades{soil,fence,pond,well,tools,dryer,roaster,storage,delivery,cafe}`, `seeds{robusta,arabica,liberica}`, `fertilizer`, `water`, `canLevel`, `stock`, `lots[]`, `sequence`, `stats{harvested,watered,weeded,dried,roasted,ground,sold,expanded,orders,delivered,served}`, `claimed[]`, `orderIndex`, `order`, `lastAt`, `epoch`, `reservoir`, `durability`, `rejectedCandidates`, `workers[]`, `cafe{…}`, `today`, `market{day,sold}`, `orders[]`, `lastOrderDay`, `lastTaskCycle`, `directives{care,plant,plantCrop,process,fertilize}`, `journal[≤60]`, `reputation`, `ledger[≤60]`, `offline`, `plots[48]`, `machines{dryer,roaster}`, `lessons{learned,granted,asked,askedDay,askedCount}`, `tutorial.seen[≤100]`, `decorations[≤100]`, `robotGift{state,cups,walkRep,reported,tally}`, `legacyBackup`, `workRevision`.
`cafe`: `stock, lots, shipments, open, reputation(10..100), served, lost, revenue, costs, autoSupply, reserve, supplies, gear, crew[≤10 + gift], tables[12], mastery`. Khách, ly đang pha và ca đang chạy **không lưu** (`model.js:93-94`).

### Migration trong `createFarm`
- v1 (`cherries`, `beans`, `seeds` dạng số) và v2 → v3: nhân stock ×100 (đổi đơn vị sang gram), stock `green` và mẻ `huller` cũ đổi thành `dried` (`:35-39`). Bản gốc v1/v2 được giữ trong `legacyBackup` (`:55`).
- Thời gian cây: chuẩn hoá `growthMs` theo `timingVersion` (`:78`). Mẻ máy cũ chưa có `timingVersion` được xếp lại hàng (`:90`).
- Crew quán: từ `staff{role}` sang `crew[]`, đổi tên `robo-pha` thành `gift-pha`, `robo-b*` thành `gift-bung` (`:99-104`).
- Bỏ hệ thống cũ: cá trong ao được bán 8 xu/con, mẻ máy xay farm hoàn hạt rang (`:126-128`). Farm giữ tối đa 1 robot và 2 thợ, người dư được hoàn phí tuyển (`:112-125`).
- Quà thiên đàng chỉ áp một lần nhờ `giftApplied` (`:172-176`). Phần thưởng bài học chỉ trả một lần nhờ `lessons.granted` (`:178-188`).
- Save không có `tutorial.seen` thì tự đánh dấu các gợi ý mà người chơi đã vượt qua (`:190-195`).

### Khi nào ghi
- Farm: mỗi `act()` thành công thì `commit` ngay (`model.js:684`). `tick()` autosave mỗi ≥ 5 s (`:323`). `flush()` chạy khi vào quán và khi dispose. **Không có handler `pagehide`/`beforeunload`** (grep toàn `src/`). Nhưng vì `advance()` tính lại từ `lastAt` khi tải, phần tiến trình thụ động không bị mất.
- Heaven: mỗi bước (gặp Thần Chết, trả lời, reveal, chọn quà, về) đều `commit` (`journey.js:49-95`).
- Ghi lỗi (storage bị chặn) thì hiện toast một lần, game vẫn chơi tiếp trong lượt (`farm/game.js:50-52`, `heaven/game.js:221-225`).

## 6. Hằng số thời gian (`farm/rules.js`, `farm/content.js`)

| Hằng | Giá trị | Ý nghĩa |
|---|---|---|
| `DAY_MS` | 60 000 ms | 1 ngày thời tiết. Ngày `%7 ∈ {3,4}` thì mưa (`model.js:229`) |
| `SEASON_MS` = `WORK_DAY_MS` | 360 000 ms (6 phút) | 1 vụ (regrow), 1 ngày công thợ, chu kỳ hồi giá chợ |
| `OFFLINE_MS` | 8 giờ | Trần thời gian offline tính cho cây, hồ chứa, cỏ |
| `CAFE_SHIFT_MS` | 240 000 ms (4 phút) | 1 ca quán, 1 kỳ trả lương nhân viên quán |
| Cây `growMs` | vối 90 s, chè 120 s, mít 150 s; mít regrow ×1.1 | `content.js:3-5` |
| Máy | sân phơi 30 s/mẻ, lò rang 18 s/mẻ (chia cho `efficiency(level)`) | `content.js:42-43` |
| Giao hàng farm→quán | 10 s / `efficiency(delivery)` | `model.js:374,484` |
| Đơn hàng | hạn 8 × `DAY_MS` | `model.js:225` |
| `INCIDENTS.phoneMs` | 40 s; `RUDE_WARN_MS` 3 s | `rules.js:83`, `cafe/service.js:62` |
| Intro | `DURATION` 23.5 s | `intro/timeline.js:5` |

## 7. Tiến độ offline (`model.js:241-289`)

- `advance(at)`: `from = max(lastTick, at − 8h)`. Cây, nước, cỏ, sức khoẻ, hồ chứa và độ bền rào chỉ tính trong `seconds` đã bị chặn ở 8 giờ.
- Mẻ máy dùng `readyAt` tuyệt đối, chuyến giao dùng `readyAt`. Cả hai hoàn tất bất kể thời gian vắng dài bao nhiêu.
- Khoảng vắng > 60 s: hợp đồng thợ (`shiftUntil`, `restUntil`) và ca nhân viên quán (`paidUntil`) được **dời** đi đúng bằng thời gian vắng, tức nhân viên tạm dừng (`:275-278`).
- Quán không tự bán khi vắng. `lastAt` bị kẹp ≤ now nên đồng hồ lùi không gây lỗi (`:59`).
- `progress.offline = {seconds, message}` được gán (`:287`) nhưng **không có nơi nào đọc** (xem ISS-02).

## 8. Vòng chơi cốt lõi từng màn

- **Selection** (`selection/scene.js`, `app/game.js:229-261`): chọn nam hoặc nữ (bấm, vuốt, mũi tên), đặt tên ≤ 20 ký tự hoặc random rồi bấm "Vào Game".
- **Intro** (cutscene ~22 s): tai nạn, Thần Chết, cổng trời. Bấm, Enter hoặc nút ▾ để nhảy thoại. Có nút Bỏ qua.
- **Heaven**: đi bằng joystick, WASD hoặc bấm. Lần lượt gặp Thần Chết, 3 chuyên gia (mỗi người 2 câu trắc nghiệm, trả lời đúng hay sai đều có dấu), reveal, chọn 1 trong 3 quà (`seeds` +6 hạt và 6 phân / `tools` quán cấp 2 / `capital` +150 xu), rồi qua cổng. Mỗi câu đúng thành 1 "mẹo" có hiệu lực ở farm (`model.js:178-188`).
- **Farm**: trồng → tưới/làm cỏ/bón/tỉa → hái quả → sân phơi (quả → nhân sạch, 600→100) → lò rang (100→84) → bán ở chợ (giá giảm dần trong ngày công, `rules.js:11-15`), giao đơn shop, hoặc chuyển hạt về quán. Mở rộng 4 ruộng (giá 0/120/180/300, phải liền kề), nâng cấp 10 hạng mục (tối đa cấp 20, riêng quán cấp 10), thuê thợ (tối đa 2, kèm 1 robot), đặt trang trí. Save mới có sẵn 4 cây chín và 4 cây đang lớn (`model.js:74`), 200 xu, 6 hạt vối.
- **Cafe**: mở cửa → ca 4 phút có mục tiêu (`4 + rank + 6×helpers`, 3 bậc ×1/1.4/1.8) → khách xếp hàng → nhận order ở quầy thu ngân (đứng yên thì tự nhận) → tự pha ở bench (minigame, cho điểm) → bưng ra bàn → nhận tiền và tip. Ly chủ quán tự pha bán ×2 (`OWN_CUP`). Có thuê và đào tạo 5 vai, nâng cấp gear và bàn, nhập vật tư. Quán mở đầu với 600 g hạt "starter" (`model.js:120`). Chế độ học: chưa thấy `cafe-intro` hoặc chưa bán ly nào thì tối đa 2 khách và không bị trừ uy tín (`service.js:73-75`).

## 9. Điều kiện mở khoá

- Chuỗi quest (`content.js:73-83`): harvest → serve → dry → roast → sell → ship → expand → water → weed. Mỗi quest thưởng xu và XP. Cấp từ bảng `LEVEL_XP` [0,30,90,190,350,600,950,1400,2000,2800], quá cấp 10 thì theo công thức bậc hai (`content.js:7,97-98`).
- HUD (`content.js:87-95`): `cafe-play` sau quest harvest; `seed-shop` khi tới quest sell, hoặc đã bán, hoặc hết giống; `order-board` khi tới ship hoặc đã có đơn; `upgrades` khi cấp ≥ 2; `workers` khi xong expand hoặc cấp ≥ 3; `build` khi xong weed hoặc cấp ≥ 4; `tools` khi xong expand, hoặc có ≥ 2 ruộng, hoặc cấp ≥ 3.
- Giống: chè cần cấp 2, mít cần cấp 3 (`content.js:3-5`). Nâng cấp tài sản lên cấp N cần farm cấp N (`rules.js:36`).
- Món quán: cần gear đủ cấp và đủ uy tín (`cafe/recipes.js:249-253`). Bàn trong nhà theo cấp thiết bị quán (3→10 bàn). 2 bàn sân vườn cần gear `terrace`.
- Robot gift ở quán (10 ly): khi HUD `workers` mở (`model.js:128-140`).
- Đơn quán tự sinh mỗi ngày khi có thợ ở farm, tối đa 2 đơn mở (`model.js:236-238`).

## 10. Tham số URL và debug

| Tham số | Tác dụng | Code |
|---|---|---|
| `?fps` | Hiện overlay fps · draw call · quality | `app/game.js:42-49` |
| `?debug=incident` | `window.__forceIncident(id,type)`, `window.__incidentOdds(id)` (farm, ghi đè khi ở quán) | `farm/game.js:70-73`, `cafe/debug.js:10-15` |
| `?debug=grid` (trong quán) | Lưới đi được, điểm layout, route. Phím G vẽ lại, H xem layout tối đa. Có `window.__cafeLayoutAudit`, `__cafeBlockersAt(x,z,pad)`, `__cafeAuditMax()` | `cafe/game.js:437`, `cafe/debug.js:19-114` |
| `import.meta.env.DEV` | Cảnh báo emoji thiếu icon | `ui/icons.js:186` |

Không có cheat tiền, tua thời gian hay nhảy màn qua URL. Muốn nhảy màn thì phải ghi `localStorage` trước (ví dụ `{version:1,introCompleted:true}` để vào heaven, hoặc có `farm` để vào farm).

## 11. `.claude/` của dự án

- **Agents (10)**: `asset-3d`, `cafe-dev`, `economy-integrator`, `farm-dev`, `game-designer`, `gameplay-reviewer`, `playtester`, `sound-designer`, `ui-stylist`, `vfx-artist`.
- **Skills (4)**: `balance-check`, `design-review`, `game-team` (điều phối 10 agent), `threejs-h5-performance-engineer` (có scripts `bench-init.js`, `glbinfo.py`, `heapdiff.py`, `imgdiff.py`, `tracetop.py`).
- **Hook dự án**: không có. `settings.local.json` chỉ cho phép `Bash(git add *)`. Hook toàn cục ở `~/.claude/settings.json`: PreToolUse Bash `guard-git.js`, SessionStart `lark-today.sh`.
- `launch.json` và SKILL.md đều dùng cổng **5173** (`--strictPort`), trong khi dev server đang chạy ở **5174**. Khi đo theo skill cần đổi URL.
- `.claude/debug/farm-grid.jpg` là ảnh debug.

## 12. Tài liệu

`docs/design/` (11 spec: contracts, onboarding-flow, robot-staff, cafe-*, farm-*, round-1-foundation), `docs/game-redesign/01-08`, `docs/3d-redesign/*` (registry, QA checklist), `docs/project-structure.md`, `docs/asset-pipeline.md`, `docs/scene-assets.md`, `docs/farm-gameplay.md`, `docs/heaven-gameplay.md`. Hợp đồng dữ liệu chuẩn nằm ở `docs/design/contracts.md`.

## 13. Lỗi thấy khi đọc code

- **ISS-01 (P3)**: chất lượng bị hạ tự động lại được lưu vĩnh viễn. `lowerQuality()` sửa `settings.quality` trong bộ nhớ, với ghi chú "Session only: never saved" (`ui/settings.js:124-134`). Nhưng `persist()` lưu nguyên object `settings` (`:18-19`) mỗi khi người chơi đổi âm lượng hay mute (`:87,100`). Kết quả: sau một lần tụt FPS, chỉ cần chỉnh âm thanh là mức thấp bị ghi vào save.
- **ISS-02 (P3)**: tóm tắt offline được tính nhưng không hiển thị. `progress.offline` được gán ở `farm/model.js:287` nhưng grep toàn `src/` không có nơi nào đọc. Người chơi quay lại sau nhiều giờ không thấy báo đã có gì xảy ra.
- **Quan sát (không phải lỗi)**: màn "completed" và nút chơi lại của heaven (`heaven/game.js:227-229,190`) gần như không thể tới được, vì app boot thẳng vào farm khi `heaven.completed` (`app/game.js:179`).
