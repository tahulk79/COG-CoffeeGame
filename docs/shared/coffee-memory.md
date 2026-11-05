# Coffee Memory và Quick Taste (F-33, F-34)

| | |
|---|---|
| Trạng thái | **Đã chốt 04/11/2026 (Quang). Lát 1 đã code 04/11** (`src/state/memory.js`, `src/features/cafe/memory-ui.js`): nháp ly game, Quick Taste, Journal, ly ngoài đời, So sánh A/B, nhắc «Lần sau đổi». Đã code (T-08c): chế độ Scientist mở bằng Key of Curiosity (đủ 8 nhóm, ghi chú TDS/RDT/thương hiệu, «Thí nghiệm»), Coffee DNA mở bằng Key of Connection. «Bộ dụng cụ của tôi» đã code (`setup.kit`, mục 5); «Thí nghiệm» có khóa biến (mục 5). Đã code (05/11): mục «Sổ tay cà phê» trong Hướng dẫn ở farm (chỉ ly ngoài đời); XP Memory đã nối (`wire.js` → `farm.act('memory','xp')`, trần 30/ngày công). Chưa kiểm chứng trên trình duyệt |
| Nguồn | Tài liệu chuẩn tr. 4–5 §5.1–5.3 (APPROVED), tr. 9 §11.1, Phụ lục tr. 14–15 §8–9; quyết định Q-10 (lưu cả ly trong game và ly ngoài đời) |
| Liên quan | [decode-awaken.md](decode-awaken.md) (First Sixth Key dùng Memory), [progression.md](progression.md) (XP Mastery), [analytics.md](analytics.md), [contracts.md](contracts.md) mục 8 |

## 1. Mục đích

Giúp người chơi **nhớ ly nào ngon hơn, hiểu vì sao, và pha ly sau tốt hơn** — cả trong game lẫn ngoài đời. Đây là cầu nối "game → kiến thức pha thật" (Q-10). Memory **không** là nơi chấm điểm: điểm mô hình của game và cảm nhận của người chơi là hai dữ liệu tách rời.

## 2. Hai loại ly

| | Ly trong game (`kind: 'game'`) | Ly ngoài đời (`kind: 'real'`) |
|---|---|---|
| Tạo khi | Người chơi **tự pha xong** một ly ở bàn pha (không tính Pha nhanh, Auto pha, ly nhân viên/robot) | Người chơi bấm «＋ Ly ngoài đời» trong sổ tay |
| Công thức thực tế | Tự điền từ giá trị từng bước của ly (g, ml, °C, độ xay, lựa chọn) | Người chơi nhập; có «Pha lại ly trước» và «Bộ dụng cụ của tôi» để điền nhanh |
| Công thức dự định | Vạch chuẩn của món tại thời điểm pha (snapshot) | Người chơi nhập (tùy chọn) |
| Điểm mô hình | Có: `simulated.score`, `quality`, `modelVersion` — ghi rõ "điểm theo mô hình game" | Không có |
| Cảm nhận (Quick Taste) | Tùy chọn: người chơi "tưởng tượng / nhớ" vị theo mô tả ly — dùng để luyện ngôn ngữ cảm quan | Tùy chọn nhưng là phần chính |

Ly game chỉ lưu dạng **nháp** (chưa có cảm nhận) cho tới khi người chơi mở sổ tay ghi; tối đa **30 nháp**, nháp cũ nhất bị bỏ trước. Ly đã có cảm nhận/insight không bao giờ tự xóa.

## 3. Chỗ đặt trong game

- **Sổ tay cà phê** là vật thể 3D trên quầy pha (khối tạm: cuốn sổ có dấu trang). Bấm sổ tay → **modal giữa màn hình**, có nút đóng, khóa di chuyển (ngoại lệ Auto như mọi modal). Không làm trang web hay route riêng.
- Màn kết quả ly tự pha có nút nhỏ «📓 Ghi sổ» (không chặn «Bưng ly»). Bấm thì ly vẫn ở tay, modal mở Quick Taste; đóng là quay lại đúng chỗ.
- Báo cáo cuối ca có dòng "n ly mới chờ ghi sổ" nếu có nháp.
- Nơi chỉ trồng (không có quán): sổ tay mở từ Hướng dẫn ▸ Sổ tay cà phê, chỉ ghi được ly ngoài đời. Đã code: nút «Mở sổ tay» trong tab Hướng dẫn, dialog `realOnly` (tab Lịch sử / Ly ngoài đời, không nháp ly game, không tab Câu hỏi/Key vì Hướng dẫn đã có). Chốt: hiện ở cả vùng `both` (cùng dialog, quán vẫn có sổ tay đầy đủ trên quầy); vùng chỉ quán không vào farm nên không cần.

## 4. Luồng (theo tài liệu chuẩn tr. 5 §5.3)

```text
Brew → Taste độc lập → So với lịch sử → Reflect → Lưu Insight → Plan lần sau
```

1. **Taste độc lập:** nhập cảm nhận **trước** khi thấy ly cũ. Ly cũ, điểm cũ, ★ tốt nhất ẩn tới khi bấm «Chốt cảm nhận».
2. **So với lịch sử:** gợi ý 1 ly để so (cùng món/phương pháp gần nhất); người chơi đổi được.
3. **Reflect:** câu hỏi ngắn "Khác gì? Bạn đoán vì sao?".
4. **Lưu Insight:** tách 3 ô — *Quan sát* (thấy gì), *Giả thuyết* (đoán vì sao), *Lần sau đổi* (một biến).
5. **Plan:** "Lần sau đổi" hiện lại khi người chơi mở bàn pha món đó (một dòng nhắc, không tự đổi vạch).

## 5. Ba chế độ nhập

| Chế độ | Mục tiêu thời gian | Gồm |
|---|---|---|
| Quick Taste | ~30 s | 6 thuộc tính 1–5 + mức thích 1–5 + 1 dòng ghi chú tùy chọn |
| Coffee Journal | 1–2 phút | Quick Taste + hạt (tên, xuất xứ, sơ chế, rang, ngày rang) + công thức (liều, nước, tỉ lệ, xay, nhiệt, bloom, thời gian) + Insight |
| Coffee Scientist | không giới hạn | Journal + đủ 8 nhóm dữ liệu (mục 6) |

Mặc định Quick Taste; công tắc Nhanh / Nhật ký / Scientist (Scientist chỉ hiện khi có Key of Curiosity; mất Key thì coi như Nhật ký). Chế độ đã chọn lần cuối được nhớ (`godbean-memory.setup.mode`: `quick`|`journal`|`scientist`). Ly game ở Scientist chỉ thêm nhóm dụng cụ/chuẩn bị/nguyên liệu/môi trường/cá nhân; nhóm `intended` chỉ nhập cho ly ngoài đời. 

**Bộ dụng cụ của tôi** (Scientist, ly ngoài đời): «Lưu làm bộ dụng cụ» ghi nhóm `equipment` + `ingredients.water/milk/brand` đang nhập vào `godbean-memory.setup.kit` (`{ equipment:{…}, ingredients:{water, milk, brand} }`, mỗi chuỗi ≤ 80 ký tự, chuẩn hóa mỗi lần đọc nên dữ liệu cũ/hỏng không làm lỗi); «Điền từ bộ dụng cụ» điền lại các trường đó, không đụng trường khác. «Pha lại ly trước» điền method/hạt/công thức/các nhóm Scientist từ ly ngoài đời gần nhất.

**Thí nghiệm (khóa biến)**: tick «Thí nghiệm» → điền từ ly ngoài đời gần nhất; người chơi chọn MỘT biến trong `VARIABLES` (độ xay, nhiệt độ, liều, nước). Các ô công thức thực tế còn lại bị khóa (disabled) ở giá trị gốc; «Mở khóa hết» quay về chế độ tô/cảnh báo khi đổi > 1 biến; bỏ tick là hủy. Chỉ khóa nhóm `actual` (hạt, dụng cụ… vẫn sửa được). Cổng bằng Key of Curiosity, không đổi kinh tế.

So bước dùng dung sai 5% (`STEP_TOLERANCE`, Đang chỉnh).

**6 thuộc tính** (tài liệu chuẩn tr. 4 §5.1): Aroma · Acidity · Sweetness · Bitterness · Body · Aftertaste, thang 1–5, mỗi thuộc tính một hàng 5 chip có icon + chữ. **Không** tô xanh/đỏ tốt/xấu, **không** cộng thành "độ ngon": chua hay đắng cao không tự động tốt hay xấu. Mức thích (1–5) là ô riêng. Chữ UI gọi là "6 thuộc tính cảm quan", **không** gọi là "Sixth Taste".

## 6. Dữ liệu (8 nhóm, tài liệu chuẩn tr. 4 §5.2)

Một mục Memory (`entry`):

| Trường | Kiểu | Ghi chú |
|---|---|---|
| `id`, `kind` (`game`/`real`), `createdAt`, `editedAt` | | |
| `schemaVersion` | số | Bắt đầu 1 |
| `method`, `recipeId` | chuỗi | `v60`, `phin-den`… hoặc `custom` cho ly ngoài đời |
| `intended` | object | Công thức dự định (snapshot vạch chuẩn ở ly game) |
| `actual` | object | `{ doseG, waterG, ratio, grind, tempC, bloomG, bloomS, pours:[g], timeS, steps:[{type, value, unit}] }` |
| `bean` | object | `{ name, origin, variety, process, roast, roastDate, storage }` — ly game tự điền giống + lô |
| `equipment` | object | `{ grinder, kettle, dripper, filter, server, cup }` (tên/model tự do) |
| `preparation` | object | `{ rdt, rinseFilter, preheat, clean }` (bật/tắt) |
| `ingredients` | object | `{ water, tds, hardness, milk, milkRatio, brand }` — ly game tự điền sữa/nước đang dùng (F-31) |
| `environment` | object | `{ weather, tempC, humidity, place, noise, light }` — tùy chọn |
| `personal` | object | `{ mood, alertness, focus, wellbeing }` 1–5 — **tùy chọn, riêng tư** (mục 9) |
| `taste` | object | `{ aroma, acidity, sweetness, bitterness, body, aftertaste }` 1–5, `liking` 1–5 |
| `notes`, `memory` | chuỗi ≤ 500 ký tự | Ghi chú hương vị; ký ức/cảm xúc |
| `insight` | object | `{ observation, hypothesis, nextChange }` |
| `simulated` | object hoặc null | Chỉ ly game: `{ score, quality, stars, modelVersion }`. **Không bao giờ ghi đè `taste`/`liking`** |

TDS không đủ mô tả nước; RDT không mặc định cải thiện vị; thương hiệu dụng cụ không tự quyết định chất lượng — các câu này hiện trong tooltip của trường tương ứng (tài liệu chuẩn tr. 5).

## 7. So sánh A/B

- Chọn 2 mục → bảng hai cột: biến nào khác (tô bằng ký hiệu ≠ và chữ, không chỉ bằng màu), cảm nhận khác ra sao.
- Đổi **≥ 2 biến** cùng lúc → cảnh báo: "Đổi nhiều biến cùng lúc nên chưa biết biến nào gây khác biệt. Lần sau thử đổi một biến." (Phụ lục tr. 15 §9.3)
- Không hiện kết luận nhân quả tự động. Chỉ gợi ý biến lệch nhiều nhất làm "ứng viên đổi" (tài liệu chuẩn tr. 5: tách Observation / Hypothesis / Experiment).
- So điểm mô hình chỉ khi cả hai đều là ly game **cùng `modelVersion`**; khác version thì ghi "điểm theo mô hình khác phiên bản, không so được".

## 8. Lưu, xuất, xóa (F-37)

- Key riêng `godbean-memory` trong localStorage (`{ version: 1, entries: [...], setup: {...} }`), tách khỏi `godbean-progress` để Reset tiến trình **không** xóa sổ tay trừ khi người chơi chọn.
- Tối đa **500 mục** (30 nháp game tính riêng). Đầy thì báo, không tự xóa mục có cảm nhận.
- Cài đặt ▸ Dữ liệu: **Xuất** (file JSON gồm tiến trình + sổ tay), **Nhập** (xác nhận trước khi ghi đè), **Xóa sổ tay**, **Xóa tiến trình** (hỏi kèm "Xóa cả sổ tay?"). Mọi xóa có hộp xác nhận kiểu `data-reset-confirm`.
- Dòng cố định trong Cài đặt ▸ Dữ liệu: "Dữ liệu chỉ nằm trong trình duyệt này. Xóa dữ liệu trình duyệt hoặc đổi máy sẽ mất. Hãy Xuất để giữ bản sao." Toast một lần khi lưu mục Memory đầu tiên.
- Sửa mục: được sửa mọi trường trừ `simulated`; giữ `createdAt`, cập nhật `editedAt`.

## 9. Quyền riêng tư

- `personal`, `memory`, `notes`, `insight` là dữ liệu riêng tư: mặc định trống, không bắt buộc, không đưa vào analytics (chỉ đếm số lần lưu, xem [analytics.md](analytics.md)), không dùng cho quảng cáo hay phần thưởng.
- Không thưởng theo lượng caffeine hay theo cảm xúc tích cực (tài liệu chuẩn tr. 4 §4.4).

## 10. Liên kết với hệ khác

| Hệ | Liên kết |
|---|---|
| Mastery (XP) | Ghi Quick Taste cho ly game +3 XP, ly ngoài đời +5 XP, lưu Insight đủ 3 ô +5 XP; tối đa 30 XP Memory mỗi ngày công 6 phút ([progression.md](progression.md)) |
| Decode & Awaken | Câu hỏi mở `recipe`, `adjust` và First Sixth Key kiểm chứng bằng mục Memory ([decode-awaken.md](decode-awaken.md)) |
| Giá bán, uy tín | **Không ảnh hưởng.** Cảm nhận người chơi không đổi giá ly hay sao |
| Analytics | `taste_submitted`, `memory_saved`, `memory_compared` |

## 11. Tiêu chí nghiệm thu

1. Ly tự pha tạo nháp với đủ giá trị từng bước và `modelVersion`; Pha nhanh/robot không tạo.
2. Ly cũ ẩn tới khi chốt cảm nhận.
3. Lưu → tải lại trang vẫn còn; so 2 mục hiện đúng biến khác và cảnh báo khi ≥ 2 biến.
4. Xuất rồi Nhập lại cho đúng dữ liệu; Xóa sổ tay không đụng tiến trình.
5. Đổi ngôn ngữ không mất dữ liệu; mọi chữ có EN/VI.
6. Dùng được bằng chạm trên màn dọc điện thoại và iPad; không phụ thuộc hover.
7. `simulated` không bao giờ ghi vào `taste`/`liking`.

## 12. Ngoài phạm vi bản đầu

Ảnh chụp ly, Coffee DNA, Sweet Spot, Taste Timeline, Equipment Comparison, AI Coffee Assistant, đồng bộ đám mây (tài liệu chuẩn tr. 5: "phân tích về sau"). Một phần mở bằng Sixth Key ([decode-awaken.md](decode-awaken.md) mục 6).
