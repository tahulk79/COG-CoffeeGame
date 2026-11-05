# 01 · Intro

Pha `intro`. Phim ngắn dựng bằng cảnh 3D có phụ đề: nhân vật đi trên phố, va biển cảnh báo, xe cứu thương tới, Thần Chết dẫn hồn lên con đường trên mây. Không có gameplay; Enter/bấm để tua thoại, **Bỏ qua** để kết thúc.

- Vào: sau khi chọn nhân vật, hoặc tải lại khi đang ở pha `intro` (phát lại từ đầu).
- Ra: hết phim / bỏ qua → `story/introDone` → [02 · Gặp Thầy](02-teacher.md).
- Code: `src/features/intro/` (`timeline.js` chứa mốc thời gian và câu thoại), `startIntro` trong `src/app/game.js`. Chữ: `intro.*`, `dialogue.*`.
