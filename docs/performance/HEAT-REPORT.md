# Báo cáo nóng máy: nguyên nhân và so sánh trước, sau tối ưu

Ngày 2026-11-09. Người sáng lập báo chơi nóng máy, kể cả ở chế độ thấp.

## 1. Giới hạn của số đo

- Đo trên Chrome không giao diện với GPU Apple M1, màn hình giả lập 390×844, CPU bị làm chậm 4 lần để gần với điện thoại.
- **Chưa đo trên điện thoại thật.** Chưa có số về nhiệt độ hay pin. Các con số dưới đây là khối lượng công việc máy phải làm, không phải độ nóng.
- GPU của điện thoại khác M1, nên tỷ lệ giảm trên máy thật có thể khác.

## 2. Cách đo

- Save thử theo mục 3 của `PERFORMANCE-TEST-PLAN.md`: 200 cây cà phê, 40 nhân viên, cấp 40.
- Hai tình huống, mỗi lần 10 giây: **Đứng yên** (không chạm, đội vẫn làm việc) và **Auto đang chạy**.
- Đo luân phiên trước, sau trong 3 vòng và lấy trung vị. Trang được tải lại trước mỗi lần đo.
- Bản "trước" dùng đúng code hiện tại nhưng các dòng tối ưu trong đợt này được trả về như cũ ở tầng mạng, nên không đụng vào repo.
- Công cụ: `src/dev/perf-profiler.js`.

## 3. Nguyên nhân

| # | Nguyên nhân | Bằng chứng |
|---|---|---|
| 1 | Chế độ thấp không giới hạn khung hình. Khi có chuyển động, game vẽ 60 hình mỗi giây. | Auto ở chế độ thấp: 52,6 khung hình/giây |
| 2 | Auto giữ game ở tốc độ cao suốt lượt, vì nhân vật tự đi và camera chạy theo được tính là "người chơi đang thao tác". Lỗi này đến từ tính năng Auto. | Luồng chính bận 77,5%, so với 34,4% khi đứng yên |
| 3 | Cây cà phê chiếm khoảng 80% số tam giác. Mỗi cây khoảng 4.800 tam giác, không có bản giản lược. | Auto: 1,26 triệu tam giác mỗi khung hình |
| 4 | Hiệu ứng nhún của cây chín gửi lại dữ liệu toàn bộ danh sách cây lên GPU 12 lần mỗi giây. | 1,8 đến 2,9 MB/giây dữ liệu tải lên |
| 5 | Vẫn tính khung xương và vẽ tới 22 nhân viên ở chế độ thấp. | 523 đến 1.296 lượt cập nhật khung xương mỗi giây |
| 6 | Hiệu ứng CSS lặp vô hạn của HUD bắt màn hình tổng hợp lại ở tần số tối đa, độc lập với tốc độ 3D. | Quan sát trong code, thời lượng GPU chưa đo riêng |

## 4. Đã thay đổi

| Thay đổi | Áp dụng cho |
|---|---|
| Khóa 30 khung hình mọi lúc | Thấp |
| Lúc Auto chạy, game về 30 khung hình sau 4 giây nếu bạn không chạm | Trung bình, Cao |
| Vẽ một nửa số mảnh lá và quả, mỗi mảnh to thêm 1,4 lần để tán vẫn dày | Thấp |
| Bỏ vòng đất mùn quanh gốc | Thấp |
| Bỏ nhún cây chín | Thấp |
| Vẽ tối đa 12 nhân viên, giảm chuyển động, tắt bóng | Thấp |
| Dừng các hiệu ứng CSS lặp của HUD, giữ bàn tay hướng dẫn | Thấp |
| Lần chạy đầu trên điện thoại vào mức Trung bình thay vì Cao | Người chơi mới |

Việc của nhân viên và tốc độ cây lớn không đổi, chỉ thay đổi phần vẽ.

## 5. So sánh (trung vị 3 vòng)

### Chế độ thấp, Auto đang chạy

| Chỉ số | Trước | Sau | Thay đổi |
|---|---|---|---|
| Khung hình/giây | 52,6 | 27,9 | −47% |
| Luồng chính bận | 77,5% | 44,2% | −43% |
| Thời gian GPU mỗi giây | 457 ms | 236 ms | −48% |
| Tam giác mỗi khung hình | 1.264.313 | 783.536 | −38% |
| Lần vẽ mỗi khung hình | 167 | 123 | −26% |
| Dữ liệu tải lên GPU | 2,91 MB/s | 1,09 MB/s | −63% |
| Cập nhật khung xương/giây | 1.296 | 482 | −63% |

### Chế độ thấp, đứng yên

| Chỉ số | Trước | Sau | Thay đổi |
|---|---|---|---|
| Khung hình/giây | 29,9 | 29,8 | Không đổi |
| Luồng chính bận | 34,4% | 31,7% | −8% |
| Thời gian GPU mỗi giây | 131 ms | 115 ms | −12% |
| Tam giác mỗi khung hình | 816.671 | 558.487 | −32% |
| Dữ liệu tải lên GPU | 1,77 MB/s | 0,25 MB/s | −86% |
| Cập nhật khung xương/giây | 523 | 358 | −32% |

### Chế độ trung bình

| Tình huống | Chỉ số | Trước | Sau | Thay đổi |
|---|---|---|---|---|
| Auto | Khung hình/giây | 49,6 | 28,0 | −44% |
| Auto | Luồng chính bận | 78,8% | 49,8% | −37% |
| Auto | Thời gian GPU mỗi giây | 512 ms | 385 ms | −25% |
| Đứng yên | Luồng chính bận | 40,2% | 38,0% | Trong sai số |
| Đứng yên | Thời gian GPU mỗi giây | 235 ms | 231 ms | Trong sai số |

## 6. Điều chưa cải thiện

- **Giật cục lúc Auto chạy chưa hết.** Khung hình chậm nhất (1%) ở chế độ thấp là 12 trước và 8,6 sau, trong điều kiện CPU chậm 4 lần. Nguyên nhân khả dĩ là các đợt tính toán của Auto và quản lý, chưa xác định.
- Khi đứng yên, chế độ thấp đã ở 30 khung hình từ trước, nên mức giảm nhỏ hơn nhiều so với lúc Auto chạy.
- Chế độ trung bình khi đứng yên gần như không đổi.

## 7. Việc tiếp theo, cần đo trên điện thoại

1. Đo bằng `?fps` trên máy thật, ghi tên máy, số khung hình và thời gian trước khi máy giảm xung.
2. Vật liệu: 346 vật liệu `MeshPhysicalMaterial` và 928 `MeshStandardMaterial` đang tốn phần tô màu. Đổi sang vật liệu đơn giản ở chế độ thấp, nhưng phải kiểm tra hình ảnh và hiệu ứng gió.
3. Kết cấu ước tính 220 MB, cần thử nén KTX2.
4. Cố định ma trận cho vật thể tĩnh: hơn 2.600 nút được cập nhật mỗi khung hình.
5. Tìm nguyên nhân các khung hình chậm khi Auto chạy.
