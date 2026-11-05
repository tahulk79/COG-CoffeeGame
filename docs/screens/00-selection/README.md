# 00 · Chọn nhân vật

Màn đầu tiên của lượt chơi mới. Hai nhân vật nam và nữ đứng trên hiên gỗ 3D. Người chơi chọn một người rồi bấm **Vào Game** để sang intro. Màn không có ô nhập tên: tên được lấy ngẫu nhiên.

Mục cuối của file này ghi luồng khởi động chung của game (chọn màn lúc mở, màn lỗi, mở hai tab).

## Vào / ra

| Vào từ | Điều kiện |
|---|---|
| Mở game | Save chưa có `introCompleted`, chưa có `heaven.completed`, chưa có `farm` (`initialize` trong `game.js`) |
| Chơi lại từ đầu | Sau `resetProgress` (cài đặt hoặc màn lỗi) trang tải lại và rơi vào nhánh trên |

| Ra tới | Khi nào |
|---|---|
| [01 · Intro](../01-intro/README.md) | Bấm **Vào Game** (form `#player-form`, `enterIntro`) |
| Màn lỗi | Tải model hoặc dựng cảnh thất bại (`fail`) |

## Luồng chơi

1. Màn tải hiện thanh tiến trình: "Tải nhân vật" (45–80 %) rồi "Chuẩn bị màn chọn" (85 %).
2. Hiện sân khấu. Nhân vật mặc định lấy từ `godbean-player`. Chưa có thì là nữ.
3. Nam đứng trái, nữ đứng phải. Người được chọn:
   - bệ đổi sang vàng, có vòng sáng, quầng sáng và vòm sáng sau lưng;
   - hiện dấu ✓ dưới bệ, mũi tên đặt ngang thắt lưng (vị trí tính bằng `anchor()`, truyền qua biến CSS `--fx`, `--fy`, `--fw`, `--fb`).
4. Người còn lại lùi ra sau, bị làm tối (độ sáng 55 %) và nhỏ hơn một chút (scale 0,92). Không thu nhỏ hẳn.
5. Bấm **Vào Game**:
   - lấy tên ngẫu nhiên theo ngôn ngữ và giới tính (`randomName`);
   - ghi `godbean-player`;
   - giữ lại model đã chọn (`takePlayer`) để dùng tiếp ở intro, giải phóng sân khấu (`releaseModels('selection/')`).
6. Màn tải "Chuẩn bị màn" rồi vào intro.

Bật `prefers-reduced-motion` thì nhân vật đổi chỗ ngay, không có nhịp sáng và bụi bay.

## Điều khiển

| Thao tác | Kết quả |
|---|---|
| Chạm hoặc bấm vào một nhân vật | Chọn người đó (`pick`) |
| Vuốt ngang trên canvas | Đổi người nếu vuốt quá 0,16 khoảng cách hai bệ; ngắn hơn thì trả về như cũ (`endDrag`) |
| Kéo dọc trên canvas | Xoay người đang chọn (`rotate`) |
| Nút ‹ / › trên màn | Đổi sang người còn lại. Chọn nam chỉ hiện ›, chọn nữ chỉ hiện ‹ (`showGender`) |
| Phím ← / → | ← luôn chọn nam, → luôn chọn nữ |
| Nút **Vào Game** (vi) / **Play** (en) | Vào intro |
| Nút ⚙️ | Mở cài đặt âm thanh, đồ hoạ, ngôn ngữ (`ui/settings.js`) |

Ngưỡng nhận hướng vuốt là 8 px. Vuốt ngang tính theo 40 % bề ngang màn.

## Dữ liệu

| Khóa localStorage | Trường | Đọc / ghi |
|---|---|---|
| `godbean-player` | `gender`: `'male'` \| `'female'` | Đọc lúc mở (`readPlayer`), ghi khi bấm Vào Game (`savePlayer`) |
| `godbean-player` | `name` | Ghi tên ngẫu nhiên. Lúc đọc cắt khoảng trắng và tối đa 20 ký tự; rỗng thì dùng `DEFAULT_NAME` |
| `godbean-progress` | `introCompleted`, `heaven.completed`, `farm` | Chỉ đọc, để chọn màn lúc mở |

- Danh sách tên: 10 tên nữ và 10 tên nam cho mỗi ngôn ngữ `vi`, `en` (`names.js`). Ngôn ngữ mặc định là `en`.
- Trình duyệt chặn lưu trữ: vẫn chơi được trong lượt hiện tại, tải lại sẽ mất.

## Code

| File | Vai trò |
|---|---|
| `src/features/selection/scene.js` | Dựng sân khấu, bệ, ánh sáng, chọn/vuốt/xoay, `anchor()`, camera tự canh theo vị trí nút Vào Game, `takePlayer` |
| `src/app/game.js` | Khởi động, chọn màn lúc mở, nối cử chỉ, phím, mũi tên, `enterIntro`, màn lỗi |
| `src/state/progress.js` | `readPlayer`, `savePlayer`, `readProgress`, `resetProgress` |
| `src/state/names.js` | `randomName`, `DEFAULT_NAME` |
| `src/state/storage-keys.js` | Tên khóa save, xoá khóa cũ `cog-coffee-*` |
| `src/characters/load-player.js` | Tải model nhân vật có rig |
| `index.html` | `#selection`, mũi tên `.selection-arrow`, dấu `.selection-check`, form `#player-form`, nút `#enter-game` |
| `src/ui/loading.js` | Màn tải và mẹo ngẫu nhiên |

## Asset

| Asset | Dùng cho |
|---|---|
| `public/models/male.glb`, `girl.glb` | Hai nhân vật; model được chọn đi tiếp sang intro |
| `public/models/selection/stage.glb` | Hiên gỗ (`stage_proc`); dải ván được nhân ra phía trước camera |
| `public/models/selection/backdrop.glb` | Nền đồi cà phê, bị giảm độ rực và phủ sương. Có nền thì ẩn `stage_farm` trong stage |

Thiếu stage hoặc backdrop thì cảnh vẫn chạy với nền trơn. Bệ, vòng sáng, vòm sáng, quầng sương và bụi dựng bằng code.

## Analytics

| Sự kiện | Khi nào | Trường |
|---|---|---|
| `landing_viewed` | Khi nạp game, mọi lần mở | `first_visit`: chưa có `introCompleted` và chưa có `farm` |
| `play_clicked` | Bấm Vào Game | — |
| `game_started` | Bấm Vào Game | `resumed: false`, `screen: 'intro'` |
| `game_started` | Mở game có save | `resumed: true`, `screen: 'heaven'` hoặc `'farm'` |

Analytics tắt khi người chơi tắt trong cài đặt hoặc khi dùng hồ sơ dev `?profile=max`.

## Khởi động chung

Thứ tự: `main.js` dịch HTML tĩnh, cài icon, rồi gọi `startGame` → `initialize` (`game.js`).

| Save lúc mở | Vào |
|---|---|
| Có `heaven.completed` hoặc `farm` | Nông trại (`enterFarm`). Vùng chỉ có quán thì farm chuyển thẳng vào quán (`farm/game.js`) |
| Có `introCompleted` | [02 · Thiên đàng](../02-heaven/README.md) (`enterHeaven`) |
| Còn lại | Màn chọn này |

**Đồ hoạ**
- Mức mặc định: máy yếu (RAM ≤ 2 GB hoặc ≤ 4 nhân) là thấp, cảm ứng là vừa, còn lại là cao (`deviceQuality`). Mức đã lưu luôn thắng.
- Ở thiên đàng và nông trại: dưới 25 fps quá 60 % thời gian trong 2 s thì hạ một mức (`watchFrame`). Không áp dụng ở màn chọn và intro.
- Mất ngữ cảnh WebGL: hạ đồ hoạ xuống thấp, hiện màn tải với dòng báo, khôi phục xong thì vẽ lại.

**Màn lỗi** (`fail`): hiện khi dựng bất kỳ màn nào thất bại.
- **Tải lại**.
- **Thử đồ họa thấp**: lưu `quality: 'low'` rồi tải lại.
- **Chơi lại từ đầu**: bấm hai lần. Save cũ được chép sang `godbean-progress-backup`, giữ phần cài đặt.
- Mục "Chi tiết kỹ thuật" chứa thông báo lỗi gốc.

**Mở hai tab**
- Chỉ từ khi vào nông trại mới theo dõi (`watchOtherTabs` trong `farm/game.js`).
- Tab khác ghi `godbean-progress` thì tab này chuyển sang đọc-chỉ:
  - báo "Game đang mở ở tab khác — tải lại để chơi tiếp ở đây";
  - mọi hàm ghi save bỏ qua;
  - cài đặt khóa các nút ghi.
- Ở màn chọn, intro và thiên đàng chưa có cơ chế này.

**Save hỏng**: đọc không được thì chép bản gốc sang `godbean-progress-corrupt` (chỉ chép lần đầu) và coi như save rỗng.

**Tham số URL**
- `?fps`: hiện fps, số draw call và mức đồ hoạ.
- `?profile=max`: chỉ bản dev. Mọi khóa save thêm hậu tố `@max`, xu khởi đầu rất lớn.

## Chưa làm / điểm mở

- Chưa có ô đặt hoặc đổi tên. Tên ngẫu nhiên là tên duy nhất.
- Chế độ đọc-chỉ khi mở hai tab chưa bao phủ màn chọn, intro và thiên đàng.
