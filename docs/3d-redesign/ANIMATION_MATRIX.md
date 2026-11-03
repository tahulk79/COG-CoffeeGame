# Animation matrix

`✓` có · `code` dựng bằng code/tween · `—` chưa có.

| Đối tượng | idle | walk | interact | plant/water/harvest | brew/serve | sit | celebrate | đặc thù |
|---|---|---|---|---|---|---|---|---|
| Người chơi | code (`motion.js`) | ✓ GLB | — | — | — | — | — | ngã: keyframe code |
| Y tế | code | code | code (IK nâng cáng) | | | | | |
| Thợ farm | code | code | code (`activity.js`) | code | | | | |
| Khách quán | code | code | | | | code | | uống: — |
| Nhân viên quán | code | code | code | | code | | | |
| Thần/NPC thiên đàng | — | | | | | | | |
| Cây cà phê | scale theo giai đoạn | | | | | | | `fruit_ripe` bật/tắt; thiếu `fruit_green`, lay gió |
| Cổng trời / cổng trùng sinh | | | | | | | | mở bản lề ở wrapper (code) ✓ |
| Lò rang | | | | | | | | thiếu node `drum` để quay |
| Máy xay | | | | | | | | khối tạm có `wheel` (torus) |
| Giếng | | | | | | | | `crank` quay, `bucket` lên xuống (Phase 01) |

Nguyên tắc: clip nằm trong GLB, tên `idle`, `walk`, `work`, `carry`, `sit`, `drink`; vòng `AnimationMixer` chỉ update khi đối tượng trong frustum.
