# 09 — Chuỗi phản hồi Input → Feedback → Animation → Confirm → Reward

> Đo trên Chrome desktop (Mac) giả lập viewport/CPU throttle; không phải thiết bị di động thật.
> Nguồn: Test A (newplayer, 390×844, input chuột, **1,5–3 fps vì pane ẩn** — xem `02_PLAYER_JOURNEYS.md`) + đọc code. Cột "Thấy khi chơi" chỉ ghi điều đã thấy trong ảnh; phần còn lại là "từ code". Ở fps thấp, hạt/icon bay ngắn (< 1 s) thường không lọt vào ảnh nên "không thấy" ≠ "không có".

## Bảng chuỗi

| Hành động | Input | Feedback tức thì | Animation | Confirm | Reward | Thấy khi chơi | Lỗ hổng |
|---|---|---|---|---|---|---|---|
| Đổi nhân vật | Mũi tên / tab Nam-Nữ / vuốt (`app/game.js:233-262`) | `aria-pressed` đổi ngay (`app/game.js:229-232`) | Trượt bệ + vòm sáng nhấp nháy (`selection/scene.js:177-205`), tôn trọng reduced-motion | Dấu ✓ dưới bệ | — | Có (ảnh 01) | Mũi tên ở đầu danh sách vẫn đổi (chỉ 2 nhân vật nên mũi tên nào cũng "đổi người còn lại", `app/game.js:234`) — đúng thiết kế |
| Tiếp hội thoại | Chạm bất kỳ / Enter / nút ▾ (`app/game.js:265-268`) | Câu mới | Chữ hiện; intro có cảnh chạy theo timeline | — | — | Có (ảnh 03) | Chữ gợi ý "Enter hoặc bấm để tiếp" vì input chuột (`ui/dialogue.js:9-10`) |
| Trả lời câu hỏi thiên đàng | Chạm đáp án | Đổi sang hộp kết quả, nhãn "CHÍNH XÁC" / "ĐÃ GHI NHẬN CÂU SAI" | Không thấy hạt | Hộp kết quả + tem "XONG PHẦN THI · 1/2 ĐÚNG" | Dòng "🎓 Mẹo: … +5 chất lượng"; con dấu trên HUD 1/3 (ảnh 07, 08) | Có | Có âm đúng/sai `bench.good`/`bench.bad` (`heaven/game.js:99`); không có hạt riêng cho câu đúng |
| Chạm thẻ nhiệm vụ | Chạm thẻ | Nhân vật tự đi; thiên đàng tự mở câu hỏi khi tới | Đi bộ | — | — | Có (ảnh 05→06) | Không có mũi tên chỉ đường thấy rõ trong ảnh farm (marker 3D có ở `shared/world/scene.js:513`, có thể bị lọt ảnh ở fps thấp) |
| Chọn ô đất trống | Chạm ô | Viền vàng đúng ô + dải giống ở đáy | Nhân vật đi tới | Chạm giống | — | Có (ảnh 14) | Dải giống che joystick |
| Trồng | Chạm giống ở dải | Thanh "Trồng" trên đầu + công cụ khối lắc (`farm/activity.js` update) | Thân đứng yên (chỉ clip đứng/đi/ngã, `characters/motion.js`) | Thông báo kết quả (`noticeResult`, `farm/game.js:823`) | Hạt `soil`×8 + âm `farm.plant` + nảy ô (`farm/feedback.js:13`) | Thanh "Trồng" có (ảnh 15); hạt không thấy | Không có động tác cúi trồng |
| Hái | Chạm cây có giỏ 🧺 | Viền + thanh "Hái" | Như trồng | Thông báo; lần đầu kèm "🎯 Hoàn thành…" (`farm/game.js:118`) | `cherry`×10 + `farm.harvest`; icon bay "+x g" về Kho, "+x xu" về ô xu (`farm/game.js:122-125`); sparkle + `reward.quest` khi xong nhiệm vụ; mở «Vào quán» chấm "Mới" | Thanh "Hái", xu 230→240, XP 10/30, nút "Mới" có (ảnh 16, 17) | Icon cây chín là giỏ, chữ nhiệm vụ nói "quả chín" (A-2) |
| Chạm cây đang lớn | Chạm cây | Viền + toast "Quả đang chín · Cây chưa khát · khoảng 6 phút nữa" | — | — | — | Có (ảnh 13) | Hai bộ đếm lẫn nhau (A-1) |
| Tưới / bón / cỏ / tỉa | Chạm cây có icon việc | Như trồng | Bình/bao/cuốc khối lắc | Thông báo | `water`×12 / `granule`×10 / `leaf`×8 / `leaf`×6 + âm riêng (`farm/feedback.js:14-17`) | Chưa chơi tới | — |
| Mua ruộng | Chạm biển khóa | Vòng sáng ở biển, nhân vật đi tới | Đi bộ | Modal "Mở ruộng 3? · Số dư sau khi mua: 60 xu", nút "180 xu" (`farm/game.js:375-377`) | `farm.build`, `dust`×16 + `sparkle`×10, nảy, rung .6, `coin.spend`, số bay "−180 xu" (`farm/feedback.js:8,62-69`); icon cuốc trên ruộng mới | Modal + ruộng mới + xu 70 (ảnh 18, 19) | Không có — chuỗi đủ 5 bước. Modal khóa phím W (đã thử) |
| Bán ở Chợ | Cửa hàng → Chợ → Bán | Modal | — | Nút bán | `coin`×8 + `coin.gain` + "+xu" bay (`farm/feedback.js:24`, `farm/game.js:122`) | Chưa mở khóa | — |
| Vào quán | Nút «Vào quán» | Màn tải | Cảnh quán | — | — | Có (ảnh 20) | — |
| Mở cửa | Nút «Mở cửa» | Biển "ĐANG MỞ CỬA", thanh ca 4:00 | Cửa mở (ảnh 21) | — | `cafe.door` (`cafe/feedback.js:20`) | Có | — |
| Khách gọi món | Đứng ở quầy thu ngân | Phiếu "Bàn 1 · Sữa đá · 240s", bong bóng món | Khách đi tới quầy | — | pulse quầy + `cafe.order` (`cafe/feedback.js:23`) | Có (ảnh 22) | Khách đầu tới khi ca còn 0:45 (môi trường chậm, A-3) |
| Pha (quầy pha) | Giữ/thả theo bước | `bench.good/partial/bad`, vùng vạch `bench.band`, quá vạch `bench.over` | Rót/đánh có âm vòng lặp (`cafe/feedback.js:43-63`) | Màn kết quả ly | Sao lần lượt `bench.star` cao dần (`cafe/feedback.js:50-53`) | **Chưa chơi tới** | — |
| Bưng ly | Chạm bàn khách | `cafe.cup` + hơi `steam`×6 | Đi bộ | — | `sparkle`×8 + `coin`×6 (+`heart`×6 nếu ≥ 3★) + `cafe.serve` + `coin.gain` (`cafe/feedback.js:26-30`) | Chưa chơi tới | Có "+xu" bay về ô xu (`cafe/service.js:196` → `cafe/game.js:422` `ui.flyReward`) — chuỗi đủ |
| Khách bỏ về | — | `puff`×8 + "−2 uy tín" bay + `cafe.angry` | — | — | Phạt | Không xảy ra | — |
| Hết ca | Đồng hồ | Modal "Hết ca" | — | Báo cáo dài (ảnh 24) | `cafe.shift-good` + sparkle×30 nếu đạt; `shift-bad` nếu không (`cafe/feedback.js:34`) | Có (0 ly, ca tập không trừ uy tín) | Báo cáo nhiều số cho người mới; robot −2,65 xu khi 0 ly (A-5) |

## Kết luận (AI heuristic)

- **Đủ chuỗi:** mua ruộng, hái, bưng ly (từ code) — có cả âm, hạt, số bay, xác nhận.
- **Thiếu "Animation" thân người:** mọi việc farm chỉ có thanh tiến độ + công cụ khối lắc; thân nhân vật đứng tư thế nghỉ (`characters/motion.js` chỉ có Rest/Walk/StumbleAndFall). Đây là khoảng trống lớn nhất của chuỗi phản hồi. Đề xuất: 1–2 tư thế keyframe (cúi, vươn) theo cách đã làm cho `StumbleAndFall`; chi phí trung bình; kiểm bằng clip 60 fps.
- **Câu đúng ở thiên đàng** có âm (`heaven/game.js:99`) nhưng không có hạt/hiệu ứng mừng; mẹo là phần thưởng chính nên có thể thêm `sparkle` nhỏ (chi phí thấp, AI heuristic).
- Hiệu ứng tự giảm theo preset (`shared/vfx/index.js:5-7`: low tắt rung/pulse, giảm hạt) và `reducedMotion()` (`shared/vfx/index.js:296`) — tốt.
- Chưa kiểm: thời lượng/độ mượt animation ở 60 fps, độ trễ input→phản hồi (cần chạy lại ở pane hiện hoặc chrome-devtools).
