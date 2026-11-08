# Gọn đất và gọn giao diện nông trại — kiểm tra & đề xuất (2026-11-08)

> **Founder chốt 2026-11-08: làm phương án A + toàn bộ phần giao diện. Đã code, chưa commit.** Đổi 2 luật Farm World 2.0: "mua đất theo lô" và "nâng cấp chỉ qua ▲".

## 1. Đất: hiện trạng (`src/core/config/layout.js`)

| | Số lượng |
|---|---|
| Lô đất nông trại | **34** (2 lô có sẵn, 32 lô phải mua) |
| Đường | 22 (mở dần theo lô) |
| Loại địa hình | 6: đồng cỏ 24 · vườn 2 · bãi chăn 4 · ao 1 · vườn cây 2 · đồi 1 |
| Tổng giá đất | 484 260 xu (lô rẻ nhất 80, đắt nhất 70 000) |
| Mỗi lô trồng được | 6 luống (lô 10 × 6 m) |

Vấn đề:
1. **Quá nhiều lần mua.** Muốn trồng thêm 6 luống là phải mua thêm 1 lô, nên đất thành một chuỗi 32 lần bấm "Khai hoang".
2. **10 lô không trồng được cà phê:** bãi chăn ("để dành nuôi con", chưa có con nào), ao, đồi, vườn cây. Người chơi phải đọc thẻ lô mới biết lô đó dùng làm gì.
3. **Bản đồ rối:** biển "+" và biển giá nổi khắp nơi; đường mở từng đoạn; đất hoang xen kẽ đất của mình.
4. **Vùng khí hậu bị chia nhỏ theo lô** (đồng bằng / trung du / cao nguyên / ven ao). Đây lại chính là thứ đáng giữ, vì nó quyết định nên trồng giống nào.

## 2. Đất: đề xuất

**A. (Khuyến nghị) 4 khu theo độ cao, mỗi khu mua 1 lần.**

| Khu | Gộp các lô | Mở | Giá đề xuất | Trồng được |
|---|---|---|---|---|
| 🏡 Nhà & đồng bằng (có sẵn) | F1, F2, F5, F6, Y0, W1, D1… | Lv1 | 0 | ~18 luống + chỗ xây xưởng |
| ⛰️ Trung du (đất đỏ bazan) | F3, F4, F7–F12, F15, F16 | Lv3 | ~1 500 | ~36 luống |
| 🏔️ Cao nguyên (sương, bậc thang) | F13, F14, F17, F18, W2–W5 | Lv6 | ~8 000 | ~36 luống, Arabica +1★ |
| 💧 Ven suối | PD1, O1, O2 | Lv8 | ~20 000 | Liberica +1★, nước cho trạm sơ chế ướt |

- Trong khu đã mua: **đặt luống tự do** (hệ ô trồng đặt được đã có), giá luống tăng dần như hiện nay. Mở rộng nhờ trồng thêm luống, không nhờ mua đất.
- Bãi chăn, đồi, vườn cây: thành **cảnh nền** (rừng, đồi chè cà phê) hoặc nằm trong khu, không bán riêng.
- Đường: mỗi khu mở cả tuyến một lần, không còn từng đoạn.
- Bản đồ chỉ còn **1 biển** "Mở khu tiếp theo" thay cho hàng chục dấu "+".
- **Save cũ:** đã sở hữu bất kỳ lô nào trong một khu thì coi như có cả khu. Luống và cây giữ nguyên chỗ. Tiền đã bỏ ra không hoàn (khu thường rẻ hơn tổng các lô).

**B. Giữ lô nhưng gộp còn ~8 lô lớn**, ẩn các lô không trồng được. Ít đụng code hơn, nhưng vẫn phải mua nhiều lần.

**C. Bỏ mua đất.** Đất mở theo cấp, xu chỉ dùng cho luống, cây và xưởng. Gọn nhất, nhưng mất một đích tiêu xu lớn, nên kinh tế phải cân lại.

## 3. Menu & nâng cấp: hiện trạng (kiểm tra trên màn hình 375 × 812)

Trên màn có cùng lúc:
- **Mỗi công trình** gắn nhãn "Lv N", mũi tên ▲ xanh (nâng cấp) và nút ▶ xanh dương (chạy mẻ), kèm thanh tiến độ khi đang chạy. 3–4 công trình là đã 9–12 thứ nổi trên đầu.
- Các biển "+" của lô bán.
- **Cột phải 6 nút:** Sổ, Round, Vay, Auto, ống nghiệm, bánh răng. Bên trái là minimap và pill "Lv10: an incident".
- **Thanh dưới:** Seeds, Build, Staff, Progress và nút tròn Storehouse / Bán hạt.
- Bảng Xây có tab **chỉ có icon** (🌱 🏭 📦 💧 🌼 🏷️), phải đoán.
- Nâng cấp chỉ bằng ▲, không có chỗ xem "còn gì nâng được". Hiệu ứng của cấp tiếp theo không hiện trước khi bấm.
- Thẻ Kho chiếm nửa màn hình, che ruộng.

## 4. Menu & nâng cấp: đề xuất

1. **Một thẻ công trình duy nhất.** Chạm vào xưởng thì mở thẻ dưới đáy (cao ~40% màn hình), gồm:
   - Trạng thái (đang chạy / xong / thiếu hạt).
   - **Nút chính** lớn: Bắt đầu mẻ, hoặc Thu hàng.
   - Dòng **Nâng cấp**: Lv 2 → 3 · "+25% tốc độ" · 🪙 500 · [Nâng cấp].
   - Di chuyển · Dỡ bỏ (thu nhỏ trong "⋯").
2. **Trên đầu công trình chỉ hiện 1 biểu tượng trạng thái, khi cần:** ✅ xong (chạm để thu), ⏳ vòng tiến độ, ⚠️ thiếu hàng. Bỏ nhãn "Lv N", ▲ và ▶ nổi.
3. **Nút "Nâng cấp" trên HUD kèm số đếm**, ví dụ "⬆ 3". Bấm vào ra danh sách những gì đang đủ tiền nâng, có hiệu ứng ghi rõ.
4. **Cột phải gọn còn 3 nút:** Hộp thư/Sổ, Auto, "⋯" (Vay, Round, Phòng thí nghiệm, Cài đặt).
5. **Bảng Xây:** tab có chữ (Trồng · Chế biến · Kho · Hạ tầng · Trang trí). Thẻ khoá ghi "Mở ở Lv N"; thẻ hết lượt ghi "2/2".
6. **Thẻ Kho gọn:** 1 dòng mỗi loại hàng, nút "Bán hết" cố định, cao tối đa 40% màn hình.

## 5. Cần chốt
1. Đất theo **A / B / C**?
2. Đồng ý bỏ luật "nâng cấp chỉ qua ▲" và chuyển sang **thẻ công trình + nút Nâng cấp (số đếm)**?
3. Giá và cấp mở của 4 khu trong bảng mục 2 có dùng làm mặc định không? Có thể chạy sim sau khi code.

## 6. Đã làm (2026-11-08)

**Đất** (`layout.js` `ESTATES`, `derive.js`, `game.js`, `state.js`):
- 4 khu. Mua một lô bất kỳ (`land/buyParcel`) = mua cả khu của nó, theo thứ tự, có cấp mở và giá của khu. Quản lý (GM), tự chơi và sim vẫn gửi mã lô nên không phải sửa.
- **Khai hoang dần thay cho mua lô:** mỗi khu mua xong có ngay 1 hàng 6 luống; mỗi lần lên cấp thêm 1 hàng (ưu tiên khu mới nhất), đặt đúng các vị trí luống chuẩn, chừa chỗ có nhà (`autoTill`, `region.tilled`). Luống miễn phí = số hàng đã khai hoang × 6; luống thêm vẫn tính giá như cũ.
- Save cũ: có một lô thuộc khu nào thì được cả khu (`withEstates`). Khu nhà luôn có. Không ai mất luống hay cây.
- Bản đồ: mỗi khu chỉ 1 biển "{icon} {tên} · 🪙 giá" và 1 dấu "+"; đất ngoài khu kế tiếp là rừng hoang.
- Không bán lẻ lô thuộc khu (`landSellError` → `estate`).
- Hướng dẫn tân thủ: bước "mua ruộng F2" thành "đặt thêm luống" (tự xong khi lên cấp được khai hoang hàng mới).

**Giao diện:**
- Trên đầu công trình: bỏ nhãn "Lv N", ▲ và ▶. Chỉ còn dấu cần thao tác (thu hàng ✅, việc ở quán); ▲ chỉ hiện khi hướng dẫn chỉ vào.
- Thẻ công trình luôn có nút "Nâng lên Lv N" cùng giá, và dòng hiệu ứng "hiện tại → cấp sau".
- HUD: nút ⬆ có số đếm những gì đủ tiền nâng (bảng Nâng cấp, nâng ngay tại đó); nút ⋯ gom Nhật ký, Vòng, Vay (có chấm đỏ khi nợ quá hạn). Cột phải còn ⋯ · ⚙️ · ⬆ · Auto.
- Bảng Xây: tab luôn có chữ; tab Đất là danh sách 4 khu (Đã có / Mở khu + giá / 🔒 Sau … / 🔒 Lv N).
- Thẻ công trình và thẻ kho cao tối đa ~42% màn hình dọc.

**Sim** (`node scripts/economy-sim.mjs 45 farm 1 tapper`): Lv10 lần đầu ở **13:12** (trước khi đổi: 24:47 khi chưa có khai hoang dần; bản cũ mua lô: ~16–17 phút). Nằm trong khung đã duyệt 10–35 phút.
Sim không mua khu nào (script `economy-sim.mjs` còn kiểm tra theo giá lô cũ); quản lý trong game đã dùng giá khu (`parcelCost`).

**Kiểm trên khung 375×812:** bảng ⬆, menu ⋯, thẻ kho, tab Đất, mua khu Trung du (trừ 1 500 xu, có hàng luống mới).
