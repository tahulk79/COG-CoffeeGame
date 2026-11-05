# Godbean

**Godbean: Build your own Coffee Empire!** — game web 3D về trồng cà phê và vận hành quán, dùng JavaScript, Three.js và Vite. Node.js 22.12+.

## Chạy

```sh
npm install
npm run dev
```

Mở địa chỉ Vite in trong terminal. Bản production: `npm run build` rồi `npm run preview`. Không cài thêm dependency nếu chưa có lý do và sự đồng ý của người dùng.

## Luồng chơi

Chọn nhân vật → Intro (Màn 1) → Thiên đàng → Nông trại ↔ Quán cà phê.

Chi tiết từng màn, điều kiện chuyển và dữ liệu đi theo: [GDD §4](docs/design/godbean-gdd.md). Mục lục tài liệu: [docs/README.md](docs/README.md).

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `src/app/game.js` | Renderer, vòng lặp, chuyển màn, nối input/HUD |
| `src/features/<màn>/` | Code từng màn: `selection`, `intro`, `heaven`, `farm`, `cafe` |
| `src/shared/` | Thế giới 3D, va chạm/tìm đường, âm thanh, VFX, giải phóng tài nguyên |
| `src/characters/`, `src/state/`, `src/ui/` | Nhân vật, save, HUD và stylesheet |
| `public/` | GLB runtime, favicon |
| `docs/` | Tài liệu theo màn, khớp với `src/features/` |
| `tools/` | Trang xem nhanh intro/farm, không nằm trong bản build |
| `scripts/` | Script tối ưu model, mô phỏng kinh tế |

Cây thư mục đầy đủ: [GDD §13.7](docs/design/godbean-gdd.md). Quy tắc làm việc cho người và AI: [AGENTS.md](AGENTS.md).
