# Bản đồ thế giới theo thành phố

> Nguồn: tài liệu văn hóa cà phê theo quốc gia do anh gửi ngày 2026-11-07. **Đây là nguồn chuẩn cho bản đồ từ nay về sau.**
> Dữ liệu trong code: `src/core/config/world.js` (quốc gia, thành phố, toạ độ, giá, game), `src/features/world-map/content.js`
> (đường biên quốc gia), `src/i18n/locales/world-cities.js` (tên thành phố, nét riêng, văn hóa, menu — en + vi).

## Luật

- Bản đồ chọn theo **thành phố**. Một quốc gia có 3–6 thành phố; mỗi thành phố là một "vùng" chơi riêng (save riêng, mở riêng bằng xu).
- Id vùng vẫn là `<mã quốc gia>-<số thứ tự thành phố>` (vd. `jp-1` = Tokyo, `vn-2` = TP.HCM), theo đúng thứ tự trong tài liệu.
  Giữ dạng id này để save cũ `vn-1`, `jp-1`, `us-1`, `br-1`, `id-1` vẫn hợp lệ.
- Giá mở thành phố thứ n = giá gốc quốc gia × hệ số (1 · 1.4 · 1.8 · 2.3 · 2.8 · 3.3). Vùng đầu tiên của game miễn phí; sau sự kiện Level 10 được mở miễn phí thêm 1 vùng.
- Game (nông trại / quán): mặc định theo quốc gia, có thể ghi đè theo thành phố (vd. Côn Minh có nông trại vì là vùng trồng Vân Nam).
  Nước trồng cà phê (VN, Brazil, Indonesia, Ấn Độ) có cả nông trại + quán; các nước còn lại chỉ có quán.
- Bỏ khỏi bản đồ: Colombia, Ý (không có trong tài liệu). Save cũ ở các nước này được chuyển sang: `co-1 → br-3` (Belo Horizonte), `it-1 → fr-1` (Paris). Kenya đã quay lại (châu Phi) nên `ke-1` giữ nguyên.
- Menu, nhịp uống, lưu ý là thông tin **cấp quốc gia** (tài liệu ghi: "Menu minh họa ở cấp quốc gia, chưa xác minh theo từng thành phố").
- **Bản đồ chỉ hiện**: tên quốc gia, danh sách thành phố (khung ở góc) với dòng nét riêng dưới tên thành phố.
  Không vẽ pin thành phố trên bản đồ. Giới thiệu, nhịp uống, lưu ý, menu **không hiện trên bản đồ** — lưu ngầm trong
  `world-cities.js` (`culture.<cc>.*`) để dùng sau.
- **Menu nối vào quán** (`src/core/config/menus.js`): mỗi món địa phương thuộc 1 trong 3 món gốc của quán
  (espresso = cà phê đen đơn giản · cà phê sữa = có sữa/ngọt · latte = espresso-sữa & đặc sản). Khách chọn món gốc như cũ
  (theo cấp mở khóa), rồi chọn một món địa phương cùng loại của quốc gia đang đứng. Giá, số hạt, thời gian pha, XP vẫn theo món gốc.
  Món địa phương hiện ở bong bóng khách (icon), lời dẫn tự động chơi, và trong bảng Menu (dưới mỗi món gốc).

## Danh sách quốc gia (theo thứ tự tài liệu)

| Mã | Quốc gia | Thành phố (id 1 → n) |
|---|---|---|
| jp | 🇯🇵 Nhật Bản | Tokyo · Kyoto · Osaka · Nagoya |
| fr | 🇫🇷 Pháp | Paris · Lyon · Marseille · Bordeaux |
| gb | 🇬🇧 Anh | London · Manchester · Edinburgh · Bristol |
| us | 🇺🇸 Mỹ | New York · Seattle · Los Angeles · San Francisco · Chicago |
| au | 🇦🇺 Úc | Melbourne · Sydney · Brisbane · Perth |
| de | 🇩🇪 Đức | Berlin · Hamburg · Munich · Cologne |
| tr | 🇹🇷 Thổ Nhĩ Kỳ | Istanbul · Ankara · Izmir |
| sa | 🇸🇦 Ả Rập Saudi | Riyadh · Jeddah · Dammam · Al Khobar |
| vn | 🇻🇳 Việt Nam | Hà Nội · TP.HCM · Đà Nẵng · Huế |
| cn | 🇨🇳 Trung Quốc | Thượng Hải · Bắc Kinh · Thâm Quyến · Thành Đô · Côn Minh |
| br | 🇧🇷 Brazil | São Paulo · Rio de Janeiro · Belo Horizonte · Curitiba |
| in | 🇮🇳 Ấn Độ | Mumbai · Delhi · Bengaluru · Chennai · Hyderabad |
| ca | 🇨🇦 Canada | Toronto · Vancouver · Montreal · Calgary |
| kr | 🇰🇷 Hàn Quốc | Seoul · Busan · Daegu · Incheon |
| tw | 🇹🇼 Đài Loan | Đài Bắc · Đài Trung · Cao Hùng · Đài Nam |
| id | 🇮🇩 Indonesia | Jakarta · Bandung · Yogyakarta · Surabaya · Medan |
| my | 🇲🇾 Malaysia | Kuala Lumpur · Penang · Ipoh · Johor Bahru |
| ru | 🇷🇺 Nga | Moscow · Saint Petersburg · Kazan · Novosibirsk |
| et | 🇪🇹 Ethiopia | ☕ Addis Ababa · Dire Dawa · 🌱 Sidama · Yirgacheffe · Jimma · Guji |
| ke | 🇰🇪 Kenya | ☕ Nairobi · Mombasa · Nakuru · 🌱 Nyeri · Kirinyaga · Kiambu |
| ug | 🇺🇬 Uganda | ☕ Kampala · Entebbe · Jinja · 🌱 Bugisu (Mt. Elgon) · Kasese · Masaka |
| tz | 🇹🇿 Tanzania | ☕ Dar es Salaam · Arusha · Dodoma · 🌱 Kilimanjaro · Mbeya · Kagera |
| rw | 🇷🇼 Rwanda | ☕ Kigali · Musanze · Rubavu · 🌱 Huye · Nyamasheke · Rutsiro |
| bi | 🇧🇮 Burundi | ☕ Bujumbura · Gitega · 🌱 Kayanza · Ngozi · Muyinga |
| ci | 🇨🇮 Bờ Biển Ngà | ☕ Abidjan · Yamoussoukro · 🌱 Daloa · Gagnoa |
| za | 🇿🇦 Nam Phi | ☕ Johannesburg · Cape Town · Durban (chỉ có quán) |

26 quốc gia, 117 thành phố.

**Châu Phi** (anh gửi thêm ngày 2026-11-07): cột đầu là thành phố có quán (☕ chỉ quán), cột sau là vùng trồng cà phê
(🌱 chỉ nông trại). Nam Phi chủ yếu café nên chỉ có quán. Thành phố thứ 6 có hệ số giá ×3.3. Kenya quay lại bản đồ nên
save cũ `ke-1` không còn bị chuyển sang Bengaluru nữa (giờ là Nairobi). Đường biên các nước Đông Phi dùng chung điểm biên.
Nhịp uống, lưu ý và menu châu Phi là bản mẫu do Claude viết (anh chưa gửi), xem/sửa trong `world-cities.js` và `menus.js`.

## Nội dung từng quốc gia

Mỗi mục: giới thiệu · nét riêng từng thành phố · nhịp uống cà phê · thói quen & lưu ý · menu tham khảo.
"—" = tài liệu chưa có nét riêng cho thành phố đó (chỉ lặp lại câu giới thiệu quốc gia) → **cần bổ sung sau**.

### 🇯🇵 Nhật Bản (jp)
Kissaten cổ điển, quán specialty chú trọng kỹ thuật, cà phê lon và cửa hàng tiện lợi cùng tồn tại. Nagoya nổi tiếng morning set.
- Tokyo — specialty và chuỗi · Kyoto — kissaten/nhà cổ · Osaka — quán bình dân, iced coffee · Nagoya — morning set
- Nhịp uống: Sáng uống kèm bánh mì/trứng; trưa mua mang đi; chiều ngồi yên, đọc sách hoặc gặp bạn. Một số kissaten chuộng rang đậm và syphon/nel drip.
- Lưu ý: Tôn trọng không gian yên tĩnh tại quán nghe nhạc; không mặc định quán nào cũng cho làm việc lâu.
- Menu (7): Blend coffee (ブレンドコーヒー) · hand drip · iced coffee (アイスコーヒー) · café au lait · latte · cold brew · canned coffee

### 🇫🇷 Pháp (fr)
Café vỉa hè, quầy bar và bánh ngọt là không gian giao tiếp đô thị; espresso thường nhỏ, nhanh. Specialty tăng hiện diện tại các thành phố lớn.
- Paris — terrace và specialty · Lyon — café khu phố · Marseille — espresso và giao thoa Địa Trung Hải · Bordeaux — café–pâtisserie
- Nhịp uống: Sáng café crème hoặc espresso với croissant; sau bữa ăn thường espresso; ngồi sân hiên quan sát phố.
- Lưu ý: Café au lait thường gắn với bữa sáng; noisette là espresso thêm chút sữa, không phải siro hạt phỉ.
- Menu (7): Un café / expresso · café crème · noisette · allongé · café au lait · cappuccino · filtre

### 🇬🇧 Anh (gb)
Café chuỗi, takeaway và specialty espresso; flat white rất phổ biến ở đô thị, song văn hóa trà vẫn quan trọng.
- London — specialty đa dạng · Manchester — independent café · Edinburgh — quán nhỏ và bánh · Bristol — rang xay thủ công
- Nhịp uống: Sáng cà phê mang đi trên đường đi làm; brunch cuối tuần; quán là nơi gặp gỡ hoặc làm việc.
- Lưu ý: Flat white thường nhỏ và đậm vị hơn latte, nhưng công thức thay đổi theo quán.
- Menu (8): Flat white · latte · cappuccino · americano · espresso · filter coffee · iced latte · cold brew

### 🇺🇸 Mỹ (us)
Từ diner refill và drip coffee tới chuỗi lớn, drive-through, specialty và đồ uống tùy biến.
- New York — coffee-to-go · Seattle — espresso/roastery · Los Angeles — — · San Francisco — — · Chicago — diner và specialty
- Nhịp uống: Sáng cốc lớn mang đi; cả ngày dùng drip/iced coffee; cuối tuần brunch; nhu cầu đồ uống lạnh mạnh.
- Lưu ý: Đồ uống nhiều cỡ và tùy biến sữa/siro; không coi mọi quán Mỹ là đồ uống ngọt.
- Menu (8): Drip coffee · americano · latte · cold brew · iced coffee · flavored latte · mocha · nitro cold brew

### 🇦🇺 Úc (au)
Văn hóa quán độc lập, espresso chất lượng cao, brunch và barista chuyên nghiệp; flat white là biểu tượng.
- Melbourne — laneway cafés, magic · Sydney — brunch và quán ven biển · Brisbane — — · Perth — —
- Nhịp uống: Sáng mua espresso-based trước giờ làm; cuối tuần brunch; đồ uống pha tại chỗ được coi trọng.
- Lưu ý: Long black thường rót espresso lên nước nóng; thuật ngữ magic không chuẩn hóa toàn quốc.
- Menu (7): Flat white · long black · piccolo latte · latte · cappuccino · magic (một số quán Melbourne) · batch brew

### 🇩🇪 Đức (de)
Kaffee und Kuchen (cà phê và bánh) song hành với espresso hiện đại; filter coffee có truyền thống lâu dài.
- Berlin — specialty và không gian sáng tạo · Hamburg — rang xay, cảng · Munich — café–bakery · Cologne — quán khu phố
- Nhịp uống: Buổi sáng cà phê với bánh mì; chiều café và bánh; gặp bạn tại quán hoặc bakery.
- Lưu ý: Eiskaffee ở Đức có thể là cà phê lạnh với kem vani, không chỉ là cà phê thêm đá.
- Menu (7): Filterkaffee · Milchkaffee · cappuccino · espresso · latte macchiato · Eiskaffee (thường với kem) · flat white

### 🇹🇷 Thổ Nhĩ Kỳ (tr)
Türk kahvesi nấu trong cezve, phục vụ cốc nhỏ có bã lắng; là nghi thức hiếu khách, trò chuyện và đôi khi bói bã cà phê.
- Istanbul — truyền thống và specialty · Ankara — quán công sở · Izmir — café ven biển
- Nhịp uống: Sau ăn, lúc tiếp khách và trò chuyện; trà cũng là đồ uống thường nhật nổi trội.
- Lưu ý: Đợi bã lắng, không uống cạn đáy; hỏi mức đường trước khi pha; menengiç làm từ quả pistacia, không chứa cà phê theo nghĩa thông thường.
- Menu (7): Türk kahvesi · sade (không đường) · orta (ngọt vừa) · şekerli (ngọt) · menengiç coffee (không phải cà phê hạt) · espresso · latte

### 🇸🇦 Ả Rập Saudi (sa)
Saudi coffee (qahwa) gắn với hiếu khách, dallah và chén finjan; thường rang nhạt, thêm bạch đậu khấu; song song là specialty hiện đại.
- Riyadh — specialty phát triển · Jeddah — café ven biển · Dammam — — · Al Khobar — —
- Nhịp uống: Mời khách trong nhà, majlis, lễ hội; tại thành phố giới trẻ cũng chuộng quán espresso và cold brew.
- Lưu ý: Thường dùng với chà là; phục vụ bằng tay phải; lắc nhẹ chén khi không muốn rót thêm trong nghi thức truyền thống.
- Menu (7): Saudi coffee / qahwa · espresso · latte · Spanish latte · V60 · iced americano · cold brew

### 🇻🇳 Việt Nam (vn)
Phin, Robusta, sữa đặc, cà phê đá và văn hóa ngồi quán lâu; specialty và cà phê Arabica phát triển song song.
- Hà Nội — nâu đá, trứng · TP.HCM — sữa đá, bạc xỉu · Đà Nẵng — café du lịch và specialty · Huế — cà phê muối
- Nhịp uống: Sáng cà phê vỉa hè; trưa/chiều gặp gỡ, làm việc; nhiều quán mở tới tối.
- Lưu ý: Tên nâu đá phổ biến ở miền Bắc; công thức trứng, muối và bạc xỉu thay đổi theo quán.
- Menu (8): Cà phê đen đá · nâu đá/cà phê sữa đá · bạc xỉu · cà phê trứng · cà phê muối · espresso · pour-over · cold brew

### 🇨🇳 Trung Quốc (cn)
Chuỗi café, đặt qua ứng dụng và giao hàng; đồ uống sữa/đá và biến thể sáng tạo; Vân Nam là vùng sản xuất Arabica quan trọng.
- Thượng Hải — specialty và sáng tạo · Bắc Kinh — café làm việc · Thâm Quyến — chuỗi/đặt app · Thành Đô — — · Côn Minh — cà phê Vân Nam
- Nhịp uống: Cà phê khi đi làm, học tập và gặp bạn; đặt hàng di động, nhận tại quầy/giao tận nơi.
- Lưu ý: Các vị trái cây, dừa và món theo mùa biến động nhanh; không coi một món viral là truyền thống lâu đời.
- Menu (7): Americano (美式咖啡) · latte (拿铁) · coconut latte (生椰拿铁) · iced latte · flat white · pour-over (手冲咖啡) · fruit coffee

### 🇧🇷 Brazil (br)
Cafezinho là cốc cà phê nhỏ, đậm, thường ngọt; gắn với hiếu khách và giờ nghỉ. Brazil đồng thời có thị trường specialty lớn.
- São Paulo — padaria và specialty · Rio de Janeiro — — · Belo Horizonte — café với pão de queijo · Curitiba — quán rang xay
- Nhịp uống: Sáng cùng bánh; sau bữa trưa hoặc trong các cuộc gặp; quán bakery/padaria là điểm dừng thường ngày.
- Lưu ý: Cafezinho không phải lúc nào cũng là espresso; cách pha và lượng đường khác nhau.
- Menu (7): Cafezinho · café coado · café com leite · pingado · cappuccino brasileiro (có biến thể cacao/quế) · espresso · iced latte

### 🇮🇳 Ấn Độ (in)
Nam Ấn nổi tiếng filter kaapi với sữa và đường, rót giữa tumbler–dabara; đô thị có café chuỗi, espresso và cold coffee.
- Mumbai — — · Delhi — — · Bengaluru — — · Chennai — — · Hyderabad — quán pha trộn nhiều phong cách
- Nhịp uống: Sáng filter coffee ở miền Nam; chiều gặp bạn; quán hiện đại phục vụ học tập, làm việc.
- Lưu ý: Filter kaapi truyền thống có thể dùng hỗn hợp cà phê–chicory; không đồng nhất mọi vùng Ấn Độ.
- Menu (7): South Indian filter coffee / kaapi · cold coffee · cappuccino · latte · americano · iced coffee · coffee with chicory

### 🇨🇦 Canada (ca)
Cà phê mang đi và chuỗi phổ biến; văn hóa double-double và drip tồn tại cùng specialty, đặc biệt tại đô thị lớn.
- Toronto — chuỗi và specialty · Vancouver — espresso và rang xay · Montreal — café chịu ảnh hưởng Pháp · Calgary — takeaway
- Nhịp uống: Sáng takeaway trên đường làm; drive-through ở ngoại ô; café gặp bạn và làm việc.
- Lưu ý: Double-double thường chỉ cà phê với hai phần kem và hai phần đường theo cách gọi phổ biến, không phải tên một công thức chuẩn quốc tế.
- Menu (8): Double-double · brewed coffee · americano · latte · flat white · iced coffee · cold brew · cappuccino

### 🇰🇷 Hàn Quốc (kr)
Café như không gian xã hội, học tập và chụp ảnh; iced americano cực kỳ dễ bắt gặp; dessert café phát triển.
- Seoul — café concept và specialty · Busan — café nhìn biển · Daegu — café khu phố · Incheon — café du lịch
- Nhịp uống: Sáng mua mang đi; chiều học/làm việc; tối hẹn gặp tại quán; đồ uống lạnh dùng quanh năm.
- Lưu ý: Dalgona coffee nổi tiếng toàn cầu nhưng không phải thức uống thường nhật chủ đạo của mọi quán Hàn.
- Menu (7): Iced americano (아이스 아메리카노) · latte · vanilla latte · dalgona coffee · Einspänner · cold brew · hand drip

### 🇹🇼 Đài Loan (tw)
Café specialty, quán độc lập và không gian thiết kế cùng tồn tại với văn hóa trà sữa; pour-over có chỗ đứng rõ rệt.
- Đài Bắc — specialty/roastery · Đài Trung — café thiết kế · Cao Hùng — quán ven cảng · Đài Nam — café trong nhà cổ
- Nhịp uống: Sáng cà phê takeaway; chiều ngồi quán học/làm việc; cuối tuần café kết hợp bánh ngọt.
- Lưu ý: Không đánh đồng trà sữa trân châu với cà phê; hai văn hóa đồ uống cùng phát triển.
- Menu (7): Americano (美式咖啡) · latte (拿鐵) · hand drip (手沖咖啡) · iced coffee · cold brew · espresso · flavored latte

### 🇮🇩 Indonesia (id)
Kopi tubruk truyền thống, quán warung và làn sóng kopi susu gula aren; nguồn hạt đa đảo tạo đa dạng hương vị.
- Jakarta — iced milk coffee · Bandung — specialty · Yogyakarta — warung và café sinh viên · Surabaya — — · Medan — cà phê Sumatra
- Nhịp uống: Sáng hoặc chiều tại warung; giới trẻ dùng kopi susu đá mang đi; quán là nơi gặp bạn.
- Lưu ý: Tubruk có bã lắng; kopi talua là đặc sản vùng, không phải menu mặc định toàn Indonesia.
- Menu (8): Kopi tubruk · kopi susu gula aren · es kopi susu · kopi hitam · V60 · espresso · latte · kopi talua (đặc sản Tây Sumatra)

### 🇲🇾 Malaysia (my)
Kopitiam và mã gọi đồ uống Hainanese/Nanyang; cà phê thường đậm, kết hợp sữa đặc hoặc sữa bay hơi; specialty phát triển ở thành phố.
- Kuala Lumpur — kopitiam và specialty · Penang — kopitiam di sản · Ipoh — white coffee · Johor Bahru — café hiện đại
- Nhịp uống: Sáng ở kopitiam cùng bánh mì kaya/roti; nghỉ giữa ngày; quán hiện đại phục vụ takeaway và brunch.
- Lưu ý: Kopi O thường có đường; muốn không đường gọi kosong. White coffee Ipoh không đơn giản là cà phê pha nhiều sữa.
- Menu (8): Kopi · kopi O · kopi C · kopi peng · kopi O kosong · cham (trà + cà phê) · white coffee (Ipoh) · latte

### 🇷🇺 Nga (ru)
Espresso, cappuccino và đồ uống sữa phổ biến ở đô thị; café là nơi gặp gỡ, làm việc, tránh lạnh; raf coffee là biến thể địa phương.
- Moscow — chuỗi và specialty · Saint Petersburg — café nghệ thuật · Kazan — quán địa phương · Novosibirsk — café đô thị
- Nhịp uống: Sáng takeaway; chiều/tối quán café; đồ uống nóng mùa lạnh, iced drinks mùa hè.
- Lưu ý: Raf coffee thường đánh nóng espresso với kem và đường vani; công thức thay đổi giữa các quán.
- Menu (7): Raf coffee (раф-кофе) · cappuccino · latte · americano · flat white · espresso · filter coffee

## Còn thiếu / việc sau

- Nét riêng của 13 thành phố đang "—": Los Angeles, San Francisco, Brisbane, Perth, Dammam, Al Khobar, Thành Đô, Rio de Janeiro, Surabaya, Mumbai, Delhi, Bengaluru, Chennai.
  (UI tạm hiện dòng nhịp uống của quốc gia cho các thành phố này.)
- Cách xếp món địa phương vào 3 món gốc (và icon) là bản mẫu — xem/sửa trong `menus.js`. Chưa có giá/công thức riêng cho từng món địa phương.
- Giá gốc từng quốc gia và hệ số theo thành phố là số mẫu, chờ cân bằng kinh tế.
