# 00 · Chọn nhân vật

Màn đầu tiên của người chơi mới. Chọn giới tính nhân vật và đặt tên rồi vào intro.

| | |
|---|---|
| Vào từ | Mở game khi save chưa có `introCompleted` |
| Ra tới | [01 · Intro](../01-intro/README.md) khi bấm bắt đầu |
| Dữ liệu ghi | `cog-coffee-player` = `{ gender: 'male'\|'female', name ≤ 20 ký tự }` (`savePlayer`); tên trống dùng `DEFAULT_NAME` |
| Code | `src/features/selection/scene.js`; chọn/vuốt/xoay model và nút bắt đầu nối trong `src/app/game.js` |

## Thao tác

- Chạm một model để chọn; vuốt ngang để đổi giữa nam/nữ; kéo dọc để xoay model đang chọn.
- Bàn phím: mũi tên trái/phải đổi nhân vật.
- Nhập tên hoặc bấm ⚄ để lấy tên ngẫu nhiên. Hồ sơ chưa lưu mặc định là nhân vật nữ, tên An Nhiên.
- Màn chọn chỉ hiện với lượt chơi mới; save đã qua Màn 1 vào thẳng màn đang chơi. Trình duyệt chặn lưu trữ thì vẫn chơi được trong lượt hiện tại.
- Model nhân vật được giữ lại (`takePlayer`) và dùng tiếp ở intro.

## Tài liệu liên quan

- Luồng người mới và thiết kế nhãn/HUD: [shared/onboarding-flow.md](../../shared/onboarding-flow.md)
- Giao diện chọn nhân vật trong đợt redesign: mục 2 của [05-scene-redesign-plan](../../archive/redesign/05-scene-redesign-plan.md) (lưu trữ)
- Sơ đồ chuyển màn: [game-flow.md](../../game-flow.md)
