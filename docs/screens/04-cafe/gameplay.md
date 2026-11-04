# Màn 4 – Quán cà phê

Mục tiêu: người chơi vận hành một quán thật và **học công thức pha cà phê thật** (tỉ lệ, độ xay, nhiệt độ, dụng cụ, giấy lọc) qua thao tác tay, không phải đọc bảng.

## Vòng chơi chính

1. **Mở cửa** → khách 3D đi vào, xếp hàng theo dây chắn tới quầy thu ngân (tối đa 6 người; dài hơn thì khách mới quay đi, uy tín −1).
2. **Nhận order** ở quầy thu ngân (đứng tại quầy là **tự nhận** order khách đầu hàng mỗi 0,5 s và tự giao ly mang đi đúng món, không phải bấm lại; tới quầy nhân vật tự quay mặt ra phía khách) → khách gọi một món đã mở, tự tới ghế trống (ưu tiên bàn trống). Hết ghế → khách đứng chờ **mang đi** cạnh quầy.
3. **Pha chế** ở quầy pha: modal "Quầy pha chế" giữa màn hình, khóa di chuyển.
   - Thẻ công thức bên trái: tỉ lệ, dụng cụ, độ xay, nhiệt độ, thời gian, các bước.
   - Mỗi bước là một thao tác: chọn hạt (Robusta/Arabica), chọn độ xay, chọn kỹ thuật (nén, gài phin, tráng giấy lọc, độ dày bọt…), hoặc **giữ để rót/đánh** tới vạch chuẩn (g, ml, °C, phút). Rót quá thì không rút lại được.
   - Sai thì hiện lý do thật (vd. "Quá mịn: chiết quá → đắng gắt").
   - Kết quả: ★ tay nghề, chất lượng ly, danh sách lỗi cần sửa, câu chuyện món.
4. **Bưng ra**: nhân vật cầm ly, bấm đúng bàn (hoặc quầy thu ngân với khách mang đi). Ly khớp theo món nên ly của khách đã bỏ về vẫn giao được cho khách khác gọi cùng món.
5. **Thanh toán**: giá theo chất lượng + tip theo ★, độ nhanh, combo liên tiếp ≥2★, chế độ pha theo trí nhớ.

### Lần đầu vào quán (chốt và triển khai 03/11/2026 — spec [onboarding-flow](../../shared/onboarding-flow.md) mục 3.5, 3.7)

- Nhiệm vụ farm **"Bán ly cà phê đầu tiên" lên vị trí 2** (ngay sau Hái), vì quán đã có sẵn lô `starter` bên dưới; ly đầu bán được trong khoảng 2 phút sau khi vào farm. Nút ☕ Vào quán hiện từ khi xong nhiệm vụ Hái.
- **Thẻ mục tiêu sẵn có của quán** (`.cafe-quest`) dẫn 4 bước, mỗi bước có mũi chỉ 3D trên điểm tương tác và tự qua khi làm đúng: (1) Bấm «Mở cửa» để đón khách; (2) **Đứng ở quầy thu ngân: bạn tự nhận order của khách đầu hàng**; (3) Tới quầy pha để pha món khách gọi; (4) Cầm ly, bấm đúng bàn của khách (mang đi: bấm quầy thu ngân). Rời quán giữa chừng thì lần sau tiếp từ bước dở (tính từ quán mở chưa, có order chưa, `stats.served`). Cờ `cafe-intro` trong `farm.tutorial` ([contracts](../../shared/contracts.md) mục 5); save đã có `stats.served > 0` coi như đã xem. Gợi ý thiếu hạt (dưới 10 g) vẫn đứng trước.
- **Lần đầu mở quầy pha** (cờ `bench-intro`): một dòng nền vàng đầu modal: "Mỗi bước: chọn đúng, hoặc giữ nút để rót tới vạch xanh rồi thả. Sai sẽ được giải thích. 💡 Gợi ý giúp nhưng bước đó tối đa 80% điểm." Tắt khi xong bước đầu của ly đầu; save có `cafe.mastery` coi như đã xem.
- Mẹo thiên đàng ở quán: `recipe` → Phin đen nóng và Cà phê sữa đá bắt đầu ★ (điểm luyện 40); `adjust` → màn kết quả ly ghi "Sửa bước này trước" cho bước thấp điểm nhất; `customer` → uy tín +3 một lần. Câu chưa thuộc được hỏi lại ở báo cáo cuối ca hoặc màn kết quả ly (ly dưới 70 điểm), tối đa 1 câu mỗi ngày công.

Save mới tặng quán **600 g hạt vối rang** (`model.js`, lô `starter`, khoảng 30 ly) để ca đầu chơi được ngay. Khi kho quán dưới 10 g, gợi ý đầu quán đổi thành "Quán chưa có hạt rang · Về farm gửi hạt (Đơn farm) hoặc Kho → Nhập hạt ngoài" trước mọi gợi ý khác; nhiệm vụ farm "Gửi hạt rang về quán" và "Bán ly cà phê đầu tiên" dẫn người chơi qua liên kết này.

Khách có thanh kiên nhẫn trên đầu (xếp hàng 55 s, ngồi 80 s, mang đi 50 s). Hết kiên nhẫn → bỏ về, uy tín −2, mất combo. Uy tín quyết định hạng sao quán, tốc độ khách tới và mở món. Khoảng cách giữa hai khách = `clamp(9 + 9 nếu chưa có máy espresso tự động và chưa có barista đang làm pha được ít nhất một món trên menu − (uy tín − 50) × 0,06 − số bàn × 0,6 − số kiosk, 3, 24)` giây × ngẫu nhiên 0,75–1,25 (uy tín 50, 3 bàn: tự pha ≈ 16 s, khoảng 3–4 khách/phút vì một ly phin tự pha mất 25–30 s; có barista ≈ 7 s, khoảng 8 khách/phút). Rời quán về farm: quán tạm dừng (khách, ly đang pha, ca bán, lương nhân viên đứng yên), vào lại chơi tiếp đúng chỗ cũ, không mất uy tín.

## Công thức (dữ liệu thật trong `src/features/cafe/recipes.js`)

| Món | Mở khi | Điểm học chính |
|---|---|---|
| Phin đen | Có sẵn | 20 g bột xay vừa thô, ủ 20 ml nước 92–96 °C, nhỏ giọt 4–5 phút |
| Cà phê sữa đá | Có sẵn | Sữa đặc vào ly trước, khuấy tan khi còn nóng |
| Bạc xỉu | Uy tín 55 | Sữa nhiều hơn cà phê, rót cà phê sau cùng |
| Phin cà phê mít | Uy tín 55 | Hạt mít (Liberica/Excelsa) pha phin 20 g, ít đắng, hương trái cây; đầu ra ở quán cho cây mít |
| Espresso | Máy espresso | 18 g bột mịn, nén phẳng, chiết 1:2 (~36 g) trong 25–30 s |
| Americano | Máy espresso | Espresso + 100–140 ml nước nóng |
| Cappuccino | + vòi đánh sữa | Sữa 60–65 °C, bọt dày 1–1,5 cm (1/3·1/3·1/3) |
| Latte | + vòi đánh sữa | ~200 ml sữa, bọt mỏng 0,5 cm |
| Cà phê trứng | Máy đánh trứng, uy tín 60 | Chỉ lòng đỏ, đánh bông 3–5 phút, giữ nóng |
| Cà phê muối | Máy đánh trứng, uy tín 65 | Kem + ~0,5 g muối phủ trên cà phê đá |
| Pour-over V60 | Bộ V60 | 1:16, tráng giấy lọc, bloom gấp 2 lần bột, 2:30–3:00 |

Thành thạo (điểm ly lấy phần nguyên, 89,6 vẫn là ★★): barista tự pha món có điểm luyện tốt nhất ≥ `90 − Trí nhớ × 0,4` của người đó (Trí nhớ 50 → 70 điểm); 3★ (≥90) mở **pha theo trí nhớ** (ẩn thẻ và vạch chuẩn, +20% tip) – vòng lặp giữ chân người chơi.

## Nguyên liệu và liên kết nông trại

- **Nơi chỉ quán (F-28, Ý):** game tự vào quán khi tải, không có nút/Esc về nông trại, không có ô Đơn hàng; Kho quán bỏ "Đặt farm", hạt chỉ từ lô `starter` và "Nhập hạt ngoài". Xem [02b-world-map](../02b-world-map/README.md).
- **Hạt rang** dùng chung kho quán của model farm. Kho quán → "Đặt farm 252 g" tạo đơn trên bảng Đơn hàng của nông trại; farm/nhân viên rang và giao như đơn hiện có. Gấp thì "Nhập hạt ngoài" 500 g / 75 xu (`SUPPLIER_PRICE`, 0,15 xu/g, đắt hơn hạt farm nên quán vẫn cần farm).
- **Vật tư** (ly, sữa đặc, sữa tươi, đá, trứng, kem, muối, giấy lọc) nhập theo gói thật (lon 380 g, hộp 1 L, túi đá 2 kg, hộp 40 tờ giấy lọc…).
- Thiếu nguyên liệu khi pha → màn liệt kê thứ thiếu kèm nút mở kho.

## Nâng cấp và nhân viên

- **Bàn ghế** (nâng cấp "cafe" của farm, cấp 1–10): 3 → 10 bàn theo `min(10, 3 + round((cấp − 1) × 7/9))`; mỗi bàn nâng riêng 2 → 4 ghế, ghế đệm, sofa (`TABLE_LEVELS`); bàn khóa hiện ghế xếp chồng.
- **Thiết bị**: phin, máy xay (cộng chất lượng), máy espresso, vòi đánh sữa, máy đánh trứng/kem, bộ V60 (mở món).
- **Nhân viên quán** (lương mỗi **ca 4 phút** = một lần mở cửa, `CAFE_SHIFT_MS`; chỉ trả khi quán mở; thời gian đã trả **chỉ trôi khi quán đang mở**, đóng cửa hoặc vắng mặt thì tạm dừng; thẻ nhân viên hiện "⏸ Đã trả ca" khi quán đóng): Thu ngân tự nhận order; Phục vụ tự bưng ly trên kệ ra bàn; Barista tự pha món đã đạt ngưỡng Trí nhớ của mình (xem Thành thạo).

## Bố cục 3D (map 32 × 24) – quầy chia ô cố định

- **Dãy quầy sau** (z = −10.6), mỗi thiết bị một ô cố định nên nâng cấp chỉ là lắp vào ô trống (ô chưa mua hiện khung viền + biển "Ô trống"):
  quầy pha 8 m với 3 trạm pha (trạm 2–3 mở bằng nâng cấp) + máy espresso tự động + kệ giao ly (pass) ở đầu phải ·
  2 quầy thu ngân (quầy 2 là nâng cấp) · quầy nhận đồ + màn hình gọi số · tủ bánh.
- **Lối nhân viên** phía sau quầy (z ≈ −12.15), vào từ hai đầu và khe giữa quầy pha – thu ngân. Người chơi cũng đứng sau quầy khi pha/thu ngân.
- **Hàng chờ** dọc dây chắn x = 1.2 tới quầy thu ngân; **2 kiosk** tự order ở giữa sảnh; khách mang đi chờ trước quầy nhận đồ.
- **10 bàn** 3 hàng ở nửa trái sảnh; góc sofa, WC, quầy tự phục vụ, bảng thực đơn chữ A ở lối vào (bấm để mở Sổ công thức).
- **Tìm đường**: khách và nhân viên dùng chung lưới `findRoute` với người chơi (né quầy, bàn, ghế, cột dây), nên thêm/dời đồ không phải sửa đường đi. Ghế là vật cản nên NPC đi tới điểm ngay ngoài ghế rồi bước vào.

## Đội nhân viên (3 slot) và bảng việc

- **04/11/2026 (spec [crew-autoplay](../../shared/crew-autoplay.md)):** đội **tối đa 3 người** (giới hạn vai giữ nguyên bên trong). Thuê được **Robot pha 01** (chỉ Phin đen, 50 điểm = ★, 4 xu/ca). Sao: robot ★, nhân viên tối đa ★★ (mệt −12 điểm), chỉ bạn đạt ★★★; Robot pha espresso (máy) cũng ra ★. Người từ cấp 3 rảnh việc vai mình thì phụ bưng/dọn (đa nhiệm); robot giữ 1 việc. Người có thể nghỉ vì mệt/lười/ghét việc. Ly bạn đang pha ở bàn pha không ai pha trùng; bạn chỉ nhận order chưa có thu ngân giữ. Chế độ Auto: spec mục 5. Các dòng "tối đa 10", "không có robot barista thuê được" bên dưới đã được thay bằng luật này.

- 14 ứng viên có tên, tiểu sử, 4 chỉ số; giới hạn theo vai: 2 thu ngân, 3 barista, 3 phục vụ, 1 tạp vụ, 1 quản lý ca.
- **Bảng việc chung**: mỗi người rảnh tự nhận việc đúng vai, ưu tiên khách sắp hết kiên nhẫn; mỗi việc được giữ chỗ để không ai làm trùng.
  - Thu ngân: đứng sau quầy của mình, nhận order khách ở đầu quầy đó.
  - Barista: cần trạm pha trống; chỉ pha món người chơi đã luyện đủ điểm (Trí nhớ quyết định ngưỡng). Chưa thạo thì hiện ❓ và gợi ý món cần dạy.
  - Phục vụ: lấy ly ở pass bưng tới khách gấp nhất; rảnh thì dọn bàn. Tạp vụ: ưu tiên dọn bàn.
  - Quản lý ca: cả đội nhanh hơn ~10–20%, tự nhập nguyên liệu sắp hết.
- Bong bóng trên đầu nhân viên: icon việc + thanh tiến độ xanh dương; 💤 khi hết ca chưa trả lương.

### Robot và sự cố (chốt 03/11/2026, đã triển khai, chưa playtest — spec [robot-staff](../../shared/robot-staff.md))

- Modal thuê có 3 tab: **Đội (n/10) · Người · Robot** (tab Robot hiện 🔒 khi nút Nhân viên ở farm chưa mở). Robot thuê được khi nút Nhân viên ở farm đã mở: **Robot bưng** (vai phục vụ, tối đa theo giới hạn 3 phục vụ) và **Robot dọn** (vai tạp vụ). Thuê **theo ca như người**, lương **3 xu/ca** cố định, **không có gói trả trước** (gói chỉ có ở Robot vườn farm). Không đào tạo, không sự cố, đi 2,4 m/s (người phục vụ cấp 1: 2,81–3,14 m/s), **bưng 1 ly/chuyến**, không tăng tip. Robot dọn tay chậm hơn tạp vụ người (3,2 s/bàn so với ~2,5–2,7 s). Quản lý ca đang làm cũng tăng tốc robot. Cho robot nghỉ rồi thuê lại được. Robot tính vào giới hạn vai và tối đa 10 người.
- **Người phục vụ bưng tối đa 2 ly/chuyến** (ly thứ hai khi có khách khác chờ đúng món), tip theo Giao tiếp như cũ.
- Không có robot thu ngân/barista/quản lý thuê được (thu ngân tự động = kiosk, pha tự động = máy espresso, xem dưới). Bạn vẫn là người pha chính; barista người tự pha món bạn đã luyện.
- Người có thể gặp tối đa **1 sự cố/ca**: **Mải chơi 📱** ~12% (đứng tối đa 40 s, chạm + «Nhắc»); **Nghỉ ốm 🤒** ~4% (trống 1 ca, không mất lương; «Thuê robot thay» chỉ khi người ốm là phục vụ/tạp vụ và vai còn chỗ); **Chửi khách 😤** ~5% chỉ thu ngân/phục vụ, cả quán tối đa 1/ca, xảy ra ở lần nhận order/bưng ly (chưa có việc thì chờ, hết ca thì hủy): bong bóng báo trước 3 s, chạm kịp thì chặn, không kịp thì 1 khách bỏ về, uy tín −2, **không mất combo**. Xác suất `× max(0,4; 1 − 0,12 × (cấp − 1))`, Quản lý ca đang làm giảm ×0,5 mải chơi và chửi khách. Đủ đội có quản lý ≈ 1 sự cố/ca.
- Không sự cố: 2 ca đầu sau khi thuê, ca gói thử robot, uy tín < 30.
- **Gói thử robot (một lần, khi nút Nhân viên ở farm mở):** 1 ca robot pha (tối đa 10 ly, chỉ Phin đen nóng và Cà phê sữa đá, điểm 50 = 1★, lỗi cố định: Phin đen thể hiện qua điểm 50 và lời giải thích "nước 100 °C + xay mịn → chiết quá, đắng" (không mô phỏng thông số pha); sữa đá dùng thật gấp đôi sữa đặc 50 ml → ngọt gắt) + robot bưng (id riêng `gift-pha`, `gift-bung`; robot bưng chỉ đi kèm khi vai phục vụ còn chỗ). Thành viên gói không tính vào giới hạn 10 người và giới hạn vai, kèm 200 g hạt riêng (lô `gift`), 10 ly, 500 ml sữa đặc, 1.500 g đá (bù đủ 10 ly robot, vật tư khởi đầu không bị ăn). Báo trong toast mở khóa Nhân viên, không toast riêng. Khách nhận ly robot: 25% chê, bỏ về không trả tiền, uy tín −0,5 (trần −2; code tính trần cho cả gói — robot-staff C-1). **Ly robot không tính mục tiêu ca và không làm mất combo** của bạn. Báo cáo cuối ca so sánh ly bạn pha và ly robot, có hàng **lãi sau hạt + vật tư** (ly sữa đá robot gấp đôi sữa đặc gần như lỗ). Hết gói: cả hai robot thử rời đi, robot pha không bao giờ thuê được.

## Tự động hoá (Nâng cấp › Tự động)

Trạm pha thêm (2 cấp), Quầy thu ngân 2, **Robot thu ngân (kiosk)** (tên cũ Kiosk tự order; 2 máy, khách tự gọi 4 giây), Quầy nhận đồ + màn hình gọi số (ly mang đi tự gọi khách tới lấy), **Robot pha espresso** (tên cũ Máy espresso tự động; Espresso/Americano 70 điểm, 10 giây). Đổi tên/hình 03/11/2026, id và luật giữ nguyên.

## Thời gian và ca làm việc

- Mỗi lần mở cửa là một **ca 4 phút**: mục tiêu số ly theo sức pha: mốc Đồng = 4 + hạng sao + 6 × số tay pha (barista pha được món trên menu + robot espresso), Bạc = ⌈1,4 × Đồng⌉, Vàng = ⌈1,8 × Đồng⌉ (xem `fun-review.md` P1), **món của ca** được gọi gấp 3 lần và bán +30%.
- Thẻ trạng thái có đồng hồ ca + thanh thời gian; dải phiếu order trên cùng hiện số giây còn lại và đổi màu; quầy pha hiện huy hiệu đếm ngược cho từng ly đang pha.
- Hết ca: báo cáo (số ly, sao trung bình, doanh thu, khách bỏ về), thưởng theo mốc (cần TB ≥ 2★): Đồng 3 / Bạc 4 / Vàng 5 xu mỗi ly, tối đa 300 xu, uy tín +1/+2/+3; chưa đạt Đồng chỉ −1 uy tín khi dưới nửa mốc Đồng; nút "Mở ca mới".
- Ly chủ quán tự pha bán ×2 giá (`OWN_CUP`, P2). Khách tới chậm hơn khi ít tay pha (+max(0, 13 − 6,5 × tay pha) s); khách gấp nhất đang chờ đúng món bạn đang pha ở quầy chỉ hao kiên nhẫn ×0,25 (P3).

## Chưa làm (để sau)

Cold brew ủ trước theo mẻ, khách quen có món yêu thích, latte art, NPC né nhau khi đi ngược chiều, ly hỏng do sai nhiều bước, sữa/trứng sản xuất từ nông trại.

## Món mới, sữa và nước, Auto pha (F-31, chốt 04/11/2026, đã code, chưa chơi thử)

- **3 món mới** (`cafe/recipes.js`): **Matcha** (3,5 xu; 2 g bột rây, nước 75–80 °C, đánh chữ W; cần **Chổi tre** 50 xu), **Matcha Latte đá** (4,5 xu; uy tín 40; matcha đánh với 30 ml nước, đá, 150 ml sữa lạnh), **Dirty** (4,5 xu; uy tín 50; cần máy espresso; 150 ml sữa lạnh + shot đôi, không khuấy). Matcha không dùng hạt: phần "nguyên liệu" 25% của chất lượng cố định 80, không bị trừ vì sai hạt.
- **Hạt:** đổi tên hiển thị Robusta → **Robusta Việt Nam**, Arabica → **Arabica Ethiopia** (id giữ `robusta`/`arabica`); Liberica giữ.
- **Sữa và nước** (Kho › Vật tư › "Nguyên liệu đang dùng"): chọn 1 sữa và 1 nước cho mọi món. Sữa **Meiji** 7 xu/lít, +4 chất lượng; **Dalat Milk** 5 xu/lít, +2 (mặc định, kho đầu có 1 lít). Nước **máy** miễn phí, −3; **Lavie** 2 xu/1,5 lít, +2. Hết loại đang chọn → tự dùng loại kia (sữa) hoặc nước máy (nước), Kho báo rõ. Mọi món cà phê dùng nước (phin 90 ml, espresso/latte/cappuccino/Dirty 40 ml, americano 160 ml, pour over 280 ml, matcha 70 ml, matcha latte 30 ml). Chất lượng ly = `điểm × 0,75 + hạt × 0,25 + thiết bị + hợp hạt + sữa + nước`, kẹp 0–100.
- **🤖 Auto pha** (bước 1 của bàn pha, cạnh ⚡ Pha nhanh): trả **2 xu**, máy tự làm từng bước để bạn xem: sáng viền + giải thích đáp án đúng rồi bấm, rót tới giữa vạch xanh rồi chốt. Mỗi bước tính như dùng "Làm mẫu" (tối đa 0,8) → ly **80 điểm = ★★**, không đạt ★★★. Trong lúc Auto pha, nút điều khiển chỉ để xem. Chế độ Auto toàn game vẫn dùng ⚡ Pha nhanh (miễn phí).
- **Giao diện mobile first (≤ 700 px):** Pha nhanh/Auto pha xếp chồng, nút cao 46–54 px; sân khấu thấp còn 170 px; đáp án 1 cột, cao 52 px; nút giữ rót rộng hết, cao 60 px; cụm điều khiển dính đáy bảng; dải thông số cuộn ngang.

## Pha nhanh và ly để lâu (chốt 04/11/2026, đã code, chưa chơi thử)

- **⚡ Pha nhanh** (nút lớn ở bước 1 của bàn pha, mobile first): một chạm, chờ **6 giây**, ra ly. Điểm = điểm cao nhất bạn **tự pha** món đó, kẹp trong **70–90**: món mới ★★ ngay, muốn ★★★ phải tự pha đạt 90 một lần. Pha nhanh không nâng điểm thành thạo. Ly vẫn là ly của chủ (×2 giá). Chế độ Auto luôn dùng Pha nhanh. Code: `QUICK_MS`, `quickScore` (`cafe/recipes.js`).
- **Rót dễ hơn khi tự pha:** kim chạy từ rỗng tới đầy trong 3,2 s (trước 2,4 s); thả tay khi kim trong vạch xanh là tự chốt bước (không cần bấm «Xong»); rót lệch vẫn được điểm một phần rộng hơn (`1 − lệch / (độ rộng vạch × 2,5)`, trước × 1,5).
- **Ly có hạn tươi** (tính theo thời gian quán mở): món nóng **60 s**, món có đá **90 s**. Quá hạn → ly nguội: **−1★, giá −30%**, thông báo "(ly nguội)". Quá **gấp đôi** → ly trên kệ hoặc trên tay tự bỏ, thông báo "🗑️ … đã bỏ" (ly nhân viên đang bưng không bị bỏ). Khách bỏ về thì ly trên tay vẫn đưa được cho khách khác gọi đúng món, hoặc bấm quầy pha để đặt lên kệ.
- **Hết ca dọn kệ:** mọi ly chưa ai nhận (kể cả ly trên tay) bị bỏ; báo cáo ca có dòng "Ly bỏ: n". Ly chỉ sống trong ca, không lưu khi tải lại.
- Không có giới hạn số ly trên kệ và không có nút "Bỏ ly": hạn tươi đã tự giới hạn.

## Bàn pha và chọn vật (cập nhật)

Bàn pha là một cột giữa: tên món + bước, viên thuốc các bước, chip thông số (tỉ lệ, độ xay, nhiệt độ, thời gian), sân khấu 3 cột trên mặt quầy (dụng cụ SVG | phin/tay cầm/phễu + ly + cân | nhiệt kế hoặc đồng hồ giây chiết), nút giữ/xong và mẹo. Hình dụng cụ là SVG trong `src/features/cafe/art.js`.

Bấm vật nào trong quán thì dưới chân vật đó hiện khung phát sáng nhấp nháy theo đúng kích thước (quầy, bàn + ghế, kiosk…); bấm nhân viên thì vòng sáng đi theo người đó.

## Debug bố cục dạng lưới ô

Mở game với `?debug=grid` rồi vào quán: ô xanh là đi được, ô đỏ là bị chặn; cột màu đánh dấu điểm đứng (xanh dương: khách, tím: điểm vào ghế, cam: nhân viên, trắng: điểm người chơi tới vật, đỏ: lỗi); đường vàng là các tuyến đã kiểm tra, đường đỏ là tuyến không đi được.
- Phím **G**: vẽ lại theo trạng thái hiện tại. Phím **H**: kiểm tra trường hợp xấu nhất (10 bàn cấp sofa, đủ mọi thiết bị).
- Kết quả in ra console (`console.table`) và `window.__cafeLayoutAudit`; `__cafeBlockersAt(x, z)` liệt kê vật đang chặn tại một điểm.
- Khi thêm đồ hoặc nâng cấp mới: thêm điểm/tuyến vào `layoutPoints()` / `LAYOUT_ROUTES` trong `service.js`, chạy H, phải ra 0 lỗi.
