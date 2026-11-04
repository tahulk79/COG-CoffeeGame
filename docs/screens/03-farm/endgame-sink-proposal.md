# Đề xuất — Sink cuối game và giá hạt nhập nơi chỉ quán

Ngày 04/11/2026. Trạng thái: **Đề xuất — chờ Quang duyệt**. Không có gì ở đây được triển khai; không đổi code, save hay luật hiện hành. Nguồn: audit `docs/design/audits/2026-11-04-audit-toan-game.md` (EC-3, EC-5). Số liệu tính tay từ công thức trong `rules.js`, **chưa chạy sim** (`scripts/balance-sim.mjs` chưa dùng cho đề xuất này).

## 1. Hiện trạng sink (EC-5)

- `upgradePrice` (`rules.js:38`): cấp 1→9 là `base×1,42^(l-1)`, cấp 10→19 là `base×1,42^9×(1+0,15(l-10))²`. Cấp tối đa 20 (`ASSET_MAX_LEVEL`, `rules.js:34`), quán tối đa 10.
- Nâng 9 công trình farm tới cấp 20: ≈ 755,7 × tổng base (855) ≈ 646.000 xu theo công thức; audit đo 652.694 (khớp trong 1%, phần chênh là làm tròn lên). Quán ≈ 7.700 xu.
- Sink còn lại: trang trí 25–40 xu/món, tối đa 100 món (`decorations.js:17`) → trần 4.000 xu; mua ruộng, hợp đồng nhân viên, hạt nhập là chi phí vận hành, không phải sink có điểm dừng.
- Faucet tham chiếu: thị trường tối đa ≈ 654 xu/ngày công khi bán đủ 1.200 xu giá gốc (`marketCurve(1200)=0,455×1200+0,3×360`, `rules.js:18`), mỗi xu giá gốc bán thêm sau đó trả 0,3 xu. Tốc độ kiếm thực tế cuối game: **chưa đo**.
- Kết luận: sink hữu hạn và sẽ cạn; sau đó tiền tích lũy không còn tác dụng. Câu hỏi mở số 4 trong audit (có cần sink lặp không) vẫn là quyết định của Quang.

## 2. Phương án

### A. Bảo trì theo cấp (sink lặp)

- Công thức: mỗi ngày công (6 phút), thu `m = 0,03% × Σ upgradePrice(id, l-1)` đã đầu tư. Với farm full cấp 20 ≈ 646.000 × 0,0003 ≈ **194 xu/ngày**; quán ≈ 2 xu/ngày.
- Tham chiếu: bằng ~30% một ngày bán chợ tối đa (654). Ở 0,1%/ngày sẽ là ≈ 646 xu, ăn gần hết thu nhập chợ → không dùng.
- Không trả được: công trình giảm hiệu suất tạm (không xuống dưới cấp 10 hiệu dụng), không mất cấp.
- Tác động sim: sink không bao giờ cạn, nhưng đánh vào người chơi đang tiến bộ sớm nếu áp từ cấp thấp; cần ngưỡng bắt đầu từ cấp 15.
- Rủi ro: phạt mất mát (loss aversion), người chơi offline bị trừ (`OFFLINE_MS` 8 giờ); đổi luật cốt lõi, cần migrate trường `lastMaintenanceDay` trong save (`docs/shared/contracts.md`).
- Công sức: L. Phải sửa model, UI nhắc phí, offline, save, test và tài liệu.

### B. Cấp 21+ giá tăng tiếp

- Công thức: giữ nhánh bậc hai hiện có cho `l ≥ 20`: `base×1,42^9×(1+0,15(l-10))²`. Giá 20→21 ≈ 146,7×base (soil 90: ≈ 13.200 xu). Cả 9 công trình lên cấp 30 thêm ≈ 2.410 × 855 ≈ **2,06 triệu xu**.
- `efficiency`, `capacityScale` đang kẹp ở cấp 20 (`rules.js:36-37`); phải bỏ kẹp hoặc cấp 21+ chỉ là sink thuần.
- Tác động sim: tăng sức mạnh nếu bỏ kẹp, làm vỡ thời gian đạt trần (ghi chú `rules.js:33`: cắt từ 999 xuống 20 để mọi cấp đều đạt được). Nếu giữ kẹp thì là sink thuần, người chơi sẽ thấy "nâng mà không có gì".
- Rủi ro: lạm phát sức mạnh, quay lại vấn đề đã cắt ngày 03/11; yêu cầu cấp farm 1:1 (`rules.js:40`) kéo theo cấp farm cao hơn 20.
- Công sức: S về code, nhưng M về cân bằng.

### C. Trang trí cao cấp và biểu tượng uy tín (sink một lần, không cộng sức mạnh)

- Công thức: thêm loại trang trí giá lớn, mở theo cấp farm, không đổi sản lượng. Đề xuất 5 bậc:

| Vật | Giá (xu) | Mở ở | Ghi chú |
|---|---|---|---|
| Cổng gỗ khắc | 15.000 | cấp farm 12 | tối đa 1 |
| Đài phun nước | 45.000 | cấp 15 | tối đa 1 |
| Tượng hạt cà phê | 100.000 | cấp 18 | tối đa 1 |
| Biển "Farm uy tín" | 200.000 | cấp 20 | tối đa 1, hiện trong HUD hồ sơ |
| Tháp đèn lễ hội | 250.000 | cấp 20 | tối đa 1 |

- Tổng ≈ **610.000 xu**, gần bằng tổng nâng cấp farm (646.000), tức là gần gấp đôi tổng sink.
- Tác động sim: không đổi faucet hay tốc độ tiến bộ; chỉ kéo dài giai đoạn "có việc để tiêu tiền". Vẫn **hữu hạn**: sau khi mua hết, sink cạn lại.
- Rủi ro: thấp. Loại mới trong `progress.decorations` cần id được nhận diện; build cũ gặp loại lạ cần bỏ qua (kiểm tra `decorationError`). Cần asset 3D tạm cho 5 vật.
- Công sức: M (5 mesh tạm + danh mục + UI trang trí đã có).

## 3. So sánh

| | Sink | Cạn? | Rủi ro save | Rủi ro cân bằng | Công sức |
|---|---|---|---|---|---|
| A. Bảo trì | ~194 xu/ngày | không | trung bình | cao (phạt) | L |
| B. Cấp 21+ | ~2,06 triệu | gần như không | thấp | cao (sức mạnh) | S/M |
| C. Trang trí | ~610.000 | có | thấp | thấp | M |

## 4. Khuyến nghị

Chọn **C** làm bước đầu: thấp rủi ro nhất, tương thích save cũ, hợp trụ cột "farm của tôi" và không ép phạt người chơi. Nó **không** giải quyết sink lặp; nếu Quang muốn tiền luôn có chỗ tiêu thì C + A (A chỉ bật từ cấp 15, 0,03%/ngày) là bước sau, sau khi có số liệu tốc độ kiếm thật từ sim. Không khuyến nghị B trừ khi đồng thời quyết định nâng trần cấp.

Quyết định của Quang: (1) chọn A/B/C hay kết hợp; (2) có chấp nhận sink hữu hạn không; (3) giá 5 vật trang trí.

## 5. Chốt giá hạt nhập nơi chỉ quán (EC-3)

Chưa triển khai; chờ Quang duyệt cùng đề xuất này.

- **Con số**: `SUPPLIER_PRICE_CAFE_ONLY = 45` xu/500 g (0,09 xu/g), thay 50 đề xuất lần trước. Lý do: 50 (0,10 xu/g) chỉ vừa hòa vốn ở chất lượng 80 và Nâu đá lỗ ở chất lượng 70.
- **Phạm vi**: chỉ áp khi `regionType(progress.region)==='cafe'`. Vùng có farm giữ 75 để quán vẫn cần hạt farm (`rules.js:9`).
- **Ngưỡng cứu trợ**: dùng **cùng giá theo nơi** (`coins < 45`). Giữ 75 sẽ cho phép người có 45–74 xu mua được hạt nhập mà vẫn nhận cứu trợ miễn phí. Chỗ phải đổi: `model.js:232, 522, 527`, `cafe/ui.js:237`, `farm/game.js:426`, thêm `docs/screens/04-cafe/gameplay.md:50`. Chuỗi lỗi `supplyCoins`/`reliefNotNeeded` đã nhận `{price}`.
- **Công thức giá bán ly nhân viên** (`model.js:557`): `giá = price × (0,6 + 0,4 × chất lượng/100)`, không ×`OWN_CUP`. Chi phí = `beans × giá_hạt_mỗi_g` + vật tư (`SUPPLIES`, `recipes.js:8`): ly 0,1; Nâu đá thêm sữa đặc 25 ml × 6/300 = 0,5 và đá 150 g × 2/2000 = 0,15, nước coi như 0. Chưa tính tip.

Lãi/ly nhân viên tại chất lượng 90 (hệ số 0,96):

| Món | Giá bán | Chi phí ở 75 xu | Lãi ở 75 | Chi phí ở 45 xu | Lãi ở 45 |
|---|---|---|---|---|---|
| Phin đen (2,5; 20 g) | 2,40 | 3,0 + 0,1 = 3,10 | -0,70 | 1,8 + 0,1 = 1,90 | **+0,50** |
| Nâu đá (3; 20 g) | 2,88 | 3,0 + 0,75 = 3,75 | -0,87 | 1,8 + 0,75 = 2,55 | **+0,33** |

Ở chất lượng 70 (hệ số 0,88): Phin đen +0,30, Nâu đá +0,09 tại 45; tại 50 Nâu đá thành -0,11. Nâu đá hòa vốn ở chất lượng ≈ 63 khi giá 45, Phin đen ≈ 40. Số lỗ audit ghi (0,3–0,57) nhỏ hơn số tính ở đây vì tôi không cộng tip và giả định không có thưởng; hướng và kết luận không đổi.

Rủi ro: giá 45 làm ly bac-xiu, phin-mít... lãi hơn (hạt rẻ hơn 40%), tiền lên nhanh hơn ở vùng quán thuần; cần chạy sim vùng chỉ quán trước khi chốt. Công sức: S.
