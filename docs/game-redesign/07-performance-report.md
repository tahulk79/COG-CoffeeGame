# 07 — Performance Report (Bước 12)

Ngày đo: 2026-11-03. Công cụ: Chrome DevTools MCP, tab cô lập, viewport iPhone 390×844 với DPR 3, **CPU chậm ×4**, chất lượng `medium` (mặc định cho máy cảm ứng).

**Giới hạn:** GPU là GPU của máy Mac, không đại diện GPU điện thoại. FPS bị vsync khóa ở 60. Chưa đo trên thiết bị thật, nên các số dưới đây chỉ dùng để so sánh tương đối.

## 1. Mỗi cảnh (sau redesign, Bước 1–11)

| Cảnh | FPS TB | 1% thấp | p95 frame | Draw call | Tam giác | Long task | Heap |
|---|---|---|---|---|---|---|---|
| Chọn nhân vật | 60 | 56,4 | 17,5 ms | 9 | 36,7k | 0 | 14,6 MB |
| Thiên đàng | 60 | 56,5 | 17,5 ms | 94 | 137,8k | 0 | 25,6 MB |
| Farm (cấp 9) | 60 | 56,5 | 17,6 ms | 119 | 167,2k | 0 | 34,9 MB |
| Quán (đang mở cửa) | 59,9 | 47,6 | 17,6 ms | 106 | 168,8k | 0 | 54,8 MB* |

\* Đo trước khi thu gom rác. Sau khi ép GC: 45 MB.

## 2. So với trước redesign

Không chạy lại được bản code cũ, vì working tree đang có nhiều thay đổi chưa commit của bạn và tôi không stash. Phần so sánh dưới đây dùng số đọc từ bộ đếm `?fps` trong ảnh "before" (chụp ở Phase 1, cùng máy, **không** giới hạn CPU):

| Cảnh | Draw trước | Draw sau | Ghi chú |
|---|---|---|---|
| Chọn nhân vật | 9 | 9 | không đổi |
| Thiên đàng | 98 | 94 | nhãn bị cắt ở mép giờ được ẩn |
| Farm cấp 9 | 119 | 119 | không đổi |
| Quán | 80–87 (cấp 1) | 104–106 (cấp 9) | khác save nên không so trực tiếp; thay đổi của redesign không thêm mesh vào quán |

Những gì redesign thêm vào runtime đều nhẹ:
- 85 ảnh icon SVG decode một lần lúc khởi động.
- MutationObserver đổi emoji, giống `ui/currency.js` đã có.
- Cập nhật cỡ nhãn chỉ khi resize hoặc zoom.
- Ẩn nhãn bị cắt ở thiên đàng: chiếu ~8 nhãn mỗi frame.

Đo lại sau khi thêm các phần này: không có long task, p95 vẫn ~17,5 ms.

## 3. Rò bộ nhớ (chuyển cảnh farm ↔ quán)

- 5 vòng đầu: DOM ổn định — 1 ngăn kéo ở farm, 2 ở quán, số icon không đổi (29 ở farm, 46 ở quán).
- So heap snapshot (đã ép GC) giữa vòng 5 và vòng 10 bằng `scripts/heapdiff.py`: **tăng +0,38 MB**, phần lớn là code và cache style. Số Mesh (3015), MeshStandardMaterial (246), CanvasTexture (273), Group (1080), SkinnedMesh (6), AnimationMixer (4) **không đổi**. Không có phần tử DOM bị tách rời (detached).
- Heap đo ở quán sau GC: 45,1 MB (vòng 5) → 45,3 MB (vòng 10).
- **Kết luận: không có rò bộ nhớ đáng kể.**

## 4. Dung lượng tải

| Cảnh | GLB cảnh | Kèm nhân vật (~2,8 MB) | Ngân sách tham chiếu (skill perf) |
|---|---|---|---|
| Chọn nhân vật | 1,4 MB | 6,9 MB (cả nam và nữ) | ≤ 5 MB |
| Intro | 3,7 MB | ~6,5 MB | ≤ 5 MB |
| Thiên đàng | 5,6 MB | ~8,4 MB | ≤ 5 MB |
| Farm | ~6,2 MB (chưa tải chợ) | ~9 MB | ≤ 5 MB |
| Quán | 8,7 MB | ~11,5 MB | ≤ 5 MB |

Tổng cộng 42 GLB, khoảng 31 MB, **chưa nén hình học** (không meshopt/Draco), texture JPEG, không KTX2. Đây là bottleneck lớn nhất còn lại, nhất là với mạng di động.

## 5. Ngân sách đề xuất (dựa trên số đã đo)

| Chỉ số | Hiện tại (lớn nhất) | Ngân sách |
|---|---|---|
| Draw call | 119 | ≤ 150 |
| Tam giác | 169k | ≤ 300k |
| p95 frame (CPU ×4) | 17,6 ms | ≤ 20 ms |
| Heap sau GC | 45 MB | ≤ 60 MB, không tăng sau 10 lần chuyển cảnh |
| Tải mỗi cảnh | ~11,5 MB | ≤ 5 MB *(chưa đạt)* |

## 6. Việc đã cân nhắc nhưng chưa làm

- **Khử răng cưa (C3):** chưa đổi. Phải đo trên GPU điện thoại thật thì mới quyết được giữa bật MSAA ở mức medium hay tăng độ phân giải render; GPU Mac không cho số dùng được.
- **Nén GLB bằng meshopt + quantize (glTF Transform):** dự kiến giảm 50–70% phần hình học. Việc này cần thêm công cụ build và bật `MeshoptDecoder` khi chạy, nên **chờ bạn đồng ý**.
- **KTX2 cho texture nhân vật:** cần thêm transcoder vào `public/`, và cần so VRAM cùng chất lượng ảnh trước khi chốt.
