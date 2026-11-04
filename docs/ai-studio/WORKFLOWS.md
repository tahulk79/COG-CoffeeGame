# Luồng làm việc

## Điều phối

```
Phiên chính (Producer, sonnet) → chọn skill → giao agent → làm → QA → ghi tài liệu → báo cáo
```

- Phiên chính là nơi **duy nhất** gọi agent (giới hạn của Claude Code: subagent không lồng nhau).
- Tối đa 3 agent cùng lúc. Song song chỉ khi việc độc lập, không chung file, không cùng sửa state.
- Tuần tự bắt buộc: thiết kế → code; code → QA; đo hiệu năng → tối ưu; tái hiện lỗi → sửa → hồi quy.
- Việc vài lệnh: phiên chính tự làm, không gọi agent.
- Mỗi brief cho agent: mục tiêu, file được đọc, file được sửa, điều cấm, sản phẩm mong đợi.

## 3 chế độ (`/game-studio <chế độ> …`)

| Chế độ | Sửa code | Chạy test | Dừng khi |
|---|---|---|---|
| `review` (mặc định) | Không | Không | Có báo cáo |
| `dev` | Có | Có — gọi `dev` là yêu cầu rõ ràng chạy test cho việc đó | Xong việc |
| `auto` | Có, theo backlog người dùng đã duyệt trong hội thoại | Sau mỗi việc | Lệnh phá hủy, liên quan bảo mật, yêu cầu mơ hồ, thử lại 2 lần vẫn lỗi |

Không chế độ nào được push, merge, deploy hay sửa hạ tầng khi chưa được cho phép. Quyền chạy lệnh dùng cơ chế chuẩn của Claude Code (`.claude/settings.json` có danh sách `deny`: `rm -rf`, `git push --force`, `git push cog`, `git reset --hard`, `git clean -f`, `sudo`, đọc/sửa `.env`).

**Quan hệ với `AGENTS.md`:** mặc định không tự chạy test/build/trình duyệt. `/team-qa` và `/game-studio dev|auto` được tính là người dùng yêu cầu kiểm tra cho đúng việc đó.

## Chất lượng Three.js (mỗi việc code)

Ưu tiên mobile; frame ổn định; tái dùng geometry/material; dispose khi rời màn (`disposeScene`); không cấp phát trong vòng lặp mỗi frame; không tăng draw call vô cớ; asset nén (meshopt, `tools/`); chạm phản hồi nhanh; save cũ vẫn tải. Số đo hiệu năng phải đo thật (trace trình duyệt, `renderer.info`); không có thì ghi "chưa đo".

## QA

- Test hiện có: `node --test tests/` (node:test, không cần cài thêm).
- Chưa có Playwright. Cần tự động trình duyệt thì đề xuất riêng trước khi cài.
- Kiểm tra hình: dev server qua `.claude/launch.json` + công cụ preview, khung 375×812 và desktop, chụp màn hình (không commit). Pane không có WebGL → ghi "chưa kiểm chứng".
- Không ghi "pass" khi không có output.

## Khôi phục phiên

Sau compact hoặc mở phiên mới:
1. Hook SessionStart (matcher `compact`) in `docs/ai-studio/PROGRESS.md` + `git status`.
2. Hook hộp thư thiết kế báo thay đổi từ `cog/main`.
3. Đọc báo cáo ngày trong `docs/design/progress/`.
4. `/sprint-status` cho bức tranh nhanh.

`PROGRESS.md` giữ ngắn: chỉ việc đang làm/chặn; việc xong chuyển sang báo cáo ngày.
