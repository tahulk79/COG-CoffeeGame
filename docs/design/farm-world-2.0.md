# Farm World 2.0: một nông trại liền mạch

> **Đã code (2026-11-07), chưa commit.** **Founder chốt (2026-11-07): giữ toàn bộ Mặc định ở mục 6.** Mỗi mục có một **Mặc định**
> đang chạy trong code, đổi được trong `src/core/config/economy.js` / `layout.js`.
> Tài liệu kỹ thuật (tiếng Anh): [docs/farm-world-2.0/](../farm-world-2.0/) — Audit, GDD, Architecture, Building System,
> Economy, UX/UI, Save migration, QA, Progress.

## 1. Kết luận nhanh
- **Hết cảnh "đất ruộng" và "đất xây" tách riêng.** Mảnh đất nào đã mua cũng là đất nông trại: ô trồng, nhà xưởng,
  kho, đồ trang trí đặt cạnh nhau được. Mua đất vẫn theo lô, giá và thứ tự như cũ.
- **Ô trồng là vật thể.** Di chuyển, dọn, đặt thêm như công trình. Ruộng mua về vẫn có sẵn 6 ô như trước, nên ai
  không muốn đổi thì chơi y như cũ.
- **Nhà xưởng làm ra hàng thật, không còn "+% ảo".** Chuỗi: **Ô trồng → Sân phơi → Xưởng rang → Xưởng đóng gói → Kho
  bán**. Mỗi bước làm hạt đắt hơn. Mỗi xưởng làm một mẻ một lúc.
- **Xây được nhiều cái cùng loại** (giới hạn theo cấp, cái sau đắt hơn cái trước). Xưởng thứ 2 chỉ kiếm thêm khi ruộng
  đủ hạt cho nó.
- **Chạm gì cũng có việc:** ô trồng (trồng / thu / di chuyển / dọn), xưởng (bắt đầu / thu hàng / di chuyển / dỡ),
  đất trống (ô trồng / xây / trang trí), đất đang bán (mua).
- Save cũ an toàn: 14–18 ruộng cũ thành ô trồng cùng mã (F1-1…), cây đang lớn giữ nguyên.

## 2. Hiện trạng & vấn đề (audit 9 mảng, chi tiết ở FARM-WORLD-2.0-AUDIT.md)
- Ô trồng là cấu hình cứng (6 ô/ruộng), không phải vật thể → không có cách nào "đổi đất".
- Loại lô quyết định công dụng → ruộng chỉ trồng, lô xây chỉ xây ("Không xây trên ruộng").
- Lưới đặt nhà lệch 0.5 m so với mép lô → lô Y0 chỉ vừa 2 sân phơi thay vì 4.
- Giới hạn 1 công trình/loại vì hiệu ứng chỉ đọc cái cấp cao nhất → xây cái thứ 2 vô ích.
- Kinh tế toàn % thụ động trên một con số "hạt".
- Lỗi thật tìm được: tải lại game lúc chọn vùng sau sự cố Lv10 thì vùng tiếp theo hết miễn phí (kẹt 60 xu) — đã sửa.
  Core không chặn "một vùng một game" (vùng nông trại vẫn xây đồ quán được) — đã sửa.

## 3. Đã làm gì
| Mảng | Thay đổi |
|---|---|
| Ô đất | Xưởng và nhà kho to đúng bằng 1 ô trồng (3 × 3 m): dọn 1 ô là có chỗ cho 1 xưởng. |
| Đất | Đất đã mua theo **địa hình**: đồng cỏ/vườn (gì cũng được), bãi chăn thả (nhà + trang trí, để dành nuôi con), vườn cây (ô trồng + trang trí), ao và đồi (chỉ trang trí). Không xây trên đường, không đè ô trồng, không chặn lối vào ruộng/xưởng. Lưới chỉ hiện khi xây. |
| Ô trồng | Ruộng mua về có 6 ô. Đặt lại ô đã dọn: miễn phí. Ô thêm: 60 xu, mỗi ô sau ×1.3, tối đa +2 ô mỗi cấp. |
| Công trình mới | Sân phơi (Lv2, giờ là xưởng phơi), Nhà kho (Lv3, thêm chỗ chứa), Giếng nước (Lv3, ô trồng gần đó lớn nhanh hơn 15–30 %), Xưởng rang (Lv4), Xưởng đóng gói (Lv6). Tất cả mở trước Lv10. |
| Hàng | Hạt 2 xu · Hạt phơi 4 · Hạt rang 9 · Túi cà phê 33. Mọi hàng chung một kho (Kho + các Nhà kho cộng dồn). |
| Nâng cấp | Mỗi cấp tăng **một** chỉ số: xưởng xen kẽ tốc độ / mẻ lớn; giếng xen kẽ tầm / tốc độ lớn. Vẫn nâng qua ▲. |
| Dỡ bỏ | Nhận lại 50 % số xu đã bỏ ra. Không dỡ đồ khởi đầu, xưởng đang làm, kho đang chứa. Xây lại không được XP lần 2. |
| Giao diện | Bảng Xây có tab (Trồng trọt · Chế biến · Kho chứa · Hạ tầng · Trang trí · Đất), thẻ gọn: icon, tên, giá, 1 dòng công dụng, số lượng/tối đa. Thẻ theo vật được chạm. Chế độ "Xem đất đang bán". |
| Hiệu năng | Cây cà phê vẽ bằng instancing (trước mỗi cây 2–3 draw call + bóng). Sửa lỗi nhân viên rời đi làm giật (xoá nhầm model dùng chung). |

## 4. Số liệu mô phỏng (45 phút, 1.2 giây/thao tác, có 1 lần sự cố Lv10)
| Cách chơi | Lv10 lúc | Thu nhập/phút lúc 35–45 phút |
|---|---|---|
| Chỉ nông trại, có chế biến | 15.9 phút | **331** |
| Chỉ nông trại, bán hạt thô | 14.8 phút | 269 |
| Chỉ quán (nhập hạt) | 20.3 phút | 570 |

Chế biến tăng thu nhập nông trại khoảng **+23 %** khi chuỗi đã chạy, đổi lại phải bỏ vốn và chạm thêm. Nhịp lên Lv10
vẫn trong khung đã duyệt (10–35 phút).

## 5. Giữ nguyên (luật đã chốt)
Bản đồ thế giới mua vùng bằng xu (vùng đầu miễn phí) · mỗi vùng một game, chọn lúc vào · chỉ Vòng 1 chơi được, Vòng 2–3
khóa · sự cố Lv10 = chơi lại từ đầu, 1 vùng miễn phí · khoản vay vẫn còn sau sự cố · mỗi cấp thuê thêm 1 người, không
giới hạn theo khu · quà mỗi cấp, rương Lv5/10/15 · giá đất và bản đồ trục bắc · chạm ô trống là trồng, chạm ô chín là
thu, kéo qua nhiều ô · chạm đất là đi tới · nâng cấp chỉ qua ▲ · 4 nút menu + nút giữa Bán/Nhập · camera xoay 45°,
không giật khi chạm · hướng dẫn tân thủ không thêm bước · quán giữ nguyên luật.

## 6. Đã chốt (2026-11-07: giữ Mặc định)
> Mục 7 (khoản vay) và 10 (sự cố Lv10 lặp lại): Mặc định là giữ như cũ — vẫn còn để ngỏ nếu sau này muốn đổi.
1. **Sân phơi đổi vai** từ "+% hạt mỗi lần thu" thành xưởng phơi hạt. **Mặc định: đổi** (bản yêu cầu muốn giá trị
   thật, không phải % ảo). Sân phơi cũ giữ chỗ và cấp.
2. **Cho xây nhà trên lô ruộng / đặt ô trồng trên lô xây.** **Mặc định: cho phép** (đó là "một nông trại liền mạch").
   Ao, đồi chỉ trang trí; bãi chăn thả không làm ô trồng; vườn cây không xây nhà.
3. **Ô trồng thêm có giá** (60 xu, ×1.3 mỗi ô, +2 ô mỗi cấp). **Mặc định: như trên.**
4. **Dỡ bỏ hoàn 50 %.** **Mặc định: 50 %**, đồ trang trí cũng 50 %.
5. **Giá hàng chế biến** (4 / 9 / 33) và mẻ (12 hạt / 30 giây…). **Mặc định: như trên**, cần bạn chơi thử.
6. **Đồ của quán vẫn chỉ 1 cái** (lò rang, ki-ốt, tủ bánh). Muốn 2 lò rang ở quán thì cần thiết kế chuỗi quán
   (rang → xay → pha). **Mặc định: giữ 1, làm sau.**
7. **Khoản vay không giới hạn** (đang là luật thử nghiệm) cho phép "in tiền". **Mặc định: giữ như cũ**; đề xuất trần nợ
   2 000 + 1 000 × cấp và chỉ vay khi đang chơi.
8. **Nhân viên chưa chạy xưởng.** **Mặc định: chưa.** Đề xuất bước sau: nông dân tự thu mẻ xong, robot thêm việc "chở
   hàng" (theo luật robot một việc).
9. **Nhịp nông trại hơi nhanh** (Lv10 ở ~15–16 phút, mục tiêu cũ ~20). Không do bản này gây ra. **Mặc định: để nguyên.**
10. **Sự cố Lv10 lặp lại tới Vòng 2?** Vẫn chưa chốt (code: chỉ 1 lần mỗi save).
