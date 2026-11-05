# Tài liệu game Godbean

**Godbean: Build your own Coffee Empire!**

Thư mục `docs/` chỉ gồm 3 phần:

| Phần | File | Dùng để |
|---|---|---|
| GDD tổng | [design/godbean-gdd.md](design/godbean-gdd.md) | Toàn bộ thiết kế: tổng quan, sơ đồ màn (§4), hệ thống, kinh tế, UI, âm thanh, dữ liệu và save (§13), lộ trình. Mục 0 là bảng trạng thái F-xx |
| Tài liệu từng màn | `screens/<NN-màn>/` | Luật hiện hành của từng màn, khớp code trong `src/features/<màn>/` |
| Tài liệu gốc | [references/GODBEAN_MASTER_HANDOFF_2026-11-04.pdf](references/GODBEAN_MASTER_HANDOFF_2026-11-04.pdf) | Bản handoff của founder |

## Theo màn

| Màn | Tài liệu | Code |
|---|---|---|
| 00 · Chọn nhân vật | [README](screens/00-selection/README.md) | `src/features/selection/` |
| 01 · Intro | [README](screens/01-intro/README.md) | `src/features/intro/` |
| 02 · Thiên đàng mini + Hội đồng | [README](screens/02-heaven/README.md) · [rules](screens/02-heaven/rules.md) | `src/features/heaven/`, `src/features/awakening/` |
| 02b · Bản đồ thế giới | [README](screens/02b-world-map/README.md) · [rules](screens/02b-world-map/rules.md) | `src/features/world-map/` |
| 03 · Nông trại | [README](screens/03-farm/README.md) · [rules](screens/03-farm/rules.md) | `src/features/farm/` |
| 04 · Quán cà phê | [README](screens/04-cafe/README.md) · [rules](screens/04-cafe/rules.md) | `src/features/cafe/` |

## Quy ước

- Code là nguồn sự thật. Tài liệu viết theo code hiện tại, không ghi nhật ký hay ngày tháng trong luật.
- Mỗi màn có `README.md` theo cùng một mẫu: vào/ra, luồng chơi, điều khiển, dữ liệu, code, asset, analytics, chưa làm. Màn nhiều luật có thêm `rules.md` (luật và số liệu hiện hành).
- Đổi luật hay số liệu: sửa `rules.md`/`README.md` của màn và cập nhật GDD trong cùng thay đổi.
- Ý tưởng chưa code: ghi một dòng ở mục "Chưa làm" của màn, hoặc ở GDD §14.3.
- Không commit ảnh chụp màn hình hay log test vào `docs/`.
