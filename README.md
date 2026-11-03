# COG — Coffee Game

Game web dùng JavaScript, Three.js và Vite. Node.js 22.12+.

## Chạy

```sh
npm install
npm run dev
```

Mở địa chỉ Vite in trong terminal. Kiểm tra bản production bằng `npm run build` và `npm run preview`.

## Luồng chơi hiện tại

Loading → **Chọn nhân vật** (nam/nữ, nhập tên hoặc ⚄ tên ngẫu nhiên; bấm/vuốt ngang hoặc phím ←/→ để chọn, kéo dọc để xoay) → Vào game → Màn 1. Giới tính và tên lưu ở `cog-coffee-player`, dùng cho thiên đàng, nông trại và quán. Màn chọn chỉ hiện với lượt chơi mới; save đã qua Màn 1 vào thẳng màn đang chơi. Hồ sơ chưa lưu mặc định là nhân vật nữ, tên An Nhiên.

Màn 1 chạy ở tốc độ bình thường khoảng **22,5 giây**: đi bộ → né xe đạp → va biển → ngã → xe cứu thương xuất hiện và dừng → y tế nâng người lên cáng → thần chết tách hồn và dẫn lên → đáp xuống đầu đường trên mây → đứng lại 1,5 giây → đi liền mạch tới cổng và vào trong. Cổng mở sẵn khi đến gần, không dừng ở cổng. Cắt giây đi bộ đầu; không tăng tốc toàn bộ chuyển động. Xe cứu thương bị ẩn hoàn toàn trước mốc cứu hộ, không đứng chờ sẵn lúc vào màn.

HUD hội thoại có biểu tượng người nói, thẻ tên, nội dung và nút **Tiếp**. Bấm bất kỳ đâu, Enter hoặc Tiếp chuyển tới câu thoại kế tiếp, đồng thời bỏ qua phần diễn biến giữa hai câu. Đoạn mở đầu vẫn tự chạy nếu không bấm. **Bỏ qua** bỏ toàn bộ đoạn mở đầu. Góc màn hình chỉ giữ nút **Bỏ qua**. Đổi tab dừng vòng lặp và tự chạy tiếp khi quay lại.

Kết thúc hoặc bỏ qua Màn 1 sẽ vào **Hội đồng trùng sinh**: đi lại trong quảng trường, nói chuyện với Thần Chết, nhận hồ sơ và chọn được dẫn đường hoặc tự khám phá, gặp ba chuyên gia, trả lời sáu câu hỏi để nhận ba dấu, kiểm tra hồ sơ rồi phát hiện mình chỉ ngất. Sau đó chọn hành trang và tự đi tới cổng trở về trần gian. NPC và bối cảnh dùng hình khối tạm để thay asset sau.

**Điều khiển:** bấm mặt đất để đi, bấm NPC để tới nói chuyện; mobile dùng joystick. Bấm bất kỳ đâu để tiếp hội thoại. Khi đang ở câu hỏi phải chọn đáp án; bấm ra ngoài chỉ nháy nhẹ viền khung để gợi ý chọn đáp án, không hiện ô cảnh báo. Có thể dùng thêm WASD/phím mũi tên để đi. Mỗi câu chỉ trả lời một lần, cả đúng và sai đều lưu ngay, không thử lại. Hồ sơ và màn kết hiện tổng đúng/sai. Tải lại sau Màn 1 vào thẳng thiên đàng và giữ tiến trình.

Xem [chi tiết gameplay thiên đàng](docs/heaven-gameplay.md). Qua Cổng trùng sinh sẽ vào thẳng nông trại: trồng, tưới, thu hoạch, sơ chế/rang và giao hàng; không dừng ở bảng kết chương. Quán cà phê có scene riêng, nhận nguyên liệu từ farm và phục vụ khách. Xem [luật gameplay hiện hành](docs/farm-operations-guide.md) để theo dõi các quyết định về nhiệm vụ, nhân viên, đơn hàng, chế biến và UI.

## Nhân vật và cứu hộ

- Dùng GLB có rig, giữ texture gốc, chuẩn hóa chiều cao 2 đơn vị. Walking lấy từ model; ngã dùng keyframe dựng bằng code và giữ tư thế cuối.
- Đo model có rig qua `src/characters/bounds.js`, đồng bộ ma trận xương trước khi lấy bounds.
- Điểm va chạm tính theo model; chặn cột, thanh đỡ và biển. Nhân vật ngã về sau, vị trí cuối là mốc chung cho cứu hộ.
- Y tế cúi đỡ, nâng đủ cao rồi mới chuyển ngang sang cáng. Cơ thể nằm nguyên trên cáng khi di chuyển. Tay có hai khớp, bám theo điểm đỡ hoặc tay cầm.
- Thần chết xuất hiện trước lúc tách hồn, dây xích nối tới bàn tay. Chưa có lồng tiếng; nhân viên y tế và thần chết dùng hình khối dựng bằng code.

Hồ sơ lưu ở `cog-coffee-player`; tiến trình ở `cog-coffee-progress`, schema `version: 1`. Nếu trình duyệt chặn lưu trữ, vẫn chơi được trong lượt hiện tại.

## Cấu trúc

Xem [quy ước cấu trúc dự án](docs/project-structure.md) trước khi thêm nội dung.

- `src/main.js`: điểm khởi động.
- `src/app/game.js`: renderer, vòng lặp, chuyển màn và nối input/HUD.
- `src/features/intro/`: cảnh Màn 1, timeline, va chạm và động tác y tế.
- `src/features/heaven/`: nội dung, luật tiến trình, cảnh và UI Hội đồng trùng sinh.
- `src/features/farm/`: luống cây, nguyên liệu, rang, giao hàng và lưu nông trại.
- `src/shared/world/scene.js`: bối cảnh khối tạm, camera, slot asset và chuyển động dùng chung.
- `src/shared/game/`: va chạm và tìm đường chia nhỏ theo frame.
- `src/features/selection/`: màn chọn nhân vật trước Màn 1.
- `src/characters/`: tải model, animation, bounds và NPC dùng chung.
- `src/state/`: hồ sơ, tiến trình và tên.
- `src/shared/three/`: giải phóng tài nguyên cảnh.
- `src/ui/`: hội thoại và stylesheet; CSS hội thoại tách riêng trong `styles/dialogue.css`.
- `public/`: GLB runtime và favicon.
- `tools/intro-preview/`: công cụ kiểm tra từng mốc, không nằm trong entry bản build.
- `docs/`: tài liệu, kết quả kiểm tra và ảnh tham khảo.

## Kiểm tra

Chạy `npm run dev`, mở `/tools/intro-preview/` trên cùng địa chỉ Vite. Chọn Nam hoặc Nữ, bấm **Chạy kiểm tra**. Công cụ dùng GLB thật, lấy mẫu 60 lần/giây từ giây 3 đến 13 để kiểm tra nhảy vị trí, xuyên nền/mặt cáng, vị trí cơ thể trên cáng, bàn tay bám đúng điểm và không vượt tầm với. Kiểm tra thêm xe cứu thương bị ẩn trước lúc cứu hộ. Các nút mốc cho phép xem riêng lúc va chạm, ngã, nâng và khiêng.

`npm run build` kiểm tra đóng gói production. Chưa đo FPS trên điện thoại thật. Không cài thêm dependency nếu chưa có lý do và sự đồng ý của người dùng.

Quy tắc làm việc: mặc định người dùng tự test. Chỉ chạy kiểm tra khi được yêu cầu cụ thể; xem `AGENTS.md`.

Xem [bố cục cảnh và slot thay asset](docs/scene-assets.md) để chuẩn bị model nghệ thuật.
