# Vòng chơi chính sau Màn 2: Quán → Nông trại → Bản đồ Việt Nam

> **Trạng thái: CHƯA LÀM. Tài liệu sống, cập nhật dần mỗi khi chốt thêm** (ghi vào mục Nhật ký ở cuối). Task: T-123–T-125 trong [TASK_LIST](../task-list/TASK_LIST.md).
>
> Ghi 2026-10-30 theo chốt của chủ sản phẩm: **Màn 3 là bài học pha chế, nông trại mở ở Màn 4**, sau đó mở bản đồ Việt Nam để đi tới từng vùng xây quán/nông trại. Đây là bản ý tưởng để duyệt, **chưa có con số được duyệt** (giá, sản lượng, thời gian). Thay thứ tự "làm nông trước" ở [GAME_DESIGN.md](GAME_DESIGN.md) §0 (xem ghi chú ở đó). Nối tiếp [CHAPTER_PLAN](../production/CHAPTER_PLAN.md) mục Mạch cốt truyện.

## 1. Tóm tắt một câu

Học pha chế bằng công thức có sẵn và nguyên liệu có hạn → bán cà phê kiếm tiền, dựng và nâng cấp quán → hết hạt thì mới cần nông trại → trồng, thu hoạch cà phê mang về quán bán → có tiền thì mở bản đồ Việt Nam, đi tới các vùng cà phê để dựng quán và nông trại mới, gặp cả cửa hàng của người khác.

## 2. Vòng lặp lõi

```
        ┌──────────── hạt cà phê ────────────┐
        ▼                                     │
   QUÁN (Màn 3)  ──bán ly──▶  TIỀN  ──mua hạt/giống, nâng cấp──▶  NÔNG TRẠI (Màn 4)
   pha chế, phục vụ,           │                                   trồng, chăm, thu hoạch
   trang trí, nâng cấp         ▼
                         BẢN ĐỒ VIỆT NAM  ──mở vùng mới──▶  quán/nông trại ở vùng khác
```

Nguyên tắc: **cái gì cũng bắt đầu từ thiếu**. Người chơi chỉ nghĩ tới nông trại khi hạt trong kho sắp hết, nên nông trại có lý do tồn tại chứ không phải thêm cho đủ.

## 3. Màn 3: Quán và bài học pha chế

- **Mở đầu:** gặp lại Thần Chết, cà phê bị đổ, bị phạt pha lại (xem [CHAPTER_3 §3.1](../production/chapters/CHAPTER_3.md)). Thần Chết là người phạt, Thần Cà Phê là người chỉ từng bước.
- **Học pha chế:** chủ sản phẩm sẽ đưa **bộ công thức** (nguyên liệu, tỉ lệ, các bước, nhiệt độ). Mỗi công thức là một bài học nhỏ có chấm điểm theo bước (xay, nén, chiết, thêm, hoàn thiện). Mở dần từng công thức theo cấp.
- **Kho hạn chế:** bắt đầu với một lượng hạt cố định nhỏ (cần chốt số, gợi ý đủ cho vài chục ly). Mỗi ly tiêu hao hạt và nguyên liệu.
- **Khách và tiền:** khách vào quán gọi món, người chơi pha, phục vụ, nhận tiền và đánh giá. Đánh giá cao thì khách đông và boa nhiều.
- **Dựng quán:** mua và đặt bàn ghế, máy, trang trí; nâng cấp máy (pha nhanh/ngon hơn), mở rộng chỗ ngồi. Hệ đặt đồ đã từng có ở bản prototype cũ (xem GAMEPLAY_ROADMAP M7) nhưng mã hiện tại chưa có, phải làm lại.
- **Điểm kết màn 3:** hạt sắp hết, tiền đủ mua hạt giống đầu tiên, Thần Cà Phê gợi ý "ở xa có một mảnh đất" → mở Màn 4.
- **Phúc Đức từ Màn 2:** dùng làm vốn/món khởi đầu hoặc độ khắt khe của Thần Chết khi nếm (chọn một, xem mục 7).

## 4. Màn 4: Nông trại cà phê

Giống game nông trại nhưng chủ đề cà phê, kèm tri thức thật:
- **Trồng và chăm:** chọn giống, chuẩn bị đất, gieo, tưới, che bóng, bón phân, phòng sâu bệnh, thu hái, sơ chế. Cây cà phê sống nhiều năm nên nhịp chơi là mùa vụ, không phải gieo gặt vài phút (để mô phỏng ngắn gọn thì ghi rõ là rút gọn).
- **Sổ tay các loại hạt (docs trong game):** mỗi giống có thẻ: tên, vùng hợp, độ cao, khí hậu, hương vị, độ khó trồng, giá. Gợi ý bộ đầu: **Robusta** (Tây Nguyên, đậm, nhiều caffeine, dễ trồng, hợp phin và cà phê sữa), **Arabica** (vùng cao mát như Lâm Đồng, Sơn La, Quảng Trị; hương hoa quả, chua thanh, khó chăm), **Excelsa/"cà phê mít"** (vị riêng), **Culi** (hạt tròn đơn; là dạng hạt, không phải giống, phải ghi đúng như vậy). Mọi thông tin phải kiểm chứng trước khi dạy như sự thật; phần rút gọn thời gian ghi rõ là trò chơi.
- **Vòng với quán:** thu hoạch → sơ chế → rang → mang về quán (Màn 3) bán. Chất lượng hạt quyết định chất lượng ly và giá.
- **Nâng cấp:** đất, dụng cụ, hệ tưới, nhà sơ chế, máy rang, thuê người làm.
- **Thiếu hụt có chủ đích:** hết hạt thì quán chững lại, có đường lùi (mua hạt đắt từ chợ/người khác) để người chơi không bị kẹt.

## 5. Bản đồ Việt Nam

**Mở khi nào:** sau khi quán và nông trại đầu tiên chạy được và có đủ tiền (và/hoặc cấp), có cảnh mở khoá có kịch bản (Thần Cà Phê: "Cà phê không chỉ ở một nơi").

**Cách chơi:** màn hình bản đồ Việt Nam có các điểm; bấm điểm để **di chuyển tới vùng** (có thời gian/tốn phí nhẹ hoặc cảnh chuyển), tới nơi thì xây dựng quán và nông trại riêng ở đó. Mỗi vùng là một "nút" độc lập với nét riêng.

| Vùng (gợi ý) | Loại nút | Nét riêng gợi ý |
|---|---|---|
| Hà Nội | Thành phố (điểm xuất phát, Màn 1) | cà phê trứng, phố cổ; quen thuộc nên làm nút khởi đầu của bản đồ |
| TP.HCM | Thành phố | cà phê sữa đá, bạc xỉu, quán vỉa hè nhộn nhịp |
| Huế/Đà Nẵng/Hội An | Thành phố | cà phê muối (Huế), khách du lịch |
| Đà Lạt (Lâm Đồng) | Vùng trồng + thành phố | Arabica, mát, du lịch, khách thích đẹp |
| Buôn Ma Thuột (Đắk Lắk) | Vùng trồng | Robusta, thủ phủ cà phê, lễ hội cà phê |
| Pleiku (Gia Lai) | Vùng trồng | Robusta, đất đỏ bazan |
| Sơn La / Quảng Trị | Vùng trồng | Arabica miền Bắc/Trung, giống và khí hậu khác |

- **Mỗi vùng có yêu cầu mở và đặc sản:** khí hậu/độ cao quyết định giống trồng được; thành phố quyết định khách và món ăn khách.
- **Cửa hàng của người khác:** mỗi vùng có các quán và đại lý NPC. Dùng để: (a) **mua/bán hạt** giá khác nhau theo vùng, (b) **học công thức mới** hoặc món đặc sản, (c) **đối thủ nhẹ** (cùng khách, ai ngon hơn thì khách đông hơn, không phá hoại), (d) **nhiệm vụ** từ chủ quán (giao hạt, thi pha chế). Mục tiêu là làm thế giới có sinh khí và tạo lý do đi nhiều vùng.
- **Cân bằng kinh tế giữa vùng:** hạt đắt ở đâu, bán rẻ ở đâu thì người chơi có việc để làm (chuyển hạt giữa nông trại và quán các vùng). Cần thiết kế để không phá nền kinh tế.

## 6. Lộ trình đề xuất (nhỏ nhất đủ chơi được trước)

1. **Slice A (Màn 3):** học pha chế với 3–5 công thức chủ sản phẩm đưa, kho hạn chế, bán ly kiếm tiền, vài món trang trí. Chưa có nông trại.
2. **Slice B (Màn 4):** một nông trại ở một vùng (Robusta, Tây Nguyên), 2 giống, thu hoạch mang về quán. Hoàn tất vòng Quán ⇄ Nông trại.
3. **Slice C (bản đồ):** màn bản đồ với **3 nút** (Hà Nội, Đà Lạt, Buôn Ma Thuột), mỗi nút có 1–2 cửa hàng NPC. Chứng minh đi vùng khác và mở rộng được.
4. **Mở rộng:** thêm vùng, giống, công thức, nhân viên, cửa hàng NPC, sự kiện.

Mỗi slice chơi được trọn vẹn và duyệt xong mới làm slice sau, đúng nguyên tắc [CHAPTER_PLAN](../production/CHAPTER_PLAN.md) mục 0.

## 7. Câu hỏi cần chốt (chủ sản phẩm)

1. **Bộ công thức:** gửi công thức (tên món, nguyên liệu, tỉ lệ, các bước, nhiệt độ, giá bán gợi ý). Bao nhiêu công thức ở Màn 3?
2. **Kho ban đầu:** bao nhiêu hạt và nguyên liệu? (Quyết định bao lâu thì người chơi phải nghĩ tới nông trại.)
3. **Phúc Đức dùng thế nào ở Màn 3:** thêm hạt khởi đầu, hay chỉnh độ khắt khe khi Thần Chết nếm, hay cả hai.
4. **Làm chủ hay làm thuê:** đã chốt "làm chủ quán" nhờ vòng quay Màn 2; xác nhận không có phần làm thuê.
5. **Di chuyển bản đồ:** tức thời (bấm là tới) hay có thời gian/phí? Gợi ý: chuyển cảnh ngắn có phí nhỏ, mở dần.
6. **Cửa hàng NPC:** chỉ để mua bán và nhiệm vụ, hay có đối thủ cạnh tranh khách? Gợi ý: cạnh tranh nhẹ.
7. **Nông trại ở nhiều vùng:** mỗi vùng một nông trại độc lập hay một nông trại chung rồi vận chuyển hạt? Gợi ý: độc lập, vận chuyển là hoạt động thêm sau.
8. **Phạm vi nền tảng:** web H5 + Android; cần tính ngân sách tải/texture cho từng vùng (mỗi vùng nạp riêng, dọn khi rời).

## 8. Rủi ro

- **Phạm vi phình rất nhanh** (quán + nông trại + bản đồ + NPC + kinh tế). Bắt buộc làm theo slice ở mục 6.
- **Kinh tế mất cân bằng** khi có nhiều vùng: cần bảng tính và thử trước khi làm nội dung.
- **Mã hiện tại chưa có hệ quán/nông trại/vùng:** `src/gameplay` chỉ có service của Màn 1–2 (phố, trải nghiệm trùng sinh); các hệ cũ (nông trại, chế biến, khách, đặt đồ, vùng) chỉ còn trong docs prototype (GAMEPLAY_ROADMAP, GAMEPLAY_SYSTEMS), phải tái dựng hoặc lấy lại từ lịch sử git.
- **Tri thức cà phê phải đúng**: kiểm chứng giống, vùng, độ cao, nhiệt độ trước khi đưa vào sổ tay.
- **Art:** mỗi vùng cần nền, nhà, nhân vật NPC; nên dùng chung bộ ghép và đổi màu/đạo cụ để giữ ngân sách.

## 9. Nhật ký cập nhật (thêm dòng mới ở cuối mỗi khi chốt hoặc đổi)

| Ngày | Nội dung |
|---|---|
| 2026-10-30 | Tạo tài liệu. Chốt: Màn 3 = học pha chế (công thức do chủ sản phẩm đưa, nguyên liệu có hạn), Màn 4 = nông trại cà phê, sau đó bản đồ Việt Nam có cửa hàng của người khác. Chưa có số liệu nào được duyệt. |

## 10. Dữ liệu chủ sản phẩm sẽ cung cấp (điền vào khi có)

- [ ] Bộ công thức pha chế (tên món, nguyên liệu, tỉ lệ, các bước, nhiệt độ, giá gợi ý)
- [ ] Số hạt và nguyên liệu ban đầu của quán
- [ ] Tài liệu các loại hạt/cách trồng cho sổ tay Màn 4
- [ ] Danh sách vùng trên bản đồ và đặc sản từng vùng
