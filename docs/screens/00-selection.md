# 00 · Chọn nhân vật

Pha `select`. Hai nhân vật nam (trái) và nữ (phải) trên sân khấu 3D; chạm, vuốt ngang hoặc mũi tên để đổi, **Vào Game** để bắt đầu. Không có ô nhập tên: tên lấy ngẫu nhiên theo ngôn ngữ và giới tính (`randomName`).

- Vào: save V3 chưa có nhân vật hoặc `story.phase === 'select'`.
- Ra: `character/set` → [01 · Intro](01-intro.md). Model đã chọn được giữ lại cho intro; GLB `selection/` được giải phóng.
- Code: `src/features/selection/scene.js`, `enterSelection`/`enterGame` trong `src/app/game.js`. Chữ: `selection.*`, `html.selection.*`.
