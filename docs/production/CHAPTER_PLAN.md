# Kế hoạch từng màn: Prototype → Vertical Slice → Production

> Cập nhật: **2026-10-29** · Trạng thái: **Nháp, chờ duyệt** · Ưu tiên: hoàn thiện **Màn 1** trước.
> Liên quan: [ART_BIBLE](../design/ART_BIBLE.md) · [ASSET_MANIFEST](../design/ASSET_MANIFEST.md) · [ASSET_REPLACEMENT_GUIDE](../ASSET_REPLACEMENT_GUIDE.md) · [TASK_LIST](../task-list/TASK_LIST.md)

## 0. Ba giai đoạn (áp dụng cho mọi màn)

| Giai đoạn | Mục tiêu | Xong khi |
|---|---|---|
| **Prototype** | Chốt lối chơi, nhịp hài, thứ tự sự kiện. Art vẽ bằng code như hiện tại (hình khối, màu tạm). | Chơi từ đầu đến cuối màn không kẹt, người test cười ít nhất ở 3 chỗ, nhịp 4–6 phút. |
| **Vertical Slice** | Một màn hoàn chỉnh như bản bán: nhân vật và môi trường là model 3D có animation (render ra sprite), UI thật, âm thanh thật. | Màn 1 đủ để quay trailer/demo cho người ngoài xem. |
| **Production** | Nâng model, texture, ánh sáng, VFX, animation; tối ưu cho mobile H5. | Đạt chất lượng đồ hoạ mục tiêu, 60 fps trên PC, ≥ 30 fps trên điện thoại tầm trung, tải màn < 5 giây trên 4G. |

**Nguyên tắc:** chỉ sang giai đoạn sau khi giai đoạn trước của màn đó đã chốt. Không làm art đẹp cho lối chơi chưa chốt.

---

## Các màn (mỗi màn một file)

| Màn | File | Trạng thái |
|---|---|---|
| 1 · Phố cổ Hà Nội: "Một ngày xui tận mạng" | [chapters/CHAPTER_1.md](chapters/CHAPTER_1.md) | Prototype tạm ổn |
| 2 · Đường Chuyển Sinh | [chapters/CHAPTER_2.md](chapters/CHAPTER_2.md) | Prototype đã code 2026-10-29, chờ chơi thử |
| 3 · Quán cà phê trùng sinh | [chapters/CHAPTER_3.md](chapters/CHAPTER_3.md) | Chưa làm (hiện thẻ "Sắp ra mắt") |
| 4 · Nông trại cà phê, sau đó bản đồ Việt Nam | [../design/CAFE_FARM_MAP_LOOP.md](../design/CAFE_FARM_MAP_LOOP.md) | Ý tưởng 2026-10-30, chờ duyệt |

> Các mục `§1.x`, `§2.x` nhắc trong TASK_LIST giờ nằm trong file của màn tương ứng.

## Mạch cốt truyện xuyên suốt Màn 1–2–3 (ghi 2026-10-30)

**Sợi chỉ:** một ngày xui ở Hà Nội khiến cậu ngất (Màn 1) → Thần Chết nhận nhầm là chết, Thần Cà Phê ghi nhầm hồ sơ (Màn 2) → hồ sơ lỡ đóng dấu, "như đổ ly cà phê không hốt lại được", nên cậu phải qua đường trùng sinh, nhặt lời nhắn → trùng sinh làm chủ một quán cà phê → (Màn 3) Thần Chết ghé quán, bị cậu làm đổ cà phê, phạt phải pha lại ly ngon thì mới yên (chi tiết ở [CHAPTER_3.md §3.1](chapters/CHAPTER_3.md)).

**Đã xử lý trong thoại (2026-10-30):**
1. *Vì sao chỉ ngất mà vẫn trùng sinh?* Thần Chết: "dấu đóng rồi, như đổ ly cà phê, không hốt lại được, quy trình là quy trình"; Thần Cà Phê: hồ sơ lỡ đóng dấu nên không về thẳng phố được, bù lại cậu được chọn kiếp mới qua 5 trạm (`reaper.twist`, `intro` trong `trials.json`). Câu "đổ ly cà phê" cũng gài trước cho gag cà phê đổ ở Màn 3.
2. *Màn 1 gieo chủ đề cà phê:* thêm các câu xàm về cà phê vào lời người đi đường, người bán, shipper, bà bán vé số và đám đông cấp cứu ("Chắc nó ngất vì sáng nay chưa kịp uống cà phê!") ở `story.json` (`S03.street.chatter`, `rescue.crowd`).

**Còn mở, cần chốt trước khi làm Màn 3:**
3. *Nông trại hay quán trước?* **ĐÃ CHỐT 2026-10-30:** Màn 3 là quán và bài học pha chế (công thức do chủ sản phẩm đưa, nguyên liệu có hạn); khi hết hạt và có tiền thì nông trại cà phê mở ở **Màn 4**, hạt thu hoạch mang về quán bán; sau đó mở bản đồ Việt Nam để đi các vùng xây quán/nông trại, có cửa hàng của người khác. Chi tiết và các câu cần chốt: [CAFE_FARM_MAP_LOOP.md](../design/CAFE_FARM_MAP_LOOP.md). Thay thứ tự "làm nông trước" ở GAME_DESIGN §0.
4. *Ai là "bậc thầy" dạy pha cà phê:* Thần Cà Phê, Thần Chết (qua đoạn pha lại) hay nhân vật mới. Khuyên Thần Chết là người phạt, Thần Cà Phê là người chỉ bước.
5. *Phúc Đức dùng ở Màn 3 thế nào:* hiện chỉ có số và 5 lời nhắn, chưa hệ nào đọc lại (vốn khởi đầu, độ khó lời phạt của Thần Chết, câu trêu của Thần Cà Phê). Cần ít nhất một chỗ dùng để Phúc Đức có tác dụng.
6. *Nhân vật sau trùng sinh:* ở đâu, còn là người Hà Nội không (cần chốt trước cảnh Thần Chết "tự dưng gặp lại" ở Màn 3).

> **Phần dùng chung (đi tự do, di chuyển, footer thoại, âm thanh, setting):** [SHARED_CHAPTER_PARTS.md](../architecture/SHARED_CHAPTER_PARTS.md). Màn mới dùng lại, không chép code.

> **Liên kết giữa các màn:** xem bảng ở [CHAPTER_2.md §2.1c](chapters/CHAPTER_2.md). Màn 1 → 2: kiểu ngất được Thần Chết hỏi lại. Màn 2 → 3: Phúc Đức và Lời nhắn.

> **Test tạm (sẽ xoá):** thêm `?chap=1`, `?chap=2` hoặc `?chap=3` vào URL để vào thẳng Màn 1 / 2 / 3, ví dụ `http://localhost:5190/?chap=2`. Code đánh dấu `TEMP (dev test` trong `main.ts`, `WorldScene.ts`, `core/session.ts`.

---

## 4. Cách làm asset 3D và UI đẹp

### 4.1 Hướng kỹ thuật: 3D render sẵn ra sprite (khuyến nghị)
Game giữ Phaser 2.5D isometric như hiện tại. Mọi model 3D làm trong **Blender**, rồi **render ra sprite sheet** bằng camera orthographic theo [ART_BIBLE §2](../design/ART_BIBLE.md) (X = 60°, Z = 45°, ô 128×64).
- **Lý do**: không phải viết lại engine; chạy nhẹ trên mobile H5; nhìn giống 3D vì ánh sáng và bóng đã nướng sẵn trong ảnh. Gameplay không đổi, chỉ cần một `AtlasRenderer` theo [ASSET_REPLACEMENT_GUIDE §2](../ASSET_REPLACEMENT_GUIDE.md).
- **Phương án khác: 3D thật (three.js)**. Ánh sáng động, xoay camera được, nhưng phải viết lại toàn bộ phần vẽ và nặng trên điện thoại. Chỉ cân nhắc nếu sau Vertical Slice thấy bắt buộc cần camera xoay.

### 4.2 Quy trình một nhân vật
1. **Concept**: sinh 3–5 phương án bằng AI tạo ảnh theo prompt mẫu (mục 4.5), chọn 1. Vẽ thêm ảnh chính diện + nghiêng (turnaround).
2. **Model**: ảnh → 3D bằng công cụ image-to-3D (Blender MCP `generate_3d` dùng Hyper3D/Hunyuan, hoặc Meshy/Tripo). Dọn lưới, chỉnh tỉ lệ chibi, giảm còn ~5–10k tam giác.
3. **Rig + animation**: tải lên Mixamo để tự gắn xương và lấy animation có sẵn (đi, chạy, ngã, ngất, ngồi, nói). Animation hài đặc thù (đập đầu cửa xe, bị gà đuổi) thì chỉnh tay trong Blender.
4. **Render**: script Blender render 8 hướng × từng animation, 12–24 khung/giây tuỳ loại, nền trong suốt, kích thước 2× (ART_BIBLE §3), bóng nhân vật tách riêng.
5. **Đóng gói**: gộp thành atlas (free-tex-packer hoặc TexturePacker), xuất WebP + JSON. Đặt tên theo quy tắc `char_<tên>_<anim>_<hướng>_<khung>`.
6. **Gắn vào game**: map trạng thái `ActorViewState` → animation trong `AtlasRenderer`.

**Tiết kiệm**: người đi đường dùng **chung 1 bộ xương + animation**, chỉ đổi đầu, áo, màu (C1-06), render một lần rồi tô màu bằng tint.

### 4.3 Quy trình môi trường
- Lấy sẵn từ thư viện miễn phí (Poly Haven, Poly Pizza, Sketchfab CC) qua Blender MCP `search_assets` cho đồ phổ thông: ghế nhựa, cột điện, cây, xe.
- Đồ đặc trưng Hà Nội (nhà ống, gánh hàng, sạp báo, nồi phở) thì sinh bằng `generate_3d` từ ảnh concept, hoặc dựng tay dạng mô-đun.
- Ghép cả dãy phố trong Blender. Render **nền tĩnh thành từng mảng lớn** (chia theo ô map) và **đạo cụ tương tác thành sprite riêng**, để còn sắp thứ tự trước sau (depth).

### 4.4 Quy trình UI
- Phong cách: sáng, tròn, viền nâu đậm, bóng mềm, font Baloo 2 (đã dùng), bảng màu trong `src/ui/theme/tokens.ts`.
- Làm bộ UI kit trong **Figma** (đã nối Figma MCP): bong bóng, nút, thanh, thẻ, icon. Sinh hoạ tiết và icon bằng AI tạo ảnh rồi tinh chỉnh trong Figma, xuất PNG 2× dạng 9-slice.
- Không vẽ chữ vào ảnh: chữ luôn render bằng font để còn đổi ngôn ngữ.

### 4.5 Prompt mẫu (để đồng bộ phong cách)
> *Nhân vật*: "chibi 3D character, cozy storybook style, soft global illumination, rounded shapes, big expressive eyes, head one third of body, [Vietnamese street tea seller, middle-aged man, white tank top, plastic sandals], full body, T-pose, neutral grey background, front view"
>
> *Đạo cụ*: "3D isometric game asset, cozy storybook style, soft lighting from upper left, rounded shapes, [Hanoi street pho stall with big steaming pot and low plastic stools], white background, no text"
>
> *UI*: "game UI kit, cozy cartoon style, cream panels with thick dark brown outline, soft drop shadow, speech bubble, rounded buttons, flat background, no text"

### 4.6 Âm thanh
- Nền phố và SFX: thư viện CC0 (Freesound, Pixabay) hoặc tự thu ở phố thật. Nhạc: thuê hoặc dùng công cụ AI tạo nhạc có quyền thương mại.
- "Giọng bập bẹ" thoại: sinh bằng code Web Audio như hiện tại (mỗi ký tự một tiếng blip, cao độ theo nhân vật). Rẻ, dễ thương, không cần lồng tiếng.
- Thay dần phần tổng hợp trong `RunAudio.ts` bằng file âm thanh, giữ nguyên tên sự kiện.

### 4.7 Production: nâng cấp và tối ưu
- **Model/texture**: tăng chi tiết nhân vật chính và 4 người bán chính; texture vẽ tay; biểu cảm mặt (đổi mắt/miệng).
- **Ánh sáng**: render 2 bộ chiều tà/hoàng hôn cho Hồi 2 (đổi sắc độ khi "giờ tan tầm"), ánh đèn đường và biển hiệu.
- **VFX**: hạt (bụi, nước, lông), rung camera, chớp màn hình, đèn xe cứu thương quét qua cảnh.
- **Animation**: thêm khung cho các gag chính, thêm "squash & stretch" khi ngã.
- **Tối ưu**: atlas ≤ 2048², WebP, tải theo màn (lazy load), 3 mức chất lượng (2× / 1.5× / 1×) theo ART_BIBLE §3, giới hạn số NPC theo máy, gộp nền tĩnh. Ngân sách Màn 1: ≤ 15 MB tải về.

