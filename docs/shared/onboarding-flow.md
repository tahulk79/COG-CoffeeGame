# Luồng người chơi mới — 5 phút đầu, HUD mở dần, thiên đàng là bài học

Ngày 03/11/2026. Trạng thái: **đã chốt toàn bộ** (người dùng chốt 03/11: thiên đàng = bài học; đổi tên quà "Bộ dụng cụ pha" → "Gói mở rộng quán", tác dụng giữ quán cấp 2; gộp Quản lý vào tab "Chỉ thị" của Nhân viên, menu dưới tối đa 6 nút; mức mẹo +30 xu, +3 uy tín, ★ ở điểm 40). Không còn điểm chờ chốt. Đã triển khai 03/11/2026 qua /game-team; playtester chơi 3 lượt (mobile 375 px + desktop), lỗi còn lại ghi ở mục "Sau triển khai" cuối file.

## 1. Tóm tắt

Người chơi thật nói "chả hiểu gì", thao tác khó cả mobile lẫn PC. Code xác nhận 6 điểm chặn: (1) gần 3 phút intro + thiên đàng không chạm cây, điểm đúng/sai không có tác dụng; (2) mobile không thấy gợi ý chạm để tiếp hội thoại; (3) HUD farm khoảng 20 nút/bảng ngay lúc vào; (4) chữ nhiệm vụ không khớp nhãn nút; (5) không ai biết bấm thẻ nhiệm vụ để được dẫn đường; (6) điều khiển farm lệch các màn, công cụ cần 4 bước.

Spec này sửa bằng 6 việc. Không thêm hệ thống mới ngoài "mẹo thiên đàng", thứ biến phần câu đố sẵn có thành bài học có tác dụng.

| # | Việc | Trụ cột |
|---|---|---|
| A | Thiên đàng là **bài học**: mỗi câu đúng cho một **mẹo** có số thật ở farm/quán; câu sai được giải thích và hỏi lại đúng lúc ở farm/quán. Thoại cắt từ 32 xuống 23 hộp, hướng dẫn điều khiển ngay khi vào | 1, 3, 4 |
| B | Gợi ý tiếp hội thoại theo thiết bị: "Chạm để tiếp" / "Enter hoặc bấm để tiếp" | 1 |
| C | HUD farm mở dần theo nhiệm vụ; lúc đầu 6 thành phần; save cũ tự hiện đủ | 1, 2 |
| D | Một bộ nhãn duy nhất; viết lại Hướng dẫn trong game theo luật 03/11 | 1 |
| E | Thứ tự nhiệm vụ mới: **Bán ly đầu** lên vị trí 2; báo cách dẫn đường lần đầu (nhấp nháy, chữ, mũi chỉ 3D) | 1, 3 |
| F | Điều khiển: chạm cây = Tự chọn là mặc định, dải công cụ ẩn tới khi có ruộng 2; gợi ý điều khiển lần đầu ở farm; lần đầu vào quán và lần đầu mở quầy pha có hướng dẫn ngắn | 1, 4 |

**Cảm giác muốn có:** ở giây thứ 10 trong farm người chơi biết phải bấm vào đâu; trước phút thứ 5 đã hái quả, rót một ly đúng vạch, thấy xu nhảy; câu trả lời ở thiên đàng hiện lại thành lợi ích nhìn thấy được ("Mắt chọn quả · +5 chất lượng").

## 2. Mốc thời gian mục tiêu (người mới, đọc tốc độ thường)

| Mốc | Hiện nay (ước từ code) | Mục tiêu | Đo bằng |
|---|---|---|---|
| Intro | 23,5 s (`DURATION`), Bỏ qua có sẵn | Giữ 23,5 s; nút Bỏ qua hiện từ giây 0, chạm bất kỳ đâu để tua câu | Đồng hồ |
| Thiên đàng | 32 hộp thoại + ~72 m đi bộ (4 m/s ≈ 18 s), thường 3–4 phút | 23 hộp, đi tự dẫn; **≤ 150 s** từ lúc vào tới khi qua cổng | Đồng hồ |
| Farm → lần hái đầu | Phụ thuộc người chơi tìm cây | **≤ 20 s** sau khi vào farm | Đồng hồ |
| Ly cà phê đầu bán được | Nhiệm vụ thứ 6, thường > 4 phút sau khi vào farm | **≤ 2 phút** sau khi vào farm | `stats.served` |
| Tổng tới ly đầu (từ màn intro) | > 8 phút | **≤ 5 phút** | Đồng hồ |

## 3. Luật

### 3.1. Thiên đàng là bài học (A)

**Giữ:** 3 chuyên gia × 2 câu × 3 đáp án, mỗi câu trả lời một lần trong chương, dấu hoàn thành không phụ thuộc đúng/sai, quà chọn một lần.

**Mẹo (perk) gắn với từng câu.** Câu đúng → mẹo có hiệu lực ngay khi vào farm. Câu sai → giải thích như hiện nay, kèm dòng "Chưa nhận mẹo · sẽ được hỏi lại ở nông trại/quán". Hộp kết quả của mỗi câu luôn ghi tên mẹo và tác dụng, để người chơi hiểu điểm có ý nghĩa.

| Câu (`questionId`) | Mẹo | Tác dụng (công thức ở 4.1) | Hỏi lại khi (nếu chưa thuộc) |
|---|---|---|---|
| `ripe` (Thần Nông) | Mắt chọn quả | Lô quả chín **người chơi tự hái** +5 chất lượng | Ngay sau lần hái tay tiếp theo |
| `water` (Thần Nông) | Đọc độ ẩm | Bình tưới chứa thêm 2 lượt nước | Lần đầu farm vào ngày mưa, hoặc khi người chơi tự đi tới giếng |
| `recipe` (Thần Pha Chế) | Cân đo chuẩn | Phin đen nóng và Cà phê sữa đá bắt đầu ở ★ (điểm luyện tốt nhất tối thiểu 40) | Báo cáo cuối ca quán |
| `adjust` (Thần Pha Chế) | Sửa từng bước | Màn kết quả ly đánh dấu **một** bước mất điểm nhiều nhất: "Sửa bước này trước" kèm lý do thật của bước đó | Lần đầu có ly dưới 70 điểm (tại màn kết quả ly) |
| `costs` (Thần Thương Hội) | Sổ thu chi | +30 xu một lần | Báo cáo cuối ca quán |
| `customer` (Thần Thương Hội) | Giữ chân khách | Uy tín quán +3 một lần (chặn 100) | Lần đầu có khách bỏ về vì hết kiên nhẫn (khi đóng ca) |

**Hỏi lại (học lại sau):**
- Câu hỏi lại dùng đúng câu và đáp án gốc trong `heaven/content.js`, hiện trong khung hội thoại đáy màn hình (cùng component `.dialogue` của thiên đàng), có chân dung chuyên gia. Khung khóa di chuyển, **không** dừng model (thời gian farm/quán vẫn chạy), nên chỉ hiện ở lúc không có áp lực (xem điều kiện dưới).
- Trả lời đúng → nhận mẹo ngay, toast "🎓 Mẹo mới: <tên> · <tác dụng>". Sai → hiện lời giải thích; câu đó không được hỏi lại trong **ngày công hiện tại** (6 phút).
- Tối đa **1 câu hỏi lại mỗi ngày công** trên toàn game (không dồn nhiều câu).
- Chỉ hiện khi: không có modal mở, nhân vật không đang làm việc, không đặt trang trí; ở quán chỉ hiện ở màn báo cáo cuối ca hoặc màn kết quả ly (đã là lúc dừng tay). Không đủ điều kiện thì hoãn tới lần kích hoạt sau.
- **Sổ tay thiên đàng** trong modal Hướng dẫn liệt kê 6 mẹo: ✓ đã thuộc (kèm tác dụng) hoặc "Ôn lại" (bấm để trả lời ngay, cùng giới hạn 1 lần/câu/ngày công). Đây là đường học lại chủ động, không cần chơi lại chương.
- Chơi lại chương thiên đàng (đã có) chỉ đặt lại tiến trình thiên đàng. Mẹo đã thuộc ở farm **không bị mất**; câu đúng ở lượt chơi lại cũng được tính là thuộc. Thưởng một lần (+30 xu, +3 uy tín, ★ khởi đầu) không bao giờ trả hai lần.

**Giảm thời gian chết ở thiên đàng:**
- Vào quảng trường: hiện gợi ý điều khiển ngay (PC: "Bấm mặt đất để đi · Bấm nhân vật để nói chuyện" đã có; **mobile thêm**: "Kéo nút tròn để đi · Chạm nhân vật để nói chuyện"). Gợi ý tắt khi người chơi đã di chuyển một lần, hoặc sau 10 s. Không lưu (chương chỉ đi một lần).
- Thoại: `WELCOME` 5 → 3 câu; lời chào chuyên gia gộp làm dòng mở đầu của hộp câu hỏi 1 (không còn hộp riêng); `REVEAL` 7 → 4 câu; `FAREWELL` 3 → 2 câu. Tổng 32 → 23 hộp. Văn bản cụ thể do người viết thoại chọn, giữ ý: bị kéo nhầm, chỉ ngất, quà và kiến thức được giữ.
- Bước nhận hồ sơ: giữ hai lựa chọn, **focus mặc định** vào "Dẫn tôi tới chuyên gia tiếp theo". Khi chọn dẫn: sau mỗi chuyên gia, nhân vật tự đi tới người tiếp theo (đã có `lead`), sau chuyên gia cuối tự đi tới Thần Tiếp Nhận.
- Bảng chọn quà ghi **số thật**: Túi hạt giống "+6 hạt cà phê vối và 6 túi phân bón"; **Gói mở rộng quán** (tên cũ "Bộ dụng cụ pha", đã chốt đổi; id `tools` giữ nguyên) "Quán lên cấp 2: mở sẵn 4 bàn thay vì 3"; Túi vốn nhỏ "+150 xu". (Hiệu ứng thật lấy từ `model.js` dòng 104 và công thức bàn trong `../screens/04-cafe/gameplay.md`.)
- Màn kết chương hiện "Mẹo đã nhận x/6 · y câu sẽ được ôn lại ở nông trại/quán".

### 3.2. Gợi ý tiếp hội thoại theo thiết bị (B)

- `.dialogue-hint` không còn bị ẩn trên `hover: none`. Chữ theo thiết bị: cảm ứng (`hover: none`) "Chạm để tiếp"; có chuột/bàn phím "Enter hoặc bấm để tiếp".
- Khi đang trả lời câu hỏi hoặc chọn quà, gợi ý đổi thành "Chọn một đáp án" (bấm ngoài vẫn chỉ nháy viền như luật hiện có).
- Áp dụng ở intro, thiên đàng và hộp hỏi lại ở farm/quán.

### 3.3. HUD farm mở dần (C)

Điều kiện mở **dẫn xuất từ state có sẵn**, không thêm trường save. Mỗi dòng mở khi **bất kỳ** điều kiện nào đúng, nên save cũ đã dùng tính năng sẽ thấy ngay.

| Thành phần | Hiện khi | Ghi chú |
|---|---|---|
| Avatar · cấp · XP, thẻ nhiệm vụ, ô xu, 🎒 Kho, ⚙️ Cài đặt, 📖 Hướng dẫn | Luôn hiện | 6 thành phần lúc mới vào. Bấm ô xu vẫn mở Cửa hàng |
| ☕ Vào quán (cụm phải) | Đã nhận nhiệm vụ `harvest` · hoặc `stats.served > 0` · hoặc `cafe.revenue > 0` | Mở cùng lúc thẻ nhiệm vụ chuyển sang Bán ly đầu |
| 🏪 Cửa hàng (menu dưới) | Nhiệm vụ hiện tại là `sell` hoặc sau đó · hoặc `stats.sold > 0` · hoặc có ô trống mà hết giống (mục Cần xử lý "Mua giống") | |
| 📦 Đơn hàng | Nhiệm vụ hiện tại là `ship` hoặc sau đó · hoặc `orders.length > 0` | |
| 🔧 Nâng cấp | Cấp nông trại ≥ 2 · hoặc có hạng mục nâng cấp > 1 | |
| 👩‍🌾 Nhân viên | Đã nhận `expand` · hoặc `workers.length > 0` · hoặc cấp ≥ 3 | **Quản lý (chỉ thị) gộp thành tab "Chỉ thị" trong modal Nhân viên**, không còn nút riêng. Cùng lúc cấp Gói thử robot; toast mở khóa thêm dòng "🎁 Tặng 1 ca robot pha + robot bưng ở quán" (không toast riêng, [robot-staff](robot-staff.md) mục 5) |
| 🏡 Xây dựng | Đã nhận `weed` · hoặc có ít nhất một đồ trang trí · hoặc cấp ≥ 4 | |
| ⛏️ Dải công cụ + kéo nhiều ô | Đã nhận `expand` · hoặc sở hữu ≥ 2 ruộng · hoặc cấp ≥ 3 | Trước mốc này chạm cây luôn là Tự chọn (3.6) |
| Bảng Cần xử lý | Có ≥ 1 mục | **Gập sẵn** trên mọi màn; tiêu đề hiện số mục "Cần xử lý · 2". Mục mới loại khẩn (hết xu trả lương, kho đầy chặn hái) làm tiêu đề nháy 3 lần, không tự mở |
| Bảng Hoạt động | Nhân viên đã mở | Gập sẵn trên mọi màn |
| 🗺️ Thế giới (đang disabled) | Ẩn tới khi có tính năng | |
| 🪙 Thu mua (`farm-market-toggle`, đang ẩn bằng CSS) | Xóa khỏi DOM | Bán ở Cửa hàng → Chợ |
| Nút thu gọn menu ‹ › và mũi tên cuộn ngang | Thu gọn chỉ hiện khi menu dưới ≥ 4 nút; **bỏ mũi tên cuộn** | Menu dưới tối đa 6 nút (Kho, Cửa hàng, Nâng cấp, Nhân viên, Đơn hàng, Xây dựng), mỗi nút ≥ 44 px, vừa màn 360 px (6 × 56 = 336 px) không cuộn |
| Cài đặt | **Một nút duy nhất** ở cụm phải: giữ nút Cài đặt của farm | Hiện có hai nút: ⚙️ chung `#game-settings-toggle` (`src/ui/settings.js`, luôn hiện) và nút settings của farm (`farm/game.js:486`). Trong farm ẩn `#game-settings-toggle`; âm thanh/đồ họa mở qua Cài đặt farm → "Âm thanh & đồ họa" (đã có). Ở intro/thiên đàng/màn chọn nhân vật giữ nút chung |

**Khi một thành phần vừa mở trong lúc chơi:** nút xuất hiện với chấm "Mới" và toast một dòng "🔓 Mở: <tên> · <một câu công dụng>". Chấm mất khi bấm nút lần đầu. Đã báo thì không báo lại (cờ `unlock-<id>` trong `farm.tutorial.seen`).

**Lúc tải save:** thành phần nào đã đủ điều kiện mở ngay khi tải thì được đánh dấu đã báo **mà không hiện toast** (save cũ không bị dội 7 thông báo).

### 3.4. Một bộ nhãn duy nhất (D)

| Khái niệm | Nhãn chốt | Bỏ |
|---|---|---|
| Mở mua giống/vật tư/bán | **Cửa hàng** (tab Cây giống · Vật tư · Chợ) | "Mua giống" (nhãn tĩnh trong `index.html`), "Thu mua", "quầy thu mua" |
| Gửi hạt từ kho farm sang quán | **Chuyển về quán · 2 xu** (nút ở danh sách đơn và chi tiết đơn); hàng loạt: **Chuyển hết** | "Nhận hàng · 2 xu", "Giao", "Giao quán" trong chữ người chơi thấy |
| Lấy mẻ xong ở trạm | **Nhận hàng** / Nhận tất cả | — (chỉ dùng cho trạm) |
| Hạt trong túi | Hạt giống (túi) / Cây giống (cửa hàng) giữ nguyên vì là hai nơi khác nhau | |

Chữ nhiệm vụ trích **đúng nhãn nút** trong ngoặc kép « ». Chữ mới cho `QUESTS` (chỉ đổi `title/detail`, giữ `id/stat/count/coins/xp`):

| id | title | detail |
|---|---|---|
| harvest | Hái lứa quả đầu tiên | Chạm cây có biểu tượng quả chín. Nhân vật tự tới hái. |
| serve | Bán ly cà phê đầu tiên | Quán đã có sẵn 600 g hạt rang. Bấm «Vào quán» → «Mở cửa», đứng ở quầy thu ngân để nhận order, pha ở quầy pha rồi bấm bàn khách. |
| dry | Phơi mẻ cà phê đầu tiên | Chạm sân phơi, chọn số phần rồi «Bắt đầu». Xong chạm giỏ trên sân để «Nhận hàng». |
| roast | Rang một mẻ hạt | Chạm lò rang, «Bắt đầu» với nhân sạch, xong chạm giỏ để «Nhận hàng». |
| sell | Bán thành quả của mình | Mở «Cửa hàng» → tab «Chợ», chọn món và «Bán». |
| ship | Gửi hạt rang về quán | Rang đủ 252 g, mở «Đơn hàng» và bấm «Chuyển về quán · 2 xu». |
| expand | Mua ruộng thứ hai | Chạm biển ruộng cạnh vườn. Đủ xu thì xác nhận mua. |
| water | Chăm lại cây vừa hái | Chạm cây có 💧 để tưới. Hết nước thì tới giếng. |
| weed | Giữ vườn sạch cỏ | Chạm luống có 🌿 để dọn cỏ. |

**Viết lại Hướng dẫn trong game** (`ui.js` `showGuide`, `showSettings`) theo luật hiện hành; các đoạn sai phải sửa:
- "Đội ngũ…": bỏ hợp đồng tuần, nghỉ giữa ca, đội dự bị, "thuê nhiều người". Thay: tối đa 2 thợ vào thẳng farm; lương `30 + 10 × (cấp − 1)` xu mỗi ngày công 6 phút, Tự gia hạn mặc định bật; muốn đổi người thì Cho nghỉ việc.
- "Đơn quán và nhiệm vụ cá nhân": bỏ nhiệm vụ 6 phút. Thay: thẻ nhiệm vụ là chuỗi một lần, chạm thẻ để được dẫn đường; đủ hàng bấm «Chuyển về quán · 2 xu».
- "Sơ chế đúng chuỗi": bỏ câu máy xay farm.
- "Nâng cấp và ao": bỏ "phúc lợi".
- "Chọn và kéo công cụ": đổi thành "Chạm cây để làm việc cây cần (Tự chọn). Từ ruộng thứ 2 mở ⛏️: chọn công cụ, kéo qua nhiều ô rồi thả."
- Thêm mục "Sổ tay thiên đàng" (3.1).
- `setting-team-info`: "Tối đa 2 thợ cùng làm tại farm. Nhiệm vụ chỉ tính thao tác của bạn." `setting-tools`: như mục kéo công cụ ở trên.

### 3.5. Thứ tự nhiệm vụ và báo cách dẫn đường (E)

**Thứ tự mới:** Hái → **Bán ly đầu** → Phơi → Rang → Bán → Gửi hạt về quán → Mua ruộng 2 → Tưới → Làm cỏ.

Lý do:
- Quán đã có lô `starter` 600 g (~30 ly), nên ly đầu không phụ thuộc farm. Đưa lên vị trí 2 đặt phản hồi "rót đúng vạch, tiền nhảy" (trụ cột 1 và 4) trước phút thứ 2.
- Liên kết farm → quán (trụ cột 3) vẫn được dạy ở nhiệm vụ 6: người chơi đã thấy quán dùng hạt, nên hiểu vì sao phải gửi hạt.
- Phơi (30 s) và rang (18 s) có thời gian chờ. Đặt sau quán thì lần chờ đầu rơi vào lúc người chơi đã có việc khác để làm (trồng ô trống bằng giống quà, quay lại quán).
- `dried` chỉ cộng khi Nhận mẻ (`model.js` dòng 456), nên phơi đặt sau Bán ly không làm mất tiến độ.
- Save cũ: thưởng theo `claimed` (id), đổi thứ tự không trả lại thưởng và không xóa thưởng đã nhận. Thẻ hiện nhiệm vụ đầu tiên chưa nhận theo thứ tự mới.

`guideQuest` theo thứ tự mới: `serve` → vào quán (đã có). Các nhánh khác giữ nguyên.

**Báo cách dẫn đường lần đầu:**
- Thẻ nhiệm vụ có dòng thứ ba "👆 Chạm để được dẫn đường" (cảm ứng) / "👆 Bấm để được dẫn đường" (chuột), và viền nhấp nháy chậm (chu kỳ 1,6 s).
- **Mũi chỉ 3D** nổi trên mục tiêu của nhiệm vụ hiện tại (cây chín, sân phơi, lò rang, biển ruộng; nhiệm vụ mở modal hoặc vào quán thì mũi chỉ nằm trên nút HUD tương ứng). Dùng cùng mục tiêu mà `guideQuest` tính.
- Tắt dòng chữ + nhấp nháy khi người chơi chạm thẻ lần đầu (cờ `quest-guide`) **hoặc** đã nhận nhiệm vụ `roast` (tự hiểu rồi). Mũi chỉ 3D tắt cùng mốc; sau đó chỉ hiện trong 6 s mỗi khi người chơi chạm thẻ.
- Giữ dấu › trên thẻ và `title`.

### 3.6. Điều khiển (F)

**Farm, mặc định:** chạm cây = công cụ Tự chọn (`tool = 'auto'`, đã là mặc định): nhân vật tới gần và làm việc cây đang cần nhất. Trước mốc ⛏️ (3.3) **không hiện** nút ⛏️ nổi (`#farm-tools-prompt`) và không có kéo nhiều ô. Giữ nguyên:
- Chạm ô trống → sáng viền đúng ô, nhân vật tới gần, dải icon nhỏ phía dưới để chọn giống, không làm tối map, đổi ô ngay được (AGENTS.md).
- Chạm ô/biển khóa → đi tới biển; đủ tiền và liền kề mới mở xác nhận; thiếu tiền báo số xu thiếu; chỉ trừ khi xác nhận (AGENTS.md).
- Chạm cây không cần việc gì → toast lý do có số ("Cây chưa khát · khoảng 2 phút nữa"), như `guideQuest` đang làm.

**Gợi ý điều khiển lần đầu ở farm** (cờ `controls`): khung nhỏ nền mờ giữa mép dưới, trên joystick, không chặn chạm, có nút ×.
- PC: "Bấm mặt đất để đi · WASD/mũi tên · Cuộn để phóng to · Kéo chuột để xoay".
- Cảm ứng: "Kéo nút tròn để đi · Chạm cây để làm việc · Kéo màn hình để xoay" (farm chưa có pinch zoom; không thêm tính năng này).
- Tắt khi người chơi đã di chuyển **và** làm xong một thao tác, hoặc sau 15 s, hoặc bấm ×. Đã tắt thì không hiện lại; Cài đặt → Điều khiển vẫn có chữ này.
- Bỏ luật `.farm-active .movement-hint{display:none}` cho đúng khung này; khung cũ của thiên đàng không dùng lại trong farm (tránh hai gợi ý chồng nhau).
- Joystick: độ mờ khi rảnh 0,45 → **0,7** trong lúc cờ `controls` chưa bật, sau đó 0,55; khi đang kéo 1.

**Khi mở ⛏️ lần đầu** (cờ `tools`): một dòng trong dải công cụ "Chọn công cụ rồi kéo qua nhiều ô, thả tay để làm". Tắt sau lần thả đầu tiên.

### 3.7. Lần đầu vào quán và lần đầu mở quầy pha

Dùng **thẻ mục tiêu sẵn có của quán** (`cafe/ui.js`, `.cafe-quest`) làm hướng dẫn theo bước, không thêm overlay. Cờ `cafe-intro`. Mỗi bước tự qua khi người chơi làm đúng việc; có mũi chỉ 3D trên điểm tương tác.

| Bước | Chữ trên thẻ | Qua khi |
|---|---|---|
| 1 | Bấm «Mở cửa» để đón khách | Quán mở |
| 2 | Đứng ở quầy thu ngân: bạn **tự nhận order** của khách đầu hàng | Order đầu tiên được nhận |
| 3 | Tới quầy pha để pha món khách gọi | Mở quầy pha |
| 4 | Cầm ly, bấm đúng bàn của khách (khách mang đi: bấm quầy thu ngân) | Bán ly đầu (`stats.served` tăng) |

Đóng quán hoặc rời quán giữa chừng thì lần sau vào tiếp từ bước đang dở (bước dẫn xuất từ state: quán mở chưa, có order chưa, `stats.served`). Khi kho quán dưới 10 g thì gợi ý "Quán chưa có hạt rang…" đã chốt vẫn đứng trước.

**Lần đầu mở quầy pha** (cờ `bench-intro`): một dòng nền vàng trên đầu modal quầy pha: "Mỗi bước: chọn đúng, hoặc giữ nút để rót tới vạch xanh rồi thả. Sai sẽ được giải thích. 💡 Gợi ý giúp nhưng bước đó tối đa 80% điểm." Tắt khi xong bước đầu tiên của ly đầu.

## 4. Số liệu và công thức

### 4.1. Mẹo thiên đàng

`L_x ∈ {0, 1}`: 1 nếu câu `x` nằm trong `farm.lessons.learned`.

| Ký hiệu | Kiểu | Khoảng | Ý nghĩa |
|---|---|---|---|
| `Q_cây` | số | 0–100 | Chất lượng cây lúc hái (`p.quality`) |
| `W_giếng` | số nguyên | cấp giếng 1–20 | Cấp nâng cấp giếng |
| `best` | số | 0–100 | Điểm luyện tốt nhất của món (`cafe.mastery[id].best`) |
| `R` | số | 10–100 | Uy tín quán |

1. **Mắt chọn quả:** `Q_lô = min(100, Q_cây + 5 × L_ripe)` chỉ khi `owner === 'player'`. Kết quả 0–100, không âm. Ví dụ: cây 80 → lô 85. Giá bán `(0,7 + 0,3 × Q/100)`: 0,94 → 0,955 (+1,6%); ly quán lấy 25% chất lượng lô → +1,25 điểm ly → giá ly +0,5%. Nhỏ, ngang hiệu ứng chất lượng của phân bón (+5).
2. **Đọc độ ẩm:** `bình = 6 + 4 × (W_giếng − 1) + 2 × L_water`. Cấp 1: 6 → 8 (+33%); cấp 20: 82 → 84 (+2%). Ảnh hưởng chủ yếu lúc đầu game, lúc tưới tay nhiều nhất.
3. **Cân đo chuẩn:** khi cấp lần đầu: `best_phin-den = max(best, 40)`, `best_nau-da = max(best, 40)` → ★ (≥ 40). **Không** đạt ngưỡng barista (`90 − Trí nhớ × 0,4`, Trí nhớ cao nhất 68 + 4 cấp × 6 = 92 → ngưỡng ≥ 53,2) và không mở pha theo trí nhớ (≥ 90). Không tăng `made`.
4. **Sửa từng bước:** không có số; bench chọn bước có `score` thấp nhất (hòa thì bước đầu tiên), hiển thị lý do `why` của bước đó.
5. **Sổ thu chi:** `coins += 30` một lần (bút toán `quest`, chi tiết "Mẹo thiên đàng: Sổ thu chi").
6. **Giữ chân khách:** `R = min(100, R + 3)` một lần. Uy tín 50 → 53; khoảng cách khách giảm `3 × 0,06 = 0,18 s` (16 s → 15,8 s). Không vượt ngưỡng mở món 55.

**Giới hạn hỏi lại:** `hỏi được(x) = x ∉ learned ∧ asked[x] ≠ ngàyCông ∧ đã hỏi hôm nay < 1`, với `ngàyCông = floor((t − epoch) / WORK_DAY_MS)`. Trường hợp xấu nhất (sai 2 lần với 3 đáp án) là 3 ngày công ≈ 18 phút để thuộc một câu. Đủ chậm để không đoán bừa, đủ nhanh để không thấy mất hẳn.

### 4.2. Nguồn vào / nơi tiêu

| Nguồn | Loại | Tốc độ |
|---|---|---|
| Sổ thu chi | xu | +30 một lần đời save |
| Giữ chân khách | uy tín | +3 một lần đời save |
| Mắt chọn quả | giá trị | +1,6% giá bán sản phẩm từ lô hái tay; 0 với lô thợ hái |
| Đọc độ ẩm | thời gian | Bớt khoảng 1/4 số chuyến ra giếng ở cấp giếng 1 |
| Cân đo chuẩn | ★ hiển thị | Không ra xu trực tiếp |

Không thêm nơi tiêu nào. Tổng nguồn mới lớn nhất là 30 xu một lần, bằng 15% vốn đầu (200) và 20% quà Túi vốn (150). Câu hỏi "tiền dư đi đâu" không đổi so với cân bằng 03/11. Không cần `/balance-check` riêng cho spec này; nếu chỉnh mẹo xu lên trên 100 thì phải chạy.

Dự phóng: ngày 1 (6 phút đầu) có thể thêm tới 30 xu, đúng lúc thiếu xu nhất (mua ruộng 2); ngày 7 và 30 không còn tác động về xu (chỉ còn +2 nước và +5 chất lượng hái tay).

### 4.3. Chiến lược áp đảo và vòng phản hồi

- "Trả lời đúng" luôn tốt hơn sai. Có chủ đích (đây là bài học), và sai vẫn có đường học lại không mất gì vĩnh viễn. Không có lựa chọn nào trong game bị khóa bởi câu sai.
- Không thể nhân thưởng: thưởng một lần ghi theo `questionId` trong `granted`; chơi lại chương không trả lại.
- Không thể đoán bừa nhanh: một câu mỗi ngày công.
- Vòng dương nhỏ có chủ đích: thuộc mẹo → bắt đầu dễ hơn một chút. Không cần hãm vì tác dụng đã chặn trần (một lần hoặc theo %).
- Thứ tự nhiệm vụ mới không thêm thưởng: tổng xu/XP của chuỗi giữ nguyên (90 xu, 40 XP).

### 4.4. Tiến trình mở khóa (người chơi mẫu)

| Thời điểm sau khi vào farm | Mở | Khoảng chết |
|---|---|---|
| 0 s | Thẻ nhiệm vụ, xu, Kho, Cài đặt, Hướng dẫn, gợi ý điều khiển | — |
| ~20 s (hái xong) | ☕ Vào quán | — |
| ~2 phút | Ly đầu; bước hướng dẫn quán xong | — |
| ~3 phút | Phơi, rang; cấp 2 → 🔧 Nâng cấp | — |
| ~4 phút | 🏪 Cửa hàng (nhiệm vụ Bán) | — |
| ~5 phút | 📦 Đơn hàng (nhiệm vụ Gửi hạt) | — |
| ~6–8 phút | Mua ruộng 2 → 👩‍🌾 Nhân viên, ⛏️ Dải công cụ | — |
| ~10–14 phút | Tưới, làm cỏ → 🏡 Xây dựng | Chờ cây khát 6–8 phút đã có việc ruộng 2/quán lấp |

Không có cú nhảy sức mạnh: mở khóa chỉ là hiện nút, không cấp tài nguyên.

### 4.5. Ngân sách chú ý

| Màn | Hiện nay | Sau spec |
|---|---|---|
| Farm lúc mới vào | ~20 nút/bảng (2 bảng mở sẵn trên desktop, menu cuộn ngang, ⛏️ nổi) | 6 thành phần, 3 thứ cần theo dõi: thẻ nhiệm vụ, xu, Kho |
| Farm đầy đủ | 7 nút menu + 4 nút phải + 2 bảng mở | 6 nút menu + 3 nút phải, 2 bảng gập có số |
| Thiên đàng | Thẻ nhiệm vụ + 3 huy hiệu | Giữ; thêm 1 dòng gợi ý điều khiển 10 s đầu |
| Quán lần đầu | Thẻ mục tiêu chung | Cùng thẻ, chữ theo bước |

Hệ mới (mẹo) không thêm thứ phải theo dõi liên tục: nó chỉ xuất hiện như câu hỏi tối đa 1 lần/ngày công và một mục trong Hướng dẫn.

## 5. Trường hợp biên

| Tình huống | Hành vi |
|---|---|
| Tải lại giữa intro | Như hiện nay (về màn chọn nhân vật nếu chưa `introCompleted`). |
| Tải lại giữa thiên đàng | Giữ câu đã trả lời và dấu (hiện có). Câu đã trả lời không hỏi lại trong chương. Gợi ý điều khiển hiện lại khi vào (không lưu, 10 s). |
| Tải lại sau khi trả lời sai, trước khi vào farm | Câu sai vẫn ở `heaven.answers` với `correct: false`; vào farm nó nằm trong danh sách hỏi lại. |
| Save cũ đã qua thiên đàng (chưa có `farm.lessons`) | Lần tải đầu: `learned` = các câu đúng trong `heaven.answers`; cấp thưởng một lần cho những câu này (+30 xu, +3 uy tín, ★ khởi đầu nếu đúng), ghi một dòng Hoạt động "Mẹo từ thiên đàng: …". Câu sai vào danh sách hỏi lại. |
| Save có farm nhưng không có `heaven` (save rất cũ/dev) | `learned = []`; cả 6 câu chờ hỏi lại; Sổ tay hiện đủ 6. |
| Save cũ đã xong nhiều nhiệm vụ | HUD hiện theo bảng 3.3 ngay (điều kiện "hoặc" theo state), không toast. Cờ `controls`, `quest-guide`: nếu `claimed` đã có `roast` thì coi như đã thấy. `cafe-intro`: coi như đã thấy nếu `stats.served > 0`. `bench-intro`: coi như đã thấy nếu có bất kỳ `cafe.mastery`. |
| Save cũ đã xong cả chuỗi (`farm.quest === null`) | Không hiện chữ dẫn đường, không mũi chỉ nhiệm vụ. |
| Save cũ đang ở giữa chuỗi khi thứ tự đổi | Thẻ hiện nhiệm vụ đầu tiên chưa nhận theo thứ tự mới (vd. đã nhận harvest/dry/roast → thẻ là Bán ly đầu). Không trả/xóa thưởng. |
| Đã có `stats.served > 0` nhưng `claimed` chưa có `serve` | `rewards()` tự trả khi tick tiếp theo, như hiện nay. |
| Quán hết hạt khi đang ở bước hướng dẫn quán | Gợi ý thiếu hạt đứng trước; bước hướng dẫn tạm ẩn, quay lại khi có hạt. |
| Thiếu xu khi nhận thưởng mẹo | Không áp dụng (chỉ cộng). |
| Uy tín đang 99 khi nhận Giữ chân khách | Chặn ở 100. |
| Kho đầy khi hái (Mắt chọn quả) | Luật kho đầy có sẵn chặn hái; mẹo không đổi luật này. |
| Câu hỏi lại đến đúng lúc mở modal/làm việc | Hoãn; không xếp hàng đợi nhiều câu. |
| Đóng game khi đang hiện câu hỏi lại | Không ghi gì; lần kích hoạt sau hỏi lại (không bị tính là đã hỏi hôm nay). |
| Offline lâu (tới 8 giờ) | Không có câu hỏi hay toast mở khóa nào phát sinh offline. Lúc quay lại, mở khóa đã đủ điều kiện hiện không toast nếu ≥ 2 mục cùng lúc (gộp thành một toast "🔓 Mở 2 tính năng mới"). |
| localStorage bị chặn | Cờ hướng dẫn và mẹo chỉ giữ trong lượt chơi; gợi ý có thể hiện lại lần sau. Không chặn chơi. |
| Chơi lại chương thiên đàng | Đặt lại `heaven.*` như hiện nay. Không xóa `farm.lessons`. Câu đúng mới được thêm vào `learned` khi vào lại farm; thưởng một lần không lặp. |
| Màn ngang điện thoại (cao ≤ 450 px) | Gợi ý điều khiển và dòng "Chạm để được dẫn đường" rút còn một dòng; menu dưới 6 nút vẫn không cuộn. |

## 6. Hợp đồng dữ liệu

Chi tiết trong [contracts](contracts.md) mục 5. Tóm tắt:

- Trường mới trong `farm`: `lessons { learned[], granted[], asked{}, askedDay, askedCount }` và `tutorial { seen[] }`. Không tăng `version` của save chính hay của farm.
- Hành động mới: `farm.act('lessons', 'answer', { questionId, optionId })`, `farm.act('tutorial', 'seen', id)`.
- Chữ ký: `createFarm(saved, startingGift, onSave, now, heavenLessons = [])`, `createFarmGame(player, gift, heavenLessons)`. `app/game.js` lấy `heavenLessons` qua hàm mới `correctQuestionIds(heaven)` của `features/heaven/journey.js`.
- Mở khóa HUD dẫn xuất từ state, không có trường lưu.

## 7. Núm chỉnh

| Hằng số | Mặc định | Khoảng an toàn | Tác động | File |
|---|---|---|---|---|
| Chất lượng Mắt chọn quả | +5 | 3–10 | Trên 10 lấn hiệu ứng phân bón | `farm/model.js` (`harvest`) |
| Nước Đọc độ ẩm | +2 | 1–4 | Trên 4 làm giếng cấp 1–2 vô nghĩa | `farm/model.js` (`waterCapacity`) |
| ★ khởi đầu | 40 | 40–69 | Từ 53 trở lên có barista Trí nhớ cao pha được ngay → bỏ qua luyện | `farm/model.js` (cấp mẹo) |
| Xu Sổ thu chi | 30 | 0–100 | Trên 100 cần chạy `/balance-check` | `farm/model.js` |
| Uy tín Giữ chân khách | 3 | 1–4 | Từ 5 trở lên vượt ngưỡng món 55 ngay | `farm/model.js` |
| Câu hỏi lại mỗi ngày công | 1 | 1–2 | Lớn hơn thành phiền | `farm/model.js` |
| Gợi ý điều khiển tự tắt | 15 s farm, 10 s thiên đàng | 8–20 s | Ngắn quá người mới không kịp đọc | `farm/ui.js`, `heaven/ui.js` |
| Mốc tắt chữ dẫn đường | nhận `roast` | `dry`…`ship` | Sớm quá người mới chưa thấy | `farm/game.js` |
| Mốc mở HUD | bảng 3.3 | — | Mở muộn = thiếu công cụ; sớm = quá tải | `farm/content.js` (bảng `HUD_UNLOCKS`) |
| Độ mờ joystick rảnh | 0,7 → 0,55 | 0,5–0,8 | Thấp quá không thấy | `ui/styles/farm.css` |

## 8. Kịch bản liên màn

1. **Thiên đàng → farm (mẹo):** trả lời 6 câu → `saveHeaven` ghi `heaven.answers` → qua cổng → `app/game.js` gọi `correctQuestionIds` → `createFarmGame(..., heavenLessons)` → `createFarm` hợp `learned`, cấp thưởng, ghi `granted`, `commit()`. Người chơi thấy toast "Quà thiên đàng…" + "🎓 4 mẹo đang có tác dụng". Chỗ gãy: tải lại ngay sau cổng trước `commit` → lần tải sau `granted` rỗng → cấp lại đúng một lần (chưa từng lưu nên không trùng). Hai bên không cùng ghi: heaven chỉ ghi `heaven`, farm chỉ ghi `farm.lessons`.
2. **Hái → quán → bán ly đầu:** hái (quest harvest) → ☕ hiện + toast mở khóa → thẻ "Bán ly đầu" có mũi chỉ trên ☕ → vào quán → thẻ quán bước 1–4 → `cafe/sell` → `stats.served++` → `rewards()` trả 15 xu. Dữ liệu: `cafe.lots` (starter), `stats`, `claimed`, `tutorial.seen` (`cafe-intro`). Chỗ gãy: rời quán ở bước 3 → khách bỏ về (uy tín −1, luật có sẵn); vào lại tiếp bước dẫn xuất từ state.
3. **Ly kém → học lại tại quầy:** ly 62 điểm → màn kết quả; nếu `adjust` chưa thuộc và đủ điều kiện hỏi → khung hỏi lại Thần Pha Chế → đúng → `act('lessons','answer')` → `learned` thêm `adjust` → ngay ly sau màn kết quả có "Sửa bước này trước". Chỗ gãy: model chấm đúng/sai bằng `heaven/content.js` (nguồn duy nhất), UI không tự chấm.
4. **Gửi hạt về quán (nhãn thống nhất):** thẻ Gửi hạt → `guideQuest` kiểm 252 g → mở Đơn hàng → nút «Chuyển về quán · 2 xu» → `orders/shipOrder` → `cafe.shipments` → tới nơi `stats.delivered++`. Chữ thẻ và nút giống nhau từng chữ.
5. **Mua ruộng 2 → mở quản lý:** xác nhận ở biển → `fields` có 2 → 👩‍🌾 Nhân viên và ⛏️ hiện cùng lúc, một toast gộp → lần đầu mở ⛏️ có dòng hướng dẫn kéo. Thuê thợ đầu → Hoạt động hiện (gập), đơn quán bắt đầu sinh (luật có sẵn).

## 9. Checklist nghiệm thu

Chạy trên **khung điện thoại 390 × 844 (cảm ứng)** và **desktop 1440 × 900 (chuột)** trừ khi ghi khác. Save mới = xóa `godbean-progress`.

| # | Kịch bản | Bước | Mong đợi (trước → sau) |
|---|---|---|---|
| 1 | Tổng thời gian tới ly đầu | Save mới, chơi không bỏ qua, đọc bình thường, theo thẻ nhiệm vụ | Từ lúc intro bắt đầu tới `stats.served = 1`: > 8 phút → **≤ 5 phút**. Thiên đàng ≤ 150 s |
| 2 | Số hộp thoại thiên đàng | Đếm số lần bấm tiếp từ gặp Thần Chết tới qua cổng | 32 → **23** |
| 3 | Gợi ý chạm trên mobile | Điện thoại, mở hội thoại bất kỳ | Gợi ý bị ẩn → hiện "Chạm để tiếp". Desktop: "Enter hoặc bấm để tiếp". Khi đang có câu hỏi: "Chọn một đáp án" |
| 4 | Gợi ý điều khiển thiên đàng | Điện thoại, vào quảng trường | Không có chữ → hiện "Kéo nút tròn để đi · Chạm nhân vật để nói chuyện"; mất sau lần kéo đầu hoặc 10 s |
| 5 | Mẹo khi đúng hết | Trả lời đúng 6 câu, chọn Túi vốn | Vào farm: xu = 200 + 150 + 30 = **380**; uy tín quán 50 → **53**; bình tưới cấp 1: 6 → **8**; Phin đen và Sữa đá hiện ★ trong danh sách món; hái tay cây chất lượng 80 → lô **85** (xem trong Kho) |
| 6 | Mẹo khi sai hết | Trả lời sai 6 câu, chọn Túi vốn | Xu = **350**; uy tín 50; bình 6; món không có ★. Mỗi hộp kết quả câu ghi "Chưa nhận mẹo · sẽ được hỏi lại" |
| 7 | Hỏi lại ở farm | Từ kịch bản 6, hái tay một cây | Khung hỏi Thần Nông câu `ripe` hiện sau khi hái. Trả lời đúng → toast mẹo; lần hái sau lô +5. Trả lời sai → không hỏi lại câu đó trong ngày công hiện tại (đợi tới mốc 6 phút mới hỏi) |
| 8 | Giới hạn 1 câu/ngày công | Từ kịch bản 6, trong cùng ngày công hái + tới giếng + đóng ca quán | Chỉ **1** câu hỏi lại hiện trong ngày công đó |
| 9 | Sổ tay | Mở Hướng dẫn → Sổ tay thiên đàng | 6 dòng; số dòng ✓ bằng số câu đã thuộc; "Ôn lại" mở câu ngay; đã trả lời sai hôm nay thì nút báo "Ôn lại sau x phút" |
| 10 | Không nhân thưởng | Đúng `costs` → chơi lại chương thiên đàng → đúng `costs` lần nữa → vào farm | Xu không tăng thêm 30 lần thứ hai |
| 11 | HUD lúc mới vào | Save mới, vào farm | Đếm nút/bảng thấy được: ~20 → **6** (avatar/XP, thẻ nhiệm vụ, xu, Kho, Cài đặt, Hướng dẫn). Không bảng Cần xử lý/Hoạt động, không ⛏️, không menu cuộn |
| 12 | HUD mở dần | Chơi theo chuỗi | Hái xong → ☕ + toast "🔓 Mở: Vào quán"; cấp 2 → 🔧; tới nhiệm vụ Bán → 🏪; tới Gửi hạt → 📦; mua ruộng 2 → 👩‍🌾 và ⛏️ (một toast gộp); nhận Làm cỏ → 🏡. Mỗi nút mới có chấm "Mới" tới lần bấm đầu |
| 13 | Save cũ đủ HUD | Dùng save đã có 2 ruộng, 1 thợ, cấp 5 | Tải: thấy đủ 6 nút menu + 3 nút phải ngay; **0** toast mở khóa; không có nút Quản lý riêng (tab Chỉ thị trong Nhân viên) |
| 14 | Menu không cuộn | 360 × 740, HUD đầy đủ | Menu dưới 6 nút, không có mũi tên cuộn, không cuộn ngang; mỗi nút ≥ 44 px |
| 15 | Một nút Cài đặt | Farm, HUD đầy đủ | Đếm nút ⚙️ thấy được: 2 → **1** |
| 16 | Nhãn khớp | Đọc thẻ nhiệm vụ Bán và Gửi hạt, rồi tìm nút | «Cửa hàng», «Chợ», «Bán», «Đơn hàng», «Chuyển về quán · 2 xu» có đúng từng chữ trên nút. Không còn chữ "Thu mua", "Mua giống" trên nút menu, "Nhận hàng · 2 xu" |
| 17 | Hướng dẫn đúng luật | Mở Hướng dẫn và Cài đặt → Thông tin | Không còn chữ "dự bị", "hợp đồng tuần", "nghỉ giữa ca", "máy xay farm", "phúc lợi", "đổi mới mỗi 6 phút" |
| 18 | Thứ tự nhiệm vụ | Save mới, hái một cây | Thẻ đổi từ Hái sang **Bán ly cà phê đầu tiên** (trước đây: Phơi) |
| 19 | Save giữa chuỗi | Save có `claimed = [harvest, dry, roast]` | Thẻ hiện Bán ly đầu; xu không đổi khi tải |
| 20 | Báo dẫn đường | Save mới, vào farm, không chạm thẻ | Thẻ nhấp nháy, có dòng "👆 Chạm để được dẫn đường" (mobile) / "Bấm…" (desktop); mũi chỉ 3D trên cây chín. Chạm thẻ một lần → dòng chữ và nhấp nháy tắt, tải lại không hiện lại |
| 21 | Tắt dẫn đường tự động | Không chạm thẻ lần nào, chơi tới khi nhận Rang | Chữ và nhấp nháy tắt khi nhận Rang |
| 22 | Chạm cây = tự làm | Save mới, chạm cây chín | Nhân vật tới và hái; không cần mở ⛏️. Chạm ô trống → sáng viền ô, dải icon giống phía dưới, map không tối |
| 23 | Gợi ý điều khiển farm | Save mới vào farm, PC rồi mobile | Hiện đúng chữ theo thiết bị; tắt sau khi đã đi + làm 1 việc, hoặc 15 s, hoặc ×; tải lại không hiện |
| 24 | Mua ruộng giữ luật | Thiếu xu, chạm ruộng khóa | Nhân vật tới biển; báo "Thiếu x xu"; không trừ xu |
| 25 | Lần đầu vào quán | Save mới, vào quán | Thẻ quán chạy đúng 4 bước 3.7; tới quầy thu ngân thì order tự nhận trong ≤ 0,5 s; xong bước 4 thì thẻ về gợi ý thường. Vào lại lần sau không hiện bước 1 |
| 26 | Lần đầu mở quầy pha | Mở quầy pha lần đầu | Dòng hướng dẫn hiện; mất sau bước đầu; mở lần 2 không có |
| 27 | Mô tả quà | Tới bước chọn quà | Ba thẻ ghi đúng "+6 hạt cà phê vối và 6 túi phân bón" / "Quán lên cấp 2: mở sẵn 4 bàn thay vì 3" / "+150 xu" |
| 28 | Save cũ chưa có `lessons` | Save đã qua thiên đàng với 4 câu đúng (có `costs`), tải bản mới | Xu +30 đúng một lần (tải lại lần 2 không cộng); Hoạt động có dòng "Mẹo từ thiên đàng"; Sổ tay ✓ 4/6 |

## 10. Chia việc theo vùng file

| Vai | File | Việc |
|---|---|---|
| **integrator** | `src/app/game.js`, `src/state/progress.js`, `src/features/heaven/journey.js`, `docs/shared/contracts.md` | Thêm `correctQuestionIds(heaven)` trong journey; truyền `heavenLessons` vào `createFarmGame` ở cả hai đường (qua cổng, tải save); không đổi key/version |
| **farm-dev** | `src/features/farm/model.js`, `content.js`, `game.js`, `blockers.js` | `lessons`/`tutorial` (chuẩn hóa, chuyển save cũ, cấp thưởng một lần, `act('lessons')`, `act('tutorial')`); mẹo `ripe`/`water`/`recipe`/`costs`/`customer`; giới hạn hỏi lại; `QUESTS` thứ tự + chữ mới; bảng `HUD_UNLOCKS`; mục tiêu mũi chỉ dùng chung với `guideQuest`; nhãn «Chuyển về quán · 2 xu» ở `game.js:247`; kích hoạt hỏi lại ở farm |
| **cafe-dev** | `src/features/cafe/ui.js`, `bench.js`, `service.js`, `game.js` | 4 bước hướng dẫn trên `.cafe-quest`; dòng `bench-intro`; "Sửa bước này trước" khi thuộc `adjust`; kích hoạt hỏi lại ở báo cáo cuối ca/màn kết quả ly; đọc `lessons`/`tutorial` qua `farm.peek()`, ghi qua `act` |
| **ui-stylist** | `src/features/farm/ui.js`, `index.html`, `src/ui/styles/farm.css`, `dialogue.css`, `heaven.css`, `src/features/heaven/ui.js`, `src/features/heaven/content.js` (chỉ chữ) | Ẩn/hiện HUD theo `HUD_UNLOCKS`, chấm "Mới", toast mở khóa; bỏ mũi tên cuộn menu, gộp Quản lý vào Nhân viên, xóa Thu mua/Thế giới, một nút Cài đặt; bảng gập có số; gợi ý điều khiển farm + thiên đàng mobile; `.dialogue-hint` theo thiết bị; thẻ nhiệm vụ nhấp nháy + dòng dẫn đường; viết lại Hướng dẫn/Cài đặt + Sổ tay; thoại thiên đàng 23 hộp, mô tả quà, dòng mẹo ở hộp kết quả |
| **asset-3d** | `src/shared/world/scene.js` (slot), `public/models/` | Slot `farm/quest-arrow` và `cafe/quest-arrow` (mũi chỉ nổi, khối tạm trước, nhún lên xuống 1 Hz); tái dùng ở thiên đàng nếu đã có mũi chỉ |

**Thứ tự phụ thuộc:**
1. integrator: hợp đồng + truyền `heavenLessons` (chặn farm-dev).
2. farm-dev: model `lessons`/`tutorial`, `QUESTS`, `HUD_UNLOCKS` (chặn ui-stylist và cafe-dev).
3. Song song: ui-stylist (HUD, hint, chữ, thoại), cafe-dev (hướng dẫn quán, bench), asset-3d (mũi chỉ; ui-stylist dùng khối tạm nếu chưa có).
4. Playtester chạy checklist mục 9 (chỉ trong `/game-team`).

## 11. Ngoài phạm vi

Không đổi luật kinh tế, giá, sản lượng, lương. Không thêm nút bỏ qua thiên đàng (đã chốt là bài học). Không làm pinch zoom (farm chưa có, không thêm trong spec này). Không lưu bật/tắt bảng HUD qua lần mở game (vẫn là điểm chưa chốt ở guide mục 9).

## Sau triển khai (03/11/2026)

Playtester chạy 3 lượt. Đạt: thiên đàng là bài học (mẹo, hỏi lại, Enter không chọn đáp án, tự tới cổng), HUD mới vào 6 thành phần, thẻ nhiệm vụ dẫn đường, chấm "Mới", 4 bước quán, ca tập không trừ uy tín, giữ 252 g cho quán, reload không lặp thưởng.

Sửa sau lượt 3, chưa chơi lại: hàng thẻ modal farm cao theo nội dung (`grid-auto-rows:max-content`) để nút «Bắt đầu»/giá mua/nâng cấp không bị thẻ dưới đè trên 375 px; báo cáo hết ca dùng câu thật của ca tập; toast "Chưa có khách tới quầy" không hiện khi khách đang đi vào.

Còn mở: kho đúng 252 g thì Chợ vẫn cho bán 1 g (chủ ý: người chơi tự quyết); reload ở thiên đàng làm mất chế độ tự dẫn tới chuyên gia kế (sau khi chọn quà vẫn tự tới cổng); chưa kiểm Gửi hạt → Mua ruộng → Tưới/Làm cỏ và màn desktop đầy đủ ở lượt cuối.
