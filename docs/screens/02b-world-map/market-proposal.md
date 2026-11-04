# Đề xuất: Chợ thế giới (sàn đơn hàng giữa các khu vực)

| | |
|---|---|
| Người đề xuất | Quang |
| Ngày | 04/11/2026 |
| Trạng thái | Đề xuất — chưa code (GDD F-32; đổi từ F-31 ngày 04/11/2026 vì trùng mã Món mới) |
| Liên quan | F-28 Bản đồ thế giới ([README](README.md)), F-10 Đơn hàng farm → quán, F-08 Chợ, "Nhập hạt ngoài" của quán |

## Ý tưởng

Một **chợ chung giữa các khu vực** trên bản đồ thế giới. Ai thiếu thì đăng đơn lên chợ, ai có thì nhận đơn về làm rồi trả hàng.

- **Nơi chỉ trồng** (Kenya, Colombia, Indonesia) chỉ làm ra hạt. Họ nhận đơn **mua hạt** của các quán ở nơi khác, rang xong thì gửi đi và được trả tiền. Họ cũng đăng đơn **bán hạt** của mình.
- **Nơi chỉ quán** (Ý, Nhật, Mỹ) không có hạt. Họ đăng đơn **cần mua hạt** hoặc nhận đơn **bán hạt** của các nông trại nơi khác. Hàng về sau thời gian vận chuyển.
- **Nơi cả hai** (Việt Nam, Brazil) dùng chợ khi dư hoặc thiếu, nhưng không bắt buộc.

Chợ là thứ nối hai loại nơi lại với nhau. Đây cũng là cách giữ trụ cột 3 ("hai màn phụ thuộc nhau") ở nơi chỉ có một bên.

## Ai ở phía bên kia?

Game hiện **chơi một mình, lưu trong trình duyệt** (`localStorage`), không có máy chủ.

| Cách | Mô tả | Công |
|---|---|---|
| **A. NPC (đề xuất cho v1)** | 7 nơi còn lại là thương lái NPC. Đơn NPC tự sinh theo loại nơi (quán NPC đặt mua hạt, nông trại NPC rao bán hạt). Đơn người chơi đăng thì NPC nhận sau một khoảng chờ | Vừa, chỉ cần client |
| B. Người chơi thật (online) | Đơn đăng lên máy chủ, người chơi khác nhận | Lớn: cần máy chủ, tài khoản, chống gian lận, đồng bộ |

Đề xuất làm A trước. Dữ liệu đơn tách sẵn trường `from` (nơi, người) để sau này thay NPC bằng người thật mà không đổi luật.

## Luật (v1, NPC)

### Đơn trên chợ

| Trường | Ý nghĩa |
|---|---|
| `side` | `buy` (bên đăng cần mua) / `sell` (bên đăng muốn bán) |
| `from` | id nơi đăng (`it`, `ke`…), `player` nếu là người chơi |
| `product`, `cropId`, `grams` | Hàng: hạt rang (v1 chỉ hạt rang; quả/hạt khô để sau), giống, số gam (252 / 504 / 1000) |
| `price` | Xu cho cả đơn. Khoảng giá nằm **giữa giá chợ địa phương và giá Nhập hạt ngoài** (xem bảng giá) |
| `deadline` | Hạn giao. Quá hạn thì đơn hủy, bên nhận mất uy tín chợ |
| `transitMs` | Thời gian vận chuyển theo khoảng cách hai nơi |

### Luồng của người chơi

1. Mở **🌐 Chợ thế giới** (nút HUD ở cả nông trại và quán; ở nơi chỉ quán thì thay ô "Đơn hàng" đang ẩn).
2. Tab **Đơn đang mở**: xem đơn NPC, lọc theo việc mình làm được.
   - Nông trại thấy đơn `buy` của các quán ("Ý cần 504 g hạt chè rang · trả 62 xu · hạn 2 ngày công").
   - Quán thấy đơn `sell` của các nông trại ("Kenya bán 1 kg chè rang · 115 xu · tới sau 40 s").
3. **Nhận đơn**: đơn chuyển sang tab **Đơn của tôi**.
   - Đơn mua: dùng lại bước sản xuất của F-10 (`orderSteps`: trồng → hái → phơi → rang → gửi). Đủ hàng thì bấm **Gửi đi · phí vận chuyển**, hàng rời kho, sau `transitMs` thì nhận tiền.
   - Đơn bán: trả tiền ngay khi nhận, hàng vào kho quán sau `transitMs` (dùng lại `cafe.shipments`).
4. **Đăng đơn**: chọn hàng, số lượng, giá trong khoảng cho phép. NPC phù hợp nhận sau 20–90 s. Giá càng sát giá thị trường thì càng nhanh có người nhận.
5. Tab **Đang vận chuyển**: chuyến đi/về có đồng hồ. Trên bản đồ thế giới có thể vẽ đường tàu nối hai nơi (để sau).

### Bảng giá (gợi ý, cần chạy `balance-sim` để chốt)

Mốc hiện có: chợ địa phương mua hạt rang khoảng **0,07 xu/g**, quán "Nhập hạt ngoài" trả **0,15 xu/g** (75 xu / 500 g).

| | Giá/g | Ghi chú |
|---|---|---|
| Quán NPC đặt mua hạt (người chơi làm farm nhận) | 0,10–0,13 | Cao hơn bán chợ địa phương: lý do để farm dùng chợ thế giới |
| Farm NPC rao bán hạt (người chơi làm quán mua) | 0,10–0,12 | Rẻ hơn Nhập hạt ngoài nhưng phải chờ vận chuyển và có hạn mức |
| Hệ số giống | vối ×1, chè ×1,3, mít ×1,5 | Như `priceScale` hiện có |
| Phí vận chuyển | 3 xu cùng châu lục, 6 xu khác châu lục | Trừ khi gửi hoặc khi đặt mua |
| Thời gian vận chuyển | 20 s cùng châu lục, 45 s khác châu lục | Có nâng cấp Giao hàng thì nhanh hơn như chuyến farm → quán |
| Phí sàn | 5% giá đơn | Chặn mua đi bán lại vô hạn |

### Cân bằng giữa các loại nơi

- **Chỉ trồng**: thu nhập chính là đơn mua của quán NPC (giá tốt hơn chợ), nhưng phải tự trồng, rang và giao đúng hạn.
- **Chỉ quán**: nguồn hạt chính là đơn bán của farm NPC (rẻ hơn Nhập hạt ngoài), nhưng phải chờ hàng và lo thiếu hạt. "Nhập hạt ngoài" vẫn còn làm đường lui đắt tiền.
- **Cả hai**: tự cung tự cấp nên ít cần chợ. Có thể giới hạn mỗi ngày công 1 đơn để chợ không thành lợi thế thêm.
- **Uy tín chợ** (0–100): giao đúng hạn thì tăng, quá hạn thì giảm. Uy tín cao thì thấy đơn giá cao hơn và đơn lớn hơn.

### Nhiệm vụ gắn chợ (thêm vào `REGION_QUESTS`)

| Nơi | Ví dụ |
|---|---|
| Kenya | "Giao 3 đơn cho quán ở châu Âu" |
| Colombia | "Bán 1 kg qua chợ thế giới" |
| Indonesia | "Hoàn thành 2 đơn chè" |
| Ý / Nhật / Mỹ | "Nhập hạt từ 2 nơi khác nhau qua chợ" |
| Việt Nam / Brazil | "Bán 1 đơn hạt dư ra chợ thế giới" |

Cần thêm chỉ số `stats.tradeDone`, `stats.tradeOrigins` (số nơi khác nhau đã giao dịch).

## Ảnh hưởng

- Luật / tài liệu: thêm mục chợ thế giới vào `02b-world-map/README.md`, `03-farm/rules.md` (mục 4 Đơn hàng, mục 6 Kho mua bán), `04-cafe/gameplay.md` (nguồn hạt), GDD (dòng `F-xx` mới).
- Dữ liệu save: `farm.trade = { board: [...], mine: [...], trips: [...], reputation, seq, lastRefresh }`. Phải sửa `shared/contracts.md`. Save cũ chưa có thì tạo rỗng, không đổi `version`.
- Code:
  - `farm/model.js`: hành động `trade/accept`, `trade/post`, `trade/ship`, `trade/cancel`; sinh đơn NPC theo ngày công.
  - `farm/orders.js`: dùng lại `orderSteps`.
  - Nông trại: modal 🌐 Chợ thế giới trong `farm/ui.js`.
  - Quán: nút Chợ thế giới trong `cafe/ui.js`.
  - Chữ: `i18n` cho cả hai thứ tiếng.
- Asset: icon 🌐, có thể thêm đường vận chuyển trên bản đồ thế giới (để sau).
- Ước lượng: model + sinh đơn NPC khoảng 1,5–2 ngày, UI modal ở farm và quán khoảng 1,5 ngày, cân bằng bằng sim và test khoảng 1 ngày.

## Câu hỏi mở

1. v1 chỉ NPC (A) hay cần người chơi thật (B) ngay?
2. Chỉ giao dịch **hạt rang**, hay cả quả tươi, hạt khô và vật tư quán (sữa, ly)?
3. Nơi "cả hai" có bị giới hạn số đơn mỗi ngày công không?
4. "Nhập hạt ngoài" giữ nguyên làm đường lui, hay bỏ hẳn ở nơi chỉ quán để buộc dùng chợ?
5. Có hiển thị đường vận chuyển trên bản đồ thế giới không (mở bản đồ lại từ HUD)?
