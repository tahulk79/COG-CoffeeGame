# Đề xuất — Nhân viên tự vận hành nông trại

Ngày 02/11/2026. Đề xuất để chốt, **chưa triển khai**. Luật hiện hành: [farm-operations-guide.md](../farm-operations-guide.md).

## 1. Hiện trạng code (vì sao thợ "làm linh tinh")

| Vấn đề | Nguồn |
|---|---|
| Thợ **chỉ làm khi được giao đơn quán**. Không có đơn → đứng chờ, dù cây khát nước hay ô trống. Chế độ `workMode:'auto'` có lưu nhưng không được dùng | `crew.js` `assignment()` trả `false` khi `!orders.length` |
| Chỉ chăm **cây cùng giống với đơn** và chỉ khi kho rang còn thiếu. Đủ hàng là bỏ mặc vườn → cây khô, cỏ mọc | `assignment()` dòng cuối `needed.some(o=>o.cropId===cropId)` |
| Chỉ trồng khi **cả farm chưa có cây giống đó**; không lấp ô trống | `assignment()` nhánh `plant` |
| Mỗi lần đến cây chỉ làm **một việc** rồi quay lại tính tiếp; đi lại nhiều | `tasks()` sinh việc rời theo từng hành động |
| Thợ mang ít nước (≈2 lượt) → chạy tới giếng ở góc map liên tục | `model.js` `refill` |
| Ca lương **60 giây**, hết ca phải trả tiếp; mệt → nghỉ 60 giây hoặc trả "bồi dưỡng" | `rules.js` `workerWage`, `model.js` `shift`/`overtime`, `crew.js` |
| Mỗi đơn phải chọn người phụ trách, đủ hàng phải bấm Giao hoặc "Nhờ giao" | `model.js` `assign`, `requestDelivery` |
| Thợ không làm khi tắt game; `farm-0` gắn cứng → chưa sẵn sàng nhiều nông trại | `crew.js`, `model.js` |

## 2. Gameplay mục tiêu

Người chơi là **chủ trang trại**, không phải người bấm thay thợ. Chủ đặt **chỉ thị** cho từng nông trại; thợ tự lập việc theo nhu cầu thật và tự xử lý tình huống. Chủ can thiệp khi muốn (bấm ô/trạm vẫn làm ngay, thợ nhường).

### 2.1 Chỉ thị nông trại (một bảng "Quản lý farm")

| Chỉ thị | Mặc định | Ý nghĩa |
|---|---|---|
| Chăm vườn | Bật | Tưới, làm cỏ, tỉa, bón (nếu bật dùng phân), hái **mọi cây** đã mở |
| Trồng lấp ô trống | Bật · giống: Vối | Ô trống được trồng bằng giống đã chọn nếu còn hạt; tắt để giữ ô trống |
| Chế biến | Bật | Quả → phơi → rang theo **mức tồn mục tiêu**; xay chỉ khi bật |
| Đơn quán | Tự nhận | Đơn mới tự vào kế hoạch sản xuất, không cần chọn người |
| Tự giao hàng | Bật | Đủ hàng là thợ đóng chuyến, trả 2 xu/chuyến, ghi vào Hoạt động. Tắt thì chờ chủ bấm |
| Ngân sách vật tư/ngày | 0 xu | >0: thợ tự mua giống/phân khi thiếu, không vượt ngân sách. 0 = chỉ báo thiếu |

Nhân viên **không** tự bán hàng ra Chợ, mua đất, nâng cấp hay cuốc cây (giữ quyết định kinh tế cho chủ).

### 2.2 Vai trò thợ

Chăm vườn · Chế biến & giao · Linh hoạt (mặc định). Vai trò cộng điểm ưu tiên, không cấm việc khác → một người vẫn cứu cây sắp khô dù đang là thợ chế biến.

## 3. Thuật toán

### 3.1 Bảng việc theo nhu cầu (mỗi 0,65 s hoặc khi dữ liệu đổi)

Mỗi việc có **thời hạn gây hại** (`timeLeft`) và **giá trị**:

| Việc | Xuất hiện khi | timeLeft |
|---|---|---|
| Tưới | nước < 45 (sớm hơn ngưỡng 35 để kịp đi) và không mưa, không phải giai đoạn khô | thời gian tới mức 15 (cây ngừng lớn) |
| Làm cỏ | cỏ ≥ 30 | thời gian tới 75 |
| Hái | quả chín, kho đủ chỗ | hằng số ngắn (quả chín là tiền) |
| Bón / tỉa | đúng cửa sổ giai đoạn, chỉ thị cho phép | thời gian còn lại của cửa sổ |
| Trồng | ô trống, có hạt, chỉ thị bật | dài |
| Phơi / rang | có nguyên liệu và trạm còn chỗ, chưa đạt tồn mục tiêu | theo áp lực kho |
| Đảo / nhận mẻ | mẻ đủ nửa thời gian / xong | trước khi hết lợi đảo / ngay |
| Giao | đơn đủ hàng, tự giao bật | theo hạn đơn |

`urgency = clamp(1 − timeLeft / horizon, 0, 1)`
`score = base[việc] × (1 + 2·urgency) + thưởng vai trò + thưởng đơn + tuổi việc − 0,3 × thời gian đi − phạt đổi việc`

### 3.2 Gom việc theo lượt ghé

Tới một cây thì làm **tất cả** việc hợp lệ tại cây đó (tưới + cỏ + bón) trong một lần dừng. Sau mỗi lượt, chọn việc kế tiếp **gần nhất trong nhóm khẩn cấp nhất** (láng giềng gần nhất theo dải urgency) để đi theo luống, không chạy chéo map.

### 3.3 Phân công 2–4 thợ

Giữ cách hiện tại: liệt kê tổ hợp gán không trùng mục tiêu, chọn tổng điểm cao nhất (đủ nhanh tới 4 thợ × 6 việc tốt nhất). Thêm **vùng**: thợ chăm vườn ưu tiên ruộng gần mình để hai người không cùng chạy một luống.

### 3.4 Chống đổi việc liên tục

Đang làm thì giữ việc, trừ khi: việc hết hiệu lực (chủ làm rồi, cây không còn cần), hoặc có việc urgency ≥ 0,9 trong khi việc hiện tại < 0,3.

### 3.5 Sản xuất theo tồn mục tiêu

- Tồn hạt rang mục tiêu = tổng đơn đang mở + dự báo quán 1 ngày.
- Quả chín luôn được phơi (giảm khối lượng 6 lần, đỡ đầy kho); nhân sạch chỉ rang tới mục tiêu, phần dư giữ dạng nhân (bảo quản lâu hơn).
- Tính cả mẻ đang chạy để không làm thừa (đã có `productionNeed`).

### 3.6 Xử lý tình huống

| Tình huống | Thợ làm | Chủ thấy |
|---|---|---|
| Hết hạt / phân | Bỏ qua việc đó; mua trong ngân sách nếu có | Cần xử lý: "Thiếu hạt Vối cho 3 ô trống" |
| Giếng cạn | Ưu tiên cây gần ngừng lớn; chờ hồi | "Giếng còn 4 lượt · 9 cây khát" |
| Kho gần đầy (>85%) | Ưu tiên phơi/rang/giao; dừng hái khi đầy | "Kho đầy · thợ tạm dừng hái" |
| Mưa | Không tưới | — |
| Không tới được mục tiêu | Bỏ việc 4 s, thử việc khác (đã có) | Hoạt động |
| Hết hợp đồng / không đủ xu gia hạn | Trả giữ chỗ, dừng an toàn | "Hợp đồng của An hết · Gia hạn" |
| Chủ đang làm cùng ô | Nhường (đã có) | — |
| Mệt | Tự nghỉ theo nhịp trong ngày, đã tính vào năng suất | Trạng thái "Nghỉ giữa ca" |

## 4. Hợp đồng và lương

- **1 ngày làm việc = 6 phút** (trùng một vụ cây và chu kỳ nhiệm vụ). **1 tuần = 7 ngày = 42 phút.**
- Phí tuyển giữ như hiện tại (một lần).
- Gói trả trước (số khởi điểm, cần cân bằng):

| Gói | Giá | Ghi chú |
|---|---|---|
| Ngày | D = 30 + 10 × (cấp − 1) xu | Thử việc |
| Tuần | 6D | Tặng 1 ngày |
| Tháng (4 tuần) | 21D | Giảm 25% |

- **Tự gia hạn** (bật/tắt từng người): khi còn < 30 s và đủ xu thì trả gói đang chọn. Không đủ xu → dừng an toàn, báo.
- Chấm dứt sớm: giải phóng vị trí, **không hoàn** phần còn lại. Dự bị không tốn lương.
- Thời gian hợp đồng chạy theo giờ thật (kể cả khi tắt game) — đi cùng mô phỏng offline ở mục 6.
- Bỏ: ca 60 s, trả lương từng ca, nút bồi dưỡng. Năng lượng chỉ ảnh hưởng tốc độ và lịch nghỉ tự động.
- Chuyển dữ liệu cũ: người đang có ca còn hạn được đổi thành hợp đồng 1 ngày; không truy thu.

## 5. Có nên giữ 2 thợ/nông trại?

Ước tính từ thông số hiện tại (`CARE`, `workDuration`): mỗi cây cần ≈ 4,3 lượt việc/vụ (tưới ≈ 0,9, cỏ ≈ 0,4, hái, tỉa, bón). Một thợ làm ≈ 90 lượt/vụ khi đi theo luống. Kết quả:

| Ruộng đã mở | Cây | Lượt việc/vụ | Thợ cần |
|---|---|---|---|
| 1 | 12 | ≈ 52 + chế biến | 1 |
| 2 | 24 | ≈ 103 + chế biến | 2 |
| 4 | 48 | ≈ 206 + chế biến | 3–4 |

→ **2 thợ ổn tới 2 ruộng**, thiếu khi mở đủ 4 ruộng. Đề xuất: **số vị trí thợ chính = 1 + số ruộng đã mở, tối đa 4** (farm mới vẫn là 2). Cùng với gom việc theo lượt ghé và mang đầy bình theo cấp dụng cụ, 4 thợ dư sức cho 48 cây.

## 6. Nhiều nông trại và khi tắt game

- Thay `farm-0` gắn cứng bằng `farmId` trên thợ, chỉ thị và bảng việc theo từng farm.
- Khi chủ ở farm khác hoặc tắt game: **mô phỏng gọn theo vụ** cho farm có thợ còn hợp đồng — cây được chăm theo tỉ lệ đáp ứng (năng lực thợ / lượt việc cần, tối đa 100%), quả được hái và phơi/rang theo công suất trạm, tối đa 8 giờ như luật offline hiện có. Không mô phỏng từng bước đi.

## 7. Nhiệm vụ cá nhân và vận chuyển

- Nhiệm vụ cá nhân **vẫn chỉ tính việc chủ tự làm** — là phần thưởng cho lúc chủ ghé farm, không phải công việc bắt buộc.
- Vận chuyển: bật "Tự giao" là không phải xác nhận từng chuyến; mỗi chuyến vẫn kiểm tra hàng, xu, kho quán và ghi Hoạt động.

## 8. Thứ tự triển khai đề xuất

> Bước 2 đã triển khai ngày 02/11/2026 theo mục 4.

> Bước 1 đã triển khai ngày 02/11/2026 (chỉ thị, làm việc không cần đơn, tồn mục tiêu, độ khẩn liên tục, ưu tiên đi theo luống/việc tại chỗ, đầy bình). Chưa làm trong bước 1: tưới sớm ở mức 45 (model hiện chỉ cho tưới dưới 35), chia vùng ruộng giữa hai thợ.

1. **Bảng việc mới + chỉ thị cơ bản** (chăm mọi cây, lấp ô trống, chế biến theo tồn mục tiêu, gom việc, mang đầy bình). Thợ làm việc được khi không có đơn.
2. **Hợp đồng ngày/tuần/tháng** thay ca 60 s, kèm chuyển dữ liệu cũ.
3. **Đơn tự nhận + tự giao**, bỏ bắt buộc chọn người phụ trách (giữ tùy chọn ưu tiên).
4. **Vị trí thợ theo số ruộng** + thông báo tình huống + ngân sách vật tư.
5. **Nhiều farm + mô phỏng offline**.

Tiêu chí xong bước 1: để 2 thợ tự chạy 2 ruộng trong 2 vụ, không cây nào ngừng lớn vì thiếu nước/cỏ khi còn nước và hạt; không trùng việc; không mất/nhân đôi hàng.

## 9. Cần chốt

1. Đồng ý thợ tự chăm/trồng/chế biến **khi không có đơn** (chỉ thị mặc định bật)?
2. Ngày làm việc 6 phút, gói Ngày/Tuần/Tháng và công thức D có ổn để thử?
3. Vị trí thợ = 1 + số ruộng (tối đa 4) hay giữ cứng 2?
4. Tự giao mặc định **bật** hay **tắt**?
5. Có cho thợ tự mua vật tư theo ngân sách không, hay chỉ báo thiếu?
6. Mô phỏng offline làm ở bước 5 hay bỏ?
