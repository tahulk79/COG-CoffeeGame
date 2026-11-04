# Đề xuất — Giống, vòng đời cây và chuỗi chế biến/bán

Ngày 02/11/2026. Đề xuất để chốt, **chưa triển khai**. Bổ sung cho [farm-cafe-gameplay-plan](../../archive/farm/farm-cafe-gameplay-plan.md) (nguồn nghiên cứu mục 2.3) và [luật hiện hành](rules.md). Số liệu là **mô phỏng game rút gọn**, không phải hướng dẫn canh tác.

## 1. Giống cà phê dùng tên thật

Giữ 3 loài theo id hiện có (`robusta`, `arabica`, `liberica`) để không vỡ save; thêm **dòng giống** mở dần.

| Loài (id giữ nguyên) | Tên hiển thị | Dòng giống trong game | Vai trò |
|---|---|---|---|
| `robusta` | Cà phê vối (Robusta) | **TR4**, **TR9**, **TRS1** (dòng vô tính của WASI, Tây Nguyên) | Năng suất cao, chịu nóng, vị đậm; nền tảng của farm đầu |
| `arabica` | Cà phê chè (Arabica) | **Catimor** (phổ biến ở Việt Nam), **Typica**, **Bourbon** (đặc sản, vùng cao như Cầu Đất) | Năng suất thấp hơn, cần vùng mát và chăm kỹ, giá theo chất lượng |
| `liberica` | Cà phê mít (Liberica · Excelsa) | **Excelsa** | Tán lớn, chịu hạn, chu kỳ dài, hương trái cây; hàng ngách |

- Dòng giống khác nhau ở: năng suất tiềm năng, thời gian kiến thiết, tuổi thọ, khả năng chịu hạn/sâu, chất lượng nền.
- Không có giống "tốt nhất mọi mặt"; ví dụ TR4 năng suất cao, TRS1 chín sớm, Bourbon chất lượng cao nhưng năng suất thấp.
- Thông số cụ thể từng dòng cần đối chiếu catalogue World Coffee Research/WASI trước khi chốt; bảng dưới chỉ là khung.

## 2. Vòng đời cây (năm cây = vụ game)

Một **vụ = 6 phút** (đã có `SEASON_MS`), coi như một năm của cây.

| Giai đoạn | Vối | Chè | Mít | Năng suất so với đỉnh |
|---|---|---|---|---|
| Cây con · kiến thiết | 1 vụ | 1,5 vụ | 2 vụ | 0 |
| Bói quả | vụ 2 | vụ 2–3 | vụ 3 | 40% |
| Tăng năng suất | vụ 3 | vụ 4 | vụ 4–5 | 75% |
| **Kinh doanh (đỉnh)** | vụ 4–15 | vụ 5–12 | vụ 6–20 | 100% |
| Suy giảm | vụ 16–20 | vụ 13–16 | vụ 21–26 | giảm 6%/vụ |
| **Già cỗi** | từ vụ 21 | từ vụ 17 | từ vụ 27 | ≤ 50%, hiện "Nên tái canh" |

Tổng thời gian một vòng ≈ 2 giờ chơi cho vối, đủ để người chơi thấy cây già nhưng không phải trồng lại liên tục.

### Quyết định khi cây già

| Lựa chọn | Luật | Ngoài đời tương ứng |
|---|---|---|
| **Cưa đốn phục hồi** | Mất 1 vụ không quả, quay lại đầu giai đoạn Kinh doanh với 85% đỉnh; mỗi cây làm 1 lần | Cưa đốn tái sinh / ghép cải tạo |
| **Phá bỏ & tái canh** | Cuốc cây → ô thành **Đất nghỉ 1 vụ** (không trồng được). Bón vôi + phân hữu cơ rút còn nửa vụ | Tái canh cần cải tạo đất trước khi trồng lại |
| Để nguyên | Vẫn cho quả nhưng thấp, tốn công chăm như cây khỏe | — |

Cây **không chết** khi người chơi vắng mặt (giữ luật hiện hành). Thiếu chăm lâu chỉ làm giảm **sức khỏe**, ảnh hưởng năng suất và đẩy nhanh suy giảm.

## 3. Thuật toán trưởng thành và năng suất

Mỗi cây lưu thêm: `cultivar`, `seasons` (số vụ đã qua), `health` (0–100), `rejuvenated`, `fallowUntil` (ô đất nghỉ).

```
tiến độ vụ   Δg = Δt / T_vụ × f_nước × f_cỏ          (dừng khi nước ≤ 15 hoặc cỏ ≥ 75, như hiện tại)
sản lượng    Y  = Y_dòng × f_tuổi(seasons) × (0,6 + 0,4·health/100) × f_bón × f_tỉa
chất lượng   Q  = Q_dòng + chăm đúng giai đoạn − stress − quả quá chín
sức khỏe     health += hồi khi đủ nước/sạch cỏ; −khi ngừng lớn kéo dài (không xuống dưới 20)
```

- `f_tuổi` lấy theo bảng mục 2. `f_bón` = 1,1 khi bón đúng cửa sổ, `f_tỉa` = 1,05 khi tỉa đầu vụ (gần như hiện tại).
- **Quả chín trên cây**: giữ được nửa vụ ở chất lượng tốt; quá nửa vụ chất lượng giảm dần (quả quá chín/khô trên cây), **không mất khối lượng** → không phạt người chơi vắng mặt quá nặng.
- Khi hết vụ: `seasons += 1`, tính lại giai đoạn tuổi, reset bón/tỉa (giữ luật hiện có).

## 4. Chuỗi chế biến

```
Quả chín ─┬─ Phơi sân (miễn phí, chậm, phụ thuộc thời tiết, cần đảo)
          └─ Máy sấy (nhanh, ổn định, tốn xu mỗi mẻ)
              → Quả khô → Xát/tách vỏ → Nhân xanh → (Phân loại) → Rang → Nghỉ hạt → Xay / Đóng gói → Bán / Quán
```

| Công đoạn | Luật đề xuất | Hiện tại |
|---|---|---|
| **Phơi sân** | Mục tiêu độ ẩm ~12,5%. Nắng: 1 vụ cho mẻ đầy; mưa dừng phơi, không che thì ẩm lại. Đảo đủ lần giữ chất lượng | Sân phơi 30 s/mẻ, đảo rút 5 s |
| **Máy sấy** (công trình mới) | Nhanh gấp 3, không phụ thuộc mưa, chất lượng ổn định; tốn xu điện/mẻ. Quá nhiệt khi đầy tải → giảm chất lượng nhẹ | Chưa có |
| **Xát vỏ** | Gộp trong trạm phơi/sấy (đúng như guide: không thêm nhà tách vỏ). Quả khô → nhân xanh 6:1 tính từ quả tươi | Đã gộp, 600 g → 100 g |
| **Phân loại** (tùy chọn, mở sau) | Tách nhân lỗi → hạng 1/hạng 2; hạng 1 bán giá cao, hạng 2 vẫn bán/rang được | Chưa có |
| **Rang** | 3 mức: **Nhạt** (hao 13%, hợp pha máy/Arabica), **Vừa** (16%), **Đậm** (19%, hợp phin/Robusta). Thời gian mẻ tăng theo mức | Một mức, hao 16% |
| **Nghỉ hạt** | Sau rang 1 ngày game mới đạt hương tốt nhất; độ tươi giảm dần sau ~2 tuần game | Chưa có |
| **Xay** | **Thô** (pha lạnh), **Vừa** (phin), **Mịn** (espresso). Bột mất tươi nhanh gấp 3 hạt | Một mức |

Mọi công đoạn giữ **bảo toàn khối lượng**: hao hụt có đầu ra rõ (nước bốc hơi, vỏ, hạt lỗi, hao rang). Vỏ cà phê có thể đưa vào nhà ủ phân (theo [đề xuất xây dựng](build-proposal.md)).

## 5. Hàng bán và giá

| Mặt hàng | Đơn vị bán | Người mua |
|---|---|---|
| Quả tươi | kg | Thương lái (giá thấp, xả kho nhanh) |
| Nhân xanh hạng 1/2 | kg | Đại lý thu mua |
| Hạt rang Nhạt/Vừa/Đậm | túi 250 g / 500 g / 1 kg | Chợ, quán |
| Cà phê bột theo độ xay | túi 250 g / 500 g | Chợ, quán |
| Đồ uống | ly | Quán (theo [cafe-gameplay](../04-cafe/gameplay.md)) |

```
giá = giá_nền(mặt hàng) × hệ số loài/dòng × hệ số chất lượng × hệ số độ tươi × chỉ số thị trường ngày (±10%)
```

- Bán theo **túi/kg** thay cho nhập gram tối đa 99 → giải quyết điểm chưa chốt số 4 trong luật hiện hành.
- Thị trường dao động theo ngày tạo lý do giữ hàng hoặc bán sớm, nhưng không ngẫu nhiên quá ±10%.

## 6. Thứ tự triển khai đề xuất

1. Tên hiển thị thật cho 3 loài + giai đoạn tuổi/sức khỏe/năng suất (không đổi id, có chuyển dữ liệu: cây cũ coi như đang ở đầu giai đoạn Kinh doanh).
2. Cây già + cưa đốn phục hồi + phá bỏ/đất nghỉ.
3. Mức rang, nghỉ hạt/độ tươi, đóng gói theo túi.
4. Máy sấy, phân loại, độ xay.
5. Dòng giống (TR4/TR9/TRS1, Catimor/Typica/Bourbon, Excelsa) sau khi đối chiếu số liệu.

## 7. Cần chốt

1. 1 vụ = 1 năm cây; vòng đời vối ≈ 21 vụ (≈ 2 giờ chơi) có hợp nhịp không?
2. Quả chín để lâu chỉ giảm chất lượng, không mất khối lượng — đồng ý?
3. Thêm **Máy sấy** tốn xu/mẻ cạnh sân phơi miễn phí?
4. Bán theo túi 250 g/500 g/1 kg thay cho nhập gram?
5. Mở dòng giống ngay ở bước 1 hay để sau (bước 5)?
