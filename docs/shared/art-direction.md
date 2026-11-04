# 03 — Art Direction (Phase 2)

Đầu vào: kết quả audit (`01`, `02`). Ràng buộc: không đổi gameplay, camera, điều khiển. Ưu tiên sửa asset và token sẵn có trước khi tạo mới. Chạy trên mobile WebGL.

## 1. Ba hướng đã cân nhắc

| | A. **"Phố Nắng Cà Phê"**: stylized ấm, chất liệu Việt *(khuyến nghị)* | B. **"Diorama màu nước"**: tranh vẽ tay | C. **"Toy low-poly"**: khối phẳng tươi |
|---|---|---|---|
| Cảm giác | Vườn cà phê cao nguyên + phố cổ: gỗ, mây tre, vôi vàng, ngói đỏ, sơn mài. Ấm áp, gần gũi, có cá tính Việt | Như sách tranh: viền mực, texture giấy, bóng tô tay | Đồ chơi nhựa nhám, màu bão hòa, flat shading |
| Hợp với asset hiện có | **Cao**: khung gỗ/giấy da của UI kit, model Meshy texture ấm, đất farm đã có texture | Thấp: phải vẽ lại texture, cần shader outline/hatching, model Meshy lệch phong cách | Trung bình: phải bỏ texture Meshy hoặc tô phẳng lại |
| Chi phí | Thấp → trung bình: chỉnh token, icon SVG, ánh sáng, thay dần khối tạm | Cao: shader tùy biến, vẽ lại toàn bộ texture, rủi ro hiệu năng | Trung bình: đổi vật liệu hàng loạt, ít chi tiết nên dễ "rẻ" |
| Hiệu năng mobile | Tốt: Standard/Lambert + baked AO nhẹ, không post-process | Kém: thêm pass outline + texture lớn | Rất tốt |
| Bản sắc | Rõ: chất liệu và hoa văn Việt là điểm nhận diện | Rõ nhưng xa chủ đề cà phê đời thường | **Yếu**: dễ lẫn với hàng trăm game casual |
| Rủi ro | Lạm dụng hoa văn làm UI rối → giới hạn bằng quy tắc mục 5 | Không đồng bộ giữa scene cũ và mới trong thời gian dài | Mất bản sắc, khó giữ chân người chơi |

**Chọn A.** Hướng này phát triển tiếp nền gỗ/giấy da đang có, nên chỉ cần tiến hóa chứ không phải viết lại. Nó dùng lại được asset Meshy, chi phí GPU thấp và có bản sắc Việt rõ nhất.

## 2. Ba trụ cột hình ảnh

1. **Nắng cao nguyên ấm.** Ánh sáng là nhân vật chính: nắng vàng ấm, bóng mát ánh xanh, có giờ trong ngày. Thoát khỏi kiểu "kem trên kem" phẳng như hiện nay.
2. **Chất liệu thủ công.** Gỗ, mây tre đan, gốm nung, vải bố, giấy dó, sơn mài. Bề mặt nhám, không bóng nhựa.
3. **Đọc được trong 1 giây.** Thế giới đông chi tiết, nhưng mục tiêu tương tác luôn nổi bật nhờ màu nhấn, viền sáng và marker. Tỷ lệ chiếm màn hình: UI ≤ 20%, đối tượng tương tác nằm trong dải sáng ấm.

## 3. Bảng màu thế giới (3D)

| Vai trò | Màu | Ghi chú |
|---|---|---|
| Nắng (key light) | `#ffe2b0` | Ấm, cường độ cao hơn ambient ≈ 3:1 |
| Trời / bóng (hemi sky) | `#cfe2f2` | Bóng ngả xanh nhạt để tách khối |
| Đất phản xạ (hemi ground) | `#8b7a55` | Nâu đất đỏ bazan, không xanh lá như hiện tại |
| Đất bazan | `#8a4b2e` → `#b0683f` | Luống, đường đất farm |
| Cỏ / lá cà phê | `#5f8a3c` / `#3f6b34` | Dùng chung `--ui-good` để UI và thế giới cùng họ màu |
| Quả chín | `#c8402f` | Màu nhấn mạnh nhất của farm, dành cho thứ cần hái |
| Gỗ ấm | `#a57940` / `#76502c` | Trùng `--ui-wood` / `--ui-wood-dark` |
| Vôi vàng phố cổ | `#f1d48a` | Tường quán, nhà phố intro |
| Ngói / sơn mài | `#b5523a` | Mái, điểm nhấn văn hóa; cũng là màu cảnh báo UI |
| Thiên đàng | Nền `#f6efe0` + nhấn ngọc `#5fa596` + vàng kim `#d9a944` | Thêm hai màu nhấn để sàn và đối tượng tách nhau |

Quy tắc: mỗi cảnh có 1 màu chủ đạo, 1 màu phụ và **chỉ 1 màu nhấn cho thứ tương tác được**. Màu nhấn không dùng cho trang trí.

## 4. Ánh sáng & không khí theo cảnh

Cùng một công thức, chỉ đổi tham số. Không thêm post-processing.

| Cảnh | Hemi (sky/ground, cường độ) | Sun (màu, cường độ, hướng) | Fog | Ghi chú |
|---|---|---|---|---|
| Chọn NV | `#e8f0f6/#9c8a66`, ~1.1 | `#ffe6c0` 2.6 + rim giữ nguyên | giữ | Vầng sáng phía sau nhân vật được chọn |
| Intro phố | `#d9e6ee/#7d6a4c`, ~1.3 | `#ffd9a0` 3.2, nắng chiều | nhẹ, ấm | Phần trời: sky gradient + mây sprite thay mây khối xám |
| Thiên đàng | `#fff6e6/#d8c9a8`, ~1.2 | `#fff0cf` 2.8 | sương sáng xa | Nhấn ngọc/vàng trên lối đi, bệ thần; bỏ bớt độ trắng của sàn |
| Farm | `#cfe2f2/#8b7a55`, ~1.1 | `#ffe2b0` 3.2, góc 40° | xa, màu trời | Bóng đổ rõ hơn để luống và cây có khối |
| Quán | `#f4e6cf/#7a5a3a`, ~1.2 | `#ffe2b0` 2.4 qua cửa sổ | không | Đèn treo emissive + lightmap/AO bake thay cho đèn động |

Mục tiêu đo được: cùng góc camera, ảnh sau có vùng tối rõ (bóng dưới cây, mái, quầy). FPS ở preset medium không giảm quá 5% so với baseline trong `02`.

## 5. Vật liệu & model

- Vật liệu **nhám**: roughness 0.7–0.95, metalness 0 (trừ máy espresso/inox 0.6). Cấm bề mặt bóng nhựa.
- Khối thủ tục và model Meshy phải cùng ngôn ngữ: khối thủ tục nhận texture "noise" nhẹ hoặc vertex color 2 tông để không phẳng lì cạnh model có texture.
- Tỷ lệ: người chơi cao 1,7 làm chuẩn; công trình ≤ 2,2× chiều cao người (sân phơi hiện quá to); bàn ghế đúng tỷ lệ người.
- Ưu tiên xử lý: (1) sửa scale/vật liệu model đang có; (2) thay **khối tạm dễ thấy** (khối xanh trên tường quán, ô trắng trên sàn, mây xám intro); (3) chỉ tạo mới bằng Meshy khi có spec (`../archive/redesign/05-scene-redesign-plan.md`).
- Nhân vật: giữ model hiện tại. Sửa cảm giác "Nam là trẻ con" ở màn chọn bằng ánh sáng/focus, không scale.

## 6. Ngôn ngữ UI

UI là **đồ vật trong thế giới game**, không phải trang web:

- **Khung**: gỗ ấm viền sáng (đã có) cho modal lớn; **giấy dó** cho thẻ thông tin; **mây tre đan** (pattern SVG nhẹ, chỉ ở viền/tiêu đề) cho HUD cấp 1. Bỏ dần thẻ trắng bo tròn kiểu SaaS bên trong modal.
- **Nút**: dạng "viên kẹo gỗ" có độ dày (đáy đổ 3px), nhấn xuống 2px. Đã có nền này, chỉ cần chuẩn hóa.
- **Icon**: một bộ SVG riêng (xem `04` §4). Nét nâu mực, tô 2 tông, góc bo, phong cách đồ thủ công. **0 emoji.**
- **Hoa văn**: tối đa 1 họa tiết mỗi màn hình (viền mây tre hoặc góc sơn mài). Không chồng nhiều lớp trang trí.
- **Cấm**: glassmorphism, neon, gradient nhiều màu, shadow mờ lớn kiểu web, thẻ trắng viền xám.

## 7. Typography

- Giữ **Baloo 2**: hỗ trợ đủ dấu tiếng Việt, tròn và thân thiện, đã dùng toàn game. Dùng cho tiêu đề, số, nút (700–800).
- Thân chữ dài (mô tả, hội thoại) dùng **Baloo 2 500–600**. Bỏ Fredoka để giảm tải font, chỉ giữ làm fallback.
- Số tiền/đếm dùng `font-variant-numeric: tabular-nums` để không nhảy khi đổi giá trị.
- Sàn đọc được: mobile ≥ 12px thân, ≥ 11px chú thích. Desktop scale theo `clamp()` (`04` §2).

## 8. Chuyển động

- Cảm giác "nảy nhẹ, có trọng lượng": ease-out cho xuất hiện, ease-in cho biến mất, overshoot ≤ 6% cho phần thưởng.
- Nhịp: phản hồi chạm 80–120 ms · mở/đóng panel 180–240 ms · chuyển cảnh 500–700 ms · phần thưởng bay về HUD 600–800 ms.
- Tôn trọng `prefers-reduced-motion` (đã có ở nhiều chỗ): thay di chuyển bằng fade.

## 9. Phạm vi landscape (đã chốt 2026-11-03)

**Portrait-first, landscape trên điện thoại được hỗ trợ bằng layout gọn riêng**: HUD dạng dải ngang phía trên, nút hành động xếp cột bên phải, hội thoại cao ≤ 30%. Điều kiện kích hoạt: `@media (orientation: landscape) and (max-height: 500px)`. Không khóa xoay màn hình.

## 10. Tham khảo nguyên tắc (không lấy tài sản)

Chỉ học **nguyên tắc** từ dòng game nông trại/phiêu lưu cozy chất lượng cao:
- HUD bám góc, số liệu dạng icon + số.
- Menu phụ gom vào một nút.
- Đối tượng tương tác có viền sáng hoặc marker nổi.
- Bảng chọn đồ là lưới ô vuông có badge số lượng.
- Ánh sáng ấm có giờ trong ngày.

Không sao chép bố cục, icon, màu đặc trưng hay nhân vật của bất kỳ game cụ thể nào.
