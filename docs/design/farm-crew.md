# Đội nông trại theo nghề (2026-11-08)

Thay `farmhand` đa năng và `sproutBot` bằng các nghề gắn với asset Gedeo. Quán café giữ nguyên. Hồ sơ, KPI, kỹ năng,
đồ nghề, tổng quản lý, thợ bị giành, pin/kẹt/bảo hành vẫn chạy như cũ. Số liệu dưới đây là đề xuất, chưa chạy sim.

Không có cấp mở khoá (founder 2026-11-08): nghề, robot, linh kiện, phần mềm, máy móc, sân phơi, trạm sơ chế, bể nước, Tổng quản lý và giấy phép cứ đủ xu là mua được. Số người không giới hạn theo cấp, chỉ có trần kỹ thuật 30 mỗi khu.

## 1. Người: mỗi người một nghề

| Nghề | Asset | Việc | Giá gốc |
|---|---|---|---|
| Thợ hái `picker` | `worker-picker-f/m` | Hái quả chín | 150 |
| Thợ trồng `planter` | `worker-planter-f` | Trồng ô trống | 130 |
| Thợ tưới `waterer` | `worker-waterer-m` | Lấy nước ở bể gần nhất, tưới miễn phí | 120 |
| Thợ sơ chế `processor` | `worker-processor-f` | Bắt đầu và thu mẻ ở sân phơi, trạm ướt | 170 |
| Thợ khuân `hauler` | `worker-hauler-m` | Bê quả từ ruộng về nhà kho gần nhất | 140 |
| Thợ tỉa `pruner` | `worker-pruner-m` | Cưa đốn cây già, tỉa nhẹ cây đang lớn (+1 hạt) | 160 |

Bảng tuyển dụng có 3 ứng viên khác nghề. Ứng viên đầu luôn là nghề đội đang thiếu nhất.

## 2. Robot: mỗi loại một việc, không có Auto

| Robot | Asset | Việc | Giá |
|---|---|---|---|
| `harvestBot` | `robot-harvest` | Hái | 1200 |
| `plantBot` | `robot-plant` | Trồng | 1200 |
| `waterBot` | `robot-water` | Tưới, lấy nước ở bể gần nhất | 1000 |
| `haulBot` | `robot-haul` | Chở quả về kho | 1400 |
| `pruneBot` | `robot-prune` | Cưa đốn, tỉa nhẹ | 1300 |
| `droneBot` | `robot-drone` | Phun lá (+1 hạt mỗi mùa, 1 xu mỗi ô) | 1600 |

## 3. Máy móc: mua, đặt trên đất, tốn phí khi chạy

| Máy | Asset | Tác dụng | Phí chạy | Giá |
|---|---|---|---|---|
| Dây tưới nhỏ giọt `dripLine` | `drip-line` | Ruộng trong 12 m tự được tưới, thợ tưới bỏ qua | 1 xu/ô mỗi mùa | 180 |
| Máy xát vỏ `pulper` | `pulper-machine` | Trạm sơ chế trong 12 m chạy nhanh hơn 30 % | 1 xu/mẻ | 350 |

Mọi máy nâng được 5 cấp (nút Nâng cấp của công trình).

## 4. Save cũ

- `farmhand`: có task thì theo task (hái, trồng, tưới), không có thì luân phiên Thợ hái, Thợ trồng.
- `sproutBot`: task trồng thành `plantBot`, còn lại thành `harvestBot`.
- Bỏ tưới trả phí (`staff/tend`), vì đã có nghề tưới.

Bỏ chăn nuôi, chuồng và xe (người sáng lập, 2026-11-09): nông trại tập trung trồng 3 giống cà phê. Save cũ tải vào thì chuồng, vật nuôi và xe biến mất, không hoàn xu. Thợ chăn nuôi được cho nghỉ và hoàn đúng số xu đã thuê (`paid`).

## 5. Luồng hàng và nước

- Thợ hái hoặc robot hái: quả nằm thành đống trên ruộng nếu có thợ khuân và nhà kho, không có thì vào kho ngay. Người chơi tự hái luôn vào kho.
- Thợ khuân: tới đống gần nhất, còn chỗ thì lấy thêm đống trong 8 m, rồi về nhà kho gần nhất. Kho đầy thì đứng chờ. Không còn thợ khuân thì đống trên ruộng tự vào kho.
- Việc bán hàng do người chơi hoặc tổng quản lý làm, thợ khuân không tự bán.
- Thợ tưới và robot tưới: chọn bể nước đã xây có đường đi ngắn nhất (mình → bể → cây). Chưa xây bể thì đứng chờ và báo.

## 6. Công thức chỉ số (n = điểm chỉ số 1..5, t = cấp linh kiện robot 0..3)

| Chỉ số | Áp dụng | Công thức |
|---|---|---|
| ⚡ Nhanh | Mọi nghề | Tốc độ làm và đi theo n = 1..5: ×0,65 · 0,8 · 1 · 1,15 · 1,3. Robot theo động cơ t = 0..3: ×0,7 · 1 · 1,2 · 1,4 |
| 💪 Bền | Mọi nghề | Năng lượng = 100 + 20 × (n − 1), ít lười hơn 15 % mỗi bậc |
| 💪 Bền | Thợ khuân | Chở = 6 + 2 × (n − 1). Robot: 6 + 2 × t(pin) |
| 💪 Bền | Thợ tưới | Mỗi lượt = 4 + bình tưới + (n − 1). Robot: 8 + 2 × t(pin) |
| 🎯 Chuẩn | Thợ hái, trồng, khuân | Giảm tỉ lệ hái non, trồng lệch, rơi hàng; từ n = 3 làm ra hàng 2★ |
| 🎯 Chuẩn | Thợ tưới | Mỗi lần tưới rút ngắn 30 % + 3 % × (n − 1) thời gian chờ |
| 🎯 Chuẩn | Thợ sơ chế | Thưởng đặc sản × (1 + 5 % × (n − 1)) |
| 🎯 Chuẩn | Thợ tỉa | Tỉa nhẹ +1 hạt, từ n = 4 là +2 hạt |
| 🧠 Thông minh | Thợ hái | n = 2 hái cây cần nhất trước, n = 5 hái 2 ô một chuyến |
| 🧠 Thông minh | Thợ trồng | n = 3 trồng giống bạn chọn |
| 🧠 Thông minh | Thợ tưới | n = 2 tưới cây còn chờ lâu nhất trước |
| 🧠 Thông minh | Thợ khuân | n = 2 chở đống lớn nhất trước, n = 3 gom thêm đống gần trong 8 m (robot: pin ≥ 1) |
| 🧠 Thông minh | Mọi nghề | n = 4 tìm việc mới ngay |

Giá nâng một bậc từ n: n điểm kỹ năng + 100 × n xu. Code: `CREW`, `haulLoadOf`, `bucketOf`, `waterSpeedupOf`, `trimBeansOf`, `premiumMulOf` trong `economy.js`.

## 7. Chỉ số thấp thì sao (lý do phải nâng cấp)

Mỗi lần chuẩn bị bắt đầu việc, đơn vị có thể bỏ việc đó để làm trò khác:

| Hành vi | Người | Tỉ lệ theo n = 1..5 | Robot | Tỉ lệ theo t = 0..3 |
|---|---|---|---|---|
| Bỏ đi chơi nơi xa, có thể sang tầng khác | 💪 Bền | 30 · 18 · 10 · 4 · 0 % | Pin: chạy về chỗ sạc | 14 · 8 · 3 · 0 % |
| Đi nhầm chỗ, đứng ngơ 3 giây | 🧠 Thông minh | 25 · 15 · 8 · 3 · 0 % | Khung: lạc đường | 20 · 10 · 4 · 0 % |

Người tính cách Lười ×1,5, Siêng ×0,6. Đi chơi kéo dài 14 · 11 · 8 · 6 · 4 giây.

Việc chưa biết làm (đứng chờ, hiện ❓):

| Việc | Người cần | Robot cần |
|---|---|---|
| Hái hoặc trồng Arabica, Liberica | 🧠 ≥ 2 | Khung ≥ 1 |
| Cưa đốn cây già | 🧠 ≥ 3 | Động cơ ≥ 2 |
| Chạy trạm sơ chế ướt | 🧠 ≥ 2 | Không áp dụng |

Tỉ lệ làm hỏng theo 🎯: hái non 25 · 15 · 8 · 3 · 0 %, trồng lệch và rơi hàng 20 · 12 · 6 · 2 · 0 %. Robot nông trại kẹt gấp 3 lần trước khi nâng khung.

## 8. Đi lại và làm việc

- Dùng chung bản đồ tìm đường với người chơi, nên chỉ qua tầng bằng dốc và bậc đá, không xuyên tường.
- Chọn việc theo quãng đường đi bộ thật qua các tầng. Chỗ đang có người làm trong 3 m bị tính thêm 5 m, nên đội tự trải ra các ruộng và các tầng.
- Khi đi, ai ở phía trước trong 1,5 m (kể cả người chơi) thì bẻ hướng né, hai người gặp nhau đều rẽ phải.
- Tới nơi thì quay mặt vào cây đang làm.

## 9. Bốn chỉ số thang 10

- Người: ⚡ Nhanh, 🧠 Thông minh, 🎯 Chuẩn, 💪 Bền, từ 1 đến 10. Café giữ thang 5.
- Robot: 🔋 Pin, ⚙️ Động cơ, ❄️ Làm mát, 🛡️ Khung, cấp 1 đến 10.
- Quản lý: 4 chỉ số giống người. ⚡ phản ứng nhanh hơn (5 giây xuống 2 giây mỗi lượt). 🧠 bán giá cao hơn 3 % mỗi bậc và ép phí sự cố 5 % mỗi bậc, tự tăng 1 sau 40 việc. 🎯 làm thêm 1 việc mỗi 3 bậc. 💪 giảm sự cố cả đội 6 % mỗi bậc.

## 10. Tình huống hài hước

- Khi bắt đầu việc, đơn vị có thể gây chuyện gắn với một chỉ số. Tỉ lệ theo chỉ số 1..10: 6 · 5 · 4 · 3 · 2,2 · 1,6 · 1 · 0,6 · 0,3 · 0,1 %.
- Cấp tình huống = 11 − chỉ số. Phí người 2 + cấp, robot 3 + 2 × cấp.
- Người: lướt điện thoại, tán gái, ngủ gật, buôn chuyện, không chịu làm, hát hò, trốn đi ăn, cá độ. Robot: nhảy, ca hát, hỏng, nhiễm virus, say dầu, đang yêu.
- Dừng làm cho tới khi trả tiền hoặc đuổi. Bạn và quản lý đều làm được. Quản lý trả nếu phí ≤ 8 phút tiền đơn vị đó kiếm được, hoặc nó gây chuyện chưa tới 3 lần trong ngày; ngược lại thì đuổi.

## 11. Quản lý điều hành

- Mỗi người và robot được giao một tầng (2026-11-09: chia đều theo từng nghề cho các tầng đã có ruộng, tổng số người mỗi tầng lệch nhau tối đa 1; việc trên ruộng chỉ làm ở tầng mình; bạn có thể ghim).
- Tự mua thứ đội thiếu: kho, bể nước, sân phơi, xe, máy.
- Bạn chỉ ký nạp tiền và bán hạt. Kho đầy 50 % là quản lý xin bán.
- Sự cố là việc đầu tiên của quản lý: mỗi lượt xử lý hết, không tính vào số việc của lượt. Mỗi lượt cách nhau 5 giây ở ⚡ 1, 2 giây ở mức cao.
- Thiếu nghề đang có việc thì tự thuê. Ruộng đã kín hoặc đông người thì tự thêm ruộng, không đặt được nữa thì mua lô đất tiếp theo.
- Không có đình công hay chờ lệnh.
- Bị dụ đi: 3 tiếng tính theo thời gian chơi. Giữ lại thì trả thưởng. Trong lúc đó chọn sẵn người thay từ bảng ứng viên; khi người cũ đi, người mới vào làm và trả phí lúc đó.

## 12. Quản lý ra lệnh, người chuyên môn đi làm

- Thợ trồng mở ruộng. Thợ khai hoang mở lô đất mới. Thợ xây xây công trình, máy.
- Quản lý quyết định, người có nghề đó đi tới nơi rồi làm. Chưa có ai cho việc đó thì quản lý tự làm.
- Từ đầu game chưa có ruộng: thuê thợ trồng, mở 6 ruộng đầu, xây kho.
- Ba việc bạn quyết (bán hạt, nạp tiền, quản lý bị dụ) nằm trong menu Duyệt, mỗi việc có nội dung và nút Duyệt, Từ chối.

## 13. Thuật toán phát triển của quản lý

- Tiền được đầu tư = xu hiện có − quỹ chăm đội − 2 kỳ lương.
- Số ruộng mở thêm: tối đa 6 mỗi lượt, giới hạn bởi tiền và sức thợ trồng (3 ruộng trống mỗi thợ). Xếp hàng cách 2,4 m, lấp kín tầng này rồi sang tầng sau, không đè đường.
- Số người cần: trồng (ô trống + ruộng tiền mở được) / 6, tối đa 8; hái số ruộng / 10; tưới ruộng khô / 14; khuân nửa số thợ hái; sơ chế nửa số trạm; tỉa ruộng / 30. Thợ chậm được tính ít hơn.
- Thiếu nghề nào nhất thì thuê nghề đó trước. Tiền nhiều (≥ 6 lần giá robot) thì mua robot đúng việc.
- Mỗi tầng có ruộng sẽ có một bể nước. Kho đầy 80 % thì xây thêm kho.
- Mua lô đất khi ruộng kín hoặc có từ 2 lần giá lô và đã có 12 ruộng.
- Tiền càng nhiều càng làm nhiều việc mỗi lượt: thêm 1 việc mỗi 2.000 xu, tối đa thêm 5.

## 14. Quản lý cân lợi nhuận

- Mỗi ruộng mới đặt vào tầng có (tiền một ruộng của tầng đó / số ruộng đang có + 1) cao nhất, nên cả 4 tầng đều được trồng. Ruộng bên cạnh ruộng cũ cùng tầng.
- Mua tầng mới khi có từ 2 lần giá và đã có 6 ruộng, hoặc khi ruộng kín.
- Tiền dư nâng cấp đội: người cần tiền ≥ 3 lần giá, robot ≥ 5 lần giá. Ưu tiên 🧠, 💪, 🎯, ⚡ (robot: khung, động cơ, pin, làm mát), chỉ số thấp nhất trước. Trong nông trại nâng chỉ tốn xu.
- Thay người yếu: trên bảng có ứng viên cùng nghề hơn 2 điểm tổng, hoặc bằng điểm mà người này gây chuyện từ 2 lần trong ngày hay lười. Tối đa một người mỗi 3 phút.
- Thuê ứng viên chỉ số cao nhất cho đúng nghề thiếu.
- Chưa biết làm Arabica, Liberica thì trồng giống dễ thay vì đứng chờ.
- Xây: kho, bể nước mỗi tầng, trạm sơ chế theo số ruộng, máy xát, xe, dây tưới và cây che bóng mỗi tầng, rồi nâng cấp công trình khi tiền ≥ 5 lần giá.

## 15. Không tiêu quá sức kiếm

- Mỗi 10 phút quản lý chỉ được đầu tư: 60 % số tiền kiếm được 10 phút qua + 3 % số dư, tối thiểu 150 xu.
- Ngoài ngân sách này chỉ có những thứ bắt buộc: người đầu tiên của một nghề, kho, bể nước, sân phơi, 6 ruộng đầu.
- Nâng cấp phải hồi vốn trong 30 phút. Xây thêm chỉ khi giá ≤ 2 lần thu nhập 10 phút. Robot ≤ 3 lần. Nâng cấp công trình ≤ 1 lần.
- Mua tầng mới: tầng đó đầy ruộng phải hồi vốn trong 120 phút.

Từ 2026-11-08, các chi tiêu của quản lý còn qua thêm lớp Farm Manager V2 (`docs/design/farm-manager-v2.md`): tiền dự phòng, xếp hạng theo hồi vốn, chế độ và quyền do bạn đặt. Các quy tắc ở mục này vẫn áp dụng.

Từ 2026-11-09, quản lý tự hái, trồng, tưới và mở ruộng như người chơi bấm (xem `farm-manager-v2.md` mục 2b), thay một phần mục 12. Quản lý cũng tự bán hạt khi kho đầy 50 % (có công tắc tắt), thay quy tắc ký bán ở mục 11 và 12.

## 16. Còn để ngỏ

- Chưa chạy `npm run sim` với đội mới, giá và phí có thể cần chỉnh.
- `worker-supervisor-m` chưa dùng. Tổng quản lý vẫn giữ áo tím đã chốt.
- Tổng quản lý tự thuê theo ứng viên và robot đang thiếu, nhưng chưa tự mua máy móc.
