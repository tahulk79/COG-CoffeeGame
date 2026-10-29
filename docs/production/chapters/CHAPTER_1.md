> **Cập nhật 2026-10-28:** Đã bỏ sáu cú chót và mốc ép ngất theo thời gian. Màn 1 tiếp tục khi né được; tai nạn dẫn tới cứu thương → trùng sinh/chuyển chương. Các mô tả cú chót bên dưới chỉ còn là lịch sử thiết kế.

> Chung cho mọi màn: [CHAPTER_PLAN](../CHAPTER_PLAN.md) (3 giai đoạn, cách làm asset 3D/UI) · [ART_BIBLE](../../design/ART_BIBLE.md) · [TASK_LIST](../../task-list/TASK_LIST.md)

## 1. Màn 1 · Phố cổ Hà Nội: "Một ngày xui tận mạng"

### 1.1 Vấn đề của bản hiện tại
- Là màn sinh tồn: chạm nguy hiểm là chết ngay. Người chơi chỉ lo né, **không có setup nên không có hài**.
- Phố vắng: không có người qua lại, không có quán xá đúng chất Hà Nội (hiện là xe trà sữa, bánh tráng, wifi…).
- Các cái chết chỉ hiện chữ trên thẻ kết, không có diễn biến nên không buồn cười.
- Chuyển sang màn 2 bằng cổng thiên đàng, không có lý do trong câu chuyện.

> **Chốt 2026-10-28 (thay cho mạch 3 hồi bên dưới):** Màn 1 là **một màn dạo phố duy nhất**. Không chia hồi, không có rào giữa phố, không cần ghé quán mới có sự cố. Sự cố xuất hiện ngay trong lúc dạo: 8 giây đầu yên ổn, sau đó thưa rồi dày dần. Dính 1 phát là ngất, xe cứu thương, vòng tròn ma thuật, sang Màn 2. Né hết 2 phút thì tới cú chót. Chỉ **cà phê ông Tám** có cửa vào bên trong; phở và bún đậu là quầy vỉa hè. Phần bên dưới giữ lại làm lịch sử thiết kế.

### 1.2 Mạch mới (3 hồi, 4–6 phút)

```
Hồi 1: DẠO PHỐ (2–3')        Hồi 2: CHUỖI XUI (1–2')       Hồi 3: NGẤT → CỨU THƯƠNG (40")
Phố đông, ghé quán,     →     Sự cố dồn dập, né được   →   Dính 1 phát (hoặc né hết thì
nói chuyện bong bóng,         thì bẻ lái lãng xẹt hơn;     cú chót lãng xẹt) → ngất →
toàn troll nhau               dính 1 phát là ngất           đám đông → xe 115 → Màn 2
```

**Hồi 1: Dạo phố (an toàn, chưa có sự cố)**
- Phố dài theo chiều ngang, camera bám nhân vật (chế độ `story` trong `framing.ts`, không còn thấy cả map).
- **Đám đông**: người đi bộ, xe máy, xe đạp chở hàng, bà gánh hàng rong, khách Tây ba lô, shipper, nhóm tập thể dục. Họ đi theo tuyến, tránh nhân vật, thỉnh thoảng nói một câu bong bóng ngắn khi đi ngang.
- **Hàng quán** (mục 1.4): đi vào vùng quán thì người bán và khách nói chuyện bằng **bong bóng trên đầu**. Thoại tự chạy, người chơi chỉ chọn **1 trong 2 bong bóng trả lời** (không có hộp thoại bấm "Tiếp").
- Ghé đủ 3 quán (hoặc sau 3 phút) thì sang Hồi 2. Mỗi quán có một câu **cài cắm** (foreshadow) cho cú xui về sau.

**Hồi 2: Chuỗi xui (có thao tác)**
- Bắt đầu bằng một biến cố chung, ví dụ "giờ tan tầm": còi xe dồn dập, nhạc đổi nhịp.
- Sự cố đến theo kiểu **domino**: có báo trước (bóng đổ, tiếng sủa, dấu chấm than), người chơi né được (đi, Lướt). **Né được thì cái tiếp theo lãng xẹt hơn.**
- **Dính 1 phát là ngất** (đã chốt 2026-10-28): diễn cú ngã của chính sự cố đó, nhân vật nằm sõng soài, nói một câu than, rồi sang Hồi 3.
- **Né được hết** trong 60 giây thì tới **cú chót**: rút từ bộ "định mệnh", mỗi lượt chơi một kiểu, chỉ rút những cú đã được cài ở quán (mục 1.5). Né giỏi đến đâu cuối cùng vẫn ngất.
- Hai gag không làm ngất mà chỉ phá: quần đùi chụp đầu (đảo phím điều khiển) và mùi sầu riêng khi rơi sát bên (đi chậm).

**Hồi 3: Ngất → xe cứu thương → Màn 2 (cutscene, chỉ bấm để tua nhanh)**
1. Màn hình tối dần ở viền, mờ, có tiếng ù tai. Nhân vật nằm sõng soài, sao bay quanh đầu.
2. Đám đông xúm lại, mỗi người một bong bóng: "Có ai gọi 115 chưa?" · "Khoan, để em quay TikTok đã" · "Thằng này hôm qua còn nợ tôi cốc trà đá" · "Ơ, nó còn thở này, đang ngáy".
3. Xe cứu thương tới nhưng kẹt giữa dòng xe máy, bấm còi mãi. Một ông xe ôm nói: "Để bác chở cho nhanh". Tài xế gắt: "Bác đi ra!".
4. Hai nhân viên y tế khiêng cáng. Gag: đầu nhân vật đập vào cửa xe "cốp", sao bay thêm một vòng.
5. Xe phóng đi, còi hú. **Giữa đường mở ra một vòng tròn ma thuật**, xe cứu thương lao vào, co lại biến mất trong ánh sáng (đã chốt 2026-10-28, thay cho cảnh mí mắt).
6. **Màn 2 mở bằng ánh sáng trắng tan dần** trên Vườn mây (thay cánh cổng thiên đàng ở chỗ chuyển màn này).

**Cảnh rào chắn hai đầu phố** (thêm 2026-10-28): bảo vệ chặn người đi bộ nhưng mở rào cho xe máy ("Xe máy là người nhà"). Nài nỉ thì được qua… và bị xe máy tông; xe cứu thương tới, bảo vệ: "Đã bảo cấm rồi còn cố đi!".

### 1.3 Bản đồ mới (prototype)
- Khoảng **48×18 ô**: một trục phố chính (2 làn xe máy), hai vỉa hè, một ngõ nhỏ rẽ vào giữa phố, một góc hồ/vườn hoa nhỏ ở cuối phố (bồ câu).
- Dọc vỉa hè từ trái sang phải: trà đá → sạp báo → phở → xe ôm và sửa xe → bún đậu → cắt tóc vỉa hè → bánh mì → hàng xôi/gánh hàng rong → góc hồ.
- Ngõ nhỏ: nhà có biển "Nhà có chó dữ", dây phơi quần áo, máy lạnh nhỏ nước. Đây là nơi dồn nhiều sự cố.
- Hồi 1 chặn cuối phố bằng một hàng rào "Đang thi công", Hồi 2 mới mở ra.

### 1.4 Hàng quán và thoại bong bóng (nháp, sẽ chuyển vào `story.json`)

Mỗi quán có 3–5 câu tự chạy và 1 lựa chọn 2 bong bóng. `[CÀI]` là câu cài cắm cho sự cố về sau.

**① Trà đá vỉa hè: chú Tư và hội chém gió**
- Chú Tư: "Ngồi đi cháu. Trà đá ba nghìn, chém gió miễn phí."
- Ông Bảy: "Hôm qua tôi đá bóng với Messi đấy." · Ông Tám: "Messi phường bên á?" · Ông Bảy: "Ừ, Messi bán bánh mì."
- Chọn: **"Cho cháu cốc trà đá"** → Chú Tư: "Hết đá rồi. Trà nóng, để nguội là thành trà đá." / **"Cháu chỉ ngồi nhờ thôi"** → Chú Tư: "Ngồi nhờ năm nghìn."
- `[CÀI]` Chú Tư: "Cái ghế đỏ kia đừng ngồi, nó gãy chân từ thời bao cấp."

**② Sạp báo: ông Hai bán báo**
- Ông Hai: "Báo đây! Tin nóng: thanh niên đi dạo phố gặp sự cố lãng xẹt!" · Nhân vật: "Ai thế bác?" · Ông Hai: "Chưa biết, mai mới có ảnh." `[CÀI]`
- Chọn: **"Giờ ai còn đọc báo giấy hả bác?"** → "Đọc gì, mua về lót ghế trà đá." / **"Cho cháu tờ báo"** → "Báo hôm qua giảm nửa giá, tin vẫn y nguyên."

**③ Phở: bà Ba khó tính ("phở chửi")**
- Nhân vật: "Cho cháu bát phở tái." · Bà Ba: "Tái hay chín? Nói một lần thôi!" · "Dạ tái." · Bà Ba: "Hết tái. Ăn chín."
- Khách bàn bên: "Quán này ngon là nhờ bị chửi. Không bị chửi ăn chẳng ra vị gì."
- Chọn: **"Bà cho cháu xin thêm hành"** → "Muốn thêm hành thì ra chợ mà mua." / **"Phở ngon quá bà ơi"** → Bà Ba (đỏ mặt): "…Lần sau được thêm thịt."
- `[CÀI]` Bà Ba: "Ăn xong đi đứng cẩn thận, ngoài ngõ có con chó nhà ông Tư Mập."

**④ Xe ôm và sửa xe: chú Năm**
- Chú Năm: "Xe ôm không cháu?" · "Cháu đi bộ." · Chú Năm: "Thế bác đi bộ cùng, hai mươi nghìn."
- Thợ sửa xe: "Bơm xe không em?" · "Em đi bộ mà." · "Bơm dép cũng được, năm nghìn."

**⑤ Bún đậu mắm tôm: cô Sáu**
- Cô Sáu: "Mắm tôm hay nước mắm?"
- Chọn: **"Nước mắm ạ"** → cả quán im lặng quay lại nhìn, tiếng quạ kêu. Cô Sáu: "…Cháu về đi." / **"Mắm tôm đánh thật bông vào cô"** → Cô Sáu: "Chuẩn người Hà Nội. Ngồi đi."
- `[CÀI]` Một ông khách: "Ăn mắm tôm xong thì bồ câu cũng phải né."

**⑥ Cắt tóc vỉa hè: bác Hùng (gương treo trên cây)**
- Bác Hùng: "Cắt kiểu gì?" · "Kiểu Hàn Quốc ạ." · Bác Hùng: "Bác chỉ biết kiểu Hàng Bạc với kiểu Hàng Gai."
- Chọn: **"Thôi để hôm khác ạ"** → "Hôm khác bác về quê." / **"Bác cắt theo cảm hứng đi"** → cắt 2 giây, nhân vật có thêm một nhúm tóc dựng ngược, giữ đến hết màn.

**⑦ Bánh mì: anh Bảy**
- "Bánh mì gì cũng có đây!" · "Cho em bánh mì không có gì." · Anh Bảy: "Hết rồi."
- `[CÀI]` Nhân vật cầm một ổ bánh mì, sau này bồ câu nhắm vào nó.

**⑧ Gánh xôi và khách Tây**
- Khách Tây: "How much?" · Bà bán xôi: "Hao mắc? Không mắc đâu, rẻ mà!" · Khách Tây (giơ ngón cái): "Very rẻ!"
- Shipper đứng gọi điện: "Alo chị ơi em tới rồi, chị ở đâu ạ?" · (loa ngoài) "Chị đang ở Úc em ạ."

**Câu đám đông đi ngang (ngẫu nhiên):** "Tránh ra, tránh ra, nóng nóng!" (bê nồi nước dùng) · "Cháu ơi mua vé số không, số đỏ như đèn xe cứu thương" `[CÀI]` · "Ai mua xôi không…" · "Đi đứng kiểu gì thế, nhìn đường chứ!" (chính người đó đang nhìn điện thoại).

### 1.5 Kho sự cố hài (Hồi 2 và cú chót)

Công thức cho mọi gag: **báo trước → người chơi tưởng an toàn → bẻ lái lãng xẹt**.

**A. Sự cố: dính 1 phát là ngất (prototype đã làm G01–G04, G06–G07, G09, G11, G14, G18–G20)**

| ID | Tình huống | Bẻ lái | Ở đâu |
|---|---|---|---|
| G01 | Vỏ chuối giữa đường, có báo trước | Né được, đứng tạo dáng tự hào, giẫm luôn vỏ chuối thứ hai | Vỉa hè |
| G02 | Biển "Nhà có chó dữ", cổng mở | Chó Chihuahua bé tí ra sủa, nhân vật cười → con chó Ngao to gấp 10 lần thò đầu ra sau | Ngõ |
| G03 | Ổ voi giữa phố | Né được ổ voi, bước lên nắp cống bên cạnh, nắp lật | Lòng đường |
| G04 | Xe máy chở tủ lạnh lao tới | Né được xe, nhưng lồng gà buộc phía sau bung ra, 12 con gà đuổi theo | Lòng đường |
| G05 | Ghế nhựa đỏ ở quán trà đá (đã cài) | Ngồi ghế xanh cho an toàn, ghế xanh gãy, ghế đỏ đứng nguyên | Quán ① |
| G06 | Bà tầng 2 đổ chậu nước rửa rau | Nhân vật né, nước trúng ông bán báo, ông vụt tờ báo cuộn tròn | Ngõ |
| G07 | Dây phơi đứt | Quần đùi hoa rơi chụp lên đầu, đi loạng choạng 2 giây, phím điều khiển bị đảo | Ngõ |
| G08 | Máy lạnh nhỏ nước tí tách | Nhân vật mở ô, ô bị gió lật ngược, bay mất | Ngõ |
| G09 | Đội đá cầu vỉa hè | Quả cầu trúng đầu, cả đội chạy tới không xin lỗi mà khen "Đánh đầu đẹp!" | Vỉa hè |
| G10 | Nhóm nhảy dưỡng sinh ở góc hồ | Bị kéo vào nhảy, phải bấm theo nhịp 3 lần mới thoát (mini QTE) | Góc hồ |
| G11 | Bồ câu (đã cài bánh mì) | Cả đàn lao vào ổ bánh mì, nhấc nhân vật lên 1 giây rồi thả xuống | Góc hồ |
| G12 | Cửa cuốn đang kéo xuống | Lướt qua kịp, chỉ có cái balo bị kẹt lại | Vỉa hè |
| G13 | Ô tô đỗ chắn kín vỉa hè | Phải lách qua khe hẹp, bị kẹt, đẩy mãi mới ra, "bụp" bay ra ngoài | Vỉa hè |
| G14 | Hai người cãi nhau ném dép tổ ong | Né chiếc thứ nhất, chiếc thứ hai bay theo đường vòng như boomerang | Vỉa hè |
| G15 | Hoa sữa mùa thu | Ngửi một hơi, đi xiêu vẹo 2 giây như say | Vỉa hè |
| G16 | Xe rác giờ tối, tiếng kẻng "keng keng" | Đứng im cho xe qua, cô lao công hốt luôn nhân vật vào xe rồi đổ ra lại: "Ơ, tưởng túi rác" | Lòng đường |
| G17 | Biển quảng cáo "SALE 50%" | Rơi mất một nửa, chỉ còn chữ "SALE" đè xuống, "giảm" một nửa máu | Vỉa hè |
| G18 | Đoàn xe máy giờ tan tầm (đã có) | Né hết dòng xe, đứng ở giải phân cách, bị một chiếc xe đạp đi ngược chiều tông nhẹ | Lòng đường |
| G19 | Mèo hoang (đã có) | Không cào, chỉ nằm chắn đường không chịu dậy. Nhân vật bước qua thì vấp chính con mèo | Ngõ |
| G20 | Sầu riêng (đã có) | Né được quả sầu riêng, mùi sầu riêng làm ngất nhẹ 1 giây | Sạp hoa quả |

**B. Cú chót "định mệnh": khi né được hết (prototype đã làm K01–K04, K06, K07; K05 để sau)**

| ID | Cú chót |
|---|---|
| K01 | Sau khi thoát hết mọi thứ, đứng yên giữa chỗ an toàn nhất phố thì **một quả sấu bé tí** rơi trúng đầu. Ngất. |
| K02 | Thấy tờ 2 nghìn dưới đất, cúi nhặt, đứng lên đập đầu vào cột điện. Tờ tiền bay mất. |
| K03 | Ngồi lại ghế trà đá thở phào. Chú Tư: "Đã bảo đừng ngồi ghế đỏ!". Ghế sập, ngã ngửa. |
| K04 | Hắt hơi vì tiêu ở quán phở mạnh quá, tự bật ngửa ra sau. |
| K05 | Đi lùi để chụp selfie với Hồ Gươm, lùi mãi lùi mãi… rơi xuống hồ (chỉ thấy bong bóng nổi lên). |
| K06 | Con chó Ngao (G02) quay lại, không cắn mà **liếm**. Nhân vật ngất vì quá sợ. |
| K07 | Ông bán báo chạy tới chìa tờ báo: tin nóng chính là ảnh nhân vật đang nằm ngất. Nhân vật nhìn ảnh, ngất thật. |

**C. Gợi ý cho những bản sau** (chưa làm ở Vertical Slice): thang của thợ điện đổ domino · xe bán kem phát nhạc khiến cả phố đứng hình · trẻ con bắn súng nước · bóng bay bị cuốn lên trời · bà cụ ngồi xổm bán rau giơ chân ngáng · xe bò chở bia · cột nước cứu hoả phun.

### 1.6 Thay đổi kỹ thuật (prototype, chưa code, chờ duyệt)

| Việc | Cách làm | File chính |
|---|---|---|
| Đổi luật: dính 1 phát là ngất; né hết 60 giây → cú chót | `RunService`: `hit` → `down` (nằm ngất), `finale` cho cú chót; bộ "định mệnh" chỉ dùng cho cú chót | `src/gameplay/story/RunService.ts`, `story.json` |
| Chia màn thành 3 hồi | Thêm `phase: 'stroll' \| 'chaos' \| 'faint'` trong `RunService`/`StoryService`; Hồi 1 tắt spawn sự cố | `StoryService.ts`, `RunService.ts` |
| Đám đông | `CrowdService` mới (code thuần): NPC đi theo tuyến định sẵn trong map, né nhân vật, câu bong bóng ngẫu nhiên | `src/gameplay/story/CrowdService.ts` (mới), `incident.json` |
| Hàng quán + thoại bong bóng | Thay `props` bằng `stalls`: vùng kích hoạt, danh sách câu (người nói, nội dung), 1 lựa chọn 2 đáp án, cờ "đã ghé" | `story.json`, `StoryService.ts`, `StoryHud.ts` (bong bóng trên đầu, dùng lại kiểu bong bóng của Màn 2) |
| Gag có diễn biến | Mỗi gag = kịch bản nhỏ: báo trước → bẻ lái → phản ứng; khai báo trong `story.json`, `RunService` chạy | `RunService.ts`, `incidentArt.ts` |
| Cutscene ngất + xe cứu thương | Chuỗi bước có thời gian (dòng thời gian đơn giản), bấm để tua nhanh | `StoryService.ts`, `WorldScene.ts`, `incidentArt.ts` |
| Chuyển cảnh mí mắt | Thêm kiểu `eyelids` vào `TransitionScene` (khép ở Màn 1, mở ở đầu Màn 2) | `src/scenes/TransitionScene.ts` |
| Map mới 48×18 + camera bám | Viết lại `incident.json`; thêm `incident: 'story'` vào `CAMERA_MODE` | `incident.json`, `WorldScene.ts` |

### 1.6b Vào trong quán bằng cửa (đề xuất 2026-10-28, chờ duyệt)

**Mục tiêu:** 3 quán có **cửa** trên mặt tiền dãy nhà phía bắc. Đi vào cửa thì màn hình tối nhanh rồi mở ra **cảnh bên trong quán**: có bàn ghế, người bán, khách, nói chuyện bằng bong bóng và một gag riêng của quán. Đi ra cửa thì về lại đúng chỗ đó trên phố.

| Quán | Bên trong | Gag trong quán (không làm ngất) | Cài cho về sau |
|---|---|---|---|
| Phở bà Ba (chuyển từ quầy vỉa hè vào nhà) | Nồi nước dùng bốc khói, 3 bàn thấp, khách húp xì xụp | Lọ tiêu bị rắc quá tay, nhân vật hắt hơi làm khách bàn bên bay mũ | Cú chót "hắt hơi" |
| Bún đậu cô Sáu (chuyển vào nhà) | Mẹt bún, chiếu ngồi, quạt trần | Chọn "nước mắm" thì đèn tắt, chỉ còn một vệt sáng chiếu nhân vật, cả quán quay lại nhìn | Bồ câu né mùi mắm tôm |
| **Cà phê ông Tám** (quán mới, hợp tên game) | Phin nhỏ giọt, ghế gỗ thấp, mèo quán | Mèo quán chiếm ghế của nhân vật; ông Tám: "Cà phê ngon là phải đợi, 15 phút một giọt" | Gợi ý trước Màn 3 (bậc thầy cà phê) |

**Luật**
- Cửa chỉ mở ở **Hồi 1** (dạo phố). Sang giờ tan tầm thì cửa đóng, treo biển "Nghỉ giờ tan tầm".
- Ở trong quán thì **đồng hồ Hồi 1 dừng lại**, phố bên ngoài cũng tạm dừng.
- Nghe hết chuyện trong quán thì tính là đã ghé quán đó (cộng vào điều kiện "ghé 2 quán").
- Trong quán đi lại bằng bàn phím, joystick hoặc bấm sàn như ngoài phố. Bấm vào người thì người đó nói.

**Cách làm (đề xuất):** cảnh trong quán là một **phòng isometric nhỏ (khoảng 8×6 ô) vẽ chồng lên trên** cảnh phố, giống cách ART_BIBLE §2 tách các cảnh cận. Không đổi map, không lưu và tải lại màn, nên trạng thái phố, đồng hồ và các quán đã ghé đều giữ nguyên.
- Phương án khác là làm thành map riêng và đi bằng hệ thống chuyển map có sẵn. Cách đó phải lưu rồi dựng lại cả cảnh phố mỗi lần ra vào, đồng hồ Hồi 1 và đám đông bị đặt lại từ đầu. Không khuyên dùng.

**Các bước**
1. Thêm cửa (3 đối tượng `shop_door`) vào map và vẽ mặt tiền có biển tên. Đi vào cửa thì vào quán.
2. `ShopService`: phòng, tường, vật cản, người trong quán, thoại, gag, cửa ra. Phần logic thuần, có test.
3. `ShopScene`: vẽ phòng, nhân vật, bong bóng, nút trả lời; chuyển cảnh tối nhanh khi ra vào.
4. Viết thoại và gag cho 3 quán vào `story.json`. Bỏ 2 quầy vỉa hè phở và bún đậu (chuyển vào trong nhà).
5. Test chơi thử tự động: vào, nói chuyện, ra; đồng hồ dừng; cửa đóng ở Hồi 2.

### 1.7 Danh sách asset Màn 1 (cần thay bằng 3D và UI đẹp)

Ký hiệu: 🧍 nhân vật có animation · 🏠 môi trường/đạo cụ · 🎛 UI · 🔊 âm thanh · ✨ VFX

**Nhân vật** (chibi, đầu ≈ 1/3 thân, 8 hướng)

| Mã | Asset | Animation cần | Ưu tiên |
|---|---|---|---|
| C1-01 🧍 | Nhân vật chính (cầm cốc trà đá / ổ bánh mì) | idle, đi, chạy, Lướt, ngã ngửa, ngã sấp, choáng (sao quanh đầu), đứng dậy, ngất nằm, bị khiêng, nói (lắc đầu) | VS |
| C1-02 🧍 | Chú Tư trà đá, ông Bảy, ông Tám (ngồi ghế nhựa) | ngồi, nói, cười, chỉ tay | VS |
| C1-03 🧍 | Bà Ba phở | đứng nồi, múc, quát | VS |
| C1-04 🧍 | Ông Hai bán báo | rao, vụt báo | VS |
| C1-05 🧍 | Cô Sáu bún đậu, bác Hùng cắt tóc, anh Bảy bánh mì, chú Năm xe ôm | nói, làm việc (1 vòng lặp/người) | VS |
| C1-06 🧍 | Người đi đường × 6 biến thể (dùng chung bộ xương, thay đầu/áo/màu) | đi, đi xem điện thoại, đứng nói | VS |
| C1-07 🧍 | Khách Tây, shipper, bà gánh hàng rong, nhóm nhảy dưỡng sinh | đi, nhảy | VS |
| C1-08 🧍 | Chó Chihuahua, chó Ngao, mèo hoang, gà × đàn, bồ câu × đàn | đi, chạy, sủa/kêu, bay | VS |
| C1-09 🧍 | 2 nhân viên y tế + cáng | đi khiêng, đặt xuống | VS |
| C1-10 🧍 | Xe máy (người lái + xe, 4 biến thể hàng chở), xe đạp, xe cứu thương, xe rác | chạy, phanh; xe cứu thương có đèn | VS |

**Môi trường và đạo cụ**

| Mã | Asset | Ưu tiên |
|---|---|---|
| E1-01 🏠 | Bộ nhà ống phố cổ (mặt tiền 3–4 tầng, ban công, mái ngói, biển hiệu) dạng mô-đun, 6–8 biến thể | VS |
| E1-02 🏠 | Vỉa hè gạch, lòng đường nhựa, nắp cống, ổ voi, vạch kẻ | VS |
| E1-03 🏠 | Quán trà đá (ghế nhựa đỏ/xanh, ấm, cốc, thùng đá), quán phở (nồi, bàn, ghế), bún đậu (mẹt), sạp báo, ghế cắt tóc + gương treo cây, xe bánh mì, gánh xôi | VS |
| E1-04 🏠 | Cột điện + bó dây điện, dây phơi, máy lạnh, cửa cuốn, biển "Nhà có chó dữ", ô tô đỗ, biển quảng cáo | VS |
| E1-05 🏠 | Góc hồ: lan can, cây liễu, ghế đá, cây sấu, cây hoa sữa | VS |
| E1-06 🏠 | Vỏ chuối, sầu riêng, quả sấu, dép tổ ong, quả cầu, ô, quần đùi hoa, tờ 2 nghìn | VS |
| E1-07 🏠 | Nội thất xe cứu thương (góc nhìn từ cáng lên trần) | VS |

**UI**

| Mã | Asset | Ưu tiên |
|---|---|---|
| U1-01 🎛 | Bong bóng thoại 9-slice (người bán, đám đông, nhân vật chính, bong bóng lựa chọn có viền nổi) | Prototype (bản tạm) → VS |
| U1-02 🎛 | Đồng hồ giờ tan tầm, chữ tượng thanh của cú chót ("CỐC!", "BOONG!") | VS |
| U1-03 🎛 | Joystick, nút Lướt, nút tua nhanh cutscene | VS |
| U1-04 🎛 | Dấu báo trước (bóng đổ, chấm than, vạch xe chạy) | VS |
| U1-05 🎛 | Thẻ tiêu đề màn ("Chương 1 · Một ngày xui tận mạng"), thẻ kết "Bạn đã ngất vì: …" (chia sẻ được) | VS |
| U1-06 🎛 | Hiệu ứng mí mắt, viền tối khi choáng | VS |

**Âm thanh**

| Mã | Asset | Ưu tiên |
|---|---|---|
| A1-01 🔊 | Nền phố: còi xe, tiếng rao ("Bánh mì đây", "Ai xôi không"), tiếng nói chuyện đám đông, chim | VS |
| A1-02 🔊 | Nhạc: Hồi 1 lofi phố nhẹ nhàng · Hồi 2 nhịp nhanh hài hước (kèn, xylophone) · Hồi 3 nhạc chậm ngắt quãng, còi cứu thương | VS |
| A1-03 🔊 | "Giọng bập bẹ" cho bong bóng thoại: mỗi nhân vật một cao độ (kiểu đọc lí nhí, không lồng tiếng thật) | VS |
| A1-04 🔊 | SFX mỗi gag: trượt, "bịch", sủa nhỏ/sủa to, gà, bồ câu, nắp cống, kẻng xe rác, "cốp" đầu, sao bay | VS |

**VFX** ✨: bụi khi ngã, sao choáng, nước tung toé, lông gà/bồ câu bay, ánh đèn đỏ xanh của xe cứu thương, mờ viền khi ngất.


### 1.8 Thứ tự làm Màn 1

| Bước | Giai đoạn | Việc | Kết quả để duyệt |
|---|---|---|---|
| 1 | Prototype | Map mới 48×18, camera bám, chia 3 hồi, chặn cuối phố | Đi hết phố được |
| 2 | Prototype | Đám đông + 8 quán + thoại bong bóng có lựa chọn | Đọc thoại, chọn đáp án |
| 3 | Prototype | Luật dính 1 phát là ngất + gag có bẻ lái + 6 cú chót (hình khối tạm) | Chơi thử Hồi 2, kiểm tra độ hài |
| 4 | Prototype | Cutscene ngất → xe cứu thương → mí mắt → Màn 2 mở mắt | Chơi trọn Màn 1 → Màn 2 |
| 5 | Prototype | Chơi thử với 3–5 người, chỉnh nhịp, bỏ gag không buồn cười | **Chốt lối chơi Màn 1** |
| 6 | Vertical Slice | Concept + model + animation nhân vật chính, 4 người bán chính, chó, xe máy | Nhân vật chính chạy được trong game |
| 7 | Vertical Slice | Dãy phố 3D, quán, đạo cụ gag, `AtlasRenderer` | Màn 1 nhìn ra 3D |
| 8 | Vertical Slice | Đám đông, xe cứu thương, y tá, nội thất xe | Đủ toàn bộ asset |
| 9 | Vertical Slice | UI kit, âm thanh, VFX cơ bản | **Màn 1 hoàn chỉnh để demo** |
| 10 | Production | Nâng model/ánh sáng/VFX, tối ưu mobile | Đạt mục tiêu chất lượng |
