# Task list

Thư mục này là **nơi duy nhất** theo dõi việc cần làm / đã làm của dự án. Danh sách nằm trong [TASK_LIST.md](TASK_LIST.md).

## Quy định (bắt buộc khi sửa docs hoặc code)
1. Sửa bất kỳ file trong `docs/` → thêm hoặc cập nhật **một dòng** tương ứng trong [TASK_LIST.md](TASK_LIST.md) trong cùng commit/PR.
2. Một việc = một dòng, có ID tăng dần (`T-001`, `T-002`…). Không đổi ID đã có.
3. Đổi trạng thái tại chỗ, không xoá dòng. Việc xong thì giữ lại, ghi ngày hoàn thành.
4. Cột **Docs/Code liên quan** ghi đường dẫn file đã sửa (link tương đối), để người sau biết nhìn vào đâu.
5. Việc phát hiện thêm nhưng chưa làm → thêm dòng trạng thái `Todo`, đừng giấu trong chat.
6. Đổi nhiều dòng thì ghi thêm một mục vào "Nhật ký cập nhật" ở cuối [TASK_LIST.md](TASK_LIST.md).

## Trạng thái
| Trạng thái | Ý nghĩa |
|---|---|
| `Todo` | Chưa làm |
| `Doing` | Đang làm (ghi tên người) |
| `Review` | Đã làm, chờ người khác kiểm tra |
| `Done` | Xong, đã kiểm tra |
| `Blocked` | Bị chặn, ghi lý do ở cột Ghi chú |
| `Dropped` | Không làm nữa, ghi lý do |

## Mẫu dòng mới
```
| T-0xx | Mô tả ngắn, bắt đầu bằng động từ | Todo | tên | [file](../...) | ghi chú |
```
