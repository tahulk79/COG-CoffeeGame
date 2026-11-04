# Phiếu sửa GDD và tài liệu

Mỗi lần sếp sửa luật / số liệu / GDD — hoặc muốn đội phát triển sửa — viết **một phiếu** `YYYY-MM-DD-ten-ngan.md`, chép từ [_template.md](_template.md). Commit tiêu đề `design: …`, kèm luôn phần tài liệu đã sửa (nếu có) trong cùng commit.

Phiếu trả lời hai câu khi đồng bộ về: **đã đổi gì** (bảng Trước/Sau) và **dev phải làm gì** (Dev cần làm).

## Vòng đời

```text
Chờ dev ──► Đang làm ──► Xong
      └──────────────► Bỏ
```

| Trạng thái | Ai đổi | Việc kèm theo |
|---|---|---|
| Chờ dev | Sếp | Điền Thay đổi, Vì sao, Dev cần làm |
| Đang làm | Dev | Điền Mã (thêm `D-xx` vào GDD mục 0.4 nếu việc lớn) |
| Xong | Dev | Tích hết Dev cần làm, ghi Kết quả; GDD tăng phiên bản, ghi Lịch sử phiên bản |
| Bỏ | Sếp | Ghi lý do ở Kết quả |

Mỗi lần đổi Trạng thái thì sửa luôn dòng **Cập nhật**; hộp thư thiết kế in câu này khi đồng bộ về. Phiếu không xóa sau khi Xong.

Ý tưởng chưa chốt **không** viết phiếu sửa; gửi vào [../ideas/](../ideas/README.md).
