---
name: game-team
description: Điều phối đội 10 agent (designer, integrator, farm-dev, cafe-dev, ui-stylist, asset-3d, vfx-artist, sound-designer, reviewer, playtester) làm trọn một tính năng gameplay từ thiết kế tới chơi thử, chỉ bàn giao cho người dùng ở cuối. Dùng khi người dùng gõ /game-team <yêu cầu> hoặc bảo "cho đội làm".
---
Session chính là **điều phối**. Subagent không gọi được nhau: mọi bàn giao đi qua bạn và qua file trong `docs/design/`. Người dùng chỉ test ở cuối, nên tự quyết mọi chi tiết hợp lý, không hỏi giữa chừng trừ khi thiếu thông tin không thể suy ra hoặc cần chi tiền/credit (Meshy, `generate_3d`).

## Vùng file (hai agent không sửa cùng file trong cùng lúc)
| Agent | Sửa |
|---|---|
| game-designer | `docs/` |
| economy-integrator | `src/features/farm/model.js`, `src/state/`, `src/app/`, `src/shared/` (trừ `vfx/`, `audio/`) |
| farm-dev | `src/features/farm/` trừ `model.js`, bố cục `farm.css` |
| cafe-dev | `src/features/cafe/`, bố cục `cafe.css` |
| ui-stylist | `src/ui/`, HUD `index.html`; màu trong `farm.css`/`cafe.css` chỉ khi dev màn đó không chạy |
| asset-3d | `assets-src/`, `public/models/`, `public/vfx/`, `public/ui/icons/`, `docs/asset-pipeline.md` |
| vfx-artist | `src/shared/vfx/`, phần renderer/hậu kỳ trong `src/app/game.js` (khi integrator không chạy) |
| sound-designer | `src/shared/audio/`, `public/audio/`, `assets-src/audio/`, mục Âm thanh trong `docs/asset-pipeline.md` |
| gameplay-reviewer, playtester | không sửa |

## Quy trình
0. **Mục tiêu.** Có yêu cầu thì dùng. Không có thì đọc `docs/design/*` (mục "Cần chốt", "Thứ tự triển khai") và chọn việc giúp người chơi cuốn/quay lại nhiều nhất.
1. **game-designer** → spec + `contracts.md` + checklist nghiệm thu + chia việc. Đọc lại spec, sửa chỗ mơ hồ trước khi đi tiếp.
2. **Song song:** economy-integrator (nếu hợp đồng đổi) ∥ ui-stylist (nếu cần class/biến UI mới) ∥ asset-3d (model, animation, flipbook, icon nếu có) ∥ vfx-artist (hiệu ứng mới; nếu cần sửa `app/game.js` thì chạy sau integrator) ∥ sound-designer (âm mới, engine).
3. **Song song:** farm-dev ∥ cafe-dev. Mỗi brief gồm: đường dẫn spec, hàm mới của integrator, class mới của ui-stylist, GLB/icon mới của asset-3d, API hiệu ứng của vfx-artist, id âm của sound-designer và chỗ cần gọi.
4. **gameplay-reviewer.** Tự kiểm chứng từng lỗi bằng cách đọc code trước khi giao sửa; bỏ lỗi không tái hiện được. Giao sửa cho đúng agent theo vùng file. Tối đa 2 vòng.
5. **playtester** chạy checklist. Lỗi → kiểm chứng → giao sửa → chạy lại đúng kịch bản lỗi. Tối đa 2 vòng; còn lỗi thì ghi vào bàn giao.
6. **Cập nhật tài liệu:** luật đã làm vào `docs/farm-operations-guide.md` / `docs/design/cafe-gameplay.md` (designer).
7. **Bàn giao** cho người dùng (tiếng Việt, ngắn): đã làm gì, file đã sửa, kịch bản playtester đạt/không đạt, lỗi còn lại, việc người dùng cần làm (vd. chạy Meshy theo hàng đợi). Không commit/push khi chưa được yêu cầu.

## Lưu ý
- Gửi các agent độc lập trong cùng một lượt để chạy song song.
- Agent báo "cần đổi hợp đồng" → quay lại bước 1 cho phần đó, không để dev tự sửa vùng người khác.
- Áp dụng ponytail: tái dùng code sẵn có, thay đổi nhỏ nhất mà đủ.
