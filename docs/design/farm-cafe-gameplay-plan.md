# Thiết kế vận hành nông trại – quán cà phê

> Bản đề xuất lịch sử. Các luật đã chốt hiện nằm ở [luật vận hành hiện hành](../farm-operations-guide.md); không dùng giới hạn tuyển người hay các luồng cũ ở đây để ghi đè luật mới.

Bản đề xuất ngày 02/11/2026. Đây là thiết kế để chốt luật chơi trước khi sửa gameplay; các con số thời gian, giá và chỉ số bên dưới là cấu hình khởi điểm để cân bằng, chưa phải thông số đã kiểm chứng bằng playtest. Không thay đổi code game trong lượt lập kế hoạch này.

## 1. Đích thiết kế và phạm vi

Người chơi điều hành một chuỗi: trồng cà phê → chăm cây → thu hái → sơ chế → rang → chuyển hàng → pha bán tại quán. Quán gửi nhu cầu ngược về nông trại. Bán thu mua là đầu ra xoay vốn và tiêu thụ hàng dư, không phải lúc nào cũng bán hết rồi đi mua lại để pha.

- Một nông trại gồm 4 ruộng, mỗi ruộng 12 vị trí cây, tổng 48 cây.
- Tối đa **2 nhân viên đang thuê trong toàn bộ một nông trại**, không phải 2 người mỗi ruộng. Người chơi có thể cùng làm việc.
- Cấp công trình, dụng cụ và nhân viên từ 1 tới 10. Tăng số nhân viên vượt 2 không nằm trong nâng cấp.
- Cà phê là cây lâu năm; thu hoạch không xóa cây. Không có vòng lặp gieo lại sau mỗi lần hái.
- Chất lượng, mùa vụ, công suất, kho, lao động và tiền tạo ra quyết định quản lý. Tránh biến thành chỉ chờ đồng hồ rồi bấm nhận.
- Nước, phân, giống, nhiên liệu, hàng trong kho và tiền đều phải có nguồn gốc, số lượng và chi phí.
- Toàn bộ điều khiển ưu tiên vật thể trên map. Kho/shop/nâng cấp/nhân viên là cửa sổ game; thao tác giống/tưới/phân/cuốc dùng thanh công cụ và kéo-thả.

## 2. Căn cứ thực tế và cách rút gọn

### 2.1 Điều giữ đúng

Cà phê có giai đoạn vườn ươm/cây con, kiến thiết, ra hoa, nuôi quả, chín, thu hái và phục hồi. Nhu cầu nước và dinh dưỡng thay đổi theo giai đoạn. Không được biến mọi cây thiếu chút nước thành phải tưới ngay bất kể mùa.

Cây giống cần phù hợp địa điểm. Vườn đầu đề xuất là vùng cà phê vối; cà phê chè dành cho khu khí hậu phù hợp mở sau. Không thiết kế giống chè luôn đắt hơn và tốt hơn vối trong mọi công thức: chúng có vai trò sản phẩm khác nhau. Cà phê mít là nhánh đặc sản mở sau khi hệ chính đã ổn.

Ngoài đời cà phê mất nhiều năm để vào kinh doanh. Game rút ngắn thời gian nhưng giữ thứ tự giai đoạn và sự khác nhau giữa lứa đầu với cây trưởng thành. Ruộng ô vuông là cách biểu diễn quản lý, không phải mật độ canh tác quy đổi trực tiếp ra mét.

### 2.2 Những luật bản thử nên thay

| Bản thử hiện nay | Luật vận hành đề xuất |
|---|---|
| Hạt xuống đất rồi cho quả rất nhanh | Gieo ở vườn ươm hoặc mua cây con; cây mới phải qua kiến thiết |
| Cứ bón là tăng tốc và thêm quả | Bón theo nhu cầu/giai đoạn, có tổng liều; bón thừa gây bất lợi |
| Cứ hết phần trăm là tưới | Xét độ ẩm vùng rễ, giai đoạn, mưa và thoát nước |
| Hái xong lập tức bắt đầu đồng hồ quả mới | Phục hồi → phân hóa mầm → hoa → quả → chín |
| Quả khô đem rang trực tiếp | Có bước tách vỏ trong sơ chế; có thể gộp trong cùng công trình |
| Xay hết rồi cất đợi quán | Chủ yếu chuyển hạt rang, quán xay gần lúc pha |
| Đủ hàng là chạy vô hạn mẻ trên một sân | Được xếp nhiều lệnh nhưng hoạt động bị giới hạn bởi công suất/diện tích |
| Bình tự đầy mỗi lần tải lại | Khôi phục đúng nước còn lại; lấy nước từ nguồn có dự trữ |

Không cần dựng lại nhà tách vỏ riêng. Sân phơi có thể là **khu sơ chế khô**, chạy các công đoạn phơi → tách vỏ tích hợp → phân loại. Đầu ra là hạt sạch chưa rang. Đây là gộp thao tác/UI, không bỏ công đoạn trong mô hình.

### 2.3 Nguồn nghiên cứu chính

1. CIRAD – vòng đời, nhân giống, chăm sóc và thu hái cà phê: https://www.cirad.fr/en/our-activities-our-impact/tropical-value-chains/coffee/plant-and-uses
2. World Coffee Research – lựa chọn giống theo năng suất, nhu cầu và điều kiện: https://worldcoffeeresearch.org/resources/coffee-varieties-catalog
3. FAO – trồng, quản lý cây non, che bóng, tưới: https://www.fao.org/4/ae939e/ae939e05.htm
4. FAO – dinh dưỡng và quản lý phân: https://www.fao.org/4/ae939e/ae939e06.htm
5. FAO – tỉa cành: https://www.fao.org/4/ae939e/ae939e07.htm
6. FAO – thu hái, sơ chế và hạt sạch trước rang: https://www.fao.org/4/ae939e/ae939e08.htm
7. Trung tâm Khuyến nông Quốc gia – quy trình tưới nhỏ giọt cà phê vối, có phân biệt giai đoạn: https://khuyennongvn.gov.vn/khoa-hoc-cong-nghe/khcn-trong-nuoc/quy-trinh-tam-thoi-tuoi-nho-giot-cho-cay-ca-phe-voi-thoi-ky-kinh-doanh-15119.html
8. WASI – tưới tiết kiệm: https://wasi.org.vn/tuoi-nuoc-tiet-kiem-giai-phap-nang-cao-hieu-qua-kinh-te-moi-truong-trong-san-xuat-ca-phe-ben-vung-o-tay-nguyen/
9. SCA – độ tươi và tác động của xay: https://sca.coffee/sca-news/coffee-decoded-9-fresh-coffee

Các tài liệu có vùng áp dụng khác nhau; không lấy định mức nước Arabica tại Lào gán nguyên cho Robusta Việt Nam. Game dùng chỉ số tương đối, không trình bày các con số mô phỏng như hướng dẫn nông nghiệp ngoài đời. Các tài liệu cũ về chế biến có nhận định chất lượng theo bối cảnh thời đó; không dùng chúng để kết luận mọi cà phê chế biến khô đều thấp cấp.

## 3. Thời gian và mùa vụ

### 3.1 Đồng hồ thống nhất

Đề xuất khởi điểm:

- 1 ngày vận hành = 12 phút chơi.
- 1 vụ mô phỏng = 12 ngày vận hành = 144 phút.
- Thời gian cây, thời tiết, lương, đơn quán, kho và máy đều dùng cùng đồng hồ mô phỏng.
- Đây là nén theo giai đoạn, không phải phép quy đổi cố định rằng 12 phút ngoài đời bằng một ngày sinh học thật.
- Mốc gieo/thu hái không chạy theo FPS. Đổi map sang quán không dừng nông trại.

| Ngày trong vụ | Giai đoạn chính | Quyết định của người chơi |
|---|---|---|
| 1–2 | Phân hóa mầm và chuẩn bị | Kiểm tra cây, dinh dưỡng, nước; không tưới máy móc vào thời kỳ cần khô tương đối |
| 3 | Ra hoa | Tưới đúng trạng thái mầm/điều kiện; theo dõi hoa |
| 4–8 | Đậu và nuôi quả | Duy trì ẩm, dinh dưỡng, cỏ và sâu bệnh |
| 9–10 | Chín và thu hái chọn lọc | Hái quả đủ chín thành 2 đợt, xử lý lô quả sớm |
| 11–12 | Phục hồi sau vụ | Tỉa cành, vệ sinh, bổ sung dinh dưỡng và bảo trì |

Lịch này là mô hình game cho vùng khởi đầu, không phải lịch tháng trồng thực tế. Thời tiết/vùng khác có cấu hình riêng.

### 3.2 Không bắt người mới chờ cả vụ

Mở game ở đầu giai đoạn thu hoạch, có 4 cây trưởng thành đã chín, 4 cây trưởng thành đang vào chín và 4 vị trí trống. Người chơi thấy ngay cả thu hái lẫn trồng mới. Có một lượng hạt sạch/hạt rang khởi đầu để mở quán; không phải đợi cây mới cho quả mới được chơi quán.

Cây con mới cần hoàn thành một chu kỳ kiến thiết rồi đón cửa sổ ra hoa kế tiếp. Lứa đầu năng suất thấp hơn cây đã ổn định. Nâng cấp không biến cây con thành cây trưởng thành ngay lập tức.

## 4. Trạng thái cây và thuật toán chăm sóc

### 4.1 Dữ liệu tối thiểu của một cây

`treeId, species, cultivar, plantedAt, ageStage, cropStage, rootMoisture, nutrients, weeds, canopy, health, pestPressure, flowerSet, fruitSet, ripeMass, unripeMass, treatmentHistory, taskReservations`.

Vùng đất có thêm khả năng giữ nước, thoát nước, độ phì, che bóng và mức thích hợp khí hậu. Hạt/cây giống không thay thế cho độ phì đất.

Chuỗi trạng thái:

`Ô trống → Chuẩn bị đất → Cây con → Kiến thiết → Phân hóa mầm → Hoa → Quả non → Nuôi quả → Chín → Thu chọn → Phục hồi`.

Nếu vẫn còn quả xanh sau lần hái đầu, cây ở trạng thái thu chọn chờ đợt sau; không xóa phần quả còn lại. Cuốc bỏ cây là thao tác hủy trồng lại, không được coi là thu hoạch.

### 4.2 Nước

Dùng chỉ số nước hữu dụng vùng rễ `M ∈ [0,100]`, không khẳng định đó là độ ẩm thể tích đo thật.

`M_next = clamp(M + mưa_hữu_hiệu + nước_tưới_hấp_thụ - bốc_thoát - thoát_nước, 0, 100)`.

Nhu cầu phụ thuộc giai đoạn, tuổi cây, nắng, che phủ và đất. Bản đầu gợi ý cây non/nuôi quả cần tưới khi M dưới 35–40, tưới tới khoảng 65–75. Không tưới đầy 100 mọi lần. Giai đoạn phân hóa mầm có quy tắc riêng: thiếu nước có kiểm soát không đồng nghĩa với stress nguy hiểm.

- Tưới khi đã đủ ẩm: hiện dấu cấm, không trừ nước.
- Tưới quá sớm/quá nhiều nếu bật thao tác cưỡng bức nâng cao: tăng nguy cơ úng, không cộng tiến độ.
- Mưa đủ thay một lượt tưới; mưa lớn có thể cần thoát nước.
- Phủ gốc giúp giảm mất nước và cỏ; hệ tưới tiết kiệm giảm nước/công đi lại.
- Giếng có lưu lượng bổ sung, bể có sức chứa. Bình là dụng cụ mang nước, không tự sinh nước.
- Ao cá có giới hạn mực nước. Không hút cạn ao đang nuôi cá; có mức dự trữ tối thiểu.

UI chỉ hiện giọt nước khi thực sự có nhiệm vụ tưới hợp lệ. Chạm cây xem lý do: “Đất đủ ẩm”, “Đang chờ phân hóa mầm”, hoặc “Cần tưới để nuôi quả”.

### 4.3 Phân bón

Không dùng luật bón một lần ở 15–65% cho mọi giống và mọi vụ nữa. Có các cửa sổ dinh dưỡng: phục hồi sau thu, trước/đầu nuôi quả, giữa nuôi quả. Tổng mức bón mỗi vụ bị giới hạn theo cây và trạng thái đất.

Bản đầu có hai loại dễ hiểu: phân hữu cơ đã ủ và phân nuôi cây/nuôi quả. N-P-K chi tiết lưu nội bộ hoặc mở trong cẩm nang, không bắt người mới pha liều hóa học.

Mỗi lần bón cần đúng giai đoạn, đất đủ ẩm, chưa bón đủ cửa sổ đó và còn vật tư. Bón thừa không tăng cấp cây, không cho thêm quả vô hạn. Giảm hiệu quả khi bón sai; cảnh báo trước khi cho cưỡng bức. Không cho bón xuống ao hoặc nước tưới quán.

### 4.4 Cỏ, tỉa cành, sâu bệnh

- Cỏ tạo áp lực cạnh tranh theo mức, không dừng toàn bộ cây ngay khi có vài lá cỏ.
- Dọn vùng gốc và lối đi; không cần nhổ trắng toàn bộ map liên tục.
- Tỉa cành sau thu hoạch giúp phục hồi/tán; không tỉa đại trà lúc đang mang quả để lấy điểm thưởng.
- Sâu bệnh xuất hiện theo rủi ro vùng/thời tiết/sức cây. Chỉ phát sinh nhiệm vụ kiểm tra/xử lý khi đạt ngưỡng, không bắt phun định kỳ vô nghĩa.
- Cây thiếu chăm lâu giảm sức khỏe/năng suất; bản tiêu chuẩn không làm chết hàng loạt khi người chơi offline.
- Thuốc/vật tư xử lý có điều kiện và thời gian chờ thu hái ở chế độ nâng cao; không thiết kế “phun xong hái ngay được thưởng”.

### 4.5 Sinh trưởng, năng suất và chất lượng

Sinh trưởng khi giai đoạn cho phép:

`Δg = Δt / T_stage × f_nước × f_dinh_dưỡng × f_khí_hậu × f_sức_khỏe`.

Các hệ số nằm trong 0–1, không nhân thành tăng tốc vô hạn. Canh tác tốt giúp đạt tiềm năng giống; không biến thành phép nhân 10 lần sản lượng nhờ chồng nâng cấp.

`Y = Y_tiềm_năng × f_tuổi × f_đậu_quả × (1 - tổn_thất_stress - tổn_thất_sâu_bệnh)`.

Năng suất và chất lượng tách riêng. Cây năng suất cao chưa chắc pha ra mọi món có giá cao nhất. Quả hái đúng độ chín có giá trị chất lượng tốt; quả xanh/quá chín tách lô, không trộn rồi lấy điểm trung bình đẹp.

## 5. Thu hái và sơ chế đúng chuỗi

### 5.1 Thu chọn

Chỉ hiện giỏ khi có lượng quả chín tối thiểu để thu. Một cây có thể cần hai lần hái trong cửa sổ chín; không dùng cuốc để thu. Giỏ có sức chứa, đầy phải mang về điểm tập kết. Nhân viên cũng tuân theo giới hạn này.

Lô quả lưu giống, nguồn ruộng, thời điểm hái, khối lượng, tỷ lệ chín và chất lượng. Ưu tiên đưa quả mới hái vào sơ chế trong cùng ngày vận hành; không để hàng tươi thành kho dự trữ vô hạn.

### 5.2 Một nhánh khô cho bản đầu

`Quả chín → Phân loại → Phơi có đảo/che mưa → Tách vỏ tích hợp → Hạt sạch chưa rang → Rang → Nghỉ hạt → Đóng gói/chuyển quán`.

- Hạt sạch là trạng thái hàng hóa thật trong dữ liệu dù công đoạn được gộp UI.
- Sân phơi có diện tích chứa; lớp quá dày không đơn giản là làm nhiều cùng tốc độ.
- Vòng tiến độ tính từ tốc độ thoát ẩm theo nắng, thông gió, lượng xếp và che phủ. Mưa làm chậm hoặc ướt lại nếu không che.
- Đảo giúp độ khô đồng đều; không chỉ là nút trừ cứng 5 giây.
- Có mốc khô mục tiêu theo phương pháp, không phơi càng lâu càng tốt. Hướng dẫn hiển thị chỉ số đủ khô và lý do chưa cho rang.
- Quy trình ướt/honey để nhánh mở rộng sau, không trộn tất cả phương pháp vào tutorial.

### 5.3 Công suất và nhiều mẻ

Đủ nguyên liệu cho phép thêm nhiều lệnh, **không có nghĩa công trình nhỏ chạy vô hạn mẻ đồng thời**.

Mỗi trạm có `C_capacity`, `WIP_active`, hàng đợi, vùng chứa hàng chờ nhận, độ bền, năng lượng và nhân công cần lúc nạp/nhận. Chỉ bắt đầu khi có đủ cả đầu vào và chỗ vận hành. Công suất sân phơi tính theo kg/diện tích; lò tính kg/lần rang; máy xay tính kg/phút.

Nếu lệnh vượt công suất: chia thành các mẻ con; người chơi thấy “Đang làm 2 · Chờ 3”. Phần đang chạy độc lập theo số vị trí thực tế. Đầu vào đang xếp hàng được giữ chỗ trong kho, không biến mất hoặc vẫn đem bán được. Hủy trước khi chạy trả giữ chỗ; hủy sau khi chế biến bắt đầu không hoàn nguyên như chưa làm gì.

Đầu ra đầy thì trạm chuyển “Chờ nhận/chuyển kho”, không sinh sản phẩm rơi mất hoặc đè lên lô trước. Máy không chiếm nhân viên suốt thời gian chờ; nhân viên nạp mẻ rồi được làm việc khác.

### 5.4 Bảo toàn khối lượng

Dữ liệu lưu gram nguyên; ly dùng gram theo công thức. Tỷ lệ đổi là cấu hình theo giống/phương pháp/chất lượng.

Ví dụ cân bằng khởi điểm cho một ruộng 12 cây trưởng thành, hoàn toàn là số game:

- 12 × 3 kg quả = 36 kg quả/vụ.
- 36 kg quả → 12 kg quả khô → 6 kg hạt sạch.
- Rang hao 16%: 6 kg → 5.04 kg hạt rang.
- Liều pha mẫu 18 g: tối đa 280 ly trước các thất thoát tại quán.

Không dùng một “quả” thành một “túi” không có khối lượng. Nâng cấp giúp giảm thất thoát trong mức trần, không tạo thêm khối lượng. Mọi tổn thất có đầu ra: nước bốc hơi, vỏ, loại bỏ, hao rang. Vỏ/bã chỉ thành phân sau ủ, không bón trực tiếp vô hạn.

### 5.5 Rang và xay

Rang có lựa chọn hồ sơ nhạt/vừa/đậm phù hợp món; không có loại rang tốt nhất cho tất cả. Lò tốt kiểm soát ổn định, tiết kiệm năng lượng, ít hỏng; không chữa được lô đầu vào đã lỗi.

Hạt rang có giai đoạn nghỉ tùy cấu hình rang/pha, rồi giảm độ tươi theo bảo quản. Quán ưu tiên nhận hạt rang nguyên và xay theo đơn/ca nhỏ. Máy xay ở farm dùng cho đơn bột đóng gói hoặc quán chưa có máy; không bắt mọi hàng chuyển quán phải xay sẵn.

## 6. Kho, vận chuyển và liên kết hai map

### 6.1 Kho theo lô

Mỗi lô có `lotId, product, cultivar, mass, quality, producedAt, processHistory, storageCondition, origin, location, reservedMass`.

`khả_dụng = đang_có - đang_giữ_chỗ`.

Quả tươi, hạt sạch, hạt rang và bột có quy tắc lưu kho riêng. Dùng lô gần hết độ tươi trước khi phù hợp công thức; không lấy FIFO cứng khi làm sai yêu cầu chất lượng.

Không cộng hàng vào cả kho farm lẫn kho quán. Hàng có trạng thái duy nhất: farm → đang vận chuyển → quán. Một chuyến chỉ nhận một lần; đổi map/tải lại không tạo thêm hàng.

### 6.2 Quán gửi nhu cầu ngược về farm

Quán gửi nhu cầu theo món/giống/hồ sơ rang/chất lượng và mức dự trữ. Farm tạo kế hoạch rang/chuyển từ nhu cầu đó.

`M_cần = tổng(số_ly_dự_báo_món × liều_cà_phê_món) × (1 + dự_phòng)`.

`đặt_bổ_sung = max(0, M_cần_trong_thời_gian_giao + tồn_an_toàn - tồn_khả_dụng_quán - hàng_đang_đến)`.

Ví dụ 40 ly × 18 g = 720 g/ngày. Dự phòng 20% cho một ngày là 864 g, không phải 864 g cộng thêm mỗi lần mở màn hình. Phiếu đang chờ phải được tính vào để tránh đặt trùng.

Ưu tiên xuất quán theo định mức dự trữ đã cài. Chỉ bán hàng dư, hoặc người chơi xác nhận bán phần quán đang cần. Quán thiếu hàng vẫn có thể đặt nhà cung cấp ngoài với giá cao hơn; không được mắc kẹt không thể tiếp tục vì cây còn non.

### 6.3 Quán vận hành

Khách đến → gọi món → giữ nguyên liệu → xay/pha → phục vụ → thu tiền → vệ sinh. Hàng chờ, chỗ ngồi, tốc độ pha, công thức và khẩu vị quyết định số khách phục vụ được.

Danh tiếng tăng nhu cầu nhưng không đảm bảo lấp đầy quán. Giá quá cao, chờ quá lâu, hết món và chất lượng thấp giảm tỷ lệ mua/quay lại. Bán cafe pha có giá trị gia tăng vì có chi phí phục vụ, nguyên liệu phụ và rủi ro tồn kho, không phải nhân giá hạt tùy ý.

Công thức ví dụ phin/espresso/sữa dùng lượng cà phê và nguyên liệu khác nhau; các định lượng là công thức game, không gán 18 g cho mọi thức uống.

## 7. Thuê tối đa hai nhân viên nông trại

### 7.1 Các chỉ số

Mỗi người có tên, cấp 1–10, bộ chỉ số nền cố định và kỹ năng học qua việc:

| Chỉ số | Tác động |
|---|---|
| Nhanh nhẹn | Tốc độ đi bộ và một phần tốc độ thao tác |
| Thông minh | Dự báo việc sắp đến hạn, ghép việc/gom chuyến hợp lý |
| Sức lực | Khả năng mang giỏ, nước, vật tư |
| Khéo léo | Độ đồng đều khi thu hái, nạp/đảo mẻ, giảm sai sót |
| Thể chất | Sức bền, khả năng phục hồi và chịu thời tiết |

Sức khỏe/năng lượng hiện tại là trạng thái biến đổi, khác với chỉ số thể chất nền. Người thông minh thấp vẫn tìm đường đúng, không cố tình đi xuyên rào hoặc đứng ngơ; khác biệt nằm ở hiệu quả lên kế hoạch.

Đề xuất sinh chỉ số nền: tổng 300 điểm cho 5 chỉ số, mỗi chỉ số trong 30–85. Bộ chỉ số sinh một lần và lưu lại, không đổi sau reload. Không có người vượt trội mọi mặt mà cùng chi phí. Tính cách/chuyên môn thể hiện lựa chọn, không cần cơ chế quay ngẫu nhiên trả tiền.

`A_hiệu_dụng(L) = min(100, A_nền + 2 × (L-1))`.

Kinh nghiệm chỉ có khi hoàn thành việc hợp lệ; spam tưới cây đã đủ nước không nhận XP. Mốc XP đề xuất để đạt cấp L: `100 × (L-1)^2`, tới cấp 10 ngừng tăng cấp. Tốc độ tăng còn cần hiệu chỉnh sau playtest.

### 7.2 Tốc độ và sức bền

Với chỉ số quy về 0–1:

`v_đi = v0 × (0.75 + 0.5 × nhanh_nhẹn) × f_mệt`.

`thời_gian_làm = T0 / (0.7 + 0.35 × nhanh_nhẹn + 0.25 × kỹ_năng_việc) / f_mệt`.

Chỉ áp dụng tăng cấp qua chỉ số/kỹ năng một lần; không nhân thêm một hệ số level lớn bên ngoài rồi nhân tiếp vô hạn. Mệt làm giảm hiệu suất có sàn, không biến thành di chuyển âm hoặc đứng cứng không giải thích.

Ví dụ ca làm 8 phút trong mỗi ngày game 12 phút, nghỉ 4 phút; hai người có thể đổi ca. Khi thể lực thấp nhân viên nghỉ/ăn/uống và hiển thị lý do. Sức khỏe thấp tạm nghỉ; không để người chơi phải bấm chăm nhân viên mỗi vài giây.

Lương theo thời gian ca có hợp đồng, không theo số lần người chơi mở map. Thông báo trước khi thiếu lương; không để thiếu tiền một lần là mất vĩnh viễn nhân viên và toàn bộ tiến trình đào tạo.

### 7.3 Thuê và phân vai

Nhân viên thứ nhất mở sau khi người chơi hiểu trồng/chăm/chế biến một lô. Người thứ hai mở khi đủ nhu cầu vận hành, không cấp hai người ngay để tutorial tự chơi hết.

Mặc định:

- A: chăm cây, thu hái, cấp nước/vật tư.
- B: sơ chế, vận chuyển, nhận thành phẩm, hỗ trợ vườn khi nguy cấp.

Đây là ưu tiên mềm; không đứng rảnh khi việc ưu tiên hết mà vườn đang cần cứu. Người chơi có thể giới hạn ruộng/nhóm việc. Không tự ý cuốc bỏ cây, đổi giống, bán hàng, mở ruộng hay tiêu tiền nâng cấp nếu chưa bật quyền rõ ràng.

Nhân viên quán thuộc hệ quán và ngân sách quán, không làm tăng giới hạn hai người của farm. Bản đầu có thể dùng người chơi phục vụ quán; giới hạn nhân viên quán cần chốt riêng khi triển khai màn quán.

## 8. Thuật toán chia việc

### 8.1 Mọi người dùng cùng luật

Player và nhân viên gọi cùng lệnh nghiệp vụ: kiểm tra điều kiện → giữ chỗ → tìm đường → đến điểm làm → thao tác → kiểm tra lại → trừ tài nguyên/cộng kết quả đúng một lần.

Một việc lưu: ID, loại, vị trí, mục tiêu, điều kiện, hạn xử lý, vật tư cần, thời gian, người giữ việc, phiên bản mục tiêu và trạng thái. Không tạo hàng trăm việc tưới giống nhau cho một cây qua mỗi tick.

Khóa duy nhất theo `(mục tiêu, loại việc, vụ/giai đoạn)`. Mỗi người chỉ làm một việc trực tiếp tại một thời điểm; máy chờ chạy tự động không khóa người.

### 8.2 Thứ tự ưu tiên

1. Cứu cây/lô hàng sắp hỏng, che mưa cho mẻ đang phơi.
2. Thu quả chín tới hạn; đưa quả tươi vào sơ chế; bổ sung quán sắp hết hàng.
3. Tưới/bón đúng cửa sổ, nhận hàng để giải phóng công suất.
4. Làm cỏ, tỉa đúng lịch, vận chuyển gom chuyến.
5. Bảo trì và việc ít gấp.

Trong cùng nhóm, điểm lựa chọn chuẩn hóa 0–1:

`S = 0.45 × khẩn_cấp + 0.25 × tác_động_nhu_cầu + 0.15 × tiện_đường + 0.10 × hợp_kỹ_năng + 0.05 × thời_gian_đã_chờ`.

`tiện_đường = 1 / (1 + ETA/60 giây)` với ETA gồm lấy vật tư, di chuyển và thao tác. Không dùng khoảng cách thẳng nếu phải đi qua rào.

Vì chỉ có hai nhân viên, xét các cặp việc khả thi rồi chọn cặp có tổng điểm tốt nhất, không giao hai việc cùng khóa/nguồn hàng. Công việc khẩn cấp thuộc nhóm cao hơn được bảo vệ trước khi tối ưu điểm. Thời gian đã chờ tránh việc thường bị bỏ đói mãi.

### 8.3 Phụ thuộc và giữ tài nguyên

Ví dụ tưới: cần bình → lấy nước nếu thiếu → mang tới cây → tưới. Hái: cần giỏ và chỗ chứa → hái → mang về → sơ chế. Không nạp lò nếu đầu ra không còn chỗ.

Giữ vật tư cho việc đã nhận; hủy trước khi dùng trả giữ chỗ. Chỉ trừ thật khi thao tác hoàn thành hoặc khi nguyên liệu đã được đưa vào máy. Hai người không lấy cùng một bao hàng vì cùng thấy tồn kho cũ.

Player ưu tiên trên nhân viên: nếu người chơi chọn cây nhân viên chưa bắt đầu, chuyển quyền giữ việc an toàn và nhân viên tìm việc khác. Nếu đã dùng vật tư, không hoàn thêm một lần rồi để player lại nhận kết quả.

### 8.4 Tránh đổi việc liên tục

Không đánh giá lại toàn bộ việc mỗi frame. Chỉ phân lại khi người rảnh, có sự kiện quan trọng hoặc sau 2–5 giây. Không ngắt thao tác ngắn đang dở chỉ vì xuất hiện việc gần hơn. Công việc nguy cấp có thể ngắt ở điểm an toàn, không dừng giữa animation rồi mất vật tư.

Nếu không có việc, nhân viên đứng ở điểm nghỉ, không đi vòng ngẫu nhiên qua ruộng. Nếu kẹt đường: tìm lại → thử lối tiếp cận khác → nhường điểm hẹp → báo lý do và nhận việc khác, không thử vô hạn.

### 8.5 Công suất lao động

`ρ = tổng giây công cần trong vụ / tổng giây ca khả dụng`.

Mục tiêu ρ khoảng 0.65–0.80 khi có một người và người chơi có tham gia; hai người giúp giảm việc lặp để người chơi tập trung chất lượng/quán. Khi đo được ρ > 1, phải đổi lịch, công cụ hoặc số ruộng đang canh tác; không tăng tốc nhân viên âm thầm để che lỗi cân bằng.

Ví dụ hai người, mỗi người làm 8 phút/ngày, 12 ngày/vụ: 192 phút công/vụ. Con số nhu cầu công phải cộng cả đi lại, lấy nước, giỏ đầy, nạp hàng, nghỉ và chờ cổng, không chỉ animation tưới.

## 9. Tìm đường và bố trí map

Map dùng cùng dữ liệu rào/cổng/công trình cho render và va chạm; không có hình chữ nhật ảo lớn hơn ruộng. Cổng mở mới tạo cạnh đi qua trong đồ thị đường.

- Đường chính rộng ít nhất hai thân người cộng biên, mục tiêu 2.0–2.4 đơn vị gameplay.
- Lối giữa các ruộng có tối thiểu một người đi với khoảng an toàn; cổng ruộng không hẹp hơn lối.
- Giếng ở cuối hành lang, cửa lấy nước quay vào lối. Chừa chỗ đứng và chỗ người khác đi qua, không đặt điểm lấy nước giữa cột/rào.
- Ao ở khu riêng, có bờ/rào và đường bảo trì; không chiếm đường duy nhất nối ruộng với xưởng.
- Nhà có ít nhất hai điểm tiếp cận khả thi phía thao tác, không yêu cầu đi vào tâm nhà.

Đề xuất đồ thị cấp cao nối cổng ruộng, ngã rẽ, cửa xưởng, giếng và kho; A* cục bộ xử lý đoạn cuối. Khoảng cách phân việc dùng độ dài đường thực. Tái sử dụng đường đã tính khi map không đổi.

Hai nhân viên và player dùng né va chạm cục bộ, đặt chỗ ở cửa hẹp và quy tắc nhường. Không cần giải bài toán đám đông lớn. Không cho cả hai khóa cùng cổng rồi đứng đối diện nhau mãi.

Kéo chọn ô là một trạng thái UI riêng: không làm camera chạy, không phát lệnh đi, không tiêu tài nguyên trước khi thả. Danh sách ô không trùng, có thể kéo ngược để rút bớt và bị chặn theo số vật tư khả dụng. Ô chờ làm giữ sáng, tắt theo kết quả từng ô.

## 10. Nâng cấp mọi nhóm tài sản tới cấp 10

### 10.1 Luật chung

- Cấp 1 là dùng được; cấp 10 là giới hạn.
- Không chỉ đổi màu và tăng giá: mỗi nhóm có lợi ích liên quan đúng công năng.
- Nâng cấp không tăng sản lượng, tốc độ, sức chứa và chất lượng cực lớn cùng lúc.
- Vật tư tiêu hao không có cấp kiểu “quả cấp 10”; chất lượng lô là hệ riêng. Cấp áp dụng tài sản/công cụ/nhân sự.
- Mốc 3/6/10 có thay đổi hình ảnh hoặc tính năng; các cấp giữa tăng dần.
- Một công trình không chạy sản xuất trong lúc nâng cấp phần cần tháo máy; hàng đã có phải được xử lý/giữ an toàn trước khi bắt đầu.

| Nhóm | Nâng cấp thực sự thay đổi | Không được làm |
|---|---|---|
| Nhà điều hành | Kế hoạch, bảng công việc, dự báo, chỗ nghỉ | Tạo thêm người vượt giới hạn 2 |
| Ruộng/đất | Giữ ẩm, thoát nước, độ phì, hạ tầng tưới | Mỗi cấp mọc thêm quả vô hạn |
| Rào/cổng | Độ bền, ít sửa, bảo vệ, cổng thuận tiện | Dời biên va chạm bất ngờ làm kẹt người |
| Giếng/bơm/bể | Lưu lượng, dự trữ, tiết kiệm công | Nước vô hạn chỉ vì mở map |
| Ao cá | Dự trữ nước, lọc, sức tải cá, sục khí | Cá sinh vô hạn khi thiếu oxy/thức ăn |
| Bình/giỏ/dụng cụ | Sức chứa, thời gian thao tác, độ bền | Nhân tỷ lệ chuyển hóa cà phê |
| Khu sơ chế | Diện tích, thông gió, che mưa, độ đồng đều | Xếp hàng vô hạn cùng chạy |
| Lò rang | Khối lượng mẻ, ổn định, hiệu suất năng lượng | Phục hồi lô đã mốc bằng rang |
| Máy xay | Năng suất, đồng đều, ít hao, nhiều cỡ xay | Mỗi kg hạt thành nhiều kg bột |
| Kho | Sức chứa, chống ẩm, bảo quản lô | Gộp mọi lô mất nguồn gốc |
| Đóng gói/giao hàng | Trọng lượng chuyến, bảo quản, thời gian | Nhận hàng ở hai map cùng lúc |
| Nhân viên | Chỉ số/kỹ năng trong giới hạn, thao tác tốt hơn | Tự bán hoặc phá cây không được cấp quyền |
| Quầy/máy pha/bàn ghế quán | Công suất, ổn định, chỗ ngồi, trải nghiệm | Khách trả tiền khi chưa phục vụ |

Ví dụ hệ số vừa phải: `hiệu_suất(L)=1+0.07×(L-1)`, tối đa 1.63; `sức_chứa(L)=B0×[1+0.18×(L-1)]`, tối đa 2.62 lần. Các loại tài sản không nhất thiết dùng chung hai hệ số.

Giá từ cấp L lên L+1: `ceil(C0 × 1.42^(L-1))`, cộng vật liệu và điều kiện tiến triển. Giá trị hoàn vốn phải được đo theo lợi nhuận tăng, không đặt số đẹp rồi buộc cày. Mục tiêu sơ bộ: nâng cấp đầu hoàn vốn 2–4 vụ, cấp giữa 4–8 vụ, cấp cao 8–15 vụ; điều chỉnh bằng dữ liệu.

### 10.2 Ao cá là nhánh phụ có trách nhiệm

Ao có nước tối thiểu, sức tải cá, oxy/chất lượng nước và thức ăn. Nâng cấp có lợi ích nhìn thấy, nhưng cá không tự làm phân/nước sạch vô hạn. Nước tưới vườn không mặc nhiên đủ chuẩn dùng pha đồ uống; quán có hệ nước riêng/lọc phù hợp trong luật game.

Bản đầu chỉ cần ao làm nguồn dự trữ và cảnh quan có vận hành. Nuôi cá thương phẩm thêm sau khi chuỗi cà phê và hai nhân viên ổn, tránh kéo game sang hai ngành chưa cân bằng.

## 11. Kinh tế và kiểm tra toán

### 11.1 Tiền thật trong game, không phải tiền vốn thử

100.000.000 xu hiện tại là dữ liệu thử giao diện, không dùng để đánh giá kinh tế. Bản chơi cân bằng phải có cấu hình vốn khởi đầu riêng; khi chuyển save phải thông báo cách xử lý vốn thử, không tự xóa tiền người chơi.

Các nguồn thu: bán hàng thu mua, doanh thu quán, hợp đồng, thưởng hướng dẫn một lần. Các nguồn chi: giống, vật tư, điện/nhiên liệu, nước, lương, bảo trì, đóng gói, giao hàng và nâng cấp.

Không cho lời bằng mua nguyên liệu tại shop rồi bán lại ngay cao hơn giá mua; thị trường biến động có giới hạn, không ngẫu nhiên làm mọi hợp đồng lỗ mà không cảnh báo.

### 11.2 Ví dụ cùng một lô

Toàn bộ số dưới đây là tiền và tỷ lệ game. Giả định bán đủ 280 ly từ 5.04 kg hạt rang, chưa có thất thoát phục vụ:

| Khoản | Giá trị ví dụ |
|---|---:|
| Chi phí trồng/thu/sơ chế/rang phân bổ cho lô | 156 xu |
| Bán hạt rang thu mua, 70 xu/kg | 352.8 xu |
| Lợi nhuận bán hạt rang | 196.8 xu |
| 280 ly × 4 xu | 1,120 xu |
| Nguyên liệu phụ, 0.7 xu/ly | 196 xu |
| Chi phí cố định quán phân bổ cho lô | 320 xu |
| Lợi nhuận hợp nhất khi bán ly | 448 xu |

Giá chuyển nội bộ theo giá cơ hội 352.8 xu: farm lãi 196.8; quán lãi `1120−352.8−196−320=251.2`; tổng 448. Đây chỉ là sổ phân tích, không cộng 352.8 xu tiền thật vào ví farm rồi cộng nguyên doanh thu quán mà bỏ giá vốn.

Phân bổ lương/chi phí cố định phải dựa trên toàn farm/quán và sản lượng kỳ; không lấy mức chi phí một ruộng ở quy mô bốn ruộng áp cho mọi người chơi rồi gọi là cân bằng. Nếu chỉ bán được 100 ly thì phải tính lại, không dùng lợi nhuận 280 ly.

### 11.3 Cung – cầu

Ví dụ 4 ruộng trưởng thành theo mức trên: 1,120 ly/vụ, bình quân 93.3 ly/ngày. Quán mục tiêu khoảng 80 ly/ngày để còn biên dự trữ. Quán muốn bán vượt khả năng farm phải mua ngoài hoặc mở nông trại ở bản đồ thế giới; không chỉ tăng nhu cầu mà không có nguồn cung.

Giai đoạn đầu nhu cầu 15–20 ly/ngày. Hàng có mùa vụ nên giữ hạt sạch, rang theo nhu cầu; không cần bắt cây đẻ quả liên tục để duy trì quán.

### 11.4 Các số phải đo khi cân bằng

Tỷ lệ sử dụng lao động, công suất phơi/rang, thời gian quán hết hàng, tỷ lệ quả hỏng, phần hàng bán thu mua, biên lợi nhuận, thời gian hoàn vốn, thời gian người chơi phải chạy việc lặp, số click cho một chu kỳ và lý do nhân viên chờ.

Nút thắt phải được hiển thị: “Thiếu diện tích phơi”, “Kho đầy”, “Nhân viên đang lấy nước”, “Quán đủ hàng 2 ngày”. Không để máy dừng mà người chơi chỉ thấy thanh tiến độ đứng yên.

## 12. UI game và hướng dẫn người chơi

### 12.1 Quy ước thao tác

- Bấm đất: đi tới điểm hợp lệ gần nhất; không đi xuyên rào.
- Bấm ô trống: sáng viền và chọn giống ở thanh nhỏ; không mở modal lớn.
- Công cụ có nút mở riêng; mặc định đóng. Nước, phân, cuốc có icon và số lượng/điều kiện.
- Kéo qua nhiều ô để đánh dấu; quay lại ô trước rút bớt; tối đa theo vật tư; thả mới thực hiện.
- Bấm nhà: chọn công trình và mở thanh lệnh; không tự nhận hàng.
- Bấm giỏ: tới nhận đúng mẻ/lô đã xong. Bấm đảo: tới đảo khi có việc hợp lệ.
- Đang làm giữ viền đúng mục tiêu, xong tắt; mục tiêu khác trong hàng chờ vẫn sáng.
- Tên công trình gắn phía trước chân nhà, có tương phản và tỷ lệ ổn định.
- Mọi thông báo gần mục tiêu hoặc trên HUD ngắn gọn, không hộp cảnh báo kiểu form web.

### 12.2 Hướng dẫn theo tình huống

Không đưa một tài liệu dài ngay khi vào game. Cho từng bước 1 câu và cho làm:

1. “Bấm giỏ trên cây để hái quả chín.” Có sẵn cây chín.
2. “Mang quả tới khu sơ chế.” Chỉ rõ cần bao nhiêu và đang có bao nhiêu.
3. “Mẻ đang khô; bạn có thể làm việc khác.” Cho thấy thanh/giây và vật thể trên sân.
4. “Bấm icon đảo khi xuất hiện.” Nói tác dụng đồng đều/giảm rủi ro.
5. “Bấm giỏ nhận hạt sạch.” Giải thích tách vỏ đã gộp tại khu sơ chế.
6. “Chọn hồ sơ rang cho món quán cần.” Cho một hồ sơ mẫu phù hợp.
7. “Chuyển lô hạt rang sang quán.” Hiện đúng hàng rời kho và trạng thái chuyến.
8. “Xay lượng cần và pha ly đầu.” Cho thấy nguyên liệu thật bị trừ.
9. “Chọn cây giống cho ô trống.” Giải thích đây là cây lâu năm.
10. “Cây đủ ẩm thì chưa cần tưới.” Minh họa dấu cấm, không tiêu nước.
11. “Thuê người thứ nhất và giao nhóm việc.” Cho xem nhiệm vụ/giữ chỗ/nghỉ.
12. “Quán báo cần bổ sung hàng.” Cài giữ hàng tối thiểu rồi mới bán dư.

Cẩm nang mở bằng icon riêng, gồm Cây cà phê, Chăm sóc theo giai đoạn, Sơ chế/rang/xay, Nhân viên, Kho/vận chuyển, Nâng cấp và Vì sao không thao tác được. Tất cả ngưỡng đang dùng trong cẩm nang phải đọc từ cùng cấu hình với gameplay để không hướng dẫn sai sau cập nhật.

### 12.3 Một ca chơi 20–30 phút

Vào game xem quán còn đủ hạt mấy ngày → giao ca cho hai người → tự kiểm tra lô cà phê/thu hái quan trọng → đưa lô vào sơ chế → qua quán vận hành/điều chỉnh menu → nhận hàng/quay farm khi có lý do → nâng đúng nút thắt → kết thúc ca với bản báo cáo 3 dòng: thu/chi, hàng còn, việc cần lần sau.

Giữ chân bằng cải thiện vận hành, giống/phương pháp mới, khách hàng và chuỗi cung ứng; không bắt tưới mỗi phút hoặc phạt nặng vì không đăng nhập liên tục.

## 13. Lưu game, offline và những điều không được sai

Dữ liệu nguồn dùng chung cho hai map: tài sản, cây, lô hàng, tiền, nhân viên, nhiệm vụ, đơn quán và chuyến giao. Hai map là hai cách xem, không phải hai bản sao kho.

- Lưu lệnh có mã duy nhất; hoàn thành lại cùng mã không phát xu/hàng lần hai.
- Bất kỳ lượng hàng nào cũng không âm, không quá giữ chỗ, không được vừa bán vừa nạp máy.
- Điểm đứng, lối vào và va chạm lấy từ cùng định nghĩa asset/map; chỉnh rào phải cập nhật đồ thị đường.
- Offline dùng cùng mô hình sự kiện, giới hạn đề xuất 8 giờ; chỉ làm được nếu có ca, vật tư, công suất và chỗ chứa.
- Nhân viên không được làm việc xuyên qua thời gian thiếu lương/nước/vật tư rồi tính hàng như đã đủ.
- Kết thúc mẻ không đòi đang mở map đó. UI nhận tay là cách lấy sản phẩm, không phải điều kiện để máy thật sự hoàn thành.
- Cây có bảo vệ offline ở mức game tiêu chuẩn: giảm tiến độ/hiệu quả có giới hạn, không chết hàng loạt. Nếu có chế độ khó thì ghi rõ trước khi chọn.
- Rút ngắn offline theo ngân sách sự kiện, không chạy lại hàng triệu khung hình. Đổi đồng hồ lùi không sinh tiền âm hoặc nhân đôi thu hoạch.
- Đổi bố cục/nâng nhà phải dành lối ra và điểm đứng an toàn; không tự teleport bình thường để che lỗi tìm đường.

## 14. Các ca kiểm chứng trước khi chốt cân bằng

1. Kéo có 3 hạt qua 10 ô chỉ giữ tối đa 3; quay lại ô 2 còn hai; một ô không nhận hai hạt.
2. Hủy trước khi gieo không mất hạt; cuốc cây đã trồng không hoàn hạt/không nhận quả.
3. Player và hai nhân viên cùng chọn một cây chỉ có một người hoàn thành, trừ vật tư đúng một lần.
4. Hai người cùng tới giếng/cổng hẹp có nhường đường, không khóa nhau vô hạn.
5. Giữ chỗ cà phê cho quán xong không thể bán hết phần giữ chỗ ở thu mua.
6. Nạp vượt công suất thì vào hàng chờ, không chạy vô hạn trên sân nhỏ.
7. Nhận mẻ đã xong chỉ cộng một lần, mẻ khác chưa xong tiếp tục giữ đúng trạng thái.
8. Hủy/chuyển map/reload giữa giao hàng không nhân đôi kho hoặc tiền.
9. Quán không có cà phê không pha được; có công thức thay thế/nhập ngoài hợp lệ để tiếp tục.
10. Chất lượng lô hỏng không được phục hồi hoàn toàn nhờ rang/xay/nâng nhà.
11. Mưa đủ làm mất việc tưới không cần thiết; giai đoạn cần khô không bị AI tưới tự động.
12. Level 10 dừng nâng, mọi hệ số có trần; vẫn chỉ 2 nhân viên mỗi farm.
13. Một vụ khô/đơn khách tăng không khiến vỡ toàn bộ nền kinh tế mà không có cảnh báo/giải pháp.
14. Offline/online cùng điều kiện cho kết quả tương đương trong sai số xác định của mô phỏng.

## 15. Thứ tự triển khai

**Giai đoạn A – luật và dữ liệu:** trạng thái cây, mùa vụ, đơn vị khối lượng, giữ chỗ hàng, công suất, tiền và đồng hồ chung. Thay vốn thử bằng cấu hình cân bằng riêng. Chưa làm nhiều mỹ thuật.

**Giai đoạn B – một vòng kín:** một giống vối, một ruộng hoạt động, sơ chế khô tích hợp, rang, vận chuyển, một món ở quán và thu mua. Chơi được trọn chuỗi và không nhân đôi tài nguyên.

**Giai đoạn C – lao động:** một người rồi hai người, lịch ca, bảng việc, giữ chỗ, di chuyển/cổng/giếng, lấy vật tư và giới hạn quyền.

**Giai đoạn D – phát triển:** 4 ruộng, hệ nâng cấp 1–10, kho/bảo quản, dự báo quán và tự đặt bổ sung. Đo công suất/hoàn vốn trước khi mở thêm giống/vùng.

**Giai đoạn E – chiều sâu:** thời tiết/sâu bệnh nhiều hơn, hồ sơ rang, chất lượng khách hàng, ao cá thương phẩm và bản đồ thế giới. Không mở đồng loạt mọi hệ trước khi vòng cơ bản ổn.

Điểm chốt quan trọng: lợi ích của mở rộng phải cân với lao động và nhu cầu quán. Nếu không, người chơi chỉ tích một đống hàng không có đầu ra, dù map và animation có đẹp cũng không thành gameplay quản lý.

## 16. Bảng thông số khởi điểm để đưa vào cấu hình

Các số sau chỉ là điểm xuất phát để mô phỏng cân bằng, không phải thông số đã thử hoặc khuyến cáo canh tác thật.

| Thành phần | Cấu hình gợi ý ban đầu | Ý nghĩa |
|---|---|---|
| Cấp quản lý farm/quán | 1–10 | Nâng tài sản tới cấp mới cần cấp quản lý tương ứng và điều kiện mở |
| Lối chính | 2.4 đơn vị game | Cho hai người tránh nhau |
| Lối phụ | Tối thiểu 1.4 đơn vị game | Có dự trữ cho bán kính người và lưới tìm đường |
| Cổng ruộng | 2.2 đơn vị game | Không phải nút cổ chai hẹp hơn đường |
| Nạp/tưới/hái | 3–8 giây mỗi thao tác cơ sở | Thời gian đi và vận chuyển cộng riêng |
| Sân phơi cấp 1 | 18 kg quả tươi/lượt, khoảng 8 phút nắng thuận | Thu một ruộng 36 kg cần hai lượt, vừa cửa sổ thu hái hai ngày |
| Lò rang cấp 1 | 1 kg hạt sạch/lượt, khoảng 2 phút | Có thể rang dần trong vụ vì hạt sạch bảo quản được |
| Máy xay cấp 1 | 1 kg/phút | Mẻ bột lớn phục vụ hợp đồng; quán vẫn ưu tiên xay theo đơn |
| Một ngày quán ban đầu | 15–20 ly dự báo | Không vượt nguồn farm non nếu chưa có nhập ngoài |
| Giới hạn tự mô phỏng khi offline | 8 giờ thực, phải có ca và vật tư | Không phải 8 giờ sản xuất vô điều kiện |

Ví dụ nút thắt: 4 ruộng thu 144 kg quả trong hai ngày game (24 phút) cần sơ chế trung bình 6 kg/phút. Sân cấp 1 chỉ khoảng 2.25 kg/phút nên không đáp ứng. Sân cấp 10 theo hệ số minh họa có khoảng 47.16 kg/lượt và thời gian 4.91 phút, tương đương 9.61 kg/phút trước ảnh hưởng thời tiết. Đây là lý do nâng khu sơ chế trước khi mở hết ruộng. Không đòi lò rang phải chạy toàn bộ sản lượng ngay lúc thu; giữ hạt sạch rồi rang theo dự báo quán.

Tiền dùng đơn vị nguyên nhỏ (100 đơn vị = 1 xu) trong sổ giao dịch; gram và đơn vị tiền nhỏ là số nguyên. Ví dụ 352.8 xu lưu là 35,280 đơn vị. Không làm tròn riêng từng bước của giao dịch rồi tạo chênh lệch mua/bán; quy tắc làm tròn thống nhất và ghi rõ ở công thức.

## 17. Điều chỉnh sau khi triển khai theo phản hồi người chơi

Bản vận hành hiện tại theo [hướng dẫn mới](../farm-operations-guide.md): farm và quán là hai scene riêng; giữ ao, bỏ nhà điều hành và điểm tập kết. Đội có thể tuyển nhiều người (8 ứng viên hiện có), mỗi farm chỉ bố trí 2. Nhân viên có lương theo cấp, phân công theo đơn và nhiệm vụ ngày; chủ chủ động giao hàng. Thời gian cây giống 90–150 giây, vụ trưởng thành khoảng 3 phút, sơ chế 30 giây, rang 18 giây, xay 10 giây. Các số dài trong đề xuất trước không còn là cấu hình đang áp dụng. Xem hướng dẫn mới để biết phần đã có và giới hạn hiện tại; chưa chạy kiểm tra hay cân bằng.
