# Phần dùng chung giữa các màn

> 2026-10-30 · Lấy Màn 1 làm chuẩn. Màn mới dùng lại các phần dưới đây, không chép code.

| Phần | File | Màn mới dùng thế nào |
|---|---|---|
| **Đi tự do** (phím WASD/mũi tên, joystick, chạm để đi; camera bám nhân vật; **không kéo map**; nút Âm thanh trên HUD) | `GameSimulation.walker` (`FreeWalker`), `WorldScene.freeWalk`, `SimulationSnapshot.freeWalk` | Service của màn có `setSteer(x, y)` và `steering`, rồi thêm nó vào `get walker()` trong `GameSimulation.ts` (`this.run ?? this.trial ?? …`). Map của màn thêm vào `CAMERA_MODE` (`'story'`) trong `WorldScene.ts`. |
| **Cách di chuyển** (tốc độ, quay mặt, giữ dáng đi, chỉ về dáng đứng sau 120 ms kẹt) | `src/gameplay/story/heroWalk.ts` (`HeroWalk`) | `walk.set(x, y, allowed)` khi nhận hướng; mỗi tick `walk.step(player, dt, speed, (dx, dy) => this.moveBy(dx, dy))`, trong đó `moveBy` là va chạm riêng của màn. Màn 1 truyền thêm `flip = -1` khi bị quần đùi chụp đầu. Cỡ thân `RUN_BODY_RADIUS`. |
| **Hình nhân vật chính** (sprite có hoạt ảnh đi bộ) | `IncidentActorView` (dùng khi map là phố hoặc đường mây) | Map dùng loại ô `sidewalk` hoặc `forest_path` là tự có. Map loại khác: thêm điều kiện ở `PlaceholderRenderer.createActor`. |
| **Footer thoại** (chân dung, tên, câu thoại, Tiếp / chạm bất kỳ đâu, đáp án, đồng hồ, trượt lên; điện thoại: tấm full width, đáp án xếp dọc; PC ≥ 900 px: vẫn full width, đáp án một hàng ngang) | `src/ui/DialogueFooter.ts` | Tạo `new DialogueFooter(scene, { next, choose, drawFace, buttons })` trong HUD; mỗi khung hình gọi `show(line | null)` với `FooterLine` (tên, `face`, câu, `mood`, `more`, `choices`, `timeLeftMs`); `layout()` khi đổi cỡ màn hình. `drawFace` vẽ chân dung riêng của màn (Màn 2: `drawTrialFace` trong `trialArt.ts`); `face: 'hero'` dùng chân dung nhân vật chính có sẵn. |
| **Mẩu giao diện** (kiểu chữ, thẻ kem viền nâu, nhãn pill, chân dung nhân vật chính, hiệu ứng pop) | `src/ui/components/storyWidgets.ts` | Import `Card`, `Pill`, `text`, `INK`, `portrait`, `popIn`. |
| **Âm thanh tổng hợp** (gain + compressor, mở khoá âm sau thao tác đầu, tắt khi Mute / ẩn tab / mở Setting, `tone` `glide` `noise`) | `src/components/audio/SynthAudio.ts` | `class XAudio extends SynthAudio`, `super(scene, gain)`. Mỗi khung hình: `if (!this.gate(paused)) return;`. Vòng nhạc kiểm tra `this.silent`; dời nhịp trong `onVisibility()`; `destroy()` gọi `super.destroy()`. Xem `RunAudio`, `TrialAudio`. |
| **Setting** (âm thanh, ngôn ngữ, toàn màn hình, chơi lại, game mới) | `HudScene` → `SettingsModal`, `SettingsButton` | Có sẵn cho mọi màn, không cần làm gì. |
| **Test nhanh từng màn** (tạm) | `?chap=1|2|3` (đánh dấu `TEMP (dev test` trong `main.ts`, `WorldScene.ts`, `core/session.ts`) | Thêm mã chương mới vào bảng trong `main.ts`. |
