# Gedeo asset manifest (2026-11-08)

Mục tiêu: nông trại Gedeo (Ethiopia) kiểu "Farming Simulator realism". Nguồn sự thật của 4 cây hero là
`scripts/blender/gedeo_heroes.py` (Blender 5.2, bpy + numpy; chạy lại: `Blender -b --factory-startup -P scripts/blender/gedeo_heroes.py -- --export public/models/gedeo`, rồi `node scripts/optimize-models.mjs public/models/gedeo/*.glb`).
Nạp trong game qua `src/shared/three/gedeo-vegetation.js` (cache, LOD, InstancedMesh, dispose). QA: `/asset-showcase.html`.

## 1. Audit pipeline

| Hạng mục | Trạng thái |
|---|---|
| Blender MCP | Có, Blender 5.2.2 LTS, addon 1.8 |
| Meshy / Tripo / Hyper3D / Hunyuan3D | **Tắt** (không có key / Premium) → không sinh model bằng AI được |
| Poly Haven / Sketchfab / Poly Pizza | **Tắt** |
| Loader | `GLTFLoader` + `MeshoptDecoder` (`src/shared/three/models.js`), mọi GLB nén meshopt |
| Animation | `AnimationMixer` trong `src/characters/motion.js` (nhân vật cũ) |
| Texture | Không có texture farm nào trong `public/assets/farm/*` (thư mục rỗng) |

Vì không có generator, 4 cây hero được **dựng bằng code Blender theo cấu trúc thực vật** (thân/cành phân nhánh có quy luật, lá có hình phiến, card lá vẽ từng lá chét), không phải khối primitive.

## 2. Asset hiện có

| File | Dùng ở | Đánh giá |
|---|---|---|
| `public/models/farm/coffee-tree.glb` | farm hiện tại (instanced) | low-poly cartoon, thay bằng `coffea-arabica-mature` |
| `public/models/farm/{dryer,market,roaster,well}-tier-1.glb`, `worker.glb`, `grounds/props/decor/surroundings.glb` | farm hiện tại | style cũ, cần làm lại theo Gedeo (mục 4) |
| `public/gedeo_coffee_farm.glb` (19 MB, chưa track) | không dùng | 475k tris, không texture; cà phê thưa, Albizia trơ cành, Enset quá nhỏ → **thay thế**, không nên ship |

## 3. Hero assets (đã làm, qua QA vòng 1)

| Asset | LOD0 tris | LOD1 tris | GLB (meshopt) | Draw calls | QA |
|---|---|---|---|---|---|
| Coffea arabica — trưởng thành, quả chín | 44k | 6.7k | 674 / 148 KB | 3 | ✅ dáng đúng (2–3 thân, cành ngang đối chéo, lá đôi elip bóng, chùm quả nách lá) — quả khó thấy từ xa |
| Albizia schimperiana — trưởng thành | 23k | 4.8k | 811 / 448 KB | 2 | ✅ tán dù phẳng nhiều tầng, lá kép lông chim 2 lần — card lá vẫn đọc thành "tấm phẳng" khi nhìn ngang |
| Cordia africana — trưởng thành, ra hoa | 43k | 10k | 1009 / 320 KB | 2 | ✅ thân ngắn, tán tròn rậm, chùm hoa trắng |
| Ensete ventricosum — trưởng thành | 7.6k | 2.6k | 173 / 107 KB | 3 | ✅ thân giả phình có bẹ, lá mái chèo đỏ gân, lá già rách, váy lá khô, không có buồng quả |

Texture: WebP nhúng trong GLB, vẽ tất định theo seed (bark 512², lá 1024–2048). Lá: pháp tuyến "khối tán" bake sẵn,
shader giữ pháp tuyến cả 2 mặt (`foliageShading`), alpha MASK 0.5, bóng đổ có alpha.

Showcase (4 hero LOD0 + 72 cà phê instanced + 7 enset instanced, shadow 2048): 33 draw calls, ~1.17M tris/frame
(gồm pass bóng), 100 fps trên máy dev, heap ~35 MB. **Chưa đo trên điện thoại thật.**

## 4. Đợt 2 (2026-11-08): cà phê theo giai đoạn + nhà cửa — đã làm, qua QA vòng 1

Nguồn: `gedeo_heroes.py` (cà phê) và `scripts/blender/gedeo_buildings.py` (nhà, texture có normal map). Nạp qua
`gedeo-vegetation.js`: `createModel(key, { state })`, `createPlantInstances(key, [{ position, rotationY, scale, state }], { lod })`, `setParts()`.

| Model (key) | File | Tris theo LOD | Ghi chú |
|---|---|---|---|
| Cà phê con (`coffeeSeedling`) | `coffea-arabica-seedling` | 228 / 148 | thân đơn, lá mầm tròn + 4–5 cặp lá |
| Cà phê non (`coffeeYoung`) | `coffea-arabica-young` | 2.1k / 660 / 249 | ~0.85 m, cành ngang đầu tiên |
| Cà phê trưởng thành (`coffee`) | `coffea-arabica-mature` | 54k / 11k / 3.4k | phần `coffee_flowers`, `coffee_cherries_green`, `coffee_cherries_ripe` → trạng thái `mature / flowering / green / ripe / harvested` |
| Nhà tukul (`tukul`) | `tukul-farmhouse` | 3.6k / 2.0k | đế đá, vách đất trộn rơm, cửa gỗ hé, 12 cột hiên + vành, 18 kèo, mái tranh nón 3 tầng mép rua, chóp gốm |
| Kho cà phê (`warehouse`) | `coffee-warehouse` | 1.0k | nền đá + láng xi măng, khung gỗ, vách/mái tôn sóng gỉ, 2 cánh cửa, pallet bao |
| Giàn phơi (`dryingBed`) | `drying-bed` | 1.3k / 0.8k | cột bạch đàn, ray, nan ngang, lưới che; lớp quả `fresh / drying / dry` |
| Bồn nước (`waterTank`) | `water-tank` | 650 | bồn tôn kẽm sóng ngang trên bệ đá, nắp nón, vòi, 2 can vàng |
| Chòi công nhân (`shelter`) | `worker-shelter` | 680 | 6 cột, mái tranh 2 lớp, ghế gỗ khúc |
| Bao cà phê (`sacks`) | `coffee-sacks` | 1.1k | 8 bao đay trên pallet |

QA trong Three.js (`/asset-showcase.html`: `stages`, `field`, `homestead`, `tukul-3q`, `warehouse-3q`, `beds`):
mái tranh, giàn phơi, ruộng 72 cây LOD2 trạng thái hỗn hợp đạt. Cảnh đầy đủ: 104 draw call, ~1.26M tris/frame (gồm bóng), 100 fps trên Mac, không lỗi console.
Đã sửa trong QA: tên mesh bị hậu tố `.002` (bật/tắt phần hỏng), quả LOD2 thành khối kim cương, tôn quá tối (metallic 0.55 → 0.2), đá đế kiểu hoạt hình, bao đay quá vuông.

Hạn chế đã biết:
- Mỗi GLB nhà nhúng riêng texture tranh/đất/đá/gỗ → trùng bộ nhớ khi nạp nhiều loại nhà. Nên tách texture dùng chung (KTX2) khi tích hợp.
- Cà phê LOD2 3.4k tris vẫn cao cho ruộng >100 cây trên điện thoại; ruộng không đổi LOD theo khoảng cách (instanced). Chưa đo máy thật.

## 5. Đợt 3 (2026-11-08): nhân công, robot, môi trường — đã làm, qua QA vòng 1

### Nhân công (`scripts/blender/gedeo_characters.py`, key trong `GEDEO_ACTORS`, nạp bằng `createActor(key, clip)`)
Thân liền một khối (skeleton Skin modifier + subdivision), đầu nặn từ ellipsoid (mắt, lông mày, mũi, tai, môi), tóc/khăn/mũ,
váy và tạp dề gắn vào hông. Rig 17 xương dùng chung, skin weight theo khoảng cách tới xương, dụng cụ gắn cứng vào xương.
Clip (30 fps, tại chỗ): `idle, walk, carry, harvest, water, prune, plant, rake, inspect`. ~1.7–2.2k mặt, 170–180 KB mỗi file.

| Key | File | Vai | Dụng cụ | Clip chính |
|---|---|---|---|---|
| `pickerF` / `pickerM` | `worker-picker-{f,m}` | hái quả | giỏ đan đeo hông | harvest |
| `waterer` | `worker-waterer-m` | tưới | bình tưới kẽm | water |
| `pruner` | `worker-pruner-m` | tỉa cành | kéo tỉa, găng | prune |
| `planter` | `worker-planter-f` | trồng cây | cuốc + bầu cây giống | plant |
| `hauler` | `worker-hauler-m` | khuân vác | bao đay trên vai | carry |
| `processor` | `worker-processor-f` | sơ chế/phơi | cào gỗ, ủng | rake |
| `supervisor` | `worker-supervisor-m` | quản lý | bảng kẹp giấy | inspect |

### Robot (`scripts/blender/gedeo_robots.py`, clip `idle, drive, work`, mọi clip key đủ mọi bộ phận)
| Key | File | Việc | Chuyển động |
|---|---|---|---|
| `harvestBot` | `robot-harvest` | hái quả | bánh xích, thùng chứa quả, tay 3 khớp + kẹp 3 ngón + camera: vươn – kẹp – xoay về thùng – thả |
| `waterBot` | `robot-water` | tưới | 4 bánh, bồn nước, cần phun quét trái–phải |
| `pruneBot` | `robot-prune` | tỉa cành | bánh xích hẹp, cột nâng, tay có đĩa cưa quay + kéo, LiDAR |
| `plantBot` | `robot-plant` | trồng cây | giá 24 bầu cây giống, mũi khoan xoắn xuống–lên |
| `droneBot` | `robot-drone` | trinh sát/phun lá | 4 cánh quạt quay, bay lơ lửng, gimbal camera quét |
| `haulBot` | `robot-haul` | chở hàng | sàn chở bao + thùng quả, bánh quay |

### Môi trường (`scripts/blender/gedeo_environment.py`, một file mỗi món)
`wetMill` (máy xát vỏ, 2 bể lên men, mương rửa, mái tôn), `compost` (nhà ủ phân mái tranh + đống ủ), `terraceWall` (tường đá khô 4 m cho ruộng bậc thang),
`fence`, `fenceGate` (cổng có cánh là node riêng), `rocks` (5 tảng), `grass` (cỏ + hoa cúc Meskel), `shrub`, `dirtPath` (đường đất đỏ có vệt bánh xe),
`props` (thùng gỗ, xô hái, thang 3 chân, xe cút kít, khay phơi, giá dụng cụ — node có tên).

QA Three.js (`/asset-showcase.html`: `farm`, `workers`, `robots`, `processing`, `terraces`): tất cả clip chạy qua AnimationMixer, không lỗi console.
Cảnh đầy đủ: ~390 draw call, ~1.5M tris/frame (gồm bóng), 100 fps trên Mac, heap ~75 MB. Thư mục `public/models/gedeo/`: 46 GLB, 9 MB.

Đã sửa trong QA: tóc đâm xuyên mặt, váy bị kéo căng theo đùi, dụng cụ chĩa lên trời khi làm việc (đã bù góc theo tư thế),
track NLA chồng nhau, exporter xoá kênh "đứng yên" của robot, cờ thư viện làm script khác export lại nhà.

Giới hạn thật (không phải lỗi đã sửa):
- Nhân vật là dựng bằng code, mức "low-poly có hình người thật", **không** đạt mức realistic như Meshy/scan: mặt đơn giản, tay dạng găng, không có ngón.
  Muốn nâng lên cần bật Meshy (hoặc nguồn có giấy phép) rồi retarget sang rig 17 xương này.
- Màu quần áo là vertex colour nên ranh giới áo/da hơi loang.
- Draw call cao (390) vì mỗi model một bộ material + texture riêng; trước khi lên điện thoại cần gộp atlas/KTX2 và instancing cho cỏ, đá, hàng rào.

## 6. Còn thiếu

1. Tích hợp vào farm (`src/features/realm/plots.js` đang dùng `farm/coffee-tree.glb#tree|fruit_green|fruit_ripe` instanced) — thay bằng `createPlantInstances('coffee', …, { state })`;
   nhân viên `farmhand` / robot `sproutBot` trong `STAFF` (economy.js) trỏ `model` sang file mới; giữ nguyên logic trồng/hái/save.
2. Tối ưu cho điện thoại: atlas texture dùng chung, KTX2, đo FPS trên máy thật.
3. Nhân vật chất lượng cao hơn: cần Meshy.

## 7. Đợt 4 (2026-11-08): thay toàn bộ khung cảnh — đã làm, qua QA
- `scripts/blender/gedeo_landscape.py` → `farm/landscape-parts.glb` (luống, vòng đất gốc, tường bậc thang, bờ dốc), `gedeo/gate-plaza.glb`, `gedeo/terrain-{north,east,west,south}.glb` + `terrain-meta.json` (đồi + 354 chỗ trồng cây che bóng).
- `farm/coffee-stages-gedeo.glb` (cây con, cây tơ) đã gắn vào vụ đầu trong `plots.js`.
- Kiểm hình khối thô: 801 → 5 (chỉ còn mặt đất phẳng và decal lô). Báo cáo trước/sau, ảnh QA, số đo hiệu năng: `docs/design/gedeo-world-replacement-report.md`.
- Mục 6.1 (tích hợp vào farm) đã xong. Còn: cull bụi cà phê theo cụm, KTX2, đo máy thật.
