# QA checklist

Mỗi asset gắn vào game phải qua:

- [ ] GLB tải được, không lỗi console; thiếu file thì giữ khối tạm (đã có fallback).
- [ ] Pivot tâm đáy, đứng trên mặt đất, mặt chính đúng hướng slot.
- [ ] Kích thước khớp khối tạm (bảng `docs/scene-assets.md`); vùng cản không chặn điểm tiếp cận (`approachOffsets`).
- [ ] Tris/texture trong ngân sách.
- [ ] Node con bắt buộc tồn tại (vd. `beans`, `fruit_ripe`, `crank`).
- [ ] Đổ bóng/nhận bóng.
- [ ] Không có chữ trên model.
- [ ] Ảnh chụp ở 390×844, 844×390, 1280×720.

Toàn game:

- [ ] `node --test tests/` xanh.
- [ ] `npm run build` thành công.
- [ ] Luồng: chọn nhân vật → Màn 1 → thiên đàng → farm → quán → về farm.
- [ ] Save/tải lại giữ tiến trình.
- [ ] FPS đo thật trên thiết bị (chưa đo).
