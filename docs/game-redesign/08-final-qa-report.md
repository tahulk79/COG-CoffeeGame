# 08 — Final QA Report (Phase 6–7)

Ngày: 2026-11-03. Nhánh `feat/round-1-foundation`, chưa commit. Mọi lần kiểm đều chạy trong tab Chrome cô lập với save mẫu, không đụng save thật.

## 1. Test & build

| Kiểm tra | Kết quả |
|---|---|
| `node --test tests/*.test.js` | **33/33 đạt**. Có một cảnh báo `BASE_URL` khi tải `farm/worker.glb` trên Node (không có Vite); có từ trước, không làm test hỏng |
| `npm run build` | **Đạt** trong 1,9 s. Cảnh báo chunk > 500 kB (`index` 735 kB, gzip 200 kB) là do bundle Three.js, có từ trước redesign |
| Console khi chơi | 0 lỗi mới. Một cảnh báo có từ trước: thiếu `public/models/cafe/robots.glb` (game giữ khối tạm) |

## 2. Quality gates

| Gate | Kết quả | Cách kiểm |
|---|---|---|
| Không chữ tràn | ✅ | Script đo `scrollWidth > clientWidth` ở farm, quán, thiên đàng, màn chọn; cả dọc và ngang |
| Không nút chồng nhau | ✅ | Script đo giao nhau của mọi nút ở HUD, ngăn kéo và từng modal. Script có báo 5 cặp trong ngăn kéo farm, nhưng đó là nút bên trong mục `<details>` đang đóng (không được vẽ) và một bong bóng 3D nằm dưới ngăn kéo; xem bằng mắt không có chồng lấn |
| Không modal vượt khung | ✅ | Shop ngang 844×390: 51–359 / 390; quầy pha 390×844: nút cuối ở 735 / 749; ngăn kéo nằm trong màn hình |
| Không icon sai kiểu | ✅ | 0 emoji trong DOM (regex `\p{Emoji_Presentation}`) và trong pseudo-element. Canvas 3D dùng icon SVG qua `fillRich` |
| Không đổi logic gameplay | ✅ | Không sửa `model.js`, `rules.js`, `content.js`, `progress.js`, `journey.js`, `service.js`. Chỉ đổi chữ hiển thị: badge "Thuê · N xu", chuỗi ngắn ở dải trạng thái quán. Mua thử 2 cây: xu và kho đúng. Pha thử: bước 1 → 2 đúng. Trả lời ở thiên đàng: nhiệm vụ chuyển đúng. Thu hoạch: +10 xu, +10 XP |
| Không rò bộ nhớ | ✅ | 10 lần chuyển farm ↔ quán: số object Three.js không đổi, heap sau GC +0,38 MB (`07`) |
| FPS / draw call | ✅ | 60 fps mọi cảnh (CPU ×4), draw ≤ 119, không tăng so với trước (`07`) |
| Vùng chạm ≥ 44px | ✅ | Đã sửa 6 chỗ ở Bước 11; quét lại 0 lỗi |
| Tải mỗi cảnh ≤ 5 MB | ❌ | 6,5–11,5 MB vì GLB chưa nén. Chờ bạn đồng ý thêm glTF Transform |

## 3. Chấm lại theo rubric (`02`)

Cột: 1 Identity · 2 Hierarchy · 3 Readability · 4 Consistency · 5 Art · 6 Composition · 7 Mobile · 8 Feedback · 9 Animation · 10 Perf.

| Màn | Trước | Sau | Thay đổi chính |
|---|---|---|---|
| Loading | 6.1 | **7.2** | Logo, mẹo chơi |
| Chọn nhân vật | 6.3 | **7.1** | Không còn thu nhỏ nhân vật kia; khung ngang; icon |
| Intro + phụ đề | 5.5 | **6.3** | Avatar theo vai; mây chưa đổi |
| Thiên đàng | 4.5 | **6.4** | Nhãn tên cỡ cố định, không còn nhãn khổng lồ hay bị cắt; ánh sáng ấm |
| Hội thoại có lựa chọn | 6.2 | **7.4** | Thẻ lựa chọn game; thẻ nhiệm vụ ẩn khi nói chuyện |
| Farm HUD (cấp 1) | 5.3 | **7.3** | Thanh 4 nút + ngăn kéo; 17% màn hình; nắng và bóng |
| Farm HUD (cấp 9) | 5.0 | **7.2** | Trước 9 nút + 4 panel, giờ thanh 4 nút + badge |
| Túi đồ | 6.0 | **6.8** | Icon cây theo giống, dòng kho gọn |
| Cửa hàng | 5.1 | **6.6** | Hàng gọn, icon riêng; chưa có lưới + panel chi tiết |
| Chợ / nâng cấp / nhân viên / đơn / trang trí | 5.2 | **6.3** | 3 cỡ modal, icon SVG; bố cục bên trong chưa đổi |
| Hồ sơ ứng viên | 5.2 | **6.7** | Hai nút rõ nghĩa, bỏ tiêu đề lặp |
| Quán HUD | 4.4 | **7.0** | Từ 40–60% xuống 21–22% màn hình; dải trạng thái; ánh sáng ấm |
| Nâng cấp quán | 5.2 | **5.9** | Tab và cỡ chung với farm; hàng vẫn là thẻ cao |
| Sổ công thức | 5.2 | **6.8** | 2 cột, icon đúng món |
| Quầy pha chế | 5.9 | **7.0** | Không phải cuộn trên điện thoại |
| Cài đặt | 5.9 | **6.8** | Mỗi thanh trượt một dòng, icon |
| Màn lỗi | 4.0 | **7.0** | Nút hành động, chi tiết kỹ thuật thu gọn |

Điểm trung bình: **5,3 → 6,8**. Điểm vẫn bị kéo xuống ở cột Art (5) và Composition (6) vì phần asset chưa làm.

## 4. Vấn đề còn lại

| Mức | Vấn đề | Cần gì |
|---|---|---|
| P1 | Dung lượng tải 6,5–11,5 MB mỗi cảnh | Bạn đồng ý thêm glTF Transform + `MeshoptDecoder` |
| P1 | Khối tạm còn thấy: khối xanh trên tường quán, ô trắng chỗ bàn chưa mở; mây xám dạng khối ở intro | Asset A5 / intro — dựng trong Blender |
| P1 | Shop chưa theo kiểu lưới + panel chi tiết; còn ~4,7 hàng/màn (mục tiêu 6) | Viết lại phần hiển thị mua trong `farm/ui.js` |
| P2 | Hàng trong modal quán còn cao, nút "Nâng cấp" chưa hiện giá | `cafe/ui.js` |
| P2 | Màu nhấn ngọc ở thiên đàng; mảng tường văn hóa ở quán; props viền farm | Asset Blender (A4, A5, plaza) |
| P2 | Portrait hội thoại render từ model (đang dùng icon dự phòng) | Asset A1 |
| P2 | Marker tương tác theo loại đối tượng; mũi tên khi mục tiêu ngoài khung | Code |
| P2 | Khử răng cưa trên điện thoại; safe area trên máy có tai thỏ | Đo trên thiết bị thật |
| P2 | Bong bóng khách trong quán chưa phóng to khi xoay ngang | `cafe/game.js` |
| P2 | Chưa chụp toast sự cố nhân viên; chưa chơi trọn một ca quán; chưa kiểm nhánh trả lời sai | QA tay |
| — | CSS cũ trong `farm.css` / `cafe.css` bị `hud.css` / `menus.css` đè vẫn chưa xóa | Dọn sau khi bạn duyệt giao diện |

## 5. File đã thêm hoặc sửa trong redesign

- **Thêm:** `src/ui/icons.js`, `src/ui/hud-drawer.js`, `src/ui/styles/hud.css`, `src/ui/styles/menus.css`, `docs/game-redesign/*`.
- **Sửa:** `index.html`, `src/main.js`, `src/app/game.js`, `src/ui/{dialogue,lesson-prompt}.js`, `src/ui/styles/{game,ui-kit,dialogue,farm,cafe}.css`, `src/shared/world/scene.js`, `src/shared/three/models.js`, `src/characters/load-player.js`, `src/features/selection/scene.js`, `src/features/heaven/{scene,ui,game}.js`, `src/features/farm/{game,ui}.js`, `src/features/cafe/{game,ui}.js`.
- Các file trên đã có sẵn thay đổi chưa commit từ trước phiên này (theo `git status` đầu phiên). Diff vì vậy gồm cả phần cũ lẫn phần redesign.

Ảnh: `screenshots/before/` (41) và `screenshots/after/` (35).
