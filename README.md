# Godbean — Farm & Café V3

**Godbean: Build your own Coffee Empire!** — game web 3D trồng cà phê và mở quán, viết bằng JavaScript thuần, Three.js 0.185 và Vite. Cần Node.js 22.12+. Không thêm dependency nếu chưa có lý do và sự đồng ý của người dùng.

## Chạy

```sh
npm install
npm run dev        # mở địa chỉ Vite in trong terminal
npm run build      # bản production vào dist/
npm run preview    # chạy thử bản build
```

## Kiểm thử và mô phỏng

| Lệnh | Làm gì |
|---|---|
| `npm test` | Test lõi thuần (`tests/core/*.test.mjs`, chạy bằng `node --test`): reducer, nông trại, quán, xây dựng, đất, nhân viên, Round, reset Level 10, trùng sinh, save/migration, tutorial |
| `npm run sim` | Mô phỏng kinh tế với người chơi mẫu (`scripts/economy-sim.mjs`). Thêm số phút: `npm run sim -- 120`. Chạy lại mỗi khi đổi số trong `src/core/config/` |

## Hồ sơ test khi dev (`?profile=test`)

Chỉ có tác dụng ở `npm run dev` (bản build bỏ qua):

- Mở `http://localhost:5173/?profile=test`: mọi khóa lưu có hậu tố `@test` (save V3 là `godbean-v3@test`), không đụng tới save thật.
- HUD hiện nút 🧪 (QA panel) ở góc dưới trái: +1.000 / +10.000 xu, +50 hạt, nhảy tới sát Level 10, +100 XP, chín cây ngay (`dev/grant`, `dev/ripen`).
- `?profile=max` cũng tách khóa riêng (`@max`). Thêm `&fps` để xem fps, draw call và mức đồ họa.

## Luồng chơi

Chọn nhân vật → Intro (tai nạn) → Gặp Thầy (nhận 3 lượt trùng sinh, Cổng Thế Giới mở) → Bản đồ thế giới (chọn nước + vùng) → Vùng đất 3D: trồng → thu hoạch → pha → bán → xây → nâng cấp → mở rộng → Level 10 lần đầu: vùng hết hạn, chọn vùng mới → mở Round 2/3, nước mới, trùng sinh, nhân viên.

Máy trạng thái `store.state.story.phase` (`select → intro → teacher → gate → play → expiry → chooseRegion → play`); tải lại trang ở pha nào thì vào lại pha đó. Chi tiết: [docs/design/v3-gdd.md](docs/design/v3-gdd.md). Mục lục tài liệu: [docs/README.md](docs/README.md).

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `src/main.js`, `src/app/game.js` | Khởi động, renderer, vòng lặp, máy trạng thái pha; các màn được tải bằng `import()` động |
| `src/core/` | Lõi thuần (không DOM, không Three): `state`, `game` (reducer), `derive`, `tutorial`, `migrate`, `store`; `config/` chứa mọi con số (kinh tế, bố cục, thế giới) |
| `src/features/selection/`, `intro/` | Chọn nhân vật, phim mở đầu |
| `src/features/teacher/` | Cảnh gặp Thầy + bong bóng thoại |
| `src/features/atlas/` | Bản đồ thế giới 3D (dùng lại `world-map/terrain.js`, `geo.js`, `content.js`) |
| `src/features/realm/` | Thế giới 3D của vùng: đất, cây, công trình, khách, nhân viên, camera, đặt công trình, cinematic |
| `src/features/hud/` + `src/ui/styles/v3.css` | HUD DOM: thanh trên, thanh công cụ, action bar, sheet, modal, toast, tutorial, QA panel |
| `src/characters/`, `src/shared/`, `src/ui/`, `src/state/` | Nhân vật, âm thanh/VFX/model/analytics, hội thoại/cài đặt/màn tải, khóa lưu |
| `src/i18n/` | `t()` và gói ngôn ngữ en/vi (`locales/*.js`) |
| `tests/core/` | Test `npm test` |
| `scripts/` | `economy-sim.mjs` (mô phỏng kinh tế), `optimize-models.mjs` (nén GLB) |
| `public/` | GLB, ảnh, favicon |
| `docs/` | GDD, kiến trúc, quyết định, tài liệu từng màn |
