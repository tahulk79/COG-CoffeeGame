# Ý tưởng thiết kế (hộp thư)

Nơi sếp và cả nhóm gửi ý tưởng mới cho game. Mỗi ý tưởng là **một file**, đẩy lên git là đội phát triển được báo (xem [../README.md](../README.md) mục "Theo dõi thay đổi").

## Gửi một ý tưởng

1. Chép [_template.md](_template.md) thành `YYYY-MM-DD-ten-ngan.md` (chữ thường, không dấu, gạch ngang). Ví dụ `2026-11-05-khach-quen.md`.
2. Điền **Người đề xuất**, **Ngày**, phần **Ý tưởng** và **Vì sao**. Để Trạng thái là `Mới`, dòng **Cập nhật** ghi `dd/mm — gửi mới`.
3. Commit với tiêu đề bắt đầu bằng `idea:`, ví dụ `idea: khách quen có món yêu thích`, rồi push.

Sửa lại ý tưởng đã gửi (thêm chi tiết, đổi trạng thái, ghi quyết định) thì **luôn sửa dòng Cập nhật** thành một câu nói vừa đổi gì; hộp thư thiết kế in câu này khi đồng bộ về, khỏi phải đọc lại cả file.

Không cần sửa GDD khi gửi ý tưởng. Ý tưởng chưa chốt **không** được triển khai vào code.

## Vòng đời

```text
Mới ──► Đang xem ──► Đã chốt ──► Đã triển khai
              └────► Bỏ
```

| Trạng thái | Ai đổi | Việc kèm theo |
|---|---|---|
| Mới | Người gửi | — |
| Đang xem | Đội phát triển | Điền "Ảnh hưởng" (mục GDD, dữ liệu, asset, ước lượng công) và "Câu hỏi mở" |
| Đã chốt | Sếp duyệt | Đội phát triển thêm dòng `F-xx` vào GDD mục 0.3 (Thiết kế = Đã chốt, Code = Chưa làm), sửa tài liệu màn liên quan, ghi `F-xx` vào file ý tưởng |
| Bỏ | Sếp | Ghi lý do ở "Quyết định" |
| Đã triển khai | Đội phát triển | Khi dòng `F-xx` chuyển Code = Đã code |

File ý tưởng không xóa sau khi chốt hoặc bỏ; nó là hồ sơ vì sao game có (hoặc không có) tính năng đó.
