# 01 · Intro (Màn 1)

Đoạn phim tương tác ngắn dựng bằng cảnh 3D, có phụ đề. Nhân vật đi trên phố, né xe đạp, va biển cảnh báo và ngã. Xe cứu thương tới, rồi Thần Chết dẫn hồn lên con đường trên mây và đi qua cổng trời. Màn không có gameplay. Người chơi chỉ tua câu thoại hoặc bỏ qua.

## Vào / ra

| Vào từ | Điều kiện |
|---|---|
| [00 · Chọn nhân vật](../00-selection/README.md) | Bấm Vào Game |

| Ra tới | Khi nào |
|---|---|
| [02 · Thiên đàng](../02-heaven/README.md) | Thời gian chạy tới `DURATION`, bấm Bỏ qua, hoặc tua hết câu thoại (`finish`) |
| Màn lỗi | Dựng cảnh hoặc tải GLB thất bại (`fail`, xem [00](../00-selection/README.md#khởi-động-chung)) |

Tải lại trang giữa intro thì vào lại màn chọn, vì `introCompleted` chỉ được ghi lúc kết thúc.

## Luồng chơi

Thời gian bắt đầu ở `START_TIME` = 1 s và dừng ở `DURATION` = 22 + `LANDING_PAUSE` = 23,5 s. Thời gian xem thực tế là 22,5 s. `PLAYBACK_RATE` = 1, không tua nhanh toàn cảnh.

| Mốc (s) | Người nói | Diễn biến |
|---|---|---|
| 1,5 | Xe đạp | Chuông xe. Nhân vật né sang bên (2–2,75 s) |
| 2,4 | Bạn (tên người chơi) | Quay lại kêu xe đạp |
| 3,4 | — | "Cốp!": va biển cảnh báo, ngã ngửa (3,65–4,45 s) |
| 4,3 | Người dẫn chuyện | Bình luận cú va |
| 6 | Nhân viên y tế | Xe cứu thương chạy vào từ 5 s, dừng ở 6,4 s. Hai y tế đưa cáng tới, nâng người lên cáng (7,9–9,2 s) |
| 9 | Thần Chết | Thần Chết hiện ở 8,8 s, hồn tách ra ở 9,4 s và bay lên từ 9,8 s |
| 12 | Bạn | Y tế khiêng cáng đi (10,8–13,5 s) |
| 14,5 (`LANDING_TIME`) | Thần Chết | Đáp xuống đầu đường trên mây, đứng yên 1,5 s |
| 16 | Thần Chết | Đi liền mạch về phía cổng |
| 20 | Thần Chết | Cổng tự mở khi tới gần, không dừng ở cổng |
| 22,5 | — | Hết thoại. Tới 23,5 s thì sang thiên đàng |

Câu thoại nằm trong `beats` (`timeline.js`), chữ dịch theo `intro.line.*`.

Chi tiết dàn cảnh:
- Xe cứu thương ẩn hoàn toàn trước 5 s.
- Y tế cúi đỡ, nâng đủ cao rồi mới chuyển ngang sang cáng. Thân người nằm nguyên trên cáng khi khiêng.
- Ngã dùng keyframe dựng bằng code và giữ tư thế cuối. Vị trí ngã là mốc chung cho cứu hộ.
- Va chạm tính theo bounds model. Nhân vật bị chặn trước cột, thanh đỡ và biển, kể cả khi tua.

HUD trong lúc chạy:
- Hộp thoại: biểu tượng người nói, tên, câu thoại, dòng gợi ý và nút ▾.
- Nút **Bỏ qua** ở góc.
- Thanh tiến trình `#progress` chạy từ `START_TIME` tới `DURATION`.
- Viền tối (vignette) mờ dần từ giây 8 đến giây 15.

## Điều khiển

| Thao tác | Kết quả |
|---|---|
| Chạm hoặc bấm bất kỳ đâu | Nhảy tới câu thoại có chữ kế tiếp (`nextDialogueTime`), bỏ qua diễn biến ở giữa |
| Nút ▾ | Như trên |
| Phím Enter | Như trên. Không lặp khi giữ phím, không nhận khi đang focus nút hoặc ô nhập |
| Nút **Bỏ qua** | Kết thúc intro ngay |
| Nút ⚙️ | Mở cài đặt. Bấm vào ⚙️ hoặc trong bảng cài đặt không tính là tua thoại |
| Không làm gì | Intro tự chạy hết |

- Dòng gợi ý đổi theo kiểu nhập vừa dùng: "Chạm…" với cảm ứng, "Enter hoặc bấm…" với chuột (`usesTouch`).
- Đổi tab hoặc rời cửa sổ thì vòng lặp dừng. Quay lại thì chạy tiếp từ chỗ cũ (`visibilitychange` trong `game.js`).

## Dữ liệu

Ghi một lần lúc kết thúc (`completeIntro`), vào `godbean-progress`:

| Trường | Giá trị |
|---|---|
| `version` | `1` |
| `introCompleted` | `true` |
| `chapter` | `max(chapter, 2)` |
| `accident` | `'sign-head-bump'` |

Đọc `godbean-player` (`name`, `gender`) để hiện tên người nói "Bạn" và nhãn truy cập của canvas.

## Code

| File | Vai trò |
|---|---|
| `src/features/intro/scene.js` | Dựng phố, xe đạp, biển, xe cứu thương, y tế, cáng, hồn, Thần Chết, đường mây, cổng; `update(time)` đặt mọi thứ theo thời gian; `replaceAsset` gắn GLB vào slot |
| `src/features/intro/timeline.js` | `START_TIME`, `LANDING_TIME`, `LANDING_PAUSE`, `PLAYBACK_RATE`, `DURATION`, `beats`, `beatAt`, `nextDialogueTime` |
| `src/features/intro/collision.js` | `approachOffsetX`: chặn nhân vật trước vật cản |
| `src/features/intro/rescue.js` | `crouchMedic`, `gripStretcher`: tư thế cúi và tay hai khớp bám điểm đỡ hoặc tay cáng |
| `src/app/game.js` | `INTRO_MODELS`, `enterIntro`, `start`, `frame`, `nextDialogue`, `finish`, thanh tiến trình, vignette, phím Enter |
| `src/ui/dialogue.js` | `showDialogue`: map người nói qua `ROLES`, dòng gợi ý, avatar |
| `src/state/progress.js` | `completeIntro` |
| `src/characters/npc.js` | `dressPerson`: mặc GLB cho y tế |
| `src/characters/bounds.js` | Đo bounds model có rig |
| `index.html` | `#intro-controls`, `#skip`, `#caption-box`, `#dialogue-next`, `#progress` |
| `tools/intro-preview/` | Xem từng mốc (va chạm, ngã, nâng, khiêng). Không nằm trong bản build |

## Asset

| Slot | File |
|---|---|
| Nhân vật | Model đã chọn ở màn 00 (`male.glb` / `girl.glb`), hồn là bản sao trong suốt |
| `intro/street/road`, `intro/warning-sign/post`, `intro/stretcher`, `intro/heaven/path` | `intro/street.glb` (các node con) |
| `intro/street/shops` | `intro/shops.glb` |
| `intro/street/trees` | `intro/trees.glb` |
| `intro/bicycle` | `intro/bicycle.glb` |
| `intro/ambulance` | `intro/ambulance.glb` |
| `intro/reaper` | `heaven/reaper.glb` |
| `intro/heaven/gate/frame`, `left-leaf`, `right-leaf` | `intro/sky-gate.glb` |
| Hai y tế | `intro/medic-m.glb`, `intro/medic-f.glb` (qua `dressPerson`) |

- Mỗi slot có khối dựng bằng code làm bản dự phòng khi thiếu GLB.
- Slot `intro/warning-sign/board` chưa có GLB, đang dùng bảng chữ dựng bằng code.
- Khi sang thiên đàng, GLB intro được giải phóng (`releaseModels('intro/')`).
- Độ phơi sáng renderer ở intro là 1,15.

## Analytics

Intro không phát sự kiện riêng. Lúc bấm Vào Game, màn 00 đã phát `play_clicked` và `game_started`. Bỏ qua intro chưa được ghi nhận.

## Chưa làm / điểm mở

- Chưa có lồng tiếng và âm thanh riêng cho intro.
- Chưa có sự kiện analytics cho bỏ qua hoặc xem hết intro.
- Chưa có GLB cho bảng biển cảnh báo (`intro/warning-sign/board`).
