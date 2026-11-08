# Gedeo: nông trại 3D chân thực + chuỗi cà phê đầy đủ (2026-11-08)

> Đã code, chưa commit. Mặc định đang chạy; đổi được trong `src/core/config/economy.js`.

## 1. Thay toàn bộ cảnh quan khu đất (mọi quốc gia)
| Thứ | Trước | Giờ |
|---|---|---|
| Nền đất | màu xanh phẳng + nhiễu | texture cỏ cao nguyên + normal map, trộn đất đỏ (shader `blendSoil`: mảng đất lộ ở trung du, lối mòn, ngoài rìa) |
| Đường | dải cam phẳng | đất nện có sỏi + normal map, mép mờ vào cỏ |
| Ô đất / luống / bờ bậc thang / vòng gốc | khối màu | texture đất đỏ, bờ đá khô (stone), vòng đất mùn |
| Đồi nền, đồi xa | khối đa giác phẳng | đồi mượt có texture cỏ, mờ trong sương |
| Cây rừng viền + đất hoang | khối nón/đa diện | Cordia / Albizia LOD2 (instancing), cây gần camera thấp hơn |
| Bụi, đá, cỏ, hoa, gốc cây | khối icosahedron/chóp | bụi Gedeo, tảng đá, cụm cỏ, khóm cúc Meskel, gốc cây |
| Hàng rào bãi chăn | hộp vuông | cột + thanh tròn bạch đàn |
| Quảng trường cổng | đèn lồng + chậu hoa khối | cột đèn bão, enset, khóm cúc; đá lát sáng |
| Giếng làng | giếng mái đỏ | điểm lấy nước Gedeo (bồn tôn, vòi, can vàng) |
| Cảnh ngoài rìa | nhà kho / nhà kính / lều khối | Ethiopia: tukul, trạm sơ chế ướt, nhà ủ phân; nước khác: kho tôn, xưởng rang, xưởng đóng gói; chung: chòi, giàn phơi, bồn nước, dải cây che bóng |
| Cây cà phê | `coffee-tree.glb` hoạt hình | `coffee-tree-gedeo.glb` (cùng node/chiều cao, logic trồng/hái giữ nguyên) |
| Nhà kho chính / sân phơi / kho / giếng / xưởng rang / xưởng đóng gói / đèn / hoa | model cũ / khối | bộ Gedeo tương ứng |
| Nhân công / robot nông trại | rig Mixamo / robot bay | 8 nhân công Gedeo (clip theo việc), HarvestBot / SeedBot |

Giữ nguyên: cổng trời (vật phẩm cốt truyện), nhân vật người chơi, khu café/phố, biển bán đất (UI).
Texture: `public/assets/farm/env/{grass,soil,road,stone}{,-normal}.jpg`, tạo bằng `gedeo_environment.py --textures`.

## 2. Chuỗi cà phê (gameplay)
Trồng cây giống → cây non → trưởng thành → ra hoa → quả xanh → quả chín → hái (cây ở lại) → **sơ chế** → rang → đóng gói → bán / café.
- **Sơ chế khô** (Sân phơi, có từ trước): 12 hạt → 12 hạt khô, 30 s, miễn phí.
- **Sơ chế ướt** (mới, `wetMill`, Lv3, 220 xu): xát vỏ → lên men → rửa; 12 hạt → 12 hạt khô, **20 s**, phí nước/nhiên liệu 2 xu, **thưởng đặc sản ×1.5** cho giống đắt (Arabica rửa kiểu Yirgacheffe).
- **Cây che bóng** (mới, `shadeTree`, Lv2, 90 xu, Albizia): Arabica trong **7 m** được **+1★** khi hái (`D.shadeStars`). Cây che bóng tự sinh giữa các hàng đã bỏ vì che camera; giờ người chơi tự đặt.
- **Enset** (trang trí, Lv2, 35 xu).

Đã kiểm bằng reducer thật: `prod/start` / `prod/collect` của trạm ướt, đặt cây che bóng và enset.

## 3. Còn để ngỏ
- Chưa chạy sim kinh tế (`npm run sim`) với trạm sơ chế ướt; số liệu là mặc định đề xuất.
- Hiệu năng điện thoại chưa đo; scene farm nặng hơn trước nhiều (cây thật, nhiều instancing, texture 1024).
- Loài cây rừng là của Ethiopia cho mọi nước; Việt Nam / Brazil… nên có loài riêng sau.
- Dev hook `globalThis.__realmScene` (chỉ khi dev) để QA.

## 4. Tối ưu điện thoại (2026-11-08)
Đo bằng `?profile=test&fps` + duyệt scene (khung 375×812, màn farm, chất lượng high):

| | Trước | Sau |
|---|---|---|
| Tam giác trong cảnh | 2.32 M | 1.26 M |
| Tam giác đổ bóng | 2.24 M | 0.39 M |
| Texture (số / megapixel) | 103 / 83 MPx (~330 MB) | 43 / 26 MPx (~105 MB) |
| Draw call | 155 | ~180–240 (thêm mirror cỏ/đá, đổi lại bớt hàng triệu tam giác) |
| File `public/models/gedeo` | 11 MB | 8.7 MB |

Đã làm:
- **Texture:** export giới hạn màu ≤ 1024 px, normal ≤ 512 px (`shrink_textures`). Khi nạp, texture trùng tên giữa các file (mọi LOD, mọi nhà có mái tranh…) chỉ upload GPU một lần (`dedupeTextures` trong `gedeo-vegetation.js`).
- **LOD3** cho Cordia / Albizia (~700–800 tam giác): rừng viền và cây trên đất hoang dùng LOD3; dải cây ngoài rìa dùng LOD2.
- **Bóng:** tắt đổ bóng cho cỏ, hoa, đá, gốc cây, bụi, rừng viền, dải cây ngoài rìa. Shadow map 1024 trên màn cảm ứng hoặc khi chất lượng khác high (2048 trên desktop high).
- **Theo mức chất lượng** (hệ có sẵn, tự hạ khi < 25 fps): medium giữ 1/2 cây rừng viền, low giữ 1/3; low tắt bóng như cũ.
- **Hình học:** đá 9×5, gốc cây 8 cạnh, quả trên cây ruộng 6×2.

Chưa làm: KTX2 (cần `toktx`, chưa có trong máy), đo trên điện thoại thật (chỉ đo khung giả lập trên Mac: 100 fps).
