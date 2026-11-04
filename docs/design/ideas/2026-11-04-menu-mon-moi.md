# Thêm món vào thực đơn quán, hạt theo xuất xứ, sữa và nước theo nhãn

| | |
|---|---|
| Người đề xuất | Sếp (qua chat, Quang chép lại) |
| Ngày | 04/11/2026 |
| Trạng thái | Đã triển khai |
| Ưu tiên | Vừa |
| Màn liên quan | 04 Quán (và 03 Nông trại vì hạt) |
| Mục GDD | 7.4 Công thức, 7.5 Nguyên liệu |
| Mã tính năng | F-31 |
| Cập nhật | 04/11 — Quang chốt theo yêu cầu của sếp, đã code: 3 món mới, sữa/nước chọn trong Kho, đổi tên hạt, thêm 🤖 Auto pha |

## Ý tưởng

Sếp gửi (nguyên văn ý):

- Món trước mắt: **Do**, **Cafe phin Việt Nam**, **Espresso**, **Latte**, **Matcha**, **Matcha Latte**, **Pour Over**, **Dirty**. Lấy công thức của các món này.
- Hạt: 2 loại **Arabica Ethiopia** và **Robusta Việt Nam**.
- Sữa: **Meiji** và **Dalat Milk**.
- Nước pha: **nước máy** hoặc **Lavie**.
- Chất lượng ly sẽ khác nhau theo các lựa chọn này.

## Vì sao

- **Học thật:** cùng một món, đổi hạt, sữa, nước là ra ly khác. Đây là kiến thức barista thật.
- **Quay lại:** có món mới để mở khóa, có lựa chọn nguyên liệu để tối ưu lãi.
- **Hai màn phụ thuộc:** hạt Robusta và Arabica gắn với farm và bản đồ thế giới (F-28).

## Đối chiếu với game hiện tại

| Món sếp gửi | Trong game | Việc cần làm |
|---|---|---|
| Do | **Chưa rõ là món gì** | Hỏi lại (xem Câu hỏi mở) |
| Cafe phin Việt Nam | Có: Phin đen nóng, Cà phê sữa đá (nâu đá), Bạc xỉu | Đổi tên hiển thị nếu sếp muốn đúng chữ "Cà phê phin Việt Nam" |
| Espresso | Có | Không |
| Latte | Có | Không |
| Pour Over | Có: Pour-over V60 | Không (đổi tên thành "Pour Over" nếu muốn) |
| **Matcha** | Chưa có | Thêm món + nguyên liệu bột matcha + dụng cụ |
| **Matcha Latte** | Chưa có | Thêm món |
| **Dirty** | Chưa có | Thêm món |

Game còn 5 món ngoài danh sách của sếp: Phin Liberica, Americano, Cappuccino, Cà phê trứng, Cà phê muối. Cần biết sếp muốn **giữ** hay **bỏ** (xem Câu hỏi mở).

## Đề xuất công thức (số theo cách pha thật; bàn pha chia thành bước như các món cũ)

| Món | Công thức | Bước trên bàn pha | Giá gợi ý | Mở khi |
|---|---|---|---|---|
| **Matcha** (nóng) | 2 g bột matcha rây mịn + 70 ml nước 75–80 °C, đánh chữ W 15–20 s tới nổi bọt | Rây bột (chọn: rây / không rây) · đong 2 g · nhiệt nước 75–80 °C (sôi 100 °C làm đắng) · đánh (chọn: chữ W / khuấy tròn) | 3,5 xu | Có dụng cụ **chổi tre (chasen)** |
| **Matcha Latte** (đá hoặc nóng) | 2 g matcha + 30 ml nước 75–80 °C đánh tan, rồi 150 ml sữa (đá: rót lên đá; nóng: đánh sữa 60–65 °C) | Như Matcha phần đầu · rót sữa 140–160 ml · chọn đá / nóng | 4,5 xu | Chasen + uy tín 40 |
| **Dirty** | 150 ml sữa tươi **lạnh** trong ly, rót thẳng 1 shot espresso đôi (~36 g) lên mặt, **không khuấy**, uống ngay để thấy lớp | Rót sữa lạnh 140–160 ml · chiết espresso 33–39 g · chọn (để nguyên lớp ✓ / khuấy ✗) | 4,5 xu | Có máy espresso + uy tín 50 |

- Dirty hợp với luật **ly có hạn tươi** (F-30): để lâu là mất lớp. Có thể cho Dirty hạn tươi ngắn hơn (30 s) nếu sếp muốn.
- Pha nhanh (F-30) và Auto dùng được ngay cho món mới, không cần làm gì thêm.

## Đề xuất hạt, sữa, nước

**Hạt.** Farm đang trồng 3 giống: Robusta, Arabica, Liberica.
- Đề xuất gọn: đổi tên hiển thị thành **Robusta Việt Nam** và **Arabica Ethiopia**, giữ id `robusta` / `arabica` (không vỡ save, không sửa luật farm).
- Vướng: Arabica Ethiopia "trồng ở farm Việt Nam" là sai thực tế. Cách đúng hơn là Arabica Ethiopia là **hạt nhập** (mua từ nhà cung cấp hoặc từ vùng khác trên bản đồ thế giới F-28). Phần hạt nhập của F-28 chưa làm.
- Liberica: bỏ hay giữ? Đang dùng cho món Phin Liberica.

**Sữa và nước: chọn trong Kho, không thêm bước ở bàn pha** (giữ mobile first, không làm món khó thêm):

| Lựa chọn | Giá | Ảnh hưởng chất lượng ly | Áp cho |
|---|---|---|---|
| Sữa **Meiji** | 7 xu / 1 lít | +4 (béo, giữ bọt tốt khi đánh) | Món có sữa tươi |
| Sữa **Dalat Milk** | 5 xu / 1 lít | +2 (vị tươi, nhẹ) | Món có sữa tươi |
| **Nước máy** | Miễn phí | −3 (mùi clo) | Món dùng nước: phin, americano, pour over, matcha |
| **Lavie** | 2 xu / 1,5 lít | +2 | Như trên |

- Công thức chất lượng hiện tại: `chất lượng = điểm pha × 0,75 + chất lượng hạt × 0,25 + thiết bị + hợp hạt`. Đề xuất cộng thêm `+ sữa + nước`, kẹp 0–100. Giá bán đã theo chất lượng (`giá × (0,6 + 0,4 × chất lượng / 100)`), nên Meiji + Lavie bán đắt hơn một chút, đổi lại tốn tiền mua.
- Kho hiển thị "Đang dùng: Meiji · Lavie" kèm nút đổi. Hết loại đang chọn thì tự dùng loại còn hàng, có báo.

## Ảnh hưởng

- **Luật / tài liệu phải sửa:** `04-cafe/gameplay.md` (công thức, nguyên liệu); GDD 7.4, 7.5, Phụ lục A.4; `contracts.md` (nguyên liệu mới, lựa chọn sữa/nước trong save quán); `03-farm/rules.md` nếu đổi tên/bỏ giống.
- **Dữ liệu save:** `cafe.supplies` thêm `matcha`, `milk-meiji`, `milk-dalat`, `water-lavie` (sữa cũ `milk` chuyển thành Dalat Milk); `cafe.gear.chasen`; `cafe.prefs = { milk, water }`. Không cần chuyển save (game vừa chơi lại từ đầu sau đổi tên).
- **Asset:** chổi tre, bát/ly matcha, lớp màu xanh matcha trong ly, hộp sữa 2 nhãn, chai Lavie. Có thể dùng khối tạm trước.
- **Ước lượng công:** 3 món mới + chuỗi Anh/Việt ~1 ngày; sữa/nước trong Kho + công thức chất lượng ~0,5 ngày; đổi tên hạt ~0,5 giờ; hạt nhập Ethiopia theo bản đồ thế giới làm riêng sau.

## Câu hỏi mở

1. **"Do"** là món gì? (Dirty đã có trong danh sách. Có phải "Cold brew", "Cà phê dừa", hay gõ nhầm?)
2. 5 món đang có ngoài danh sách (Phin Liberica, Americano, Cappuccino, Cà phê trứng, Cà phê muối): **giữ** hay **bỏ**?
3. Arabica Ethiopia là **hạt trồng ở farm** (chỉ đổi tên) hay **hạt nhập**? Bỏ Liberica không?
4. **Tên nhãn thật** (Meiji, Dalat Milk, Lavie) trong game: có lo bản quyền nhãn hiệu không? Đề xuất dùng tên gợi nhớ ("Sữa Nhật", "Sữa Đà Lạt", "Nước khoáng") nếu phát hành thương mại.
5. Matcha Latte bán **đá**, **nóng** hay cả hai (2 món)?

## Quyết định

04/11/2026 — Quang chốt (sếp hỏi "cho thêm món được không", danh sách món do Quang gửi). Câu hỏi mở chốt tạm như sau, sếp muốn khác thì báo để sửa:

1. "Do" không phải tên món (hiểu là "đó" trong câu "em đang để 1 số món đó").
2. **Giữ** 5 món cũ (Phin Liberica, Americano, Cappuccino, Cà phê trứng, Cà phê muối).
3. Chỉ **đổi tên hiển thị**: Robusta → **Robusta Việt Nam**, Arabica → **Arabica Ethiopia**; giữ Liberica. Hạt nhập theo bản đồ thế giới làm sau.
4. Dùng **đúng tên nhãn** Meiji, Dalat Milk, Lavie theo yêu cầu. Rủi ro nhãn hiệu khi phát hành thương mại: cần xem lại trước khi phát hành.
5. Matcha Latte bán **đá** (1 món).

Thêm theo yêu cầu cùng ngày: nút **🤖 Auto pha** ở bàn pha (trả 2 xu, xem máy làm từng bước, ly tối đa ★★) và giao diện bàn pha mobile first.
