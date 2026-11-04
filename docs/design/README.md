# Thiết kế game (design/)

Thư mục giữ **GDD** — tài liệu thiết kế tổng của game — và là nơi trả lời câu hỏi về trạng thái thiết kế và tiến độ code.

| File | Nội dung |
|---|---|
| [cog-coffee-gdd.md](cog-coffee-gdd.md) | GDD tổng hợp. Mục 0 là bảng trạng thái |
| [ideas/](ideas/README.md) | Hộp thư ý tưởng: mỗi ý tưởng một file, có vòng đời Mới → Đang xem → Đã chốt / Bỏ |

## Trả lời câu hỏi của quản lý

| Câu hỏi | Xem ở đâu |
|---|---|
| GDD đang ở trạng thái nào? | GDD › Thông tin tài liệu + mục 0.1 |
| Code đã làm tới đoạn nào của GDD? | GDD › mục 0.3, cột **Code** và **Kiểm chứng**; mỗi dòng trỏ về mục GDD tương ứng |
| GDD còn cần sửa gì? | GDD › mục 0.4 (việc sửa tài liệu) và mục 15.1 (câu hỏi thiết kế chưa chốt) |
| Luật chi tiết của một tính năng? | Theo cột Mục GDD, rồi tới tài liệu nguồn trong `screens/` hoặc `shared/` |

Câu trả lời luôn kèm **ngày đối chiếu code lần cuối** (Thông tin tài liệu). Nếu ngày đó cũ hơn commit gần nhất, phải đối chiếu lại trước khi báo cáo.

## Quan hệ với tài liệu khác

```text
design/cog-coffee-gdd.md      tổng quan + trạng thái (đọc trước)
        │ trỏ tới
        ▼
screens/<màn>/rules.md, gameplay.md   luật chi tiết, nguồn sự thật
shared/*.md                           hệ thống dùng chung, hợp đồng dữ liệu
screens/**/*-proposal.md              đề xuất chưa duyệt
archive/                              lịch sử, không dùng làm đặc tả
```

- Luật chi tiết nằm ở tài liệu theo màn. GDD tóm tắt và **không** là nơi đầu tiên đổi luật.
- Khi GDD và tài liệu màn khác nhau, tài liệu màn thắng; ghi chỗ lệch vào mục 0.4 hoặc Phụ lục B của GDD.

## Quy ước trạng thái

Mỗi tính năng có mã `F-xx` và ba cột trạng thái độc lập:

| Cột | Giá trị | Ai đổi |
|---|---|---|
| Thiết kế | Đề xuất → Đã chốt / Đang chỉnh / Bỏ | Đổi khi người dùng duyệt hoặc bác |
| Code | Chưa làm → Đang làm → Một phần → Đã code | Đổi khi commit code của tính năng |
| Kiểm chứng | Chưa / Test / Sim / Playtest dd/mm | Chỉ đổi khi có bằng chứng (test đã chạy, số sim, ghi chép playtest) |

- "Đã code" không có nghĩa đã kiểm chứng.
- Mã `F-xx`, `D-xx` không dùng lại sau khi xóa; tính năng bỏ thì giữ dòng với Thiết kế = Bỏ.
- Việc sửa tài liệu (`D-xx`) làm xong thì xóa khỏi bảng 0.4 và ghi vào Lịch sử phiên bản.

## Khi nào cập nhật GDD

| Sự kiện | Cập nhật |
|---|---|
| Người dùng duyệt / bác đề xuất | Cột Thiết kế; nội dung mục GDD tương ứng |
| Commit code của một tính năng | Cột Code; ngày + commit ở "Đối chiếu code lần cuối" |
| Có kết quả test, sim, playtest | Cột Kiểm chứng; ghi chú lỗi còn mở |
| Đổi luật hoặc số liệu | Sửa tài liệu màn trước, rồi mục GDD; nếu chưa kịp thì thêm dòng `D-xx` |
| Phát hiện tài liệu lệch code | Thêm dòng `D-xx` vào mục 0.4 |
| Mỗi lần sửa GDD | Tăng phiên bản (x.y), thêm dòng Lịch sử phiên bản, cập nhật số đếm ở mục 0.1 |

Tăng số phụ (1.1 → 1.2) cho cập nhật trạng thái và sửa nhỏ; tăng số chính (1.x → 2.0) khi đổi vòng chơi hoặc phạm vi game.

## Luồng git giữa hai repo

| Repo | Remote trong máy | Vai trò |
|---|---|---|
| `beolamtat/V2` | `origin` | Repo làm việc của đội phát triển |
| `tahulk79/COG-CoffeeGame` | `cog` | Repo chung của sếp, nhánh `main` là bản chính thức |

```text
cog/main ──sync về──► nhánh làm việc (origin) ──commit──► PR/MR sang cog/main ──sếp merge──► cog/main
   ▲                                                                                          │
   └──────────────────────────── sếp push ý tưởng / sửa thiết kế ─────────────────────────────┘
```

1. **Bắt đầu việc mới:** `node scripts/design-inbox.mjs` xem `cog/main` có gì mới; báo người dùng; đồng ý thì đồng bộ (`git fetch cog` rồi merge `cog/main` vào nhánh). Hook git in lại những gì vừa vào.
2. **Làm việc:** trên nhánh riêng; đổi luật/tính năng thì cập nhật bảng trạng thái GDD trong cùng commit (AGENTS.md).
3. **Gửi:** push nhánh lên `origin`, tạo PR sang `tahulk79/COG-CoffeeGame` `main`. Mô tả PR ghi các mã `F-xx` / `D-xx` / ý tưởng đã đụng tới.
4. **Sau khi sếp merge:** đồng bộ lại `cog/main`. Commit do chính bạn viết được đánh dấu "(bạn)" trong báo cáo và không tính là tin mới; chỉ thay đổi của người khác mới kích hoạt cảnh báo.

GitHub Action `design-notify` chạy trên `cog` cả với PR của bạn khi được merge; issue đó chỉ cần đóng.

## Ý tưởng mới từ sếp và nhóm

Repo chung (của sếp): `https://github.com/tahulk79/COG-CoffeeGame`, nhánh `main`, remote tên `cog` trong máy phát triển.

| Sếp muốn | Làm thế nào |
|---|---|
| Đưa ý tưởng mới | Thêm file vào `docs/design/ideas/` theo mẫu, commit `idea: …`, push lên `main`. Không cần sửa GDD |
| Đổi luật / số liệu đã chốt | Sửa tài liệu màn (`screens/`, `shared/`), tăng phiên bản GDD và ghi Lịch sử phiên bản; commit `design: …` |
| Duyệt / bác ý tưởng | Đổi Trạng thái trong file ý tưởng, ghi phần "Quyết định" |

Đội phát triển nhận ý tưởng `Đã chốt` mới triển khai; ý tưởng `Mới` / `Đang xem` chỉ được đọc, ước lượng, hỏi lại. Quy trình chi tiết: [ideas/README.md](ideas/README.md).

## Theo dõi thay đổi (báo ngay)

Bốn lớp, lớp sau bắt cái lớp trước bỏ sót:

| Lớp | Khi nào chạy | Báo gì | Ở đâu |
|---|---|---|---|
| GitHub Action `design-notify` | Ngay khi có push lên `main` chạm `docs/design`, `docs/screens`, `docs/shared` | Mở issue nhãn `design-update`, giao cho người trong biến `DESIGN_NOTIFY_ASSIGNEE` → email/thông báo GitHub | `.github/workflows/design-notify.yml` (cần có trên repo của sếp) |
| Hook đầu phiên Claude Code | Mỗi lần mở phiên làm việc | Fetch `cog/main`, so với mốc đã xem; có mới thì agent phải báo đầu câu trả lời | `.claude/settings.json` → `scripts/design-inbox.mjs --hook` |
| Hook git sau pull/sync | Sau `git pull`, `git merge`, `pull --rebase` | Commit, file tài liệu, thư mục code đã đổi, ý tưởng đang mở trong lần đồng bộ đó | `.githooks/post-merge`, `.githooks/post-rewrite` (bật bằng `git config core.hooksPath .githooks`) |
| Lệnh tay | Bất cứ lúc nào | Như hook đầu phiên, đầy đủ | `node scripts/design-inbox.mjs` |

Xem xong thì đánh dấu đã xem để lần sau chỉ báo cái mới hơn:

```bash
node scripts/design-inbox.mjs --ack
```

Mốc đã xem lưu ở `.git/design-inbox.json`, riêng từng máy, không commit. Đổi remote/nhánh theo dõi: `--remote <tên> --branch <tên>` hoặc biến môi trường `DESIGN_REMOTE`, `DESIGN_BRANCH`.

**Trước khi đồng bộ về** (pull, merge, sync với repo của sếp), agent chạy `node scripts/design-inbox.mjs` và báo người dùng cái sắp vào; **sau khi đồng bộ**, hook git in báo cáo những gì vừa vào.
