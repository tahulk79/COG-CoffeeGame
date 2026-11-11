# Đợt tối ưu theo cấu hình điện thoại (2026-11-11)

## Cách đo

- Chrome (DevTools Protocol) giả lập điện thoại: màn hình 390×844, DPR 3, cảm ứng, UA Android, **CPU chậm 4 lần**. GPU thật là Apple M1, nên số GPU không đại diện cho điện thoại.
- Save thử theo mục 3 của `PERFORMANCE-TEST-PLAN.md`: 200 cây, 40 nhân viên, cấp 40, chất lượng Trung bình (mặc định của điện thoại), đứng yên 10 giây.
- Công cụ: `src/dev/perf-profiler.js`, trace CPU + `scripts/perf-trace-summary.mjs`, heap snapshot.
- **Chưa đo trên điện thoại thật.**
- Trong lúc đo có một phiên khác sửa cùng thư mục (incident, cinematics, story), nên không dùng `git stash` để A/B cả trang. Bảng 1 so một lần đo trước với hai lần đo sau. Bảng 2 là A/B chạy ngay trong trang, đáng tin hơn.

## Đã sửa

| # | Vấn đề tìm được | Sửa | File |
|---|---|---|---|
| 1 | Nạp sẵn ~394 ảnh SVG (197 icon × 2 màu) trước khi vào game. Mỗi ảnh SVG là một trang riêng trong trình duyệt (heap có 411 Page/Document). Hàm dùng chúng, `fillRich`, không được gọi ở đâu. | Tạo ảnh khi cần lần đầu. `iconsReady` vẫn giữ để `main.js` không đổi. | `src/ui/icons.js` |
| 2 | Vòng cảnh báo cây (~3 lần/giây) và nút "Thu hoạch tất cả" (2,5 lần/giây) cộng lại thưởng của cả đội cho **từng** cây: 200 cây × 40 người. | Bọc trong `readOnlyPass`, như vòng của đội đã làm. | `src/features/realm/index.js`, `src/features/hud/toolbar.js` |
| 3 | `formatNumber` gọi `toLocaleString`, hàm này tạo bộ định dạng Intl mới mỗi lần. HUD gọi nhiều lần mỗi khung. | Giữ một `Intl.NumberFormat` cho mỗi bộ tùy chọn. | `src/i18n/index.js` |
| 4 | 8 vật liệu dùng chung cho mesh thường và InstancedMesh (lá, thân cây che bóng, cỏ). three phải đổi shader và tính lại tham số chương trình ở mỗi lần vẽ xen kẽ. | InstancedMesh dùng bản sao riêng của vật liệu, mỗi vật liệu gốc một bản sao, texture dùng chung, giải phóng cùng bản gốc. Còn 1 vật liệu trộn. | `src/shared/three/instanced-material.js` (mới), `plots.js`, `world.js`, `gedeo-vegetation.js` |

Đã thử rồi bỏ: không cập nhật ma trận cho nhân viên bị ẩn. A/B trong trang cho 0,69 ms so với 0,67 ms, không có lợi, nên đã hoàn tác.

## Bảng 1: khung hình, đứng yên 10 giây

| Chỉ số | Trước | Sau (lần 1 / lần 2) |
|---|---|---|
| FPS trung bình (khóa ~35 ở Trung bình) | 35,5 | 37,5 / 37,4 |
| FPS 1% thấp nhất | 21,1 | 36,0 / 32,2 |
| Luồng chính bận | 49,1% | 38,9% / 37,8% |
| JS mỗi khung | 13,9 ms | 10,4 / 10,1 ms |
| Cập nhật logic | 5,9 ms | 4,4 / 4,3 ms |
| Gửi lệnh vẽ | 7,7 ms | 5,8 / 5,6 ms |
| Heap JS cuối lượt đo | 190 MB | 221 / 114 MB (dao động theo GC, xem bảng 3) |

## Bảng 2: A/B chạy trong trang (CPU chậm 4 lần)

| Phép đo | Cũ | Mới |
|---|---|---|
| Quét trạng thái 200 cây | 4,34 ms | 0,56 ms (nhanh 7,7 lần) |
| Một lần `formatNumber` | 32,1 µs | 1,4 µs (nhanh 23 lần) |
| Giải mã 394 ảnh SVG lúc khởi động | ~1.030 ms | 0 (bỏ hẳn) |

## Bảng 3: RAM (heap snapshot, cùng save)

| | Trước | Sau |
|---|---|---|
| Tổng heap trong snapshot | 156,4 MB | 134,5 MB (−22 MB, −14%) |
| Trang SVG ẩn (Page, Document, Window) | 410 | 0 |
| Mã đã biên dịch | 10,5 MB | 8,5 MB |

Bộ nhớ native của các trang SVG (layout, vẽ) nằm ngoài snapshot, nên mức tiết kiệm thật còn lớn hơn.

## Còn lại, xếp theo lợi ích

1. **Texture:** khoảng 194 MB GPU (ước tính), 24 texture từ 1024 px trở lên, có một texture 2048. KTX2/Basis giảm 4 đến 6 lần. Việc này cần duyệt art (đã mở từ đợt trước).
2. **Dữ liệu hình học trên CPU:** 37,5 MB ArrayBuffer, phần lớn là bản sao geometry vẫn giữ sau khi đã lên GPU. Có thể giải phóng cho mesh tĩnh không bị raycast. Cần rà soát từng nơi gọi.
3. **Gửi lệnh vẽ** vẫn là phần lớn nhất của khung: 147 đến 159 lần vẽ, `projectObject` và `renderBufferDirect`. Gộp tòa nhà (99 mesh, 97 vật liệu) là bước tiếp theo.
4. **346 MeshPhysicalMaterial ở mức Trung bình.** Mức Thấp đã đổi sang Standard. Đổi ở Trung bình rẻ hơn cho GPU điện thoại nhưng hơi đổi độ bóng, nên cần chủ dự án duyệt.
5. Xương nhân vật tải lên GPU khoảng 1,2 MB/s (12 nhân viên đang hiển thị). Đã biết từ đợt trước.
6. 35 MB ExternalString trong heap chủ yếu là mã nguồn và sourcemap của dev server, không có ở bản build.

## Phần 2: texture KTX2 (cùng ngày)

Tất cả texture trong 149 file GLB và 8 ảnh nền của trang trại đã chuyển sang KTX2/Basis ETC1S. GPU nhận trực tiếp dạng nén (ETC2 trên điện thoại và trên M1, ASTC/BC tùy máy) thay vì RGBA thô.

| Chỉ số (cùng save, đo trong game) | Trước | Sau |
|---|---|---|
| Bộ nhớ GPU của texture model và nền | ~173 MB | 24 MB (66 texture ETC2) |
| Tổng bộ nhớ texture, kể cả nhãn chữ canvas | ~190 MB | ~42 MB |
| Dung lượng tải GLB | 42,6 MB | 46,4 MB (+9%) |
| Dung lượng tải ảnh nền | 1,4 MB | 1,1 MB |
| FPS và CPU khi đứng yên | không đổi | không đổi |

- Đã thử UASTC (chất lượng cao hơn), nhưng file nặng gấp 4 đến 7 lần (grass: 1,2 MB so với 186 KB). Toàn bộ GLB tăng lên 76 MB, nên đã bỏ.
- Ảnh màu dùng ETC1S chất lượng 128. Normal map dùng ETC1S 255 với chế độ normal map, không gian tuyến tính. Kích thước làm tròn về lũy thừa của 2 (682×1024 thành 512×1024).
- So sánh hình ở `docs/performance/ktx2/farm-before-after.jpg`: nhìn bằng mắt không thấy khác biệt ở góc camera của game. Chưa xem cận cảnh nhân vật ở màn chọn nhân vật (texture 2048).
- Chạy lại: `node scripts/ktx2-textures.mjs` cho GLB, `--env` cho ảnh nền. File đã là KTX2 sẽ được bỏ qua. Biến môi trường `KTX2_*` dùng để thử cấu hình khác. Bản gốc nằm trong git (HEAD); file `.jpg` nền vẫn được giữ làm nguồn.
- Lúc chạy game: `src/shared/three/ktx2.js` (loader và transcoder ở `public/basis`), `models.js` và `farm-textures.js`. Bản build còn kèm thêm một bản transcoder do three tự đóng gói (585 KB trong `dist`), nhưng game không bao giờ tải bản này.
- Còn lại: dữ liệu mipmap nén vẫn nằm trong heap JS sau khi đã tải lên GPU (~24 MB). Có thể giải phóng, nhưng `model-icons` dùng renderer thứ hai nên phải tải lại từ dữ liệu này, cần xử lý riêng.

## Phần 3: tải dần và bỏ file thừa (cùng ngày)

Đo bản build thật (`vite preview`) ở người chơi cũ vào thẳng trang trại (save cấp 40, 200 cây, 40 nhân viên). Mạng 4G nhanh, CPU chậm 4 lần, mỗi lần đo dùng ngữ cảnh trình duyệt mới không cache và chỉ mở một tab. Bản gốc là commit HEAD (trước mọi thay đổi hôm nay), đo xen kẽ với bản mới.

Mốc "trang trại hiện ra" là lúc HUD bắt đầu tải ảnh nút, vì `createPlayHud()` chạy ngay trước `hideLoading()`. Đồng hồ đo bằng `setTimeout` bị trễ khi luồng chính bận, nên không dùng.

| | Bản gốc (2 lần) | Bản mới (4 lần) |
|---|---|---|
| Trang trại hiện ra | 21,5 s / 21,7 s | **8,2 – 8,3 s** (−62%) |
| Phải tải trước khi vào | 16,8 MB, 110 file | 11,2 MB, 73 file |
| Tổng tải, kể cả phần tải sau | 17,0 MB | 17,5 MB |

### Đã sửa

| Vấn đề | Sửa |
|---|---|
| `models.js`, `gedeo-vegetation.js`, `mountain-dressing.js` và `gedeo-worker.js` mỗi nơi có bộ nhớ đệm riêng. 12 file (xưởng ướt, kho, giàn phơi, đèn…) bị tải và parse 2 lần, giữ 2 bản trong RAM. | Dùng chung `loadGLTF(url)` trong `models.js`, chỉ giữ `scene` và `animations`. Lần đầu tôi giữ cả `parser`, làm thừa ~12 MB (GLB thô); đã sửa. |
| `loadPlant()` tải mọi LOD dù nơi gọi chỉ dùng một (rừng ven dùng LOD3 nhưng vẫn tải LOD0 1 MB của cordia, 554 KB của albizia). | `loadPlant(key, [lod])` chỉ tải LOD cần. `createPlant` hiện LOD thô trước, LOD chi tiết tải sau rồi tự chèn vào. |
| Bộ giải mã KTX2 (515 KB) chỉ bắt đầu tải sau khi GLB đầu tiên về. | `ktx2Loader.init()` ngay khi nạp module, tải song song. |
| Màn loading chờ cả suối, cầu, sương mù, biển tầng, đồi bao quanh, hồ đá. | Chỉ chờ đất và đồ vật trên đất. Phần còn lại tải từ khung hình đầu tiên **sau khi** màn loading tắt (nếu bắt đầu sớm hơn, nó tranh CPU với bước biên dịch shader và làm chậm hơn: đo được 38 s). Mỗi phần có bản thay thế đơn giản. |
| Mô hình của **mọi** loại công trình (café, máy rang 665 KB, kho, xưởng…) được tải lúc vào game, dù save chưa có. | Đợt 1 chỉ gồm công trình save đang có (mọi vùng), cây cà phê và cái cốc. Đợt 2 tải phần còn lại sau phần cảnh vật, 2 file một lúc. Công trình đặt trước khi mô hình về sẽ hiện hộp tạm, rồi được dựng lại (`buildings.refreshType`). Đã thử: đặt một silo lúc màn loading còn hiện, sau đó nó có đủ 5 mesh của mô hình thật. |
| Cổng `heaven/portal.glb` được tải nhưng luôn ẩn, không chỗ nào bật lên. | Bỏ tải. |
| Ảnh khói `smoke-atlas.webp` (335 KB) tải lúc vào game. | Tải lần đầu khi có khói; trước đó dùng khói vẽ sẵn. |

Quy tắc cũ của founder ngày 2026-11-08 ("dựng hết sau màn loading, không tải từng mảnh") được thay bằng yêu cầu ngày 2026-11-11: tải dần.

### Đã xóa (không được game tải ở đâu; vẫn còn trong git)

- `public/models/gedeo/coffea-robusta-*` (6 file) và `coffea-liberica-*` (6 file). Robusta dùng chung mô hình arabica; liberica dùng `farm/coffee-tree-liberica.glb`.
- `public/models/farm/coffee-tree-robusta.glb`, `public/models/gedeo/cliff-face.glb`.
- `src/features/hud/minimap.js` (không file nào import).
- Tổng 6,8 MB. Đã bỏ các dòng tương ứng trong trang dev `asset-lineup`.

**Giữ lại có chủ đích:** bò, chó, dê, dân làng, nhà sàn… trong `mountain-dressing.js`. Code ghi rõ để dành mở khóa sau (`WILD_START`), và game không tải chúng nên không ảnh hưởng tốc độ.

### RAM

Heap JS (snapshot, sau khi đã tải hết phần tải sau) giảm từ 173,9 MB xuống 111,0 MB nhờ sửa bộ nhớ đệm. Con số này vẫn cao hơn bản gốc (~90 MB), vì dữ liệu texture KTX2 nén (~43 MB) nằm trong heap JS. Bản gốc giữ ~135 MB ảnh RGBA đã giải mã ở ngoài heap JS, nên so tổng RAM thì bản mới nhẹ hơn. Có thể giải phóng dữ liệu nén sau khi đã lên GPU, nhưng `model-icons` dùng renderer thứ hai nên cần làm riêng.
