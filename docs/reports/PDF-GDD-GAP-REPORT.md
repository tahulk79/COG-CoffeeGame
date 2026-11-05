# Báo cáo đối chiếu PDF chuẩn ↔ GDD ↔ code

| | |
|---|---|
| Ngày | 04/11/2026 |
| Tài liệu chuẩn | [`docs/references/GODBEAN_MASTER_HANDOFF_2026-11-04.pdf`](../references/GODBEAN_MASTER_HANDOFF_2026-11-04.pdf) — v1.0, 24 trang (không sửa, không ghi đè) |
| GDD đối chiếu | [`docs/design/godbean-gdd.md`](../design/godbean-gdd.md) v1.8 → cập nhật thành v1.9 trong cùng thay đổi. **Ghi chú:** `docs/gdd/` không tồn tại; GDD của dự án là file này |
| Code đối chiếu | Nhánh `feat/audit-implementation-2026-11-04`, HEAD `4f361ba`. Chỉ đọc, **không sửa gameplay code** |
| Người làm | Game Designer (gameplay), Economy Designer (cân bằng), UX Designer (trải nghiệm), Producer (tổng hợp, repo/CI/analytics/LiveOps) |
| Kiểm chứng | Không chạy test, build, sim hay trình duyệt (theo `AGENTS.md`). Mọi kết luận về code là đọc code; tính toán cân bằng là tính tay từ công thức |

## 1. Đọc PDF

| Hạng mục | Kết quả |
|---|---|
| Cách đọc | Trích chữ bằng PDFKit (macOS) từng trang; công cụ Read/pdftoppm/pypdf không có trên máy |
| Trang đọc được | **24/24**, đủ chữ (1.381–2.920 ký tự/trang) |
| Hình ảnh, sơ đồ | **PDF không chứa ảnh hay sơ đồ vẽ.** Cấu trúc file (ReportLab) chỉ có font và luồng chữ, không có đối tượng `/Image`. Các "sơ đồ" trong PDF là chuỗi chữ có mũi tên (vd. vòng Play → … → New Questions tr. 3) và đã đọc đủ |
| Bảng | Bảng được dựng bằng chữ ngăn bởi dấu `•`. Đã đọc đủ: ba tiến trình (tr. 3), Fragments (tr. 3), 8 nhóm dữ liệu (tr. 4), Phase (tr. 7), backlog GB (tr. 9), hệ thống (tr. 12), biến số pour-over (tr. 13), screen map (tr. 16), M1–M5 (tr. 20), user story C6S (tr. 23) |
| Không đọc được | **Không có.** Không có trang nào thiếu nội dung |
| Không xác minh được từ PDF | Logo/wordmark (tr. 2: chưa có vector); tệp `GODBEAN_MASTER_HANDOFF_2026-11-04.md` mà tr. 10 nhắc tới (không có trong repo); repo `tahulk79/TheCoffeeSixSense`, GitHub Pages, ZIP v0.1–v0.3, WebTest (tr. 8, 19, 22 — không có trong repo này); số KPI (tr. 8, 21 — giả thuyết, chưa có dữ liệu) |

**Thứ bậc trong PDF:** trang 1–10 (mục 1–13) là quyết định Godbean, nhãn APPROVED / PROPOSED / GAP / HOLD. Trang 10–24 là **Phụ lục A** — GDD cũ "The Coffee Six Sense" 23/10, PDF tự ghi "chỉ mang tính lịch sử", thua mục 1–13 khi mâu thuẫn. Báo cáo này áp đúng thứ bậc đó.

## 2. Kết luận chính

1. **Khung game khớp PDF.** Tầng Learn & Earn (farm + quán), Build & Expand (mua ruộng, nâng cấp, thuê người), liên kết farm → quán, EN/VI, web mobile-first, không đăng ký: code đã có (§3.1–3.2, §1).
2. **Ba hệ thống PDF xếp P0 chưa có ở cả GDD lẫn code:** Coffee Memory (§5.3), nếm 6 thuộc tính cảm quan (§5.1), Decode & Awaken / First Sixth Key (§4, GB-005). Grep toàn `src/` và `docs/` (aroma, acidity, fragment, sixth, awaken, memory): không có kết quả gameplay.
3. **Thứ tự lộ trình ngược với PDF §9.** PDF: Core Brew → Memory → Sixth Key → Economy slice. Repo đã làm kinh tế rất sâu (F-05…F-32) mà chưa có ba hệ thống trên. Đây là quyết định của founder, không tự đổi.
4. **"Học thật" chưa ghi là mô phỏng.** GDD trụ cột 4 "chấm theo số đo thật", UI `cafe.book.note` "Tỉ lệ pha thật"; không có chữ "mô phỏng" nào trong `src/`; điểm ly deterministic nhưng không có `model_version`. Trái §5 và §11.1 (APPROVED).
5. **Dữ liệu người chơi:** chỉ localStorage, chỉ có Reset (`src/state/progress.js`, `src/ui/settings.js`); không xuất/nhập, không báo nguy cơ mất save. Trái §5.3 (APPROVED), C6S-009.
6. **Kinh tế thiếu các đánh đổi PDF đòi:** bón/tỉa tăng cả sản lượng và chất lượng (`farm/model.js:293`) nên không có "Yield vs Quality"; không có điều kiện thắng; chợ NPC vẫn ~67–85% tổng thu (GDD 10.5).

## 3. Bảng truy vết yêu cầu

Loại: **A** PDF quy định, GDD thiếu · **B** GDD mâu thuẫn PDF · **C** code khác PDF · **D** PDF chưa rõ, cần quyết định · **✓** khớp. Cột GDD là mục **sau khi cập nhật v1.9** (mục mới đánh dấu ★).

| ID | PDF tr./mục | Yêu cầu | Nhãn PDF | GDD | Code liên quan | Loại | P |
|---|---|---|---|---|---|---|---|
| R-01 | 1 §1 | Game-first, hấp dẫn cả người chưa hiểu cà phê | APPROVED | 1.3, 1.5★ | `docs/shared/onboarding-flow.md` | ✓ / A | P1 |
| R-02 | 1 §1 | Hybrid Discovery: cơ chế cà phê có cơ sở khoa học, truyện hư cấu | APPROVED | 1.5★, 2 | `cafe/recipes.js` | ✓ | P2 |
| R-03 | 1 §1 | Persistent Discovery: lưu, so sánh khám phá lâu dài | APPROVED | 1.5★, F-33★ | `farm/model.js` chỉ lưu `mastery {best, made}` | A+C | P0 |
| R-04 | 1 §1 | Bốn thông điệp thương hiệu | APPROVED | 1.2, 1.5★ | `index.html` (tagline) | A | P2 |
| R-05 | 1 §1 | Web responsive PC/mobile/**iPad** trước, native sau | APPROVED | 1.2 | chưa có bằng chứng chạy iPad | A+D | P1 |
| R-06 | 1 §1, 9 §11.1 | EN/VI, không hardcode chữ trong logic | APPROVED | 1.2, F-24 | `src/i18n/` | ✓ (chưa kiểm chứng) | P1 |
| R-07 | 1–2 §2 | Lore Divine Data Seed / Databean, Decode the Divine | APPROVED | 3.1 (ghi chú)★ | `heaven/content.js` | A | P1 |
| R-08 | 2 §2 | Lore là hư cấu, không tuyên bố năng lượng đo được | APPROVED | 1.5★ | — | A | P2 |
| R-09 | 2 §2.1 | Sixth Key 3 chiều; vòng xoắn 5 bước; không xếp hạng giác ngộ | APPROVED | 1.5★, F-35★ | — | A | P1 |
| R-10 | 2 §2.2 | Logo/wordmark db, chưa tự nhận đã đăng ký nhãn hiệu | APPROVED hướng / GAP | 12 (ghi chú)★ | `public/favicon.svg` | A+D | P2 |
| R-11 | 2 §3.1 | Learn & Earn: Farm Play + Coffee Shop Play | APPROVED | 5.1, 6, 7 | `src/features/farm`, `src/features/cafe` | ✓ | — |
| R-12 | 2 §3.1 | Farm Play có "sơ chế" (washed/natural/honey ở §5) | APPROVED | 6.3 | `farm/content.js` (chỉ sân phơi + lò rang) | C | P1 |
| R-13 | 2 §3.1 | Vòng … Serve → Earn → **Learn** | PROPOSED | 5.1 | — | A | P2 |
| R-14 | 2 §3.2 | Build & Expand: mua đất quê / mặt bằng phố / cả hai | APPROVED | 4.1, F-28 | `src/features/world-map/` | ✓ | — |
| R-15 | 2 §3.2 | Farm Owner: khí hậu, đất ảnh hưởng năng suất/chất lượng; chi phí/ha | APPROVED | 6.1–6.2 | `farm/model.js:293` (không có biến vùng) | C | P1 |
| R-16 | 2 §3.2 | Thương mại hạt xanh số lượng lớn, mua từ đối tác | APPROVED | 6.4, F-32 | `farm/model.js` (chỉ chợ NPC + Nhập hạt ngoài) | A | P1 |
| R-17 | 2 §3.2 | Café Owner: vị trí, **giá**, marketing, dòng tiền, chuỗi | APPROVED | 7 | `cafe/recipes.js` (giá món cố định) | A+C | P2 |
| R-18 | 2 §3.2 | Đánh đổi sản lượng–chất lượng–chi phí–giá–nhu cầu–uy tín | APPROVED | 6.2, 10 | `farm/model.js:293` (bón ×1,1 **và** +5 chất lượng, 1 xu) | C | P0 |
| R-19 | 3 §3.3 | Ba tiến trình độc lập Wealth / Mastery / Awakening | APPROVED | 9.1, F-36★ | `farm/model.js` (XP chung; bán chợ cho XP = ⌊xu/2⌋) | A+C | P1 |
| R-20 | 3 §3.3 | Hai kiểu thắng: Economic / Discovery Victory | APPROVED | F-36★, 15.1★ | — | A+D | P1 |
| R-21 | 3 §4 | Decode & Awaken xuyên suốt, **không phải tầng thứ 3 bắt buộc** | APPROVED | F-35★ | — | A | P0 |
| R-22 | 3 §4 | Awaken mở lựa chọn/công cụ/câu chuyện, không chỉ buff số | APPROVED | A.1 (mẹo là buff số) | `heaven/content.js` | D | P1 |
| R-23 | 3 §4.1 | 6 loại Divine Data Fragments, trao khi kiểm chứng | PROPOSED | F-35★ | — | A | P2 |
| R-24 | 3 §4.2 | Awakening Tree 6 Key; không bán Key; không leaderboard tâm thức | PROPOSED (luật cấm: APPROVED §7) | 1.5★, 10.6★ | — | A | P2 |
| R-25 | 4 §4.3 | Nhiệm vụ Yield vs Quality | PROPOSED | — | `farm/model.js:293` | C | P2 |
| R-26 | 4 §4.3 | Nhiệm vụ The Bitter Truth (doanh thu ↑ lợi nhuận ↓) | PROPOSED | — | `farm/model.js` có `cafe.revenue/costs`, không hiển thị lãi | A+C | P2 |
| R-27 | 4 §4.3, 7 §9 ph.3, GB-005 | First Sixth Key: pha 2 ly → so sánh → giả thuyết → ly 3 → Key of Curiosity | PROPOSED (backlog P0) | F-35★ | — | A | P0 |
| R-28 | 4 §4.4 | Resonance là biểu tượng; không thưởng theo caffeine, không ép cảm xúc tích cực | APPROVED/PROPOSED | 1.5★ | — | A | P2 |
| R-29 | 4 §5 | Không tự nhận dự đoán đúng vị thật; không một công thức tối ưu | APPROVED | 2 (trụ 4 sửa)★, 1.4 | `cafe/bench.js:249` (một vạch chuẩn mỗi món), `i18n/locales/cafe.js:70,357` | B (đã sửa GDD) + C | P0 |
| R-30 | 4 §5 | Pour-over là phương pháp đầu tiên | APPROVED | A.4 (V60 mở cuối, cần Bộ V60) | `cafe/recipes.js:222-228` | B+D | P0 |
| R-31 | 4 §5 | Biến số: cultivar, vùng, độ cao, sơ chế, profile rang, bloom, nhịp rót, nhiệt, thời gian | APPROVED | A.3, A.4 | `farm/content.js`, `cafe/recipes.js` (V60 không có bước nhiệt/thời gian/final pour) | A+C | P1 |
| R-32 | 4 §5.1 | 6 thuộc tính cảm quan; tách đặc tính / chất lượng kỹ thuật / yêu thích / ký ức | APPROVED | F-34★ | `farm/model.js:548` (một số `quality`) | A+C | P0 |
| R-33 | 4 §5.2 | 8 nhóm dữ liệu Bean…Taste | APPROVED | F-33★ | có một phần: nước/sữa (F-31), tráng giấy V60 | A | P1 |
| R-34 | 5 §5.2 | Dữ liệu sức khỏe/cảm xúc tùy chọn, riêng tư | APPROVED | 1.5★, F-33★ | — | A | P1 |
| R-35 | 5 §5.3 | Coffee Memory: Brew → Taste độc lập → Compare → Reflect → Save Insight → Plan | APPROVED | F-33★ | không có (`journal` chỉ là log 60 dòng) | A+C | P0 |
| R-36 | 5 §5.3 | Chấm độc lập trước khi xem điểm cũ | APPROVED | F-33★ | `cafe/bench.js` hiện ★ tốt nhất trước khi pha | C | P1 |
| R-37 | 5 §5.3 | Lưu riêng recipe dự định và phiên pha thực tế, giữ snapshot | APPROVED | F-33★ | `cafe/bench.js` (`state.values` không lưu) | A+C | P0 |
| R-38 | 5 §5.3 | Quick Taste / Journal / Scientist; Repeat Last Brew; My Coffee Setup | APPROVED | F-33★ | — | A | P1 |
| R-39 | 5 §5.3 | Người chơi sửa/xuất/xóa dữ liệu; báo nguy cơ mất localStorage | APPROVED | F-37★ | `src/state/progress.js`, `src/ui/settings.js` (chỉ Reset) | A+C | P0 |
| R-40 | 5 §6 | Giải đấu, Virtual Judges, reputation công thức | APPROVED định hướng / PROPOSED | 14.4 | — | ✓ (để sau, MVP chỉ 1 Brewing Challenge) | P2 |
| R-41 | 6 §7 | F2P, không pay-to-win, không bán Sixth Key, không khai thác cảm xúc | APPROVED | 10.6★ | không có thanh toán | ✓ / A | P2 |
| R-42 | 6 §7 | Coffee Coins / Gems / Pass / Lab Pro / Founder's Pack | PROPOSED | 10.6★ (để sau) | "xu" = soft currency | ✓ / D | P2 |
| R-43 | 6 §7, 9 §11.1 | Giao dịch có nguồn/đích, giải thích được lợi nhuận; không tin số dư client | APPROVED | 10.1, 13 | `farm/model.js:162-163` (`ledger` cắt 60 dòng; điểm ly nhận từ UI) | C | P1 |
| R-44 | 6 §8.1 | Glossary cà phê EN/VI; định dạng tiền/ngày/nhiệt độ theo locale | APPROVED | — | `src/i18n/index.js` (`formatNumber`; không có °F) | A | P2 |
| R-45 | 6 §8.2 | Analytics events tối thiểu + envelope; không gửi nhật ký/sức khỏe | APPROVED | F-38★ | không có analytics trong `src/` | A | P1 |
| R-46 | 7 §8.3–8.4 | LiveOps, Founder Control Center, marketing automation | PROPOSED / APPROVED (chưa chạy trước MVP) | 14.4 | — | ✓ (để sau) | P2 |
| R-47 | 7 §9 | Thứ tự phase 0–6 | Quyết định gần nhất | 14 (ghi chú)★, D-16★ | toàn bộ `src/features/` | B | P0 |
| R-48 | 8 §10 | Repo canonical `tahulk79/TheCoffeeSixSense`; HOLD không cập nhật GitHub | GAP / HOLD | Thông tin tài liệu | remote `cog` = `tahulk79/COG-CoffeeGame`, `origin` = `beolamtat/V2` | D | P0 |
| R-49 | 8 §11 | CI lint/typecheck/build/tests; versioning schema/scoring/config | PROPOSED quy trình | 13 | `package.json` (không có script test), `.github/workflows/` chỉ `design-notify.yml`; save `version: 1` | C | P1 |
| R-50 | 9 §11.1 | Brew: cùng input + **model version** → cùng kết quả; UI ghi rõ là simulation | APPROVED | 7.4, F-39★ | `cafe/bench.js` (deterministic, không có version, không có nhãn) | C | P0 |
| R-51 | 9 §11.1 | Responsive Safari iPad dọc/ngang, phone nhỏ, desktop; không phụ thuộc hover | APPROVED | 11.2 | `ui/styles/ui-kit.css` (hover trong `@media(hover:hover)`) | ✓ (chưa kiểm iPad) | P1 |
| R-52 | 14 PL §7.3 | Chơi bằng chạm ở màn dọc, không bắt buộc thao tác chính xác | Phụ lục | 7.1 | `cafe/bench.js` (giữ-thả tới vạch) | C nhẹ | P2 |
| R-53 | 14 PL §7.4 | Giải thích theo biến lệch nhất | Phụ lục | A.1 | `cafe/bench.js:352` (chỉ hiện khi có mẹo `adjust`) | C | P1 |
| R-54 | 15 PL §10 | Challenges: thử 2 hạt, cải thiện công thức, lưu nhật ký | Phụ lục | 9.2 | `farm/content.js` (nhiệm vụ thao tác) | A | P1 |
| R-55 | 16 PL §13.1 | Route `/play /lab /memory /challenges /profile` | Phụ lục ("chưa phải hợp đồng") | 4.1 | luồng 3D 00→04 | B (lịch sử, không làm) | — |
| R-56 | 17 PL §13.2 | FTUE "Start Brewing" ngay | Phụ lục | 9.4 | `docs/shared/onboarding-flow.md` | B (lịch sử) / D | P2 |
| R-57 | 17 PL §15 | MVP không làm kinh tế phức tạp | Phụ lục | 10 | `farm/`, `cafe/` | B (lịch sử, thua §9 ph.4) | — |
| R-58 | 24 PL §29 | Definition of Done: iPad touch, EN/VI, không hỏng Memory, có mô tả giới hạn điểm | Phụ lục (cho Web MVP) | 14.5★ | — | A | P1 |

## 4. Phân loại

### 4.1 PDF quy định nhưng GDD còn thiếu (A)

R-03, R-04, R-07, R-08, R-09, R-13, R-16, R-19, R-20, R-21, R-23, R-24, R-26, R-27, R-28, R-32, R-33, R-34, R-35, R-38, R-39, R-44, R-45, R-54, R-58.
→ v1.9 thêm mục **1.5 Tầm nhìn theo tài liệu chuẩn**, **10.6 Nguyên tắc kiếm tiền**, **14.5 Definition of Done**, dòng F-33…F-39 ở bảng 0.3.

### 4.2 GDD mâu thuẫn PDF (B)

| ID | GDD (trước) | PDF | Xử lý trong v1.9 |
|---|---|---|---|
| R-29 | Trụ 4 "Chấm theo số đo thật"; 1.4 "Kiến thức thật … là luật chơi" | §5: mô phỏng có nhân quả hợp lý, không tự nhận đoán đúng vị thật | **Đã sửa câu chữ GDD.** Chữ UI là code → backlog B-04 |
| R-30 | A.4: V60 là món mở cuối, cần mua Bộ V60 | §5: pour-over là phương pháp đầu tiên | Ghi D-17, chờ quyết định Q-02 |
| R-47 | Mục 14: kinh tế trước, chưa có Memory/Key | §9: Core Brew → Memory → Sixth Key → Economy | Ghi D-16, chờ quyết định Q-01 |
| R-55/56/57 | 3D, FTUE qua truyện, kinh tế đầy đủ | Phụ lục: route web 2D, Start Brewing, không kinh tế | Phụ lục là lịch sử, thua §1–13 → **giữ GDD**, ghi lý do ở 1.5 |

### 4.3 Code không đúng thiết kế trong PDF (C) — không sửa ở bước này

| ID | Khác biệt | File | Đề xuất |
|---|---|---|---|
| R-50 | Không có nhãn "mô phỏng", không có `model_version` cho điểm ly | `src/features/cafe/bench.js:345-352` | B-04 |
| R-29 | Chữ "Real brew ratios / Tỉ lệ pha thật" | `src/i18n/locales/cafe.js:70,357` | B-04 |
| R-39 | Không xuất/nhập/xóa riêng; không báo nguy cơ mất save; chữ Reset ghi "không hoàn tác" dù có bản `-backup` | `src/state/progress.js`, `src/ui/settings.js` | B-03 |
| R-18 | Bón/tỉa tăng cả sản lượng lẫn chất lượng, chi phí ~1 xu → không có đánh đổi | `src/features/farm/model.js:293` | Q-05 |
| R-31 | V60: hạt, xay, giấy, liều, bloom, một lần rót; không có bước nhiệt, thời gian, final pour (thẻ món ghi 92–94 °C) | `src/features/cafe/recipes.js:222-228` | B-05 |
| R-36 | Hiện ★ tốt nhất trước khi pha (neo điểm) | `src/features/cafe/bench.js` | làm cùng B-02 |
| R-37 | Giá trị từng bước của ly không được lưu | `src/features/cafe/bench.js` | làm cùng B-01 |
| R-19 | Bán chợ cho XP = ⌊xu/2⌋ → Mastery gắn với Wealth | `src/features/farm/model.js` | Q-04 |
| R-43 | `ledger` chỉ 60 dòng; điểm ly nhận từ UI (clamp 0–100) | `src/features/farm/model.js:162-163, 541-555` | chấp nhận ở alpha; ghi rủi ro |
| R-53 | "Sửa bước này trước" chỉ hiện khi có mẹo `adjust` | `src/features/cafe/bench.js:352` | Q-03 |
| R-12, R-15 | Không có phương pháp sơ chế, không có hệ số vùng | `src/features/farm/content.js`, `model.js` | nối `crop-processing-proposal.md` |
| R-49 | Không có script test trong `package.json`, CI chỉ có `design-notify` | `package.json`, `.github/workflows/` | B-08 |

### 4.4 PDF chưa rõ, cần quyết định bổ sung (D)

| Mã | Câu hỏi | Phương án (khuyến nghị in đậm) |
|---|---|---|
| Q-01 | Thứ tự lộ trình: PDF §9 hay hướng hiện tại? | **A. Coi kinh tế hiện có là "Phase 4 slice đã xong", tạm dừng mở rộng kinh tế (F-12, F-22, F-32), làm Memory + Sixth Key gắn vào bàn pha.** B. Giữ hướng hiện tại, đẩy Memory/Key sang Phase 6 (trái GB-003…005 P0) |
| Q-02 | Vị trí pour-over | **A. Giữ Phin là món đầu (bản sắc Việt), nâng V60 đủ 3 giai đoạn + bước nhiệt, mở sớm qua nhiệm vụ, dùng V60 cho First Sixth Key.** B. V60 có sẵn từ đầu, thay Phin trong hướng dẫn |
| Q-03 | Mẹo thiên đàng có là Awaken/Fragment không? | **A. Không — giữ là bài học (Mastery); Fragment chỉ trao khi kiểm chứng ở farm/quán.** B. Đổi thưởng thiên đàng thành "câu hỏi mở" mở nhiệm vụ Decode (đổi F-03/F-04 đã chốt) |
| Q-04 | Ba trục tiến trình có tách số liệu không? | A. Bỏ XP từ bán chợ, XP chỉ từ thao tác/khám phá. B. Giữ XP chung, chỉ đặt tên trục trong UI. Cần Economy sim |
| Q-05 | Đánh đổi năng suất ↔ chất lượng là luật thật hay chỉ nội dung nhiệm vụ? | A. Có chi phí thật (bón tăng sản lượng, giảm chất lượng; hoặc giống năng suất cao–chất lượng thấp). B. Chỉ làm trong nhiệm vụ Yield vs Quality |
| Q-06 | Điều kiện Economic / Discovery Victory | Mốc tổng tài sản, số quán, danh tiếng / số Key. Liên quan sink cuối game EC-5 |
| Q-07 | Chủ quán có tự đặt giá món? | Có / không (PDF §3.2 liệt kê "giá") |
| Q-08 | Vùng có ảnh hưởng số liệu không (khí hậu, đất, độ cao)? | Hệ số năng suất/chất lượng · hệ số giá · chỉ thưởng nhiệm vụ |
| Q-09 | Repo canonical và lệnh HOLD (§10) | PDF ghi `TheCoffeeSixSense` và HOLD "không cập nhật GitHub"; repo này là `COG-CoffeeGame`/`beolamtat/V2` và PDF đã được commit (`4f361ba`). Cần founder xác nhận repo nào là chuẩn và HOLD còn hiệu lực không |
| Q-10 | Coffee Memory ghi ly game hay ly thật ngoài đời? | §5.3 "ghi ly thật" + §5.1 "tự pha ngoài đời" → **A. Một sổ tay chung: ly game có số đo tự điền, ly thật người chơi nhập.** B. Chỉ ly game trong MVP |
| Q-11 | Analytics trước hay sau backend? | PDF §8.2 APPROVED nhưng Phụ lục "khi có backend"; chọn công cụ (Supabase/khác) — ngoài ngân sách $300? |

## 5. Vấn đề theo mức ưu tiên

### P0 — chặn việc đúng hướng tài liệu chuẩn

| # | Vấn đề | Truy vết |
|---|---|---|
| P0-1 | Chưa chốt thứ tự lộ trình so với PDF §9 | R-47, Q-01 |
| P0-2 | Chưa có Coffee Memory (lưu, so sánh, insight) | R-03, R-35, R-37 |
| P0-3 | Chưa có nếm 6 thuộc tính, tách điểm mô hình khỏi cảm nhận | R-32 |
| P0-4 | Chưa có First Sixth Key / Decode (lớp phủ, không phải màn mới) | R-21, R-27 |
| P0-5 | UI và GDD không ghi rõ điểm là mô phỏng; không có `model_version` | R-29, R-50 |
| P0-6 | Không xuất/xóa dữ liệu, không báo nguy cơ mất save localStorage | R-39 |
| P0-7 | Không có đánh đổi năng suất–chất lượng–chi phí như §3.2 | R-18 |
| P0-8 | Vị trí pour-over mâu thuẫn §5 | R-30, Q-02 |
| P0-9 | Repo canonical / HOLD mâu thuẫn trạng thái thật | R-48, Q-09 |

### P1

Lore Databean trong truyện (R-07); Sixth Key 3 chiều (R-09); ba trục tiến trình và điều kiện thắng (R-19, R-20); mẹo thiên đàng vs Awaken (R-22); sơ chế, hệ số vùng (R-12, R-15); hạt xanh bán sỉ / đối tác (R-16); V60 thiếu nhiệt, thời gian, final pour (R-31); 8 nhóm dữ liệu (R-33); quyền riêng tư cảm xúc (R-34); chấm độc lập chống neo (R-36); 3 chế độ nhập (R-38); ledger giải thích lợi nhuận (R-43); analytics tối thiểu (R-45); CI/test script, versioning save (R-49); kiểm iPad (R-05, R-51); biến lệch nhất luôn hiện (R-53); Challenges thử nghiệm (R-54); Definition of Done (R-58).

### P2

Thông điệp thương hiệu (R-04), lore hư cấu (R-08), logo (R-10), Learn trong vòng lặp (R-13), giá/marketing/chuỗi quán (R-17), Fragments/Awakening Tree (R-23, R-24), nhiệm vụ mẫu (R-25, R-26), Resonance (R-28), giải đấu, monetization, LiveOps (R-40…R-42, R-46), glossary (R-44), chạm một lần để rót (R-52), FTUE "chơi nhanh" (R-56).

## 6. Backlog cần triển khai

Chỉ triển khai sau khi founder chốt Q tương ứng (AGENTS.md: cần `Đã chốt` + dòng F-xx). Thứ tự gợi ý theo PDF §9.

| ID | Việc | F-xx | Phụ thuộc | Ước lượng |
|---|---|---|---|---|
| B-01 | Lưu phiên pha (`values` từng bước, hạt, món, `model_version`, thời điểm) vào save + migration `version` | F-33, F-39 | `docs/shared/contracts.md` | M |
| B-02 | Quick Taste: 6 chip 1–5 sau ly tự pha, ẩn điểm cũ tới khi nộp, không ảnh hưởng giá bán | F-34 | B-01 | M |
| B-03 | Cài đặt › Dữ liệu: Xuất / Nhập / Xóa + dòng "Save chỉ nằm trong trình duyệt này"; sửa chữ "không hoàn tác" | F-37 | — | S |
| B-04 | Nhãn "Theo mô hình game" ở màn kết quả ly; đổi chữ "Tỉ lệ pha thật"; hằng `SCORE_MODEL_VERSION` | F-39 | — | S |
| B-05 | V60 đủ bloom / main / final pour + bước nhiệt; mở sớm (theo Q-02) | F-14 (mở rộng) | Q-02 | M |
| B-06 | Sổ tay Coffee Memory (modal ở quầy pha): lịch sử, so sánh A/B, cảnh báo đổi ≥ 2 biến, insight, Pha lại ly trước | F-33 | B-01, B-02, Q-10 | L |
| B-07 | First Sixth Key: pha 2 ly → so sánh → giả thuyết → ly 3 → Key of Curiosity | F-35 | B-06, Q-03 | L |
| B-08 | Thêm `npm test` (`node --test tests/*.test.js`) và CI chạy test + build; test determinism điểm ly | — | — | S |
| B-09 | Đánh đổi năng suất–chất lượng (theo Q-05) + chạy lại `scripts/balance-sim.mjs` | F-20 | Q-05 | M |
| B-10 | Ba trục tiến trình + điều kiện thắng (theo Q-04, Q-06) | F-36 | Q-04, Q-06 | L |
| B-11 | Analytics tối thiểu theo §8.2 (sau khi chọn công cụ) | F-38 | Q-11 | M |
| B-12 | Playtest Safari iPad dọc/ngang + phone nhỏ + desktop theo Definition of Done 14.5 | — | — | S |

S ≈ ≤ 1 ngày, M ≈ 2–3 ngày, L ≈ ≥ 1 tuần — ước lượng thô, chưa có bằng chứng.

## 7. Đề xuất cải tiến chưa được phê duyệt

Các ý dưới đây là gợi ý của nhóm, **không** đưa vào GDD như luật:

- Memory đặt là "sổ tay" vật thể 3D ở quầy pha, không làm route web (UX).
- Lối «Chơi nhanh» ở màn chọn để vào thẳng quán, nếu đo thấy ly đầu > 5 phút (UX).
- Tùy chọn trợ năng "Chạm một lần để rót đủ" (UX).
- Chữ tối thiểu 14 px cho chỉ dẫn trên mobile; mọi trạng thái màu có icon/chữ đi kèm (UX).
- Mở rộng sim cho nơi chỉ trồng/chỉ quán, nhân viên/robot trước khi chốt thưởng vùng (Economy).
- Nhiệm vụ "thử 2 hạt", "cải thiện 1 món" thêm vào chuỗi 9.2 khi có Memory (Game Designer).

## 8. Chưa xác minh

- Không chạy test, build, sim, trình duyệt; chưa có bằng chứng iPad.
- Chưa mở: `scripts/balance-sim.mjs`, `docs/shared/robot-staff.md`, `03-farm/rules.md`, `04-cafe/gameplay.md`, `cafe/ui.js`, lời thoại thiên đàng chi tiết.
- Dòng code dẫn chứng chính đã kiểm lại trực tiếp: `cafe/recipes.js:222-228`, `farm/model.js:162-163, 293`, `cafe/bench.js:345-352`, `i18n/locales/cafe.js:70,357`; các dòng còn lại theo báo cáo của từng chuyên gia.

## 9. Quyết định ngày 04/11/2026 (Quang) và việc còn mở

| Điểm | Quyết định | Áp dụng vào | Còn lại |
|---|---|---|---|
| Q-01 Lộ trình | **Kết hợp:** giữ kinh tế đang có, bổ sung Phase 1–3 (Core Brew, Memory, First Sixth Key) làm ưu tiên kế tiếp | GDD 14.4 (thứ tự làm tiếp) | — |
| Q-02 Pour-over | **Theo PDF:** V60 có sẵn, món hướng dẫn đầu, đủ nhiệt + bloom + rót chính + rót cuối + thời gian | F-40; `04-cafe/gameplay.md`, `onboarding-flow.md` 3.7, GDD 7.5, A.4, A.6 | Số liệu Đang chỉnh; đo "ly đầu ≤ 5 phút" khi playtest |
| R-29/R-50 Chữ "thật" | **Giữ "thật"** | GDD trụ cột 4, F-39 (chỉ còn `SCORE_MODEL_VERSION`) | **Lệch PDF APPROVED tr. 4 §5, tr. 9 §11.1 → cần founder xác nhận (D-21).** Gợi ý dung hòa: "thật" cho công thức/số đo, nhãn nhỏ cho điểm ly |
| Q-05 Năng suất ↔ chất lượng | **Theo PDF, Economy cân đối:** bón ×1,15 / −6, tỉa ×0,9 / +10, giá chợ × (0,3 + 0,8 q/100), Đơn Chợ q ≥ 85 ×1,6 | F-41; `03-farm/rules.md` mục 6, GDD 6.2, 10.2, 10.3 | Tính tay (chênh ~12% thay vì +33%); phải chạy sim sau khi code |
| Q-03 Mẹo thiên đàng | **Kết hợp:** mẹo giữ (Mastery) + câu hỏi mở kiểm chứng ở farm/quán → Fragment | F-35; `02-heaven/gameplay.md`, GDD 3.1, 5.3 | Spec `docs/shared/decode-awaken.md` (D-22) |
| Q-09 Repo | **Làm trên V2** (`beolamtat/V2`), sau MR vào `cog` `main`; tên repo trong PDF §10 không áp dụng | GDD Thông tin tài liệu | — |

**Còn cần chốt:**

1. D-21: founder xác nhận giữ chữ "thật" (trái PDF), hoặc chọn cách dung hòa.
2. Q-10: Coffee Memory ghi ly trong game, ly thật ngoài đời, hay cả hai — chặn spec Memory (D-23).
3. Q-04: tách ba trục tiến trình (bỏ XP từ bán chợ?).
4. Q-06: điều kiện Economic / Discovery Victory.
5. Q-07: chủ quán tự đặt giá món?
6. Q-08: vùng có ảnh hưởng số liệu?
7. Q-11: công cụ và thời điểm analytics.
8. Viết spec D-22 (Decode & Awaken) và D-23 (Coffee Memory) trước khi code F-33…F-35.

## 10. Quyết định đợt 2 (04/11/2026) — đã áp dụng

| Mã | Quyết định | Áp dụng vào |
|---|---|---|
| D-21 | Giữ công thức và số đo thật, ghi rõ điểm số là mô phỏng | F-39; `04-cafe/gameplay.md` mục "Pour-over", GDD 2, 7.4 |
| Q-10 | Coffee Memory lưu cả ly trong game và ly ngoài đời | [shared/coffee-memory.md](../shared/coffee-memory.md) (D-23) |
| Q-04 | Tách Wealth / Mastery / Awakening | [shared/progression.md](../shared/progression.md), GDD 9.1 |
| Q-06 | Hai mục tiêu thắng độc lập | [shared/progression.md](../shared/progression.md) mục 3 |
| Q-07 | Chủ quán tự đặt giá có giới hạn | F-42; `04-cafe/gameplay.md` mục "Chủ quán tự đặt giá" |
| Q-08 | Vùng ảnh hưởng số liệu trồng trọt | F-43; `02b-world-map/README.md` mục "Vùng ảnh hưởng trồng trọt" |
| Q-11 | Analytics theo sự kiện, từ MVP | [shared/analytics.md](../shared/analytics.md) |
| D-22/23 | Viết hai spec trước khi code | [shared/decode-awaken.md](../shared/decode-awaken.md), [shared/coffee-memory.md](../shared/coffee-memory.md); dữ liệu ở `contracts.md` mục 8 |

**Còn lại (không còn câu hỏi thiết kế mở từ PDF):**

1. **D-25** — mọi số mới (trần XP chợ 40, ngưỡng thắng 300.000 xu, hệ số giá 0,8–1,3 và p^1,5, hệ số vùng, bón/tỉa) là tính tay; phải chạy `scripts/balance-sim.mjs` sau khi code để chốt.
2. **D-26** — chọn nơi nhận analytics và người cấp project (không chặn phần ghi hàng chờ local).
3. Lời thoại 6 đoạn lore Databean (Key) và chữ EN/VI cho các tính năng mới — viết khi code.
