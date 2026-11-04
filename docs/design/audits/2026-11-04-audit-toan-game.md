# Audit toàn game — 04/11/2026

| | |
|---|---|
| Người chạy | Quang (Producer `/game-studio review`, Claude Code) |
| Ngày | 04/11/2026 |
| Bản audit | Cây làm việc nhánh `docs/session-templates` trên `ef3aa5b`, **có thay đổi chưa commit** (24 file) |
| Phạm vi | Gameplay, kinh tế, UX, hiệu năng, QA; 5 màn + bản đồ thế giới |
| Sửa code | Audit không sửa code. Đợt triển khai cùng ngày: xem mục 4b |
| Cập nhật | 1 P0, 11 P1, khoảng 45 P2. Lỗi gấp nhất là hồi quy danh tiếng (`model.js:538`) trong code chưa commit và kẹt tiền ở 3 nơi chỉ quán |

## 1. Cách làm

**Agent chuyên môn đã chạy** (đều chỉ đọc; mỗi nhóm có 1 agent phản biện độc lập đối chiếu code, nhiều phát hiện được tái hiện bằng script node):

| Nhóm | Agent | Kết quả |
|---|---|---|
| Gameplay, tiến trình | game-designer ×2 | 11 phát hiện, 11 xác nhận |
| Kinh tế | economy-designer | 5 phát hiện, 5 xác nhận (script `ec1.mjs`, `ec3.mjs`) |
| UX, i18n, a11y | ux-designer ×2 | 7 phát hiện: 5 xác nhận, 1 bác bỏ, 1 chưa chắc (đã xác nhận bằng trình duyệt) |
| Hiệu năng | performance-analyst | 8 phát hiện, 7 xác nhận (build thử, đo GLB) |
| Lỗi code | gameplay-programmer + general-purpose | 14 phát hiện; 12 tái hiện bằng script |
| QA | qa-tester | `node --test tests/*.test.js`: **43/43 qua**; 6 lỗ hổng độ phủ |

Lần đầu 4 agent (game-designer, ux-designer, qa-tester, gameplay-programmer) hết `maxTurns` (20; qa-tester 10) trước khi trả kết quả. Đã chạy lại với phạm vi hẹp hơn.

**Chơi thử bằng Chrome** (WebGL thật, giả lập 390×844 cảm ứng, DPR 2):

1. **Lượt 1 từ đầu, Việt Nam:**
   - Chọn nhân vật → intro trọn 23,5 s → thiên đàng 6 câu, 3/3 dấu → bản đồ → Việt Nam.
   - Farm: Hái → quán: mở ca, tự pha Nâu đá ★★★ (kỹ năng 91), mang ra bàn, hết ca.
   - Phơi → Rang → Bán ở Chợ → Gửi hạt về quán → Mua ruộng 2 → Chăm cây.
   - Không có lỗi JS nào ngoài lỗi do công cụ test gây ra.
2. **Lượt 2, tiền 9.999.999.999.999** (kèm XP 20.000 để qua giới hạn cấp farm):
   - Nâng 10 công trình farm lên tối đa (170 lần), mua ruộng 3, thuê 1 người + 2 robot (chặn người thứ 4).
   - Nâng toàn bộ thiết bị, tự động hóa, mở rộng và 10 bàn của quán; thuê 3 nhân viên.
   - Chạy Auto trọn một ca; đo fps, draw call, heap.
3. **Lượt 3, Ý (chỉ quán)** bằng Bỏ qua: kiểm tra luật nơi chỉ quán; đo fps với CPU chậm 4 lần.

**Chưa làm:**
- Chưa chơi Kenya/Colombia (chỉ farm) trên trình duyệt.
- Chưa kiểm chứng được bước đặt đồ trang trí: chạm giả lập lên mặt đất không chọn được chỗ, do giới hạn công cụ, không tính là lỗi.
- Chưa đo trên điện thoại thật nên không có số GPU mobile.
- Chưa chạy `scripts/balance-sim.mjs`.

## 2. P0 — chặn chơi

| ID | Lỗi | Bằng chứng | Nguyên nhân gốc | Hướng sửa | Xác minh |
|---|---|---|---|---|---|
| GP-A1 | **Nơi chỉ quán (Ý, Nhật, Mỹ) có thể kẹt tiền vĩnh viễn**: hết hạt (< 10 g), chưa có chasen, và tiền < 59 xu (có chasen: < 9 xu) thì không còn thao tác nào ra xu. Save gắn cứng một nơi nên chỉ còn cách xóa save | `farm/model.js:506-509` chỉ nhập robusta 75 xu; `cafe/ui.js:25,231` ẩn «Đặt farm»; `farm/game.js:853,936` không về được farm/Chợ; `model.js:295` lương nhân viên vẫn tự gia hạn; quà robot 200 g chỉ một lần (`model.js:143-149`) | Nơi chỉ quán bỏ vòng farm (lưới an toàn hái → bán) mà không có sàn an toàn thay thế | Gói hạt cứu trợ khi tiền < 75 và hạt < 10 g (bán chịu hoặc giá rẻ), hoặc gói nhập nhỏ hơn; dừng tự gia hạn lương khi tiền thấp | Code + phản biện. Trình duyệt (Ý): chỉ có Open/Pantry/Manage, nhập hạt 75 xu/500 g |

## 3. P1 — lỗi rõ ở vòng chơi chính

| ID | Lỗi | Bằng chứng | Nguyên nhân gốc | Hướng sửa | Xác minh |
|---|---|---|---|---|---|
| EC-2 | ~~**Danh tiếng không đổi theo từng ly**~~ **Đã sửa 04/11** (tách lệnh khỏi comment, thêm test; chưa chạy test) (hồi quy trong code chưa commit) | `farm/model.js:538`: lệnh `cafe.reputation=clamp(...)` nằm sau `// quests count only your own cups` trên cùng dòng | Thêm comment không xuống dòng (đợt sửa audit sáng 04/11) | Tách lệnh ra dòng riêng; thêm test ly ★★★ +1,2 / ly ★ −0,6 | `git diff` so với HEAD. **Trình duyệt:** bán ly ★★★ mà uy tín vẫn 53 |
| PT-1 | **Thuê barista làm ca thất bại**: mỗi barista +6 ly mục tiêu, nhưng ly nhân viên chỉ ★1 nên trung bình < 2★ → trượt ca, −1 uy tín. Càng thuê nhiều, càng trượt | `cafe/service.js:474` mục tiêu `4+hạng+6×helpers()`; `service.js:100-103` tính barista là "giúp" nếu làm được 1 món bất kỳ (kể cả máy espresso tự động); `service.js:207,488` sao TB tính cả ly nhân viên | Mục tiêu tăng theo số tay pha, không theo năng suất và chất lượng thật | Mục tiêu theo năng suất ước tính (ly/phút × sao), hoặc chỉ tính sao TB trên ly người chơi; xem lại GDD 10.5 ("2 barista lời nhất") | **Trình duyệt:** quán nâng tối đa + 2 barista + máy tự động: mục tiêu 25, bán 11 ly, TB 1,1★, uy tín −1; Auto của người chơi pha 0 ly cả ca |
| EC-1 | **Đơn Chợ lặp vô hạn** ở giá cố định 1,2× giá gốc, bỏ qua giảm giá theo lượng bán và sàn 30% | `model.js:239` `makeOrder`; `model.js:706-708` giao đơn rồi tạo đơn mới ngay, không cộng `market.sold`, không cooldown; Auto tự giao (`autoplay.js:52`) | Đơn được thiết kế như thưởng, nhưng sinh lại tức thì | Cộng giá gốc đơn vào `market.sold`, hoặc giới hạn 1–2 đơn mỗi ngày công; thêm đơn vào sim rồi chạy lại 10.5 | Script `ec1.mjs`: 20 kg robusta bán chợ 689 xu, giao đơn 1.700 xu (×2,5) |
| GP-A2 | **Nơi chỉ quán không bao giờ thấy thẻ nhiệm vụ** (chuỗi gốc lẫn 2 nhiệm vụ riêng); thưởng cộng âm thầm | `ui/styles/cafe.css:8` ẩn thẻ farm khi ở quán; thẻ quán (`cafe/ui.js:106-186`) không đọc `farm.quest`; toast hoàn thành chỉ có ở `farm/game.js:185` | Thẻ nhiệm vụ gắn với HUD farm | Thẻ quán hiện nhiệm vụ hiện tại khi hết bước intro | Code. Trình duyệt (Ý): không có thẻ nhiệm vụ, `claimed` rỗng |
| GP-B2 | **«Để sau» không tính vào giới hạn hỏi lại**: câu mẹo hiện lại sau mỗi lần hái tay; Auto rơi vào vòng lặp bấm «Để sau» | `model.js:233` `askable` chỉ đếm `askedCount` khi trả lời (`model.js:614`); `lesson-prompt.js:46-47` đóng mà không báo model; `farm/game.js:904` hỏi sau mỗi lần hái | Thiếu hành động "defer" trong model | Thêm `act('lessons','defer')` ghi `askedDay`/`askedCount` | Code + phản biện (có thể trùng G15) |
| PF-1 | **Bản đồ thế giới rò shadow map 2048²** (~32 MB GPU) mỗi lần mở/đóng | `world-map/scene.js:37-38`; `dispose` ở `:284`; `shared/three/dispose-scene.js:27-52` không giải phóng `light.shadow` | `disposeScene` bỏ sót render target của bóng | Gọi `light.shadow.dispose()` trong `disposeScene`; hạ map xuống 1024 | Code + three r185 `LightShadow.js:267-277` |
| BG-B1 | **Đồng hồ máy chạy trước rồi chỉnh lùi**: máy chế biến kẹt cả tháng, giá Chợ không hồi, đơn và mưa ngừng | `model.js:68` chỉ kẹp `lastAt`, không kẹp `epoch`/`readyAt`/`deadline`; `model.js:256` `advance` đứng yên khi giờ lùi | Mốc tuyệt đối "tương lai" giữ nguyên khi nạp | Khi `saved.lastAt > now`, dời mọi mốc đi `now − saved.lastAt` | Script `probe-model.mjs`, `probe-clock.mjs`: batch còn 719,99 giờ |
| BG-B2 | **Thợ farm «Tạm dừng» vẫn tự gia hạn và trả lương** | `farm/crew.js:233` gia hạn chạy trước kiểm tra `!w.enabled` (`crew.js:245`) | Thứ tự kiểm tra | Bỏ qua tự gia hạn khi `!enabled` | Script `probe-crew.mjs`: 3 ngày 850 → 730 xu, 0 giây làm việc |
| BG-B3 | **Đóng quán bằng tay giữa ca**: bỏ ly đang cầm và ly trên kệ nhưng giữ khách → khách bỏ về, mỗi người −2 uy tín | `cafe/service.js:523` `toggleOpen` → `endShift`; chỉ nhánh hết giờ (`:532`) cho khách về êm | Hai đường kết thúc ca xử lý khách khác nhau | Đóng tay cũng cho khách về êm | Script `probe-service.mjs A`: uy tín 50 → 45 |
| BG-B4 | **Ẩn tab khi ở quán**: ca bán và tuổi ly chạy theo giờ thật trong khi model dừng lương → ly bị vứt, ca tự đóng, −1 uy tín | `service.js:13` `cupAge` dùng `Date.now`; `resume()` (`:510`) chỉ gọi khi vào lại quán; `model.js:292` | Quán không nghe `visibilitychange` | Gọi `service.resume(gap)` khi tab hiện lại | Script `probe-service.mjs B`: ẩn 150 s thì ca còn 68 s thay vì 218 s |
| UX-1 | **Nút ▶ Auto nằm trên mọi modal và nền tối**: che «Show me» ở bàn pha, «Cancel» ở thanh đặt đồ, thẻ order bàn 2; bấm được khi đang có hộp xác nhận | Ảnh chụp trình duyệt: bàn pha, Kho/Chợ, xác nhận "Accept sale order", thanh Garden lamp | `ui/autoplay-hud.js` có z-index cao hơn lớp modal | Hạ dưới lớp modal, hoặc ẩn khi modal/hộp xác nhận mở; né dải order của quán | **Trình duyệt**, mọi màn farm/quán |

## 4. P2 — nhỏ, đánh bóng, tài liệu lệch

**Kinh tế**
- EC-3: ở nơi chỉ quán, Phin đen và Nâu đá do nhân viên bán bị lỗ 0,3–0,57 xu/ly (hạt nhập 0,15 xu/g, ly nhân viên không ×2). Các món khác vẫn lãi.
- EC-4 / QA-1: nạp save kẹp tiền ở 1e12 (`model.js:61`). **Trình duyệt:** 9.999.999.999.999 → 1.000.000.000.000. Người chơi thường không chạm tới; nếu muốn test tiền cực lớn thì ghi trần vào `contracts.md`.
- EC-5: sink hữu hạn. Nâng toàn bộ farm hết **652.694 xu** (trình duyệt khớp ước tính), toàn bộ quán chỉ khoảng 7.700 xu. Cuối game không còn chỗ tiêu tiền.

**Gameplay**
- GP-A3: nhiệm vụ cuối Colombia/Kenya (`beansSold`) không dẫn đường; `STAT_QUEST` (`farm/game.js:737`) thiếu `beansSold`.
- GP-A4: tên nhiệm vụ "Pull 10 espressos", "Bán 25 ly mang đi" nhưng điều kiện đếm mọi ly (`content.js:98-100`). Espresso cần máy 120 xu và arabica, mà nơi chỉ quán chỉ nhập được robusta.
- GP-A5: trong quán không có gì báo nhiệm vụ kế tiếp (về farm phơi).
- GP-A6: `vn-ship` mở bảng Đơn hàng nhưng không tạo đơn (`openOrderBoard` so sánh `id==='ship'`).
- GP-B1: nói lại với Thần Chết lặp nguyên hộp «NHẬN NHIỆM VỤ», chọn lại có thể tắt tự dẫn (`heaven/game.js:151`). **Trình duyệt:** lặp 30+ lần.
- GP-B3: Auto bán hoặc gửi hết hạt rang ngay khi đạt 100 g, nên không gom đủ đơn 200/252 g (`autoplay.js:49-57`).
- GP-B5: hành trang bị đổi im lặng (Bỏ qua, hoặc nơi không dùng được). +150 xu không vào sổ cái (`model.js:163,183-189`). **Trình duyệt (Ý):** chỉ thấy trong nhật ký.

**Lỗi code**
- BG-B5: ly nhân viên đang bưng lọt khỏi luật dọn kệ cuối ca và luật tạm dừng.
- BG-B6: bù giờ offline lấy trạng thái mưa của đúng phút quay lại cho cả khoảng vắng.
- BG-B7: hủy batch giữa hàng chờ để lại lỗ 30 s.
- BG-B8: Auto pha trừ 2 xu trước khi có ly, vẫn đổi món/đóng được.
- BG-B9: khách mang đi ở quầy nhận không nhận ly trả về kệ.
- BG-B10: `act('workers','role')` nhận giá trị bất kỳ.
- PT-2: `cafe/bench.js:245` `TypeError` khi bấm «Done» sau lúc rót tự chốt, vì `gauge` đã null. **Trình duyệt:** lỗi console, không mất ly.

**Save**
- BG-A1: không flush save khi `pagehide`/ẩn tab (mọi `act()` vẫn commit ngay, nên chỉ mất tối đa 5 s tick).
- BG-A2 / QA-2: save có version lạ hoặc JSON hỏng bị ghi đè, không backup.
- BG-A3: hai tab ghi đè nhau.
- BG-A4: `enterFarm` lỗi giữa chừng không dọn scene; không chặn gọi lại.

**Hiệu năng**
- PF-x: draw call tăng theo số khách. Quán nâng tối đa đạt đỉnh 390 draw call (gốc 217) khi đông khách. Không rò: khách về thì giảm, heap 156 → 69 MB. Máy Mac giữ 75 fps, kể cả khi CPU chậm 4 lần; chưa đo GPU điện thoại. Hướng sửa: gộp mesh hoặc dùng instancing cho khách và ly, đặt ngân sách draw call cho mobile.
- PF-2: màn chọn nhân vật không giải phóng shadow map 1024².
- PF-3: không xử lý `webglcontextlost` (three tự phục hồi, nhưng không báo người chơi hay hạ chất lượng).
- PF-4: `replaceAsset` duyệt toàn cảnh cho mỗi slot.
- PF-5: cache GLB không xả.
- PF-6: backdrop màn chọn khoảng 80k tam giác.
- PF-7: bundle chính 1.050 kB (291 kB gzip), asset 22 MB.
- PF-8: đổi chất lượng đồ họa khi đang ở bản đồ không áp vào cảnh bản đồ.

**UX**
- UX-B1: ô tiền HUD tràn khỏi mép phải khi số lớn (**trình duyệt:** "1,000,000,00…" bị cắt). Thiếu `min-width:0` và rút gọn kiểu compact.
- UX-A1: thẻ nhiệm vụ farm che nhãn giá ô khóa và biển "Reserve pond" ở màn 390 px (**trình duyệt**).
- UX-A2: vùng HUD quán có `aria-label` "Farm" (**trình duyệt**).
- UX-A4: khi vào farm ở màn dọc, ruộng bị cắt mép trái; khung nhìn ngang chỉ khoảng 8 đơn vị (**trình duyệt**).
- UX-B2: vòng Tab của modal bỏ qua ô nhập số lượng.
- UX-B3: ký hiệu "₫" viết cứng cả ở bản tiếng Anh.
- PT-3: bước cân bột phin của ly đầu tiên có vạch xanh 19–21 g / tối đa 30 g, tức chỉ khoảng **0,21 s** để thả tay. Matcha 75–80 °C khoảng 0,16 s. **Trình duyệt:** rót vượt lên 24 g; vẫn được ★★★ nên chỉ là độ khó.
- PT-4: nhiệm vụ "Chăm cây vừa hái" phải chờ khoảng 4 phút. Thông báo giải thích tắt trong chưa tới 5 s, nên bấm thẻ trông như không có gì xảy ra.
- PT-5: modal trạm nhớ tab cuối. Mở lò rang sau máy phơi thì vào thẳng "Progress & pickup": "No batch processing".
- PT-6: số hiển thị khó đọc: "Next level: 21.24 kg/batch"; Tools "4 → 4 s/action" (nâng mà như không đổi); bảng nâng cấp dùng "18000 → 21240 g", trong khi trạm dùng "18 kg".
- PT-7: khi hết ca, khách đang chờ và order trên bàn biến mất mà không tính "walked out". Báo cáo ca ghi 0 nên người chơi không biết đã bỏ lỡ.
- PT-8: nơi chỉ quán vẫn ghi "Order beans from the farm (cheap…)" và "Unlocks at farm level 2". `cafe.hint.noBeans` vẫn bảo "Về farm gửi hạt".
- PT-9: bản đồ thế giới — khối Việt Nam nổi lệch khỏi bờ biển, bóng đổ ra biển; cờ Nhật nằm gần bán đảo Triều Tiên.
- PT-10: trang trí chỉ có 3 món, gợi ý "R to rotate · Esc to cancel" là phím trên thiết bị cảm ứng. Nút ↻ Rotate có, nhưng nút Cancel bị nút Auto che (xem UX-1).

**Tài liệu lệch**
- GP-B4: `crew-autoplay.md:15` "chạm bất kỳ đâu là lấy lại quyền" trái với mục 5 và code; dòng 71 "Auto không mua bán" trái với `autoplay.js:47-65`.
- GP-A3: README 02b ghi `sold`, code dùng `beansSold`.
- QA-5: số test trong GDD (39/39, 41/41) đã cũ; hiện là 43/43.

**Độ phủ test**
- QA-3: `src/state/progress.js` không có test nào.
- QA-4: luật theo loại nơi chỉ có test một phần.
- QA-6: Auto 3 suất × 10 phút chưa có test cho đồng hồ và giới hạn suất.
- Danh tiếng theo ly, đơn Chợ và tiền lớn chưa có test.

**Đã bác bỏ / không phải lỗi**
- UX-A3: chữ "Click to be guided" trên cảm ứng — do giả lập bằng chuột; điện thoại thật hiện "Tap".
- "Hái xong nhảy sang Bán ly đầu": đúng thiết kế đã chốt (`onboarding-flow.md` 3.5).
- Chỗ tưởng kẹt ở nhiệm vụ Chăm cây: chỉ là phải chờ (PT-4).
- Draw call tăng trong ca: không rò (xem PF-x).
- Đã kiểm, không thấy lỗi:
  - Chặn mua khi thiếu tiền, ruộng không liền kề, nâng cấp vượt cấp.
  - Kho/xu không âm qua các nhánh `act()`.
  - Không rò listener: mọi listener dùng `AbortController`.
  - Giới hạn 3 slot farm: **trình duyệt** chặn người thứ 4, có giải thích.
  - Luồng ô khóa → nhân vật đi tới biển → xác nhận, trừ tiền khi xác nhận: **trình duyệt** đúng luật `AGENTS.md`.

## 4b. Triển khai 04/11/2026 (giai đoạn IMPLEMENTATION)

Producer điều phối; quyết định thiết kế do game-designer (D1–D4) và economy-designer (E1–E5) chốt theo ủy quyền của Quang, chọn phương án nhỏ nhất. Bằng chứng: `node --test tests/*.test.js` **74/74 qua** (cuối đợt dev), build OK; script tái hiện cũ chạy lại bởi qa-tester; chơi thử Chrome (390×844 cảm ứng) hai chế độ: **Normal** (save mới, Việt Nam, từ chọn nhân vật tới mua ruộng 2, không buff) và **Max** (save test riêng, 9.999.999.999.999 xu + XP 20.000, chỉ sửa save trong môi trường dev, không thêm cheat vào code).

| ID | Trạng thái | Agent | Gốc lỗi → cách sửa | Bằng chứng |
|---|---|---|---|---|
| GP-A1 (P0) | DONE | economy-designer (E2) → gameplay-programmer (M1, C3) | Nơi chỉ quán không có sàn an toàn → `act('cafe','relief')`: tiền < 75 và hạt quán < 10 g → tặng 300 g robusta (q65), 1 lần/ngày công; nút trong Kho quán | Test node; **trình duyệt (Ý, 10 xu, 0 g):** nút hiện, +300 g, tiền giữ 10, nút ẩn sau khi nhận |
| EC-2 | DONE | Producer | Lệnh danh tiếng nằm sau `//` | Test; **trình duyệt:** 51 → 51,6 → 52,2 → 52,8 theo từng ly ★★ |
| PT-1 | DONE | game-designer (D2) → gameplay-programmer (C1) | Mục tiêu +6/tay, TB tính ly nhân viên → `shiftGoal` = 4 + hạng + 3×tay, `shiftAvg` chỉ ly người chơi | Test; sim 60′: 3 barista 0 trượt (trước 5 trượt); **trình duyệt:** mục tiêu 16 (trước 25), đạt Vàng 36 ly |
| EC-1 | DONE | economy-designer (E1) → M1, U2 | Đơn Chợ sinh lại tức thì → tối đa 2 đơn/ngày công (`ORDERS_PER_DAY`, `market.orders`) | Test; **trình duyệt:** giao đơn 1 +17 xu, `orders` = 1 (đơn 2 là arabica, không có hàng nên chưa thử chặn đơn 3 trên UI) |
| GP-A2 / GP-A5 | DONE | game-designer (D1b) → C3 | Thẻ quán không đọc `farm.quest` → dòng «🎯 nhiệm vụ · n/N» + toast hoàn thành trong quán | Test toast; **trình duyệt:** VN hiện «🎯 Dry your first batch», Ý hiện «Sell your first cup · 0/1» |
| GP-B2 | DONE (chưa thử trên trình duyệt) | M2, U2 | «Để sau» không báo model → `act('lessons','defer')` gọi khi đóng không trả lời | Test node |
| PF-1, PF-2, PF-8 | DONE (chưa đo GPU) | gameplay-programmer (GĐ1) + Producer | `disposeScene` không giải phóng shadow map; bản đồ 2048² → 1024²; `applyRendererQuality` nhận nhiều scene | Test thiên đàng; đọc diff |
| PF-4 | DONE | engine-programmer (soạn diff) → Producer áp | Mỗi `replaceAsset` duyệt toàn cảnh → đánh dấu dirty, `canStand` tự dựng lại | Test 64/64; chơi farm/quán không lỗi va chạm |
| BG-B1, B2, B5, B6, B7, B10 | DONE | M2, M3, C2 | Xem mục 3/4 | Script tái hiện cũ cho kết quả đã sửa (qa-tester) + test |
| BG-B3 / PT-7 (D4) | DONE | C1 | Hai đường kết thúc ca → gộp vào `endShift`, khách về êm, báo cáo «về lúc đóng cửa N» | Test; **trình duyệt:** 3 khách về, uy tín 53 → 53, lost 0 → 0 |
| BG-B4 | DONE | C2 | Quán không nghe `visibilitychange` → `service.resume(gap)` | **Trình duyệt** (giả lập ẩn 40 s): đồng hồ ca chỉ chạy 1 s |
| UX-1 | DONE | U1 + Producer | z-index 60 > modal 7; trong `<dialog>` quán nút vẫn đè → hạ z, ẩn khi modal mở, trong dialog chỉ hiện nút Dừng ở góc trên | **Trình duyệt:** ẩn khi mở Shop và bàn pha |
| EC-4 / QA-1 | DONE | M1 | Trần coins 1e12 → 5e13 (an toàn cho cent) | **Trình duyệt:** 9.999.999.999.999 giữ nguyên; mua 20 xu ra đúng …979 |
| UX-B1 | DONE | U1 | HUD không co số → rút gọn kiểu compact («10T»), số đầy đủ ở title/aria | **Trình duyệt** |
| GP-A3, GP-A4, GP-A6, GP-B1, GP-B3, GP-B5, BG-B8, BG-B9, PT-2, PT-4, PT-5, PT-8, UX-A2, UX-B2, BG-A1, BG-A2/QA-2, QA-3, GP-B4, QA-5 | DONE | U1–U3, M3, C2, C3, Producer (tài liệu) | Xem mục 4 | Test node cho phần logic; PT-8, GP-B5 xem trên trình duyệt (Ý); BG-A1 thấy save được ghi khi rời trang |
| NEW-1 Auto không dọn bàn khi hết ghế sạch | DONE (giảm một phần) | gameplay-programmer (phân tích, mô phỏng cùng seed HEAD = hiện tại → **không phải hồi quy**) + Producer (sửa) | Auto chỉ dọn bàn khi hết việc → khách không có ghế sạch đi quầy nhận rồi bỏ về giận dữ. Sửa `cafe/game.js autoPick`: hết ghế sạch mà còn khách xếp hàng thì dọn trước khi pha. Producer **bác** bản sửa của agent (bỏ phạt uy tín khách bỏ về vì bàn bẩn) vì là đổi luật chưa duyệt, che triệu chứng | Test `hasCleanSeat`; **trình duyệt** cùng cấu hình: bàn bẩn tối đa 17 (trước 32), 2 phút đầu 0 khách bỏ về, nhưng cả ca vẫn mất 20 khách, uy tín 53 → 16,6 → gốc chính là NEW-2 |

| NEW-2 Nhịp khách vượt sức pha | DONE | game-designer (chốt) → gameplay-programmer | `helpers()` đếm đầu người, sàn 3 s cố định → `arrivalGap` với sàn theo tay pha hiệu dụng H và độ phủ menu C; mục tiêu Đồng = 4 + hạng + round(3H); barista robot được tính đúng | Test T1–T7; sim 60′ 0 khách bỏ về ở 0–3 barista; **trình duyệt** cùng save quán tối đa: cả ca 0 khách bỏ về (trước 20, uy tín 53 → 16,6), 16 ly |
| NEW-3 Uy tín chạm 100 nhanh | Quyết: giữ 0,6 | game-designer | Trần 100 có chủ ý; xem lại khi có số đo playtest | GDD 7.2 |
| PT-3 Vạch rót quá hẹp | DONE | game-designer → gameplay-programmer | `handRate`: qua vạch tối thiểu 0,45 s khi tự giữ | Test 72/72; chưa thử bằng tay |
| PT-6, UX-B3, PT-10 | DONE | gameplay-programmer + Producer (dòng nâng cấp ở `farm/game.js`, canvas `activity.js`) | Số khối lượng dùng `formatMass` («79.6 kg cherries/batch»), ký hiệu đồng xu «¢» mọi ngôn ngữ, gợi ý đặt đồ theo cảm ứng | **Trình duyệt:** bảng nâng cấp và đồng xu |
| QA-4, QA-6, BG-A4 | DONE (BG-A4 một phần) | gameplay-programmer | Thêm `tests/region-rules.test.js`, `tests/autoplay-runs.test.js`; chặn gọi lại `enterFarm/enterHeaven` khi đang chuyển cảnh. Còn: dọn scene dở khi `createFarmGame` ném lỗi giữa chừng (cần sửa trong `farm/game.js`) | Test 72/72 |

| **Đợt `/game-studio dev` (04/11, 8 agent)** | | | | |
| EC-3 | DONE (giá tạm, CẦN DUYỆT) | economy-designer (45 xu) → gameplay-programmer + Producer (`farm/game.js` menu) | Giá nhập dùng chung 75 → `supplierPrice(region)`: 45 xu ở nơi chỉ quán; ngưỡng cứu trợ theo cùng giá | Test node |
| EC-5 | ĐỀ XUẤT, CẦN DUYỆT | economy-designer (viết), game-designer (phản biện: khuyên v1 chấp nhận sink hữu hạn) | Chưa code — [endgame-sink-proposal.md](../../screens/03-farm/endgame-sink-proposal.md) | — |
| PT-11 | DONE | ux-designer (spec) → gameplay-programmer | HUD chỉ so số ly → hiện «⚠ … cần TB ★★ (hiện x★)» khi cổng ★ chưa đạt | Test 74/74; chưa xem trên máy |
| BG-A3 | DONE | gameplay-programmer | Không theo dõi tab khác → event `storage` bật chỉ đọc + thông báo | Test node (mô phỏng `storage`) |
| BG-A4 | DONE | gameplay-programmer | `createFarmGame` lỗi giữa chừng không dọn → try/catch `events.abort()` + `world.dispose()` | Test 74/74 |
| UX-A1 | DONE | ux-designer (spec) → technical-artist | `hideCutLabels` chỉ xét mép màn → ẩn nhãn 3D nằm sau thẻ nhiệm vụ | **Chrome:** nhãn «🔒 180» không bị che |
| UX-A4 | DONE | ux-designer (spec) → technical-artist | Camera bám nhân vật, fov hẹp ở màn dọc → khi vào farm màn dọc: zoom 0,9, nhìn về tâm ruộng | **Chrome 390×844:** thấy trọn ruộng 12 ô |
| PT-9 | DONE | technical-artist | Điểm Việt Nam nằm ngoài biên, biên Nhật thô → sửa tọa độ, biên Nhật, tô đất theo biên | **Chrome:** khối VN trên đất, cờ Nhật trên Honshu |
| PF-3, PF-5, PF-6, PF-7 | DONE (chưa đo FPS) | performance-analyst, technical-artist (PF-6) | Mất WebGL không xử lý; cache GLB không xả; backdrop 79,6k tam giác; three chung chunk → listener mất/khôi phục ngữ cảnh, `releaseModels('selection/'|'intro/')`, simplify 0,45 (35,8k tam giác, 757 → 385 kB), `vite.config.js` tách chunk `three` (index 1.053 → 360 kB) | Build OK; **Chrome:** màn chọn nhân vật hiển thị bình thường |
| PF-x (draw call theo số khách) | CHƯA LÀM | — | Việc lớn (gộp mesh/instancing nhân vật skinned), cần đo GPU điện thoại thật trước | — |

**Chưa làm / chờ quyết (BLOCKED):**
- Cần Quang duyệt: EC-3 giá 45 xu (đã code, giá tạm), EC-5 sink cuối game (đề xuất, chưa code).
- PF-x (draw call theo số khách), PF-3, PF-5, PF-6, PF-7: cần đo trên điện thoại thật / làm asset (technical-artist).
- Đã làm ở đợt `/game-studio dev` (bảng trên): UX-A1, UX-A4, PT-9, BG-A3, BG-A4, PT-11, PF-3/5/6/7, EC-3. Còn: PF-x.
- **PT-11 (mới, P2):** HUD ca hiện «Gold ✓» theo số ly trong khi cổng «TB ly bạn pha ≥ 2★» chưa đạt (Auto Pha nhanh món chưa thành thạo = ★1) → người chơi tưởng đã đạt nhưng không có thưởng. Nên hiện trạng thái cổng sao trên HUD. Trình duyệt 04/11.

## 5. Backlog đề xuất

Thứ tự theo rủi ro và công sức. Owner là agent gợi ý cho `/game-studio dev`. Mỗi mục cần Quang duyệt trước khi làm.

| # | Việc | Gồm | Owner | Công | Ghi chú |
|---|---|---|---|---|---|
| 1 | ~~Sửa hồi quy danh tiếng trước khi commit~~ **Xong 04/11** | EC-2 + test | gameplay-programmer | S | Đã sửa `model.js:538`, thêm test trong `farm-gameplay.test.js`; chưa chạy test |
| 2 | Sàn an toàn và thẻ nhiệm vụ cho nơi chỉ quán | GP-A1, GP-A2, PT-8, GP-A4 (đổi tên) | game-designer → gameplay-programmer | M | Cần quyết số gói cứu trợ (economy-designer) |
| 3 | Cân lại mục tiêu ca khi có nhân viên | PT-1 | economy-designer → gameplay-programmer | M | Cần quyết: mục tiêu theo năng suất, hay sao TB chỉ tính ly người chơi; chạy lại sim |
| 4 | Giới hạn đơn Chợ | EC-1, GP-B3 | economy-designer → gameplay-programmer | S | Thêm đơn vào `balance-sim.mjs`, chạy lại GDD 10.5 |
| 5 | Lớp z của nút Auto | UX-1, PT-10 | ux-designer → gameplay-programmer | S | |
| 6 | Thời gian thực ở quán và crew | BG-B4, BG-B5, BG-B3, BG-B2 | gameplay-programmer | M | Thêm test cho từng lỗi |
| 7 | Chống lệch đồng hồ khi nạp save | BG-B1, BG-B6 | gameplay-programmer | M | |
| 8 | Hỏi lại câu mẹo đúng giới hạn | GP-B2 | gameplay-programmer | S | Đối chiếu G15 |
| 9 | Giải phóng shadow map | PF-1, PF-2, PF-8 | performance-analyst → technical-artist | S | |
| 10 | Save an toàn | BG-A1…A4, QA-2, QA-3 (test `progress.js`) | gameplay-programmer + qa-tester | M | Chạm định dạng save: hỏi trước |
| 11 | Đánh bóng UX và HUD | UX-B1, UX-A1, UX-A2, UX-A4, PT-3…PT-7, GP-B1, GP-B5, GP-A5, GP-A6, GP-A3 | ux-designer + gameplay-programmer | M | |
| 12 | Hiệu năng mobile | PF-x (draw call khách), PF-4…PF-7, PF-3 | performance-analyst + technical-artist | L | Cần đo trên điện thoại thật trước (`?fps`) |
| 13 | Kinh tế cuối game | EC-3, EC-5, EC-4 | economy-designer + game-designer | M | Quyết định thiết kế |
| 14 | Dọn tài liệu và test | GP-B4, QA-4, QA-5, QA-6, lỗi nhỏ BG-B7…B10 | qa-tester + producer | S | |

## 6. Quyết định cần Quang

1. Nơi chỉ quán: dùng gói cứu trợ, giảm giá nhập, hay cho mua hạt bằng nợ?
2. Mục tiêu ca khi có nhân viên (PT-1): tính theo năng suất thật, hay chỉ chấm sao TB trên ly của người chơi?
3. Đơn Chợ (EC-1): cộng vào đường giảm giá, giới hạn số đơn mỗi ngày, hay hạ thưởng?
4. Có cần sink lặp cho cuối game (EC-5) không, hay chấp nhận giới hạn cấp 20?
