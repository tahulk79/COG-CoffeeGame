# Ba trục tiến trình và hai mục tiêu thắng (F-36)

| | |
|---|---|
| Trạng thái | **Đã chốt hướng 04/11/2026 (Quang), chưa code. Số liệu Đang chỉnh: phải chạy `scripts/balance-sim.mjs` trước khi chốt số** |
| Nguồn | Tài liệu chuẩn tr. 3 §3.3 (APPROVED), tr. 6 §7; quyết định Q-04 (tách Wealth / Mastery / Awakening), Q-06 (hai mục tiêu thắng độc lập) |
| Liên quan | [coffee-memory.md](coffee-memory.md), [decode-awaken.md](decode-awaken.md), GDD 9, 10 |

## 1. Nguyên tắc

- Ba trục **độc lập**: không trục nào đổi được sang trục khác. **Xu không mua được XP, Fragment hay Key.**
- Mục đích (Q-04): chỉ kiếm tiền không mở được toàn bộ game; giàu không đồng nghĩa thức tỉnh.
- Mỗi trục mở một loại thứ khác nhau:

| Trục | Tích lũy | Mở | Hiển thị |
|---|---|---|---|
| **Wealth** | Xu + giá trị tài sản (ruộng, công trình, thiết bị quán, trang trí — hàm `assetValue` sẵn có) | Mua ruộng, nâng cấp, thuê người, mặt bằng | Ô xu HUD; Hồ sơ ▸ "Tài sản" |
| **Mastery** | XP và cấp nông trại; điểm luyện món (★) | Giống mới, trần cấp nâng cấp công trình, món mở theo luyện, barista tự pha | Thanh XP HUD (đã có) |
| **Awakening** | Fragment, Message, Sixth Key | Công cụ, chế độ, câu chuyện ([decode-awaken.md](decode-awaken.md) mục 6) | Sổ tay thiên đàng ▸ Fragment / Key |

## 2. Mastery: nguồn XP mới

Hiện tại (GDD 9.1) bán chợ cho XP = ⌊xu nhận / 2⌋, là nguồn XP lớn nhất, nên XP thực chất đi theo tiền. Luật mới:

| Nguồn | Hiện code | Luật mới |
|---|---|---|
| Bán chợ | ⌊xu / 2⌋, không trần | ⌊xu / 2⌋ nhưng **tối đa 40 XP mỗi ngày công** |
| Đơn Chợ, đơn cửa hàng | `xp` của đơn | Giữ |
| Hái cây | +6 | Giữ |
| Nhận mẻ chế biến | +4 | Giữ |
| Mua ruộng | +10 | **Bỏ** (là chi tiêu Wealth) |
| Ly bạn/nhân viên pha | 1 + số sao | Giữ |
| Luyện món lên ★★ / ★★★ lần đầu | — | **+15 / +30** mỗi món |
| Memory | — | Quick Taste ly game +3, ly ngoài đời +5, Insight đủ 3 ô +5; trần 30 XP/ngày công ([coffee-memory.md](coffee-memory.md)) |
| Giải mã câu hỏi mở | — | +20 mỗi lần giải mã đúng (Fragment vẫn là phần thưởng Awakening riêng) |
| Nhiệm vụ | `xp` của nhiệm vụ | Giữ |

Ước lượng tay: sim 120 phút cũ cho ~10.600 xu chợ → ~5.300 XP từ chợ; trần 40 XP × 20 ngày công = 800 XP. Mất ~4.500 XP sẽ làm chậm lên cấp rõ rệt (cấp 17–18 → khoảng cấp 11–13), bù một phần bằng nguồn mới. **Nếu sim cho thấy cấp 120 phút < 14, giảm ngưỡng XP các cấp ≥ 8 hoặc nâng trần chợ** — chốt số sau sim. Nơi chỉ quán (không có chợ) không bị ảnh hưởng bởi trần chợ.

## 3. Hai mục tiêu thắng (Q-06)

Hai mục tiêu **độc lập**: đạt cái này không cần cái kia. Đạt mục tiêu **không kết thúc game**: hiện màn chúc mừng ngắn, trao danh hiệu (hiện ở thẻ tên và Hồ sơ), chơi tiếp bình thường. Lưu cờ trong save, không thu hồi.

| | **Economic Victory — "Chủ đế chế cà phê"** | **Discovery Victory — "Người giải mã"** |
|---|---|---|
| Điều kiện | Tài sản (xu + `assetValue`) ≥ **300.000 xu** **và** theo loại nơi: *cả hai* — đủ 4 ruộng + quán uy tín ≥ 85; *chỉ trồng* — đủ 4 ruộng + mọi công trình farm ≥ cấp 15; *chỉ quán* — quán cấp 10 + uy tín ≥ 90 + đủ tự động hóa | Mở đủ **6 Sixth Key** |
| Lý do số | Nâng hết farm ≈ 653 nghìn xu (GDD 15.2); 300 nghìn ≈ 50–60 giờ chơi ở thu nhập sim ~5 nghìn xu/giờ — mục tiêu dài, còn chỗ tiêu sau khi thắng | 6 dòng Fragment ([decode-awaken.md](decode-awaken.md)) |
| Tiến độ hiển thị | Hồ sơ ▸ Mục tiêu: thanh tài sản + các điều kiện ✓/✗ | Sổ tay thiên đàng: 6 ô Key |

Danh hiệu không cộng chỉ số. Đạt cả hai: danh hiệu thứ ba "Godbean" (chỉ trang trí).

## 4. Dữ liệu

- `farm.xpLog` không cần; thêm `progress.market.xp` (XP chợ đã nhận trong ngày công, reset cùng `market.day`).
- `progress.mastery[recipeId].tiers` (mốc ★★/★★★ đã thưởng) để không thưởng lại.
- Cấp 1 `godbean-progress`: `victories: { economic: at|null, discovery: at|null }`.
- Chi tiết trường: [contracts.md](contracts.md) mục 8.

## 5. Tiêu chí nghiệm thu

1. Không có hành động nào đổi xu lấy XP, Fragment hay Key.
2. XP chợ dừng ở 40/ngày công; ngày công mới reset.
3. Hai mục tiêu thắng kích hoạt đúng điều kiện từng loại nơi, không kết thúc game, không lặp màn chúc mừng.
4. Chạy `scripts/balance-sim.mjs` cho 3 loại nơi, ghi cấp đạt được ở 60/120 phút và thời gian tới Economic Victory (ước lượng) vào GDD 10.5.
