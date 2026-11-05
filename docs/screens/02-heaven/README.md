# 02 · Thiên đàng

**Thiên đàng mini (02-mini, từ 05/11/2026, F-44):** Thần Chết và Thần Tiếp Nhận đứng sẵn, tối đa 5 hộp thoại (tiết lộ «chỉ ngất», câu móc Hội đồng ở trần gian), hộp 5 là lời tiễn kèm nút **Nhận ❧ Túi hạt giống**, rồi tự đi vào cổng (chạm để tua) và mở bản đồ thế giới. Ba chuyên gia và 6 câu hỏi không còn ở đây: họ gặp người chơi ở trần gian (Hội đồng so le, F-45); câu đúng của save cũ vẫn là **mẹo có tác dụng thật** ở farm/quán.

| | |
|---|---|
| Vào từ | [01 · Intro](../01-intro/README.md); hoặc mở game khi save có `introCompleted` mà chưa xong thiên đàng |
| Ra tới | [02b · Bản đồ thế giới](../02b-world-map/README.md) khi bước vào cổng; chọn nơi xong mới qua cổng tới farm/quán |
| Dữ liệu ghi | `heaven` (có `mode`, `answers`, `revealed`, `completed`, `gift`), `startingGift` (`saveHeaven`). Save mới: `gift`/`startingGift` luôn `'seeds'`, `mode: 'mini'`; kiểu `'seeds'\|'tools'\|'capital'` giữ cho save cũ |
| Dữ liệu truyền | `gift` (save mới `'seeds'`), `correctQuestionIds(heaven)` và `answeredQuestionIds(heaven)` (câu đã gặp → `farm.lessons.met`, F-45) được đưa vào `createFarmGame`; analytics `heaven_completed` thêm `mode`, `region_type` |
| Hook bản đồ | `createHeavenGame(profile, onReborn, onPortal)`; trả thêm `cancelPortal()` (đóng bản đồ, đứng trước cổng) và `depart()` (đã chọn nơi, chạy hoạt cảnh qua cổng). Không còn lời tiễn ở cổng (đã ở hộp 5) |
| Code | `src/features/heaven/`: `scene.js`, `game.js`, `ui.js`, `content.js` (NPC, câu hỏi dùng chung với Hội đồng, thoại `MINI`, `STARTING_GIFT`), `journey.js` (tiến trình mini, `correctQuestionIds`) |
| Lối vào thứ hai (05/11/2026, F-45) | Hội đồng ở trần gian: vào từ farm (Cổng Hội đồng, `farm/content.js` `council`) hoặc quán (chuông Hội đồng, `cafe/game.js`), hội thoại đáy màn mở tại chỗ rồi về chỗ cũ — không quay lại cảnh thiên đàng. Code: `farm/model.js` (`council`, `act('lessons','council')`), `ui/lesson-prompt.js` (`askCouncil`), `farm/game.js` (`openCouncil`). Luật: [gameplay.md](gameplay.md) mục Hội đồng so le |

## Tài liệu

| File | Nội dung |
|---|---|
| [gameplay.md](gameplay.md) | Luồng 02-mini, save cũ, mẹo (bài học), điều khiển, lưu và khôi phục, tổ chức code |
| [shared/onboarding-flow.md](../../shared/onboarding-flow.md) | Spec đầy đủ về mẹo, số liệu thưởng, thoại gọn (mục 3.1, 4.1) |
| [shared/contracts.md](../../shared/contracts.md) | `farm.lessons`, `farm.tutorial` (mục 5) |
| [game-flow.md](../../game-flow.md) | Vị trí trong luồng game |
