# Sơ đồ liên kết giữa các màn

Một trang cho cả game: màn nào dẫn tới màn nào, điều kiện chuyển, dữ liệu truyền đi. Chi tiết từng màn nằm trong `screens/<màn>/README.md`. Nguồn sự thật cho dữ liệu là [shared/contracts.md](shared/contracts.md); nguồn cho điều kiện chuyển là `src/app/game.js`.

## Sơ đồ

```mermaid
flowchart TD
    BOOT([Mở game<br/>đọc cog-coffee-progress]) --> CHK{Save có gì?}
    CHK -->|không có / chưa xong intro| SEL
    CHK -->|introCompleted| HEAVEN
    CHK -->|heaven.completed hoặc có farm| FARM

    SEL["00 · Chọn nhân vật<br/>giới tính + tên ≤ 20 ký tự"] -->|Bắt đầu: savePlayer| INTRO
    INTRO["01 · Intro (Màn 1)<br/>23,5 s, có nút Bỏ qua"] -->|hết giờ / Bỏ qua: completeIntro| HEAVEN
    HEAVEN["02 · Thiên đàng<br/>3 chuyên gia · 6 câu · chọn hành trang"] -->|qua cổng trùng sinh: saveHeaven| FARM
    FARM["03 · Nông trại<br/>màn chính, giữ model dữ liệu"] -->|nút Vào quán| CAFE
    CAFE["04 · Quán cà phê<br/>cảnh con của farm"] -->|nút Nông trại| FARM

    SET[/Cài đặt: mở được ở mọi màn/] -.-> SEL
    SET -.-> HEAVEN
    SET -.-> FARM
    SET -.-> CAFE
```

Đường một chiều: 00 → 01 → 02 → 03. Sau khi qua cổng thiên đàng không còn đường quay lại; tải lại trang sẽ vào thẳng farm. Chỉ 03 ↔ 04 đi hai chiều.

## Điều kiện chuyển màn

| Từ | Tới | Điều kiện | Chỗ xử lý |
|---|---|---|---|
| Mở game | 00 / 02 / 03 | Đọc save: `heaven.completed` hoặc có `farm` → 03; `introCompleted` → 02; còn lại → 00 | `src/app/game.js` (khởi động) |
| 00 Chọn nhân vật | 01 Intro | Bấm bắt đầu; ghi `cog-coffee-player` | `enterIntro` |
| 01 Intro | 02 Thiên đàng | Hết `DURATION` (23,5 s) hoặc Bỏ qua; ghi `introCompleted` | `finish` → `enterHeaven` |
| 02 Thiên đàng | 03 Nông trại | Đủ 3 dấu hoàn thành, chọn hành trang, đi qua cổng; ghi `heaven`, `startingGift` | callback của `createHeavenGame` → `enterFarm` |
| 03 Nông trại | 04 Quán | Nút "Vào quán" (nhiệm vụ "Bán ly cà phê đầu tiên" chỉ tới đây) | `enterCafe` trong `features/farm/game.js` |
| 04 Quán | 03 Nông trại | Nút "Nông trại" | `exitCafe` |

## Dữ liệu đi theo từng chặng

| Chặng | Dữ liệu truyền | Dùng ở đâu |
|---|---|---|
| 00 → 01 | `gender`, `name` | Mô hình nhân vật và tên trên HUD ở mọi màn sau |
| 02 → 03 | `gift` (`seeds` / `tools` / `capital`) | Hành trang áp một lần khi tạo farm |
| 02 → 03 | `heaven.answers` → `correctQuestionIds` → `farm.lessons` | Câu đúng thành mẹo có số thật ở farm/quán; câu sai được hỏi lại đúng lúc |
| 03 ↔ 04 | Cùng một model `farm` | Quán đọc/ghi kho, tiền, lô hàng, chuyến giao qua `farm.act(...)`, không có save riêng |

## Điểm cần nhớ

- **Quán không phải một màn độc lập.** `createCafeGame` được gọi từ bên trong `createFarmGame`; farm giữ scene quán để vào lại nhanh và vẫn `tick` model khi người chơi đang ở quán (thợ vẫn chạy, đơn vẫn đếm hạn).
- **Một save duy nhất** `cog-coffee-progress` (`version: 1`). Mọi hàm ghi đọc lại bản cũ rồi gộp, nên trường của màn này không bị màn khác ghi đè.
- **Cài đặt** (`settings`) nằm chung save, không thuộc màn nào; xem [shared/ui-audio-vfx.md](shared/ui-audio-vfx.md).
- Luồng 5 phút đầu và các kịch bản liên màn (thiên đàng → farm → quán → bán ly đầu) nằm trong [shared/onboarding-flow.md](shared/onboarding-flow.md) mục 8.
