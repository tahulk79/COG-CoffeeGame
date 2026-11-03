# Bố cục cảnh và thay asset

## Các cảnh đã có trong gameplay

| Cảnh / khu | Khối tạm thể hiện | Hành động người chơi | Điều kiện đi tiếp |
|---|---|---|---|
| Phố và tai nạn | Phố, xe đạp, biển, nhân vật ngã | Xem hoặc bấm bỏ qua | Chuyển tới thiên đàng |
| Cứu hộ và dẫn hồn | Cáng, y tế, cơ thể và linh hồn, thần chết | Theo diễn biến mở đầu | Hồn được dẫn lên đầu đường |
| Đường lên trời | Đường trên mây, cổng đầu vào | Dừng ngắn khi đáp, đi liên tục vào cổng | Hoàn thành mở đầu |
| Lối vào quảng trường | Thần chết tại (-4, 7), hồ sơ trên HUD | Hội thoại rồi chọn dẫn đường / tự khám phá | Nhận hồ sơ |
| Khu trồng cà phê | Thần Nông tại (-13, -2), chậu cây và quả cà phê trên bàn | Trả lời hai câu một lần | Ghi điểm đúng/sai, nhận dấu hoàn thành |
| Khu pha chế | Thần Pha Chế tại (-7, -12), máy và cốc trên bàn | Trả lời hai câu một lần | Ghi điểm đúng/sai, nhận dấu hoàn thành |
| Khu kinh doanh | Thần Thương Hội tại (6, -12), sổ và đồng xu | Trả lời hai câu một lần | Ghi điểm đúng/sai, nhận dấu hoàn thành |
| Quầy tiếp nhận | Thần Tiếp Nhận tại (13, -2), chồng hồ sơ và con dấu | Hội thoại phát hiện chỉ ngất, chọn hành trang | Mở khóa cổng trùng sinh |
| Cổng trùng sinh | Khung cổng, hai cánh bản lề, tường cuối đường tại z = 13 | Tới gần, lời tiễn, đi qua cổng đã mở | Chỉ chuyển sang nông trại sau khi nhân vật qua ngưỡng |
| Nông trại | Sáu luống, cây nhỏ / cây lớn / quả chín, cây ven vườn, đường đất | Bấm vị trí, joystick hoặc WASD / mũi tên | Gameplay chính, không có bảng kết thúc chặn lại |
| Khu sơ chế và rang | Bàn và thùng rang tại (7, -5) | Dùng ba quả để tạo một túi cà phê rang, chờ rồi nhận | Có nguyên liệu, không tạo trùng mẻ |
| Điểm giao hàng | Quầy tại (7, 3) | Giao một túi lấy 40 xu; mua ba hạt giống với 20 xu | Kiểm tra tồn kho / tiền trước giao dịch |

Các thần được bố trí thành vòng cung quanh sân giữa, quay mặt vào quảng trường và có lối đi riêng. Quầy tiếp nhận ở nhánh phải; cổng trùng sinh là đầu cuối phía trở về, có tường chặn đi vòng. Cổng đóng chặn đường. Cổng mở hết mới cho nhân vật đi qua theo luồng chuyển cảnh; không cho tự đi ra phía sau bản đồ.

## Quy ước model

- Đơn vị Three.js là đơn vị world; avatar cao khoảng 2 đơn vị.
- NPC và đồ vật đặt chân / đáy ở local Y = 0, hướng chính local +Z. Giữ kích thước gần khối tạm để không làm mất khoảng đứng tương tác.
- Nhãn tên, dấu nhiệm vụ, điều kiện tương tác, điểm số và dữ liệu lưu nằm ngoài model hình ảnh.
- Cây có wrapper riêng: ẩn khi luống trống, nhỏ khi mới trồng, lớn khi phát triển. Cây trưởng thành được giữ lại sau thu hoạch, cần tưới cho lứa tiếp theo.
- Model cây có thể đặt nhóm `fruit_ripe` và `fruit_green`: game bật quả chín ở trạng thái thu hoạch, bật quả xanh khi cây đang lớn.
- Thời gian cây lớn và rang là nhịp game rút gọn (25 giây và 4–8 giây), không mô phỏng thời gian nông nghiệp ngoài đời.

## Các slot thay hình

Scene và controller cung cấp `getAssetSlots()` và `replaceAsset(id, object3D)`. Đây là điểm thay hình, không phải API để đổi luật chơi. Gọi sau khi tải GLB và trước khi đưa cảnh cho người chơi điều khiển. Model phải được chuẩn hóa kích thước / pivot trước khi gắn; API không đoán tỷ lệ của file nghệ thuật.

| Slot | Nội dung thay | Kích thước tham khảo |
|---|---|---|
| `intro/street/road` | Mặt đường, vỉa hè, vạch kẻ, gờ vỉa | Dài 80 theo X; mặt vỉa hè cao khoảng 0,3 |
| `intro/street/shops` | Dãy nhà phố, mái hiên, biển hiệu, bàn ghế trước quán | Mặt tiền tại z ≈ -3,4; cao 6–8,6 |
| `intro/street/trees` | Bốn cây ven đường và bồn cây | Cao khoảng 5,5; gốc tại z = -0,8 |
| `intro/warning-sign/post` | Cột và tay treo biển | Pivot chân cột; cao 3,1; tay vươn +Z 1,6 |
| `intro/warning-sign/board` | Tấm biển "CHÚ Ý ĐẦU" (nhân vật va vào) | 1,9 × 0,48; pivot tâm tấm, game tự lắc |
| `intro/bicycle` | Xe đạp + người lái | Dài 1,9; cao khoảng 1,4; hướng chạy +X |
| `intro/ambulance` | Xe cấp cứu (đầu xe về +X) | 5,1 × 1,9; cao 2,6 |
| `intro/stretcher` | Cáng | 2,1 × 0,75; tay cầm tại (±1,2; 0,9; ±0,31) |
| `intro/reaper` | Thần chết mở đầu (không gồm xích) | Cao 2,7; tay kéo xích tại (-1,05; 1,3; 0) |
| `intro/heaven/path` | Đường mây và mây nền | Mặt đi tại pivot; đường rộng 7, dài 22 về -Z |
| `intro/heaven/gate/frame` | Trụ và vòm cổng trời | Pivot chân giữa cổng; rộng 5,9; cao khoảng 7,3 |
| `intro/heaven/gate/left-leaf`, `right-leaf` | Cánh cổng trời | Rộng 2,5; cao 4,7; pivot bản lề, hình kéo về phía giữa |
| `heaven/reaper` | Toàn bộ thần chết và lưỡi hái | Cao 2,7; thân rộng khoảng 1 |
| `heaven/growing` | Cụm chuyên gia trồng + bàn và đạo cụ | Rộng 2,1; sâu khoảng 1,7; cao 2,1 |
| `heaven/brewing` | Cụm chuyên gia pha chế + bàn và máy | Như trên |
| `heaven/business` | Cụm chuyên gia kinh doanh + bàn | Như trên |
| `heaven/clerk` | Cụm thần tiếp nhận + quầy hồ sơ | Như trên |
| `heaven/portal/frame` | Hai trụ và vòm, không gồm cánh | Rộng 3,9; cao khoảng 5 |
| `heaven/portal/left-leaf` | Cánh trái | Rộng 1,65; cao 3; pivot ở bản lề trái, hình kéo về local +X |
| `heaven/portal/right-leaf` | Cánh phải | Rộng 1,65; cao 3; pivot ở bản lề phải, hình kéo về local -X |
| `farm/plot-0/bed` … `farm/plot-5/bed` | Nền và viền mỗi luống | 2,1 × 2,1; cao khoảng 0,25 |
| `farm/plot-0/crop` … `farm/plot-5/crop` | Cây và quả của mỗi luống | Cao 1,4; tán nằm trong luống |
| `farm/roaster` | Bàn sơ chế và thiết bị rang | Rộng 2; sâu 1,5; cao khoảng 2 |
| `farm/market` | Quầy giao hàng | Rộng 2; sâu 1,5; cao khoảng 2 |

Màn 1 (`createIntro`) cũng trả `getAssetSlots()` / `replaceAsset()`: gắn trước `compileAsync`. Nhân vật chính, linh hồn và hai nhân viên y tế dùng rig người trong `characters/` (có animation/IK riêng) nên không phải slot; tia va chạm, mây trôi, bụi hồn, xích là hiệu ứng của game. Đèn còi chỉ nhấp nháy trên khối tạm; asset xe thật tự mang đèn.

Bản lề và nhịp mở cổng được giữ ở wrapper của cánh, nên model cánh không được chứa một bản lề / animation mở thứ hai. Sau khi gắn hình mới, scene dựng lại vật cản từ bounds các mesh nằm trong chiều cao di chuyển; các cánh cổng được xử lý riêng theo trạng thái đóng / mở. Các khối cũ giữ ẩn để được giải phóng cùng scene; không tiếp tục chặn đường.

Ví dụ tích hợp ở factory cảnh, sau khi có GLTFLoader và controller:

```js
const { scene: model } = await loader.loadAsync(`${import.meta.env.BASE_URL}models/heaven/reaper.glb`);
// Chuẩn hóa kích thước và pivot model theo bảng trên trước khi gắn.
game.replaceAsset('heaven/reaper', model);
```

API hiện gắn hình và cập nhật vùng cản. Clip idle / nói chuyện của asset NPC chưa được nối tự động; thêm tại lớp dựng hình khi có asset thật. Avatar vẫn dùng loader và animation riêng trong `characters/`.

## Asset theo bậc nâng cấp

Mỗi công trình nông trại (giếng, sân phơi, lò rang, máy xay, tiệm/quầy) có 5 slot, chỉ một slot hiện theo cấp:

| Slot | Bậc | Hiện từ cấp |
|---|---|---|
| `farm/<id>/tier-1` | Cơ bản | 1 |
| `farm/<id>/tier-2` | Cải tiến | 10 |
| `farm/<id>/tier-3` | Chuyên nghiệp | 50 |
| `farm/<id>/tier-4` | Công nghiệp | 200 |
| `farm/<id>/tier-5` | Huyền thoại | 500 |

Giữ nguyên footprint, pivot và hướng cửa của bậc 1 cho mọi bậc để vùng cản và điểm tương tác không đổi; chỉ thay hình. Gắn bằng `replaceAsset('farm/dryer/tier-3', model)`. Dấu bậc ở `farm/<id>/upgrade-markers`; dấu nâng cấp ngoài trời của đất/rào/ao/giếng ở `farm/upgrades/<id>` hiện theo bậc 2–4.

## Khung UI dùng chung

Màn 1, màn 2 (Hội đồng trùng sinh), chọn nhân vật và farm dùng chung một kiểu khung gỗ + giấy da. Màu và ảnh khai báo một lần ở `:root` trong `src/ui/styles/game.css`:

| Biến | Dùng cho |
|---|---|
| `--ui-panel-image` | Nền giấy: thẻ nhiệm vụ, hội thoại, toast, joystick |
| `--ui-window-image` | Nền ván gỗ: hồ sơ trùng sinh, bảng kết chương |
| `--ui-button-image` | Nút xanh / vàng / nút hồ sơ |
| `--ui-paper`, `--ui-plank`, `--ui-go`, `--ui-gold`, `--ui-wood*`, `--ui-ink*` | Màu nền dự phòng và màu chữ |

Thay asset UI: đặt ảnh vào `public/ui/` rồi gán, ví dụ `--ui-panel-image:url(/ui/paper.png)`. Ảnh nằm trên lớp màu dự phòng nên thiếu file vẫn hiển thị đúng. Không cần sửa selector hay JS.

Biến trạng thái: `--ui-line` (kẻ dòng), `--ui-muted` (chữ phụ), `--ui-good/-bg`, `--ui-warn/-bg`, `--ui-bad/-bg/-edge`, `--ui-off/-edge` (khoá, công tắc tắt), `--ui-toast-bg`, `--ui-focus`, `--ui-shine` (viền sáng), `--ui-sheet` (nền kem đặc), `--ui-shadow`, `--ui-drop-soft`, `--ui-coin-hi/-edge`, `--ui-chip-edge`. Màu viết thẳng còn lại trong farm.css/cafe.css chỉ là màu vẽ hình (gói hạt, đồng xu, quầy pha).

Bộ class dùng chung ở `src/ui/styles/ui-kit.css` (import đầu tiên trong game.css). Code mới dùng thẳng class này; selector cũ đứng làm bí danh trong `:where()` nên rule riêng của farm/quán vẫn thắng.

| Class | Dùng khi |
|---|---|
| `ui-btn` + `--go` / `--gold` / `--plain` / `--link` / `--icon`, cỡ `--sm` / `--lg` | Nút: xanh = thao tác chính, vàng = mua/xu/giữ để rót, kem = phụ/hủy, chữ = liên kết, tròn = chỉ icon. Khoá dùng `:disabled` hoặc `aria-disabled="true"` (xám, con trỏ cấm); đang xử lý dùng `aria-busy="true"` |
| `ui-close` | Nút đóng tròn ngoài góc trên phải của modal |
| `ui-hud-btn` | Ô gỗ kem ở menu HUD: icon trên, nhãn `small` dưới |
| `ui-modal`, `ui-modal__window`, `__head`, `__title`, `__subtitle`, `__body`, `__foot`, cỡ `ui-modal--sm/md/lg` | Shop, kho, nâng cấp, xác nhận, cài đặt: giữa màn, nền tối `--ui-backdrop`. Dùng được với `<section role=dialog>` + cửa sổ con, hoặc `<dialog class="ui-modal ui-modal__window">` cùng thẻ. Dải chọn giống không dùng modal |
| `ui-tabs` + `ui-tab` (`aria-selected`/`aria-pressed`), `ui-tabs--segmented` | Tab thư mục trong modal; segmented cho 2–3 lựa chọn (Nam/Nữ, Thấp/Vừa/Cao) |
| `ui-alert` + `--info` / `--good` / `--warn` / `--bad` (hoặc `data-tone`) | Thông báo nằm trong khung, không tự mất |
| `ui-toast` (`data-success="false"` = tông xấu) | Báo ngắn giữa phía trên, JS tự ẩn sau 3 s, không chặn bấm |
| `ui-panel`, `ui-panel--card` | Giấy HUD nhỏ ở mép (nhiệm vụ, nhật ký), thẻ lớn chọn nhân vật |
| `ui-box`, `ui-box--empty`, `ui-row` | Ô kem trong modal, ô trống, dòng icon + chữ + nút phải |
| `ui-badge`, `--dot`, `--level`, `ui-chip` | Số đếm, chấm báo, huy hiệu cấp, nhãn nhỏ |
| `ui-switch` (`role=switch` + `aria-checked`), `ui-slider` (`input[type=range]`) | Công tắc, thanh trượt âm lượng (vùng chạm 44 px) |
| `vfx-chip` (`data-tone="good/bad/neutral"`) | Chip số bay về HUD của `src/shared/vfx` |

`#game-settings-toggle` (⚙️) ở góc trên phải các màn chọn nhân vật, mở đầu, thiên đàng; vị trí tự chỉnh bằng `:has()` theo HUD đang hiện, ẩn ở farm/quán (đã có ô ⚙️ riêng).

## Phần chưa có

Quán bán cà phê, khách hàng và trang trí quán là chương tiếp theo; hiện mới có vòng nông trại và giao hàng. Không hiển thị nút vào một quán chưa triển khai. Âm thanh, lồng tiếng, hiệu ứng nghệ thuật và model chính thức chưa được gắn.

Các thay đổi cổng, slot asset và UI gần nhất chưa được chạy kiểm tra sau khi người dùng yêu cầu trở lại tự test. Không xem các kết quả test trước đó là xác nhận cho những thay đổi này.
