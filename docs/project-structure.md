# Cấu trúc dự án game

Dự án dùng JavaScript, Three.js và Vite. Tổ chức theo màn chơi/tính năng để thêm nội dung mà không dồn mọi thứ vào một thư mục hoặc một file.

```text
index.html                     Khung HTML và HUD
src/
  main.js                      Khởi động ứng dụng
  app/
    game.js                    Renderer, vòng lặp, chuyển màn, nối input và HUD
  features/
    selection/
      scene.js                 Cảnh chọn nhân vật
    intro/
      scene.js                 Cảnh 3D Màn 1
      timeline.js              Thời lượng và phụ đề Màn 1
      collision.js             Chặn đường tiếp cận vật cản ở đoạn mở đầu
      rescue.js                Động tác cúi và căn tay y tế theo điểm đỡ
    heaven/
      content.js               NPC, câu hỏi và hội thoại
      journey.js               Luật tiến trình và điều kiện mở khóa
      scene.js                 Cấu hình cảnh thiên đàng
      ui.js                    HUD, lựa chọn và cảm ứng
      game.js                  Điều phối gameplay thiên đàng
    farm/
      content.js               Sáu luống và trạm nông trại
      model.js                 Kho, cây, thời gian và giao dịch
      game.js                  Điều phối gameplay nông trại
  characters/
    load-player.js             Tải và chuẩn hóa model người chơi
    motion.js                  Animation người chơi
    bounds.js                  Đo model có rig sau khi đồng bộ xương
    player.js                  Dựng NPC bằng hình khối
  state/
    progress.js                Lưu/đọc tiến trình và hồ sơ người chơi
    names.js                   Tên mặc định và tên ngẫu nhiên
  shared/
    game/
      collision.js             Vật cản và trượt cạnh
      navigation.js            Tìm đường tới vị trí bấm
    world/
      scene.js                 Cảnh, camera, asset slot dùng chung
    three/
      dispose-scene.js         Giải phóng tài nguyên cảnh 3D
  ui/
    styles/
      game.css                 Giao diện game
public/
  favicon.svg
  models/                      Model GLB hiện có
docs/
  project-structure.md
  screenshots/                 Ảnh tham khảo, không phải asset runtime
```

## Thêm nội dung

- Mỗi màn hoặc tính năng mới có thư mục riêng trong `src/features/`, ví dụ `coffee-shop/`. Đặt cảnh, luật chơi và dữ liệu riêng của màn trong cùng thư mục. Dùng tên theo nội dung thay vì số màn để đổi thứ tự chơi dễ hơn.
- Khi cảnh lớn, tách các phần có trách nhiệm rõ ràng thành file trong thư mục màn, ví dụ `environment.js`, `reaper.js`, `dialogue.js`. Chưa cần tạo file hoặc thư mục trống cho nội dung chưa có.
- `app/game.js` điều phối vòng đời, input và giao diện. Luật tính điểm, nhiệm vụ và tương tác mới đặt trong feature tương ứng; không dồn thêm vào vòng lặp chính.
- Cảnh giữ giao diện `scene`, `camera`, `update`, `resize`, `dispose`; gọi `dispose` khi rời cảnh để giải phóng GPU. Màn chọn bổ sung các hàm chọn và chuyển model cho Màn 1.
- Code chỉ dùng ở một feature ở lại feature đó. Nhân vật dùng qua nhiều màn nằm trong `characters/`; tiện ích không phụ thuộc màn nằm trong `shared/`. `shared/` không import ngược từ `app/` hoặc `features/`.
- Đọc/ghi localStorage tập trung ở `state/`. Giữ nguyên key và schema khi sắp xếp file để không mất tiến trình đã lưu. Nếu đổi schema sau này, thêm bước chuyển dữ liệu.
- HTML hiện nằm ở `index.html`, CSS ở `ui/styles/`. Khi thêm HUD lớn cho một màn, tách phần điều khiển HUD vào feature hoặc `ui/` nếu dùng chung.

## Tài nguyên và đường dẫn

Giữ hai model hiện tại tại `public/models/male.glb` và `public/models/girl.glb`. Khi có thêm nhiều asset, nhóm theo nội dung bên trong loại tài nguyên, ví dụ `public/models/coffee-shop/`, `public/audio/intro/`, `public/textures/street/`. Chuyển asset phải cập nhật mọi đường dẫn tải cùng lúc.

Asset trong `public/` được copy nguyên vào bản build. Khi tải bằng JavaScript, dùng `import.meta.env.BASE_URL` như loader hiện tại để hỗ trợ triển khai dưới đường dẫn con. Không bỏ ảnh tham khảo, file thiết kế gốc hoặc bản backup vào `public/`.

`node_modules/` và `dist/` là thư mục sinh tự động, đã được bỏ qua trong Git. Không chỉnh sửa code trong hai thư mục này. Không thêm dependency chỉ để tổ chức thư mục.

`tools/intro-preview/` là công cụ kiểm tra cảnh trong trình duyệt với model thật và mốc thời gian có thể tua; không được import vào game hoặc đưa vào `public/`.

Chi tiết chương tiếp theo nằm trong [gameplay thiên đàng](heaven-gameplay.md). Luật tiến trình tách khỏi scene để thay asset không ảnh hưởng câu hỏi, dấu chứng nhận hoặc mở cổng.

[Bố cục cảnh và slot asset](scene-assets.md) mô tả các khu, kích thước, pivot và API thay khối tạm bằng model.
