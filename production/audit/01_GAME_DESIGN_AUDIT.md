# 01 — Đánh giá thiết kế game (20 khía cạnh)

> Đo trên Chrome desktop (Mac) giả lập viewport/CPU throttle; không phải thiết bị di động thật.
> Nguồn: Test A (người chơi mới, 14,5 phút, xem `02_PLAYER_JOURNEYS.md` — chạy ở 1,5–3 fps do pane ẩn) + đọc code sau khi chơi. **Mọi điểm 0–10 là AI heuristic**, không phải kết quả human playtest. "Chưa chơi tới" = chỉ có bằng chứng từ code.

## Bảng điểm

| # | Khía cạnh | Điểm (AI heuristic) | Ưu tiên |
|---|---|---|---|
| 1 | Động lực | 6 | P2 |
| 2 | Mục tiêu rõ | 7 | P2 |
| 3 | Vui từng khoảnh khắc | 5 | P2 |
| 4 | Quyết định có ý nghĩa | 4 | P2 |
| 5 | Phản hồi | 7 | P3 |
| 6 | Thưởng ngắn hạn | 7 | P3 |
| 7 | Thưởng trung hạn | 5 | P2 |
| 8 | Thưởng dài hạn | 4 | P2 |
| 9 | Thành tựu | 2 | P3 |
| 10 | Khám phá | 5 | P3 |
| 11 | Đa dạng | 6 | P3 |
| 12 | Lặp/mệt | 5 | P2 |
| 13 | Hoạt động phụ | 6 | P4 |
| 14 | Liên kết hệ thống | 7 | P3 |
| 15 | Hình/âm | 7 | P3 |
| 16 | A11y mobile | 5 | P2 |
| 17 | Onboarding | 6 | P1 |
| 18 | Lý do quay lại | 5 | P2 |
| 19 | Công bằng | 6 | P2 |
| 20 | Lý do bỏ game | — (liệt kê rủi ro) | P1 |

## Chi tiết

### 1. Động lực — 6
- **Hiện trạng:** mở đầu có câu chuyện (bị biển đập đầu, "chưa chết · chỉ ngất") và mục tiêu dài "mở quán". Farm có XP/cấp (`farm/content.js:97`), xu, mở khóa HUD dần (`farm/content.js:87+`).
- **Bằng chứng:** ảnh `evidence/newplayer/03…`, `07-heaven-perk-reward.jpg`, `17-…cafe-unlocked.jpg`.
- **Tốt:** giọng kể hài, mẹo thiên đàng có số thật dẫn sang farm/quán.
- **Hỏng:** sau thiên đàng câu chuyện biến mất; không có nhân vật/mục tiêu cảm xúc ở farm (AI heuristic).
- **Đề xuất:** 1 dòng thoại ngắn của Thần Tiếp Nhận khi đạt mốc (ly đầu, ruộng 2, cấp 3). **Chi phí:** thấp (dùng `lesson-prompt`/`dialogue` sẵn có). **Cách kiểm:** chơi mới, đếm số lần có thoại sau khi vào farm.

### 2. Mục tiêu rõ — 7
- **Hiện trạng:** thẻ nhiệm vụ luôn ở góc trên, chạm để tự đi (heaven + farm + bước 1/4–4/4 ở quán). Chuỗi 9 nhiệm vụ (`farm/content.js:73-83`).
- **Bằng chứng:** ảnh 05, 09, 11, 20–23.
- **Tốt:** chạm thẻ = dẫn đường thật (thiên đàng tự đi tới chuyên gia, mở luôn câu hỏi).
- **Hỏng:** chữ "biểu tượng quả chín" không khớp icon giỏ trên cây; chữ chi tiết nhiệm vụ bị cắt "…Nh…" ở 390 px (ảnh 11).
- **Ưu tiên:** P2. **Đề xuất:** đổi chữ thành "Chạm cây có giỏ 🧺" hoặc đổi icon. **Chi phí:** 1 dòng (`farm/content.js:74`). **Cách kiểm:** người mới hái được trong ≤ 20 s mà không chạm cây đang lớn.

### 3. Vui từng khoảnh khắc — 5
- **Hiện trạng:** hành động farm = chạm → đi tới → thanh tiến độ trên đầu + công cụ khối lắc lư (`farm/activity.js`) → hạt + âm. Thân nhân vật chỉ có clip đứng/đi/ngã (`characters/motion.js:26,37,53`), không có động tác làm việc.
- **Tốt:** có hạt (`cherry`, `soil`, `water`), âm riêng từng việc (`farm/feedback.js:12-35`).
- **Hỏng:** chờ thanh tiến độ khi đứng im, không có "nhịp chạm" (AI heuristic).
- **Đề xuất:** thêm tư thế cúi/vươn tay đơn giản bằng keyframe (giống cách làm `StumbleAndFall`). **Chi phí:** trung bình. **Cách kiểm:** quay video 3 hành động, so trước/sau.

### 4. Quyết định có ý nghĩa — 4
- **Hiện trạng:** 6 câu thiên đàng đáp án đúng hiển nhiên (đáp án sai là câu đùa) — ảnh 06, 10. Quà chọn 1 trong 3 có số thật (tốt). Farm: chọn giống (lúc đầu chỉ có Vối), mua ruộng.
- **Hỏng:** câu hỏi không phải lựa chọn thật → mẹo gần như luôn nhận đủ; lựa chọn đầu farm ít.
- **Đề xuất:** 1 đáp án sai "hợp lý" mỗi câu. **Chi phí:** thấp (nội dung `heaven/content.js`). **Cách kiểm:** tỉ lệ đúng của người thật < 90%.

### 5. Phản hồi — 7
- **Hiện trạng:** mỗi hành động farm có âm + hạt + (nảy vật/rung) theo bảng `farm/feedback.js:12-35`; thất bại có `ui.deny`; mất xu có số bay "−x xu" (`farm/feedback.js:65-69`). Quán có bảng tương tự `cafe/feedback.js:18-63`.
- **Tốt:** hái/nhận mẻ có icon bay "+x g" về nút Kho và "+x xu" về ô xu (`farm/game.js:122-125`, `farm/ui.js:651-655` `flyTo`); hoàn thành nhiệm vụ/lên cấp được đặt đầu thông báo (`farm/game.js:118-119`).
- **Hỏng:** thông báo chạm cây trộn 2 bộ đếm (A-1); ở 1,5–3 fps không bắt được icon bay trong ảnh nên chưa xác nhận bằng mắt.
- **Đề xuất:** sửa chữ A-1. **Chi phí:** 1 dòng. **Cách kiểm:** quay clip lần hái đầu ở 60 fps.

### 6. Thưởng ngắn hạn — 7
- Mẹo sau mỗi câu đúng (ảnh 07), +xu +XP khi hái (ảnh 17), nút mới có chấm "Mới", hoàn thành nhiệm vụ có sparkle + `reward.quest` (`farm/feedback.js:76-79`). **Hỏng:** thanh XP chỉ nảy khi lên cấp (`farm/feedback.js:73`), XP lẻ không có hiệu ứng riêng. **Đề xuất:** chưa cần. **Cách kiểm:** clip lần hái đầu.

### 7. Thưởng trung hạn — 5
- Ruộng mới, mở khóa HUD, sao công thức (★ ở quầy pha, chưa chơi tới). **Hỏng:** chuỗi nhiệm vụ chỉ 9 bước; nhiệm vụ tự nhận lệch thứ tự (mua ruộng → tự nhận `expand` trước `serve`, `farm/model.js:228`) nên thẻ không báo. **Đề xuất:** toast "Hoàn thành sớm: Mua ruộng thứ hai +10 xu". **Chi phí:** thấp. **Cách kiểm:** mua ruộng trước khi bán ly, thấy toast.

### 8. Thưởng dài hạn — 4
- Cấp không giới hạn (`farm/content.js:97`), nâng cấp, nhân viên, uy tín quán. **Hỏng:** sau nhiệm vụ 9 không có mục tiêu đặt tên (chưa chơi tới — từ code). **Đề xuất:** mốc quán (uy tín 60/70/80) có tên + phần thưởng. **Chi phí:** trung bình. **Cách kiểm:** mô phỏng `scripts/balance-sim.mjs` xem có mốc mới mỗi ~10 phút.

### 9. Thành tựu — 2
- `grep -rl "thành tựu\|achievement" src` → không có. **Đề xuất:** chưa cần; dùng mốc ở mục 8 trước. **Chi phí:** trung bình. **Cách kiểm:** —.

### 10. Khám phá — 5
- Thiên đàng có 4 NPC; farm có ao cá, sân phơi, giếng, lò rang, khu khóa (ảnh 11, 19). **Hỏng:** chưa có lý do đi khám phá ngoài nhiệm vụ (AI heuristic). **Đề xuất:** đồ trang trí/ao cá mở bằng chạm có toast giới thiệu lần đầu. **Chi phí:** thấp. **Cách kiểm:** chơi mới, đếm vật thể tương tác được mà người chơi tự chạm.

### 11. Đa dạng — 6
- Farm (trồng/tưới/bón/cỏ/tỉa/hái/phơi/rang/xay/giao/cá) + quán (thu ngân, quầy pha nhiều công thức, bưng, dọn). **Hỏng:** 14,5 phút đầu chỉ chạm vào cây và biển; phần đa dạng nằm sau. **Ưu tiên:** P3. **Cách kiểm:** đếm loại hành động trong 10 phút đầu.

### 12. Lặp/mệt — 5
- Mỗi việc farm cần chạm → đi → chờ thanh (thời gian `farm.workDuration`). Dải công cụ + kéo nhiều ô chỉ mở ở ruộng 2/cấp 3 (theo `onboarding-flow.md` §3.3). **Rủi ro:** 12 ô × chạm từng ô khi chưa mở công cụ (AI heuristic). **Đề xuất:** giữ như spec; đo số chạm/lứa khi có người thật. **Chi phí:** —. **Cách kiểm:** đếm chạm để chăm 12 ô.

### 13. Hoạt động phụ — 6
- Ao cá (`stockFish/feedFish/harvestFish`), trang trí, sự cố nhân viên/khách (`cafe/service.js:390-405`). **Chưa chơi tới.** Ưu tiên P4.

### 14. Liên kết hệ thống — 7
- Thiên đàng → mẹo có hiệu lực ở farm/quán; farm → hạt rang chuyển về quán (`farm/model.js:374,484`); quán có sẵn 600 g hạt khởi đầu (`farm/model.js:162`). **Tốt:** vòng farm↔quán rõ trên giấy. **Hỏng:** ở phút 10 người chơi chưa thấy hạt của mình vào ly (AI heuristic). **Cách kiểm:** đếm thời gian từ lần hái đầu tới ly đầu dùng hạt tự làm.

### 15. Hình/âm — 7
- Mô hình 3D thống nhất phong cách (ảnh 01, 03, 05, 20). 51 id âm (`shared/audio/sounds.js`), có bus music/ambience/sfx/ui (`shared/audio/index.js:6`). **Hỏng:** robot quán thiếu GLB (A-4), dùng khối tạm; nhân vật chồng lên NPC (A-6). **Chi phí:** asset. **Cách kiểm:** console không còn warn robots.glb.

### 16. A11y mobile — 5
- **Tốt:** nút có `aria-label` (read_page: "Nhân vật trước", "Chọn tên ngẫu nhiên"…), có `prefers-reduced-motion` ở selection (`selection/scene.js:149`) và CSS. **Hỏng:** chữ chi tiết nhiệm vụ bị cắt ở 390 px; NPC/đích dẫn đường bị che dưới joystick (ảnh 12); dải chọn giống che joystick (ảnh 14); chữ cảm ứng chưa kiểm bằng chạm thật. **Ưu tiên:** P2. **Đề xuất:** camera dẫn đường chừa vùng joystick. **Chi phí:** thấp–trung bình. **Cách kiểm:** giả lập chạm thật (chrome-devtools `emulate … touch`) ở 360/390 px.

### 17. Onboarding — 6
- **Tốt:** HUD mở dần, thẻ nhiệm vụ dẫn đường, hướng dẫn quán từng bước 1/4–4/4, ca tập đầu không trừ uy tín (`cafe/service.js:73,449`).
- **Hỏng:** A-1, A-2 (bối rối đầu tiên ở farm); mục tiêu ≤ 5 phút tới ly đầu (`onboarding-flow.md` §2) chưa đo được (môi trường chậm). Nếu máy yếu fps thấp thì ca tập đầu có thể hết trước khi pha (A-3).
- **Ưu tiên:** P1 (đây là cửa vào). **Đề xuất:** sửa chữ A-1/A-2; đo lại 5 phút đầu ở 60 fps. **Chi phí:** thấp. **Cách kiểm:** chạy lại Test A trên chrome-devtools hiện trang (không ẩn).

### 18. Lý do quay lại — 5
- Cây lớn theo thời gian thực, có xử lý offline (`farm/model.js:59,71` `lastAt`, `offline`). **Hỏng:** không có thông báo/mục tiêu "quay lại sau X phút" rõ ở lúc rời (chưa chơi tới, AI heuristic). **Cách kiểm:** đặt `lastAt` lùi 30 phút, xem màn chào lại.

### 19. Công bằng — 6
- Mua ruộng: chỉ trừ khi xác nhận, ghi số dư sau mua (ảnh 18). Ca tập đầu không phạt. **Hỏng:** A-3 — thời gian ca theo đồng hồ thật còn khách theo khung hình; A-5 — báo cáo robot âm xu khi 0 ly (cần kiểm). **Đề xuất A-3:** đếm ca bằng `dt` của game hoặc nhân `spawnIn` theo thời gian thực. **Chi phí:** thấp nhưng **cần quyết định thiết kế**. **Cách kiểm:** CPU throttle 6x, so số khách/ca với 1x.

### 20. Lý do bỏ game (rủi ro, AI heuristic)
1. Phút 7–8: vào farm thấy nhiều thứ, chạm nhầm cây đang lớn, đọc "6 phút nữa" → nghĩ phải chờ lâu (A-1/A-2).
2. Thiên đàng dài và câu hỏi quá dễ → người muốn "vào game" nhanh thấy chậm (intro có nút «Bỏ qua», ảnh 03; trong ảnh thiên đàng không thấy nút tương tự — chưa kiểm code).
3. Ca quán đầu kết thúc "0 ly" trên máy chậm (A-3) → cảm giác thất bại ngay lần đầu.
4. Không có mục tiêu đặt tên sau chuỗi 9 nhiệm vụ (mục 8).
