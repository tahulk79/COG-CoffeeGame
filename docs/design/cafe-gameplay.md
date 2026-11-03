# Màn 4 – Quán cà phê

Mục tiêu: người chơi vận hành một quán thật và **học công thức pha cà phê thật** (tỉ lệ, độ xay, nhiệt độ, dụng cụ, giấy lọc) qua thao tác tay, không phải đọc bảng.

## Vòng chơi chính

1. **Mở cửa** → khách 3D đi vào, xếp hàng theo dây chắn tới quầy thu ngân (tối đa 6 người; dài hơn thì khách mới quay đi, uy tín −1).
2. **Nhận order** ở quầy thu ngân → khách gọi một món đã mở, tự tới ghế trống (ưu tiên bàn trống). Hết ghế → khách đứng chờ **mang đi** cạnh quầy.
3. **Pha chế** ở quầy pha: modal "Quầy pha chế" giữa màn hình, khóa di chuyển.
   - Thẻ công thức bên trái: tỉ lệ, dụng cụ, độ xay, nhiệt độ, thời gian, các bước.
   - Mỗi bước là một thao tác: chọn hạt (Robusta/Arabica), chọn độ xay, chọn kỹ thuật (nén, gài phin, tráng giấy lọc, độ dày bọt…), hoặc **giữ để rót/đánh** tới vạch chuẩn (g, ml, °C, phút). Rót quá thì không rút lại được.
   - Sai thì hiện lý do thật (vd. "Quá mịn: chiết quá → đắng gắt").
   - Kết quả: ★ tay nghề, chất lượng ly, danh sách lỗi cần sửa, câu chuyện món.
4. **Bưng ra**: nhân vật cầm ly, bấm đúng bàn (hoặc quầy thu ngân với khách mang đi). Ly khớp theo món nên ly của khách đã bỏ về vẫn giao được cho khách khác gọi cùng món.
5. **Thanh toán**: giá theo chất lượng + tip theo ★, độ nhanh, combo liên tiếp ≥2★, chế độ pha theo trí nhớ.

Khách có thanh kiên nhẫn trên đầu (xếp hàng 55 s, ngồi 80 s, mang đi 50 s). Hết kiên nhẫn → bỏ về, uy tín −2, mất combo. Uy tín quyết định hạng sao quán, tốc độ khách tới và mở món.

## Công thức (dữ liệu thật trong `src/features/cafe/recipes.js`)

| Món | Mở khi | Điểm học chính |
|---|---|---|
| Phin đen | Có sẵn | 20 g bột xay vừa thô, ủ 20 ml nước 92–96 °C, nhỏ giọt 4–5 phút |
| Cà phê sữa đá | Có sẵn | Sữa đặc vào ly trước, khuấy tan khi còn nóng |
| Bạc xỉu | Uy tín 55 | Sữa nhiều hơn cà phê, rót cà phê sau cùng |
| Espresso | Máy espresso | 18 g bột mịn, nén phẳng, chiết 1:2 (~36 g) trong 25–30 s |
| Americano | Máy espresso | Espresso + 100–140 ml nước nóng |
| Cappuccino | + vòi đánh sữa | Sữa 60–65 °C, bọt dày 1–1,5 cm (1/3·1/3·1/3) |
| Latte | + vòi đánh sữa | ~200 ml sữa, bọt mỏng 0,5 cm |
| Cà phê trứng | Máy đánh trứng, uy tín 60 | Chỉ lòng đỏ, đánh bông 3–5 phút, giữ nóng |
| Cà phê muối | Máy đánh trứng, uy tín 65 | Kem + ~0,5 g muối phủ trên cà phê đá |
| Pour-over V60 | Bộ V60 | 1:16, tráng giấy lọc, bloom gấp 2 lần bột, 2:30–3:00 |

Thành thạo: 2★ (≥70) để barista tự pha món đó; 3★ (≥90) mở **pha theo trí nhớ** (ẩn thẻ và vạch chuẩn, +20% tip) – vòng lặp giữ chân người chơi.

## Nguyên liệu và liên kết nông trại

- **Hạt rang** dùng chung kho quán của model farm. Kho quán → "Đặt farm 252 g" tạo đơn trên bảng Đơn hàng của nông trại; farm/nhân viên rang và giao như đơn hiện có. Gấp thì "Nhập hạt ngoài" (đắt).
- **Vật tư** (ly, sữa đặc, sữa tươi, đá, trứng, kem, muối, giấy lọc) nhập theo gói thật (lon 380 g, hộp 1 L, túi đá 2 kg, hộp 40 tờ giấy lọc…).
- Thiếu nguyên liệu khi pha → màn liệt kê thứ thiếu kèm nút mở kho.

## Nâng cấp và nhân viên

- **Bàn ghế** (nâng cấp "cafe" của farm): 3 → 6 bàn, mỗi bàn 2 ghế; bàn khóa hiện ghế xếp chồng.
- **Thiết bị**: phin, máy xay (cộng chất lượng), máy espresso, vòi đánh sữa, máy đánh trứng/kem, bộ V60 (mở món).
- **Nhân viên quán** (lương/ngày game, chỉ trả khi quán mở): Thu ngân tự nhận order; Phục vụ tự bưng ly trên kệ ra bàn; Barista tự pha món đã 2★ với 75 điểm.

## Bố cục 3D (map 32 × 24) – quầy chia ô cố định

- **Dãy quầy sau** (z = −10.6), mỗi thiết bị một ô cố định nên nâng cấp chỉ là lắp vào ô trống (ô chưa mua hiện khung viền + biển "Ô trống"):
  quầy pha 8 m với 3 trạm pha (trạm 2–3 mở bằng nâng cấp) + máy espresso tự động + kệ giao ly (pass) ở đầu phải ·
  2 quầy thu ngân (quầy 2 là nâng cấp) · quầy nhận đồ + màn hình gọi số · tủ bánh.
- **Lối nhân viên** phía sau quầy (z ≈ −12.15), vào từ hai đầu và khe giữa quầy pha – thu ngân. Người chơi cũng đứng sau quầy khi pha/thu ngân.
- **Hàng chờ** dọc dây chắn x = 1.2 tới quầy thu ngân; **2 kiosk** tự order ở giữa sảnh; khách mang đi chờ trước quầy nhận đồ.
- **10 bàn** 3 hàng ở nửa trái sảnh; góc sofa, WC, quầy tự phục vụ, bảng thực đơn chữ A ở lối vào (bấm để mở Sổ công thức).
- **Tìm đường**: khách và nhân viên dùng chung lưới `findRoute` với người chơi (né quầy, bàn, ghế, cột dây), nên thêm/dời đồ không phải sửa đường đi. Ghế là vật cản nên NPC đi tới điểm ngay ngoài ghế rồi bước vào.

## Đội nhân viên (tối đa 10) và bảng việc

- 14 ứng viên có tên, tiểu sử, 4 chỉ số; giới hạn theo vai: 2 thu ngân, 3 barista, 3 phục vụ, 1 tạp vụ, 1 quản lý ca.
- **Bảng việc chung**: mỗi người rảnh tự nhận việc đúng vai, ưu tiên khách sắp hết kiên nhẫn; mỗi việc được giữ chỗ để không ai làm trùng.
  - Thu ngân: đứng sau quầy của mình, nhận order khách ở đầu quầy đó.
  - Barista: cần trạm pha trống; chỉ pha món người chơi đã luyện đủ điểm (Trí nhớ quyết định ngưỡng). Chưa thạo thì hiện ❓ và gợi ý món cần dạy.
  - Phục vụ: lấy ly ở pass bưng tới khách gấp nhất; rảnh thì dọn bàn. Tạp vụ: ưu tiên dọn bàn.
  - Quản lý ca: cả đội nhanh hơn ~10–20%, tự nhập nguyên liệu sắp hết.
- Bong bóng trên đầu nhân viên: icon việc + thanh tiến độ xanh dương; 💤 khi hết ca chưa trả lương.

## Tự động hoá (Nâng cấp › Tự động)

Trạm pha thêm (2 cấp), Quầy thu ngân 2, Kiosk tự order (2 máy, khách tự gọi 4 giây), Quầy nhận đồ + màn hình gọi số (ly mang đi tự gọi khách tới lấy), Máy espresso tự động (Espresso/Americano 70 điểm, 10 giây).

## Thời gian và ca làm việc

- Mỗi lần mở cửa là một **ca 4 phút**: mục tiêu số ly (6 + 2 × hạng sao), **món của ca** được gọi gấp 3 lần và bán +30%.
- Thẻ trạng thái có đồng hồ ca + thanh thời gian; dải phiếu order trên cùng hiện số giây còn lại và đổi màu; quầy pha hiện huy hiệu đếm ngược cho từng ly đang pha.
- Hết ca: báo cáo (số ly, sao trung bình, doanh thu, khách bỏ về), đạt mục tiêu thưởng tối đa 150 xu + uy tín +3, nút "Mở ca mới".

## Chưa làm (để sau)

Cold brew ủ trước theo mẻ, khách quen có món yêu thích, latte art, NPC né nhau khi đi ngược chiều, ly hỏng do sai nhiều bước, sữa/trứng sản xuất từ nông trại.

## Bàn pha và chọn vật (cập nhật)

Bàn pha là một cột giữa: tên món + bước, viên thuốc các bước, chip thông số (tỉ lệ, độ xay, nhiệt độ, thời gian), sân khấu 3 cột trên mặt quầy (dụng cụ SVG | phin/tay cầm/phễu + ly + cân | nhiệt kế hoặc đồng hồ giây chiết), nút giữ/xong và mẹo. Hình dụng cụ là SVG trong `src/features/cafe/art.js`.

Bấm vật nào trong quán thì dưới chân vật đó hiện khung phát sáng nhấp nháy theo đúng kích thước (quầy, bàn + ghế, kiosk…); bấm nhân viên thì vòng sáng đi theo người đó.

## Debug bố cục dạng lưới ô

Mở game với `?debug=grid` rồi vào quán: ô xanh là đi được, ô đỏ là bị chặn; cột màu đánh dấu điểm đứng (xanh dương: khách, tím: điểm vào ghế, cam: nhân viên, trắng: điểm người chơi tới vật, đỏ: lỗi); đường vàng là các tuyến đã kiểm tra, đường đỏ là tuyến không đi được.
- Phím **G**: vẽ lại theo trạng thái hiện tại. Phím **H**: kiểm tra trường hợp xấu nhất (10 bàn cấp sofa, đủ mọi thiết bị).
- Kết quả in ra console (`console.table`) và `window.__cafeLayoutAudit`; `__cafeBlockersAt(x, z)` liệt kê vật đang chặn tại một điểm.
- Khi thêm đồ hoặc nâng cấp mới: thêm điểm/tuyến vào `layoutPoints()` / `LAYOUT_ROUTES` trong `service.js`, chạy H, phải ra 0 lỗi.
