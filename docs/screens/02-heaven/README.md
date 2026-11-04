# 02 · Thiên đàng

Chương học việc: gặp Hội đồng trùng sinh, trả lời câu hỏi về trồng cà phê, pha chế, kinh doanh, nhận hành trang rồi đi qua cổng về nông trại. Câu đúng cho **mẹo có tác dụng thật** ở farm/quán.

| | |
|---|---|
| Vào từ | [01 · Intro](../01-intro/README.md); hoặc mở game khi save có `introCompleted` mà chưa xong thiên đàng |
| Ra tới | [02b · Bản đồ thế giới](../02b-world-map/README.md) khi bước vào cổng; chọn nơi xong mới qua cổng tới farm/quán |
| Dữ liệu ghi | `heaven` (có `answers`, `completed`, `gift`), `startingGift` (`saveHeaven`) |
| Dữ liệu truyền | `gift` và `correctQuestionIds(heaven)` được đưa vào `createFarmGame` |
| Hook bản đồ | `createHeavenGame(profile, onReborn, onPortal)`; trả thêm `cancelPortal()` (đóng bản đồ, đứng trước cổng) và `depart()` (đã chọn nơi, chạy hoạt cảnh qua cổng). Lời chào ở cổng chỉ nghe lần đầu |
| Code | `src/features/heaven/`: `scene.js`, `game.js`, `ui.js`, `content.js` (NPC, câu hỏi, thoại), `journey.js` (tiến trình, `correctQuestionIds`) |

## Tài liệu

| File | Nội dung |
|---|---|
| [gameplay.md](gameplay.md) | Luồng chơi, thiên đàng là bài học, điều khiển, lưu và khôi phục, tổ chức code |
| [shared/onboarding-flow.md](../../shared/onboarding-flow.md) | Spec đầy đủ về mẹo, số liệu thưởng, thoại gọn (mục 3.1, 4.1) |
| [shared/contracts.md](../../shared/contracts.md) | `farm.lessons`, `farm.tutorial` (mục 5) |
| [game-flow.md](../../game-flow.md) | Vị trí trong luồng game |
