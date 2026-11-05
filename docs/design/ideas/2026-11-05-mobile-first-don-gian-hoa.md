# Mobile-first: đơn giản hoá, hướng dẫn người mới, quản lý cả khu vườn

| | |
|---|---|
| Người đề xuất | Quang (phân tích bằng `/game-studio review`: game-designer + 2 ux-designer) |
| Ngày | 05/11/2026 |
| Trạng thái | Đã chốt (Quang 05/11, chưa qua sếp) |
| Ưu tiên | Cao |
| Màn liên quan | 02 Thiên đàng / 02b Bản đồ / 03 Nông trại / 04 Quán / Chung |
| Mục GDD | <để trống> |
| Mã tính năng | F-44 … F-49 |
| Cập nhật | 05/11 — Quang yêu cầu triển khai: chốt Q1–Q3, Q5, Q7, Q8, Q10 (F-44…F-48); Q4, Q6, Q9 (F-49) vẫn Đề xuất chờ sếp + sim |

> Đây là **đề xuất để review**, chưa phải luật. Không triển khai vào code khi chưa `Đã chốt` và chưa có dòng F-xx trong GDD. Mọi số đếm thao tác/thời gian bên dưới là **ước tính từ đọc tài liệu và code**, chưa chạy game, sim hay playtest. Phần tham khảo game khác phần lớn dựa trên kiến thức chung; chỗ nào chưa chắc ghi "cần xác minh".

> **Bản review toàn luồng theo GDD (05/11):** [audits/2026-11-05-review-luong-mobile-first.md](../audits/2026-11-05-review-luong-mobile-first.md) — luồng màn mới, bản đồ farm kiểu Hay Day, bảng mở khoá theo cấp, 18 phát hiện, danh sách sửa tài liệu và 10 câu hỏi cho sếp.

## Ý tưởng

Ba hướng đi cùng nhau:

1. **HUD mobile dọc tối giản**: tối đa 5 nút thường trực ở vùng ngón cái, một nút giữa đổi theo ngữ cảnh, mọi thứ khác nằm trong ngăn Quản lý hoặc mở dần.
2. **Quản lý cả khu vườn**: đơn vị người chơi ra quyết định là **ruộng** (12 ô), không còn là từng ô. Người chơi đặt kế hoạch cho cả ruộng, bấm một nút để Thu/Chăm/Gieo cả ruộng, chế biến tự chạy theo kế hoạch đầu ra.
3. **Hướng dẫn người mới**: chạm hành động đầu tiên trong ≤ 60 s, ly đầu bán được trong ≤ 5 phút, 4 bước đầu có bàn tay chỉ (ép bước), sau đó luôn hiện đúng 1 dòng "Việc tiếp theo".

## Vì sao

- **Quá tải nhận thức.** Ước tính trong 15 phút đầu lộ ra khoảng **18–20 hệ thống** (thiên đàng, bản đồ, 5 việc chăm, sân phơi, lò rang, kho theo lô, shop 3 tab, chợ giảm giá, quán, bàn pha V60, hỏi lại mẹo, Memory, Decode, Nâng cấp, Nhân viên, Auto…). Mức thường gặp ở game mobile cùng loại là khoảng 5–7 hệ trong phiên đầu (nhận định thiết kế, chưa đo).
- **Vi quản lý từng ô nặng nhất đúng lúc người mới chơi.** Một vòng 1 ruộng tới ly bán được tốn khoảng **80–110 chạm và khoảng 10 điểm quyết định**. Dải công cụ kéo nhiều ô chỉ mở từ ruộng 2 hoặc cấp 3 (`src/features/farm/content.js:117`).
- **HUD farm khi đã mở hết có 12 thành phần chạm được**, vượt mức ≤ 4 nút cố định của `docs/shared/design-system.md` §5. Vài vùng chạm dưới 44 px (zoom 27×32, nút × của dải giống, mũi tên cuộn).
- **Người mới chưa chạm gì trong một thời gian dài**: chọn nhân vật → intro ~23,5 s → khoảng 23 hộp thoại + 6 câu + chọn quà → bản đồ 8 nơi, rồi mới tới farm. Playtest 03/11 có người chơi nói "chả hiểu gì" (`docs/shared/onboarding-flow.md:7`).
- Trụ cột: **cuốn ngay** (hành động sớm), **quay lại** (tự động hoá là phần thưởng), **học thật** (giữ nguyên nhân thật trên thẻ ruộng).

## Tham khảo game hiện hành

| Game | Mẫu đáng học | Mức chắc |
|---|---|---|
| Hay Day | Cấp góc trên trái, tiền trên phải. Chạm ô → bánh xe cây trồng, **kéo ngón qua nhiều ô** để trồng/thu. Xe tải đơn hàng là "việc tiếp theo" hiển nhiên. Bàn tay chỉ ngay giây đầu | Khá chắc |
| Township | Kéo thu nhiều ô; mở nhà máy/chức năng theo cấp; tutorial ép bước bằng tay chỉ | Khá chắc |
| Stardew Valley | Sprinkler tưới tự động 4/8/24 ô mở theo cấp Farming: **việc tay dần thành quyết định đầu tư** | Khá chắc (có nguồn wiki) |
| Good Pizza, Great Pizza | Khách đầu tiên dạy bằng cách làm; mỗi ca thêm một yếu tố; gần như không có nút chrome | Khá chắc |
| Royal Match / Gardenscapes | Ép bước vài màn đầu rồi thả, mở dần booster | Khá chắc |
| My Café, Cats & Soup, idle cafe tycoon | Trạm tự chạy; người chơi nâng cấp và gán nhân sự; giữ một "khoảnh khắc kỹ năng" | Cần xác minh chi tiết bố cục |
| FarmVille 3, Harvest Town, Pocket Camp | — | Cần xác minh |

### Hay Day: đã đối chiếu nguồn công khai (05/11)

Nguồn: [trang Google Play](https://play.google.com/store/apps/details?id=com.supercell.hayday&hl=vi) (cập nhật 16/10/2026, 100 Tr+ lượt tải, 4,6★), Hay Day Wiki (Fandom) các trang [Farm](https://hayday.fandom.com/wiki/Farm) và [Crops](https://hayday.fandom.com/wiki/Crops). Wiki do cộng đồng viết, có thể lệch bản game mới nhất.

| Điều xác minh được | Nguồn | Bài học cho Godbean |
|---|---|---|
| Không có tưới hay chăm sóc: "nơi này không bao giờ có mưa nhưng cây trồng vẫn luôn tươi tốt". Vòng lõi chỉ gồm trồng → thu → trồng lại / chế biến | Play | Ủng hộ gộp Tưới + Làm cỏ thành **Chăm** (hoặc tự động) ở giai đoạn đầu. Godbean vẫn giữ chăm sóc vì trụ cột Học thật, nhưng đưa nó lên cấp ruộng |
| Gieo không tốn tiền, dùng nông sản đã thu làm giống (1 hạt cho 2) | Wiki Crops | Gieo nên là 1 thao tác, không phải một quyết định nặng |
| Giống mở dần: lúa mì cấp 1, ngô cấp 2, đậu nành cấp 5, mía cấp 7… Khi mở giống mới được tặng 1–3 cây để bắt đầu | Wiki Crops | Dải giống đầu game chỉ 1–2 icon; giống mới mở có quà khởi đầu |
| Ruộng tăng dần: cứ 2 cấp được thêm ruộng (3 ruộng tới cấp 49) | Wiki Farm | Mở rộng vườn gắn với cấp, đều đặn |
| Hướng dẫn: nhân vật Mavis dẫn người chơi cấp 1–4; bù nhìn Mr. Wicker giới thiệu từng cơ chế **khi nó mở khoá** | Wiki Farm | Khớp đề xuất: ép bước ở đầu game + hướng dẫn đúng lúc (just-in-time). Có thể gán vai này cho một chuyên gia thiên đàng |
| Tính năng mở rất muộn: trang trí cấp 8, mở rộng đất cấp 22, sắp xếp bố cục cấp 23, tuỳ biến cấp 31 | Wiki Farm | Ủng hộ ẩn Trang trí / Xây dựng tới sau 1 giờ |
| Mọi chức năng là **công trình trên bản đồ** (xe tải đơn hàng, kho silo/barn, cửa hàng ven đường, nhà người giúp việc, bảng sự kiện) thay vì nút HUD | Wiki Farm | Chuyển Đơn hàng / Nhân viên / Nhiệm vụ thành điểm chạm 3D (bảng đơn, nhà thợ) → bớt nút trên thanh, đúng luật AGENTS "thao tác trên đối tượng" |
| Đơn hàng xe tải và tàu là nguồn xu chính, là "việc tiếp theo" hiển nhiên | Play | "Việc tiếp theo" nên gắn với một vật thể (bảng đơn quán) chứ không chỉ là chữ |
| Bản cập nhật 10/2026: "nhấn giữ để cho thức ăn vào tất cả bát thú cưng cùng lúc, không cần kéo từng cái" | Play, mục Tính năng mới | Chính Hay Day đang bỏ thao tác từng ô → ủng hộ **giữ để làm cả ruộng** |
| Người giúp việc Rose/Ernest, Angus "lo đánh bắt cá khi bạn vắng mặt" | Wiki Farm, Play | Tự động hoá là phần thưởng giữa game, khớp mục Mương tưới / thợ theo ruộng |

Chưa xác minh được từ nguồn công khai: vị trí chính xác từng nút HUD và cử chỉ vuốt trồng (ảnh trên Play là ảnh quảng cáo, không thấy HUD). Muốn chắc cần chơi thử Hay Day và tự chụp màn hình để tham khảo nội bộ (không commit ảnh vào repo).

Lưu ý: chỉ học **mẫu bố cục và nhịp mở khoá**; không chép tên, nhân vật, hình ảnh hay giao diện của Hay Day.

**Mẫu chung:** tiền ở trên · thế giới 3D ở giữa · một cụm hành động ở vùng ngón cái · thao tác lặp là chạm/kéo trực tiếp lên đối tượng · tự động hoá mở dần như phần thưởng.

## Đề xuất 1 — Bố cục HUD mobile dọc (375×812)

### Kiểm kê hiện tại (farm, đã mở hết)

Hồ sơ/XP · thẻ nhiệm vụ · chip xu (cũng mở shop) · zoom + / − · Kho · Cửa hàng · Vào quán · Quản lý ≡ · Auto · joystick · coach ×. Tổng **12**, chưa tính dải giống và ngăn kéo. Nguồn: `index.html:79-85`, `src/features/farm/ui.js:28-79`, `src/ui/styles/hud.css`, `src/ui/styles/farm.css`. Quán: khoảng 8 (`src/features/cafe/ui.js:108-136`).

Trùng lặp: chip xu và nút Cửa hàng cùng mở shop (design-system §6 đã cấm); `#farm-main-nav` có ít nhất 6 lớp CSS chồng nhau (`farm.css:276`–`:1052`), là nợ kỹ thuật cần dọn trước khi dựng bố cục mới.

### Farm

```
┌─────────────────────────────────┐ safe-area-top
│ (Lv3)━━━  🎯 Thu ruộng 1    ¢1.2k│  1 hàng 44px: avatar+vòng XP · việc tiếp theo · xu
│                                 │
│          THẾ GIỚI 3D            │  biển ruộng / marker bám đối tượng
│   ▒▒ ▒▒ ▒▒   [biển Ruộng 1]     │
│   ▒▒ ▒▒ ▒▒                      │
│  [toast 1 dòng]                 │
│     ( Thu cả ruộng · 6 )        │  chip ngữ cảnh 48px, chỉ hiện khi có việc
│  ┌─dải giống (khi chạm ô)─────┐ │  giữ luật AGENTS; kéo qua nhiều ô
│  │ 🌱 🌱 🌱 🌱 🌱          ×  │ │
│  └────────────────────────────┘ │
│ ┌────┬────┬────────┬────┬────┐  │  thanh 5 nút, ~69×56–64px
│ │Kho │Shop│ ✋ Thu  │Quán│ ≡  │  │  nút giữa = hành động chính theo ngữ cảnh
│ └────┴────┴────────┴────┴────┘  │
└─────────────────────────────────┘ safe-area-bottom
```

### Quán

```
┌─────────────────────────────────┐
│ ☕ Ca 2:41 ▬▬▬  🪑 3/6  ⭐ 50     │  dải ops 44px, icon + số, không chạm
│ [việc tiếp theo 1 dòng]         │
│            QUÁN 3D              │  order bám đầu khách (marker 3D)
│     ( Mang ly ra bàn 2 )        │  chip ngữ cảnh: bước tiếp theo của ca
│ ┌────┬────┬─────────┬────┬────┐ │
│ │Kho │Sách│🚪Mở/Đóng│Farm│ ≡  │ │
│ └────┴────┴─────────┴────┴────┘ │
└─────────────────────────────────┘
```

### Giữ / Gộp / Ẩn / Bỏ

| Thành phần | Đề xuất | Lý do |
|---|---|---|
| Hồ sơ + XP | Gộp thành avatar + vòng XP | Ít xem, chiếm cột trái |
| Thẻ nhiệm vụ | Giữ, rút còn 1 dòng "Việc tiếp theo" | Hướng dẫn chính |
| Chip xu | Giữ, **bỏ hành vi mở shop** | Trùng nút Cửa hàng |
| Zoom + / − | Bỏ trên cảm ứng (chụm 2 ngón), giữ cho chuột | Hiếm dùng, < 44 px |
| Kho, Cửa hàng, Quán/Nông trại, Quản lý ≡ | Giữ trên thanh | Dùng nhiều |
| Nâng cấp, Nhân viên, Đơn, Xây dựng, Hướng dẫn, Cài đặt | Giữ trong ngăn Quản lý | Ít dùng mỗi phút |
| Auto | Đổi thành chip nhỏ cạnh xu (⏸ luôn thấy khi bật) | Không phải né thanh bằng offset |
| Joystick | Joystick nổi: chạm giữ nửa trái màn hình mới hiện | Giải phóng vùng ngón cái — **cần duyệt** |
| Dải giống | Giữ, cuộn bằng vuốt, nút × 44 px | Luật AGENTS |
| `#farm-menu-toggle`, `#farm-tools-prompt` | Bỏ / gộp vào chip ngữ cảnh | Thừa (cần xác minh còn hiện không) |
| Coach × | Giữ, vùng chạm 44 px | — |
| Modal Shop/Kho/Nâng cấp | **Giữ nguyên** modal giữa màn | Luật AGENTS |

Màn ngang/desktop: thanh dọc bên phải (đã có `hud.css:44-46`), desktop giữ `zoom: 1.15`, phím tắt, không joystick. Safe area: lề `max(12px, env(safe-area-inset-*))`.

## Đề xuất 2 — Quản lý cả khu vườn (theo ruộng)

**Đơn vị mới: Ruộng** (dùng lại `FIELDS` 4 × 12 ô, `content.js:29-43`).

| Phương án | Mô tả | Đánh giá |
|---|---|---|
| A | Ruộng chỉ là lớp UI: thêm thao tác hàng loạt, mô phỏng từng ô giữ nguyên | Nhanh nhất, nhưng không có quyết định cấp ruộng |
| B | Ruộng là đơn vị mô phỏng (gộp 12 ô thành 1) | Phải migrate `plots[]` (`model.js:90-97`), làm vỡ câu Decode `water`, mất hình 3D từng cây |
| **C (khuyến nghị)** | Như A + **Kế hoạch ruộng** + tự động hoá mở dần | Ít rủi ro save, giữ Decode, có quyết định chiến lược |

**Thao tác theo phương án C:**

1. **Chạm biển ruộng → thẻ ruộng nhỏ** (không phủ màn hình): giống cho cả ruộng · Chế độ {Năng suất = bón · Cân bằng · Chất lượng = tỉa} · Đầu ra {Chợ · Quán · Giữ kho} · Thợ phụ trách.
2. **Một nút việc của ruộng**, đổi theo nhu cầu cao nhất: Thu / Chăm / Gieo. Nhân vật đi dọc luống, mỗi cây vẫn có hiệu ứng thu riêng. Tưới + làm cỏ gộp thành **Chăm**.
3. **Chế biến tự chạy**: quả chín tự vào hàng chờ phơi → rang theo Đầu ra, tự vào kho khi còn chỗ (đưa chỉ thị "Tự chế biến" ở `rules.md:39` thành mặc định).
4. **Tự động hoá là phần thưởng**: "Mương tưới" cho từng ruộng (kiểu sprinkler) trong Nâng cấp; gán thợ theo ruộng (đã có `plotZones`, `crew.js:22-31`).
5. Chạm từng ô vẫn dùng được, như chế độ nâng cao.

**Dữ liệu save (nếu chốt):** thêm `farm.fieldPlans: { [fieldId]: { cropId, mode: 'yield'|'balanced'|'quality', output: 'market'|'cafe'|'store', crew } }`; save cũ thiếu thì dựng mặc định từ `directives` (`model.js:87`), giống mẫu `region` — không tăng `version`. `plots[]` giữ nguyên. Phải sửa `docs/shared/contracts.md` cùng lúc.

**Kinh tế:** thao tác hàng loạt và tự chế biến làm tăng sản lượng/phút → **phải chạy lại `scripts/balance-sim.mjs`** với hồ sơ người chơi "quản lý ruộng" trước khi chốt số (gộp với D-25).

### Bảng cắt giảm / mở dần theo F-xx

Nguyên tắc: tính năng đã chốt hoặc thuộc PDF founder thì **ẩn tới mốc, không bỏ**.

| F | Đề xuất | Mốc |
|---|---|---|
| F-01, F-02, F-03, F-05 | Giữ lõi | — |
| F-04 Hỏi lại câu sai | Ẩn | Phút 15 |
| F-06 Chăm sóc | **Gộp** thành Chăm + chế độ ruộng | — |
| F-07 Chế biến | **Gộp**: tự xếp, tự nhận (XP "nhận mẻ" tính khi tự nhận) | — |
| F-08 Chợ | Giữ, chỉ hiện "giá hôm nay ↓" | Phút 5–15 |
| F-09 Nâng cấp | Mở ở cấp 3 thay vì cấp 2 (cần sim) | Phút 15 |
| F-10 Đơn farm→quán | **Gộp** vào Đầu ra = Quán, tự gửi khi quán thiếu | Bảng đơn ẩn tới khi có thợ |
| F-11 Trang trí | Ẩn | Sau 1 giờ / cấp 6 |
| F-13 Ca quán | Giữ; mốc Đồng/Bạc/Vàng ẩn | Từ ca 2 |
| F-15 Nâng cấp quán | Ẩn | Sau ca đầu |
| F-16, F-17, F-23 Thợ, nhân viên, chỉ thị | Ẩn; chỉ thị gộp vào Kế hoạch ruộng | Phút 15–60 |
| F-18 Sự cố | Ẩn bằng cách kéo dài thời gian miễn sự cố | Sau 1 giờ — **đụng luật đã chốt** |
| F-19 Nhiệm vụ | Viết lại chuỗi theo ruộng (nhiệm vụ 8–9 Tưới/Làm cỏ → "Đặt chế độ ruộng") | — |
| F-28 Bản đồ | Chọn sẵn Việt Nam lần chọn vùng đầu, không nhãn xếp hạng, vẫn xác nhận 3 chạm; dòng gợi chạm cờ khác thay link «Chọn vùng khác» (05/11, F-44 — [Q3](../../shared/mobile-first-proposal.md)) | — |
| F-29 Auto | Giữ | Phút 5–15 |
| F-31 Sữa/nước | Ẩn lựa chọn (mặc định) | Phút 15 |
| F-33, F-34 Memory, Quick Taste | **Giữ (P0)**: lối vào 1 chạm "Ghi cảm nhận" ở kết quả ly đầu | Phút 0–5 |
| F-35 Decode | **Giữ (P0)**: Sổ tay chỉ hiện khi câu đầu "Sẵn sàng giải mã" | Theo sự kiện |
| F-36 Ba trục | Thanh Awakening hiện khi có Fragment đầu; Victory sau 1 giờ | — |
| F-40 V60 đầu | Giữ (PDF) + **Làm mẫu miễn phí cho ly đầu** (`04-cafe/gameplay.md:144`) | Phút 0–5 |
| F-41 Đánh đổi | **Gộp** vào chế độ ruộng (`rules.md:122` đã có ý này) | Phút 5–15 |
| F-42 Đặt giá | Ẩn (p 0,8 đang thắng mọi cấu hình, D-28) | Sau 1 giờ |

**Lộ trình mở dần:**

- **Phút 0–5:** thu ruộng 1 → ly V60 đầu (có Làm mẫu) → Quick Taste 1 chạm. HUD: xu, Kho, Việc tiếp theo.
- **Phút 5–15:** Kế hoạch ruộng + Đầu ra, chế biến tự chạy, chợ, mua ruộng 2, Pha nhanh, Auto.
- **Phút 15–60:** Nâng cấp, thợ/robot theo ruộng, mốc ca, sữa/nước, hỏi lại mẹo, Sổ tay Decode, nhân viên quán, Mương tưới.
- **Sau 1 giờ:** sự cố, đặt giá, trang trí, Victory, ruộng 3–4.

## Đề xuất 3 — Hướng dẫn người mới (tutorial)

| # | Bước | Chỉ dẫn | Qua bước khi | HUD mở thêm | Mục tiêu (đề xuất, cần đo) |
|---|---|---|---|---|---|
| 0 | Chọn nhân vật | 1 nút Bắt đầu lớn | Bấm | — | ~5 s |
| 1 | Intro | Bỏ qua hiện từ giây 0 | Hết/Bỏ qua | — | ≤ 23,5 s |
| 2 | Thiên đàng | Tay chỉ, tự đi, nút Tiếp | Qua cổng | — | 60–90 s |
| 3 | Bản đồ | Thẻ "Bắt đầu ở Việt Nam" + link "Chọn vùng khác" | Bấm | — | ≤ 10 s |
| 4 | Farm: thu | Tay chỉ + viền sáng; "Chạm để thu"; nút khác khóa | Thu xong | Xu | ≤ 20 s |
| 5 | Farm: trồng | Viền sáng ô, dải giống; "Chọn hạt để trồng" | Trồng xong | Kho | ≤ 60 s tới chạm trồng |
| 6 | Vào quán | Tay chỉ trên nút Quán | Vào quán | Quán | ~15 s |
| 7 | Quán: mở cửa → nhận order → pha (Làm mẫu) → bưng | Mũi chỉ 3D + thẻ (đã có) | `stats.served = 1` | Shop | Ly đầu ≤ 5 phút tổng |
| 8 | Thả | Chỉ còn dòng "Việc tiếp theo" | — | Mở dần theo `HUD_UNLOCKS` | — |

- **Ép bước** ở bước 4–7 (chỉ cho chạm đúng chỗ), sau đó chỉ gợi ý.
- **Đứng im N giây** (đề xuất 8–10 s trong 5 phút đầu, 20 s sau đó): tay chỉ + viền sáng về đích; tối đa 3 lần rồi thôi.
- **Đúng lúc (just-in-time)**: tính năng vừa mở khoá có tay chỉ 1 lần + 1 câu công dụng (đã có toast + chấm "Mới"; gộp khi mở ≥ 2 mục).
- **Tra lại**: đổi 📖 Hướng dẫn hiện có thành sổ ngắn "Việc tiếp theo" + 3–5 mục (đi, trồng, bán, quán) với nút "Chỉ cho tôi". Không thêm nút mới.
- Bớt lớp gợi ý chồng nhau: hiện có gợi ý điều khiển 15 s + thẻ nhấp nháy + toast + chấm Mới + hỏi lại + `cafe-intro` + `bench-intro`. Thay khung chữ điều khiển 15 s bằng tay chỉ.
- Rút thiên đàng (phương án nhẹ): giữ nội dung, dời 3/6 câu sang cơ chế "hỏi lại ở farm/quán" sẵn có. Phương án mạnh: 1 chuyên gia + 2 câu ở lượt đầu.

## Ảnh hưởng

_Đội phát triển điền chi tiết khi chuyển Đang xem._

- **Luật / tài liệu phải sửa:** `AGENTS.md` (mục Thiết kế game: chọn giống từng ô), `docs/shared/design-system.md` §5–6 (thanh 5 nút, joystick), `docs/screens/03-farm/rules.md` (mục chăm sóc 26–28, chế biến 91–98, chỉ thị 39–40, F-41 112–122, sự cố 49), `docs/shared/onboarding-flow.md`, `docs/shared/crew-autoplay.md` (thứ tự Auto gọi thao tác ruộng), `docs/screens/02-heaven/gameplay.md`, `docs/screens/02b-world-map/README.md`, GDD 0.3 (thêm F-44, sửa ghi chú F-06/07/10/16/19/41).
- **Dữ liệu save:** `farm.fieldPlans` (tuỳ chọn, có mặc định), không tăng `version`. Nếu dời chọn quà sang farm thì đụng `startingGift` → cần kế hoạch migrate.
- **Asset:** biển ruộng có trạng thái (cần thu/chăm/gieo), icon tay chỉ, marker order 3D ở quán.
- **Ước lượng công:** chưa ước lượng. Gợi ý chia lát: (1) dọn CSS `#farm-main-nav` + thanh 5 nút; (2) tutorial ép bước + "Việc tiếp theo"; (3) Thu/Chăm cả ruộng; (4) Kế hoạch ruộng + tự chế biến + sim kinh tế.

## Mâu thuẫn với luật đã chốt (cần sếp quyết)

| # | Đề xuất | Đụng tới | Phương án nhẹ |
|---|---|---|---|
| 1 | Gieo cả ruộng | AGENTS.md: chọn giống dải icon, sáng viền **từng ô** | Giữ gieo từng ô; chỉ Thu/Chăm theo ruộng |
| 2 | Joystick nổi | `design-system.md` §6 | Giữ joystick, thu nhỏ, ẩn khi mở dải giống (đã có) |
| 3 | Chip xu không mở shop | Hành vi hiện tại `ui.js:235` | — |
| 4 | Rút gọn thiên đàng | `onboarding-flow.md:3` "thiên đàng là bài học" | Dời 3/6 câu sang hỏi lại |
| 5 | Mặc định vùng Việt Nam | `02b-world-map/README.md:17,34` loại nơi ẩn có chủ đích, chọn xong không đổi | Chỉ chọn sẵn + gợi ý, vẫn cho chọn |
| 6 | Ẩn sự cố tới sau 1 giờ | `rules.md:49` "không có tùy chọn tắt sự cố" | Giữ như hiện tại |
| 7 | Tự chế biến, tự nhận | GDD 6.3, `rules.md:94,98` | Chỉ bật khi có chỉ thị "Tự chế biến" |
| 8 | Gộp Tưới + Làm cỏ | Trụ cột "Học thật" | Thẻ ruộng ghi nguyên nhân thật ("5/12 cây nước < 35") |
| 9 | Decode `ripe` cần lô hái tay | `decode-awaken.md:51` | "Thu cả ruộng do người chơi bấm" = hái tay |
| 10 | V60 ở ly đầu dễ vượt 5 phút | PDF tr. 4 §5 | Giữ V60, thêm Làm mẫu miễn phí |
| 11 | Ép bước tutorial | Triết lý "gợi ý, chạm thẻ để dẫn" của `onboarding-flow.md` | Chỉ ép 4 bước đầu |

Chỗ **không đổi**: modal Shop/Kho/Nâng cấp giữa màn (Auto vẫn chạy phía sau); mua ruộng qua biển (chỉ trừ tiền khi xác nhận); chỉ ⏸ mới dừng Auto; các hệ P0 Memory/Quick Taste/Decode không bỏ, chỉ đổi lúc lộ ra.

## Câu hỏi mở

1. Mô hình quản lý: **C lai** (khuyến nghị), A chỉ thao tác hàng loạt, hay B ruộng là đơn vị mô phỏng?
2. Có sửa luật AGENTS.md để cho **Gieo cả ruộng** (từng ô thành chế độ nâng cao) không?
3. Joystick: nổi (ẩn mặc định) hay giữ cố định?
4. Thiên đàng lượt đầu: giữ, dời 3/6 câu, hay rút còn 1 chuyên gia?
5. Bản đồ: chọn sẵn Việt Nam cho người mới được không?
6. Ẩn sự cố tới sau 1 giờ được không?
7. Làm lát nào trước (đề xuất: thanh 5 nút + tutorial trước, vì không đụng save và kinh tế)?
8. Cần đo thật: thời gian từ Bắt đầu tới chạm đầu, tới `stats.served = 1`, tỉ lệ Bỏ qua — cần playtest hoặc F-38 analytics (đang chờ D-26).

## Quyết định

**05/11/2026 — Quang uỷ quyền Claude tự quyết 10 câu hỏi; chưa phải Đã chốt, chờ sếp duyệt.** Chi tiết luật, phụ thuộc, tài liệu phải sửa: [shared/mobile-first-proposal.md](../../shared/mobile-first-proposal.md).

| Câu | Quyết định (tóm tắt) |
|---|---|
| 1 Luồng mở đầu | Thiên đàng mini ≤ 5 hộp trước farm. Ba chuyên gia gặp **so le** ở Cổng Hội đồng (farm) / vật Hội đồng (quán): Thần Nông sau lần hái đầu, Pha Chế sau ly đầu, Thương Hội sau ca 2. Câu chưa gặp không bao giờ bị hỏi lại (gỡ BLOCKING hỏi lại chen tutorial) |
| 2 Quà | Bỏ chọn 3 thẻ; mọi người chơi mới nhận Túi hạt giống, 1 chạm trong hộp lời tiễn. Không có Quà Hội đồng. Nơi chỉ quán vẫn tự đổi sang Túi vốn |
| 3 Bản đồ | Lần chọn vùng đầu chọn sẵn Việt Nam, vẫn đổi được; giữ ẩn loại nơi, cảnh báo, khoá vĩnh viễn. Sếp phải chấp nhận đánh đổi nghiêng về loại "cả hai" |
| 4 Trục Cấp | Chỉ chốt **hướng**: cấp mở, xu trả, uy tín đo sức khoẻ quán, Awakening theo sự kiện. XP thợ/robot/tự nhận = 0: chờ sếp quyết là sửa lỗi hay đổi kinh tế (mục 4 câu 3 của đề xuất). Mọi mốc cấp và XP chờ sim |
| 5 Gieo/thu | **Không** gieo/thu cả ruộng một chạm. Kéo-gieo mở từ đầu; bài gieo đầu: chạm 1 ô rồi kéo qua thêm 2 ô. Chạm cây chín là hái ngay (giữ hành vi sẵn có; chỉ đổi nhánh đang cầm công cụ khác thì vẫn hái). Luật AGENTS.md (từng ô sáng viền) giữ nguyên |
| 6 Tự chế biến | Nhận tay từ đầu. "Giỏ tự vào kho" là nấc 2 của chỉ thị Tự chế biến, mở theo cấp (đề xuất 7, chờ sim), mặc định tắt |
| 7 Quán ca tập | Ca tập tự mở khi có hạt chè rang đủ liều, 1 khách V60, không hết giờ, xong ở ly đầu kèm báo cáo tích cực; nút Mở/Đóng khoá tới khi xong ca tập |
| 8 Làm mẫu V60 | Có: dùng hệ 💡/👀 có sẵn, tự bật ở ly V60 tự pha đầu (`v60-guided`), là ly tự pha (không `demo`), chỉ bước chọn bị kẹp 0,8 |
| 9 Sự cố | Ẩn bằng miễn trừ theo cấp gắn với "mở chỗ thợ 2 + 1 cấp" (không ghi cứng số), bật dần, sự cố đầu luôn là Mải chơi; không thêm nút tắt |
| 10 Công trình | 4 công trình: Cửa quán, Bảng đơn, Sạp ven đường, Nhà thợ (+ Cổng Hội đồng của câu 1). **Không** dựng Xưởng nâng cấp; nâng cấp nằm trên từng vật, danh sách tổng trong ≡. Kho giữ nút HUD |

Thay đổi so với đề xuất ban đầu ở file này: bỏ Gieo cả ruộng và Thu cả ruộng một chạm (câu 5), bỏ Xưởng nâng cấp (câu 10), chuyên gia so le thay vì mở cả 6 câu một lúc (câu 1), quà cố định thay vì chọn (câu 2).
