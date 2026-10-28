# Đối chiếu mỹ thuật với UI — 2026-10-29

## Phạm vi và bằng chứng

Đã mở bản localhost đang chạy tại cổng5180 trong trình duyệt in-app, xem màn phố và mở cài đặt. Viewport hiển thị khoảng503×715. Đối chiếu ảnh district-background-v1.png, houses-v2.png, hero-v1.png cùng StoryHud.ts, theme/tokens.ts, chapter1Scenery.ts và cách gắn nhà trong incidentArt.ts. Đây là kiểm tra thị giác theo yêu cầu mới “tự check”; không chạy unit/e2e/typecheck/build, không nghiệm thu thiết bị thật. Không đổi asset/code game trong lượt rà soát này.

## Kết luận

Chưa đạt tính đồng bộ. UI hiện có nét nâu dày, bo tròn và mảng kem/coral/mint rõ; ảnh phố thiên mô hình thu nhỏ nhiều vật liệu, còn hero là minh họa chibi nét mảnh. Cách ghép và lặp ảnh làm lệch tỷ lệ, hướng sáng và quan hệ trước/sau. Đây không thể xử lý chỉ bằng tint/alpha hoặc thêm nhiều ảnh hơn.

| Vấn đề | Bằng chứng / trường hợp cụ thể | Sửa đề xuất |
|---|---|---|
| UI và thế giới lệch ngôn ngữ tạo hình | Bảng cài đặt kem/nét nâu rõ, nhưng phố có ngói/đá/lá chi tiết và bóng như mô hình thật. | Giữ UI làm chuẩn; cảnh dùng mảng lớn, viền nâu, bóng đơn giản, palette từ tokens. Hero/NPC cùng cách viền và mức chi tiết. |
| Background trông như một tầng dưới map | Ở mép dưới vùng cỏ và hàng rào, ảnh nhiều mái nhà bắt đầu ngay sát mép sàn; foreground phẳng và background có ánh sáng/độ sâu khác nhau. | Vẽ background theo chính bố cục/phép chiếu của vùng chơi, có đoạn chuyển tiếp phố/vỉa hè/cây cùng cao độ; cảnh xa ít tương phản. Không đặt ảnh phong cảnh bất kỳ bên dưới hình chữ nhật map. |
| Lộ đối xứng và đổi hướng sáng | chapter1Scenery.ts lật xen kẽ cả X/Y để khớp pixel. Ngói, ban công, giao lộ và bóng cũng bị lật. | Bỏ lặp gương cho nhà/phố; background cần đường nối được thiết kế thật. Ưu tiên một bố cục nền phủ vùng camera cho phép, mở dài theo trục đường khi cần; chỉ vật liệu nền đơn giản được lặp. Một tranh logic có thể chia phần khi xuất để tối ưu. |
| Tỷ lệ và độ đọc chưa thống nhất | Trong màn đã xem, hero nhỏ/mảnh so với cây, nhà và UI. Nhà được setDisplaySize với chiều ngang/dọc độc lập theo footprint/height. | Khóa thước tỷ lệ hero/cửa/quầy/xe trước; scale đồng nhất từng ảnh, căn pivot/footprint riêng. Không bóp ảnh để ép vừa ô. Duyệt silhouette hero trên mobile trước khi giảm camera nhìn xa. |
| Nền quá bận, ít phân cấp | Background có đầy cây, ngói, mái hiên và bóng rõ gần bằng vùng chơi; giảm alpha làm ảnh bạc chứ không làm nó thành cùng phong cách. | Cảnh chơi rõ nhất, cảnh phụ nhẹ hơn, nền xa chỉ khối phố chính; bỏ chi tiết nhỏ không đọc được ở mobile. Nền kín, màu chốt sẵn thay vì phủ tint để chữa màu. |

## Hướng mỹ thuật được đề xuất

- Hoạt hình2.5D isometric, giữ phép chiếu2:1 đang dùng; không chuyển3D.
- Palette gốc theo UI: giấy#FFFAF0, kem#FFF6E5, nét#5A3825, coral#FF7F6B, mint#6FD3C0. Cho phép màu phụ dịu của đường/cây, không giới hạn mọi vật vào đúng năm màu.
- Mỗi vật liệu hai đến ba mảng sáng/tối chính; ánh sáng nhất quán từ trái trên. Không texture ảnh thật, không phủ dày vết bẩn/ngói/lá nhỏ.
- Nhà khác cấu trúc mái/cửa/ban công nhưng cùng ngôn ngữ tạo hình; người khác tuổi/tóc/vóc dáng và trang phục nhưng cùng tỷ lệ đầu/thân, nét và bóng. Đa dạng không đồng nghĩa mỗi người một phong cách.
- Tiếp tục bỏ hồ theo lựa chọn người dùng; không thêm mục tiêu, nhấp nháy hero hoặc các kết thúc theo giờ đã xóa.

## Thứ tự sửa

1. Làm một khung mẫu tổng hợp có UI thật, một đoạn phố, hero, NPC, cây, quầy và xe cứu thương ở cùng camera. Xem ở chiều rộng390px và PC. Chốt tính đồng bộ bằng cả cảnh, không duyệt từng PNG riêng.
2. Từ khung mẫu, khóa bảng màu, độ dày nét, ánh sáng, tỷ lệ và pivot. Lấy UI hiện có làm chuẩn.
3. Làm lại background liền cảnh theo bố cục map, bỏ lật gương và chữa ranh giới “tấm sàn”. Background phải không cạnh tranh với đường chơi.
4. Thay nhà/cây/quầy/xe và nhân vật theo chuẩn đã khóa; ưu tiên phần xuất hiện gần hero. Giữ biến thể có ý nghĩa nhưng không giữ ảnh chỉ vì đã tạo trước đó.
5. Xem lại tổng cảnh trong game ở dọc/ngang/PC, sau đó mới căn animation và xuất bản runtime gọn.

Điều kiện qua bước1: UI/hero/cảnh trông cùng một game; nhận ra nhân vật và chỗ đi được ngay; không thấy map nổi trên một bức ảnh khác; cảnh nền không lộ gương hoặc đổi hướng sáng. Không sinh thêm hàng loạt asset trước khi khung mẫu đáp ứng các điều kiện này.
