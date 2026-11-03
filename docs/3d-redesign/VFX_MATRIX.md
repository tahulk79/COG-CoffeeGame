# VFX matrix

Hệ thống: `src/shared/vfx/index.js` (`createVfx`, `flyTo`, `popNumber`, `shake`, quality 3 mức). Gắn sự kiện: `src/features/farm/feedback.js`, `src/features/cafe/feedback.js`.

| Sự kiện gameplay | Nơi phát | Hiện có | Cần |
|---|---|---|---|
| Trồng | farm feedback | rà soát | bụi đất |
| Tưới | farm feedback | rà soát | giọt nước |
| Làm cỏ / bón | farm feedback | rà soát | |
| Thu hoạch | farm feedback | rà soát | quả bay, xu về HUD (`flyTo`) |
| Rang / khói lò | farm | rà soát | khói tại Empty `chimney_top` |
| Mở ruộng | farm | rà soát | bụi + sáng viền |
| Nâng cấp công trình | farm | rà soát | |
| Hơi ly / hơi espresso | cafe feedback | rà soát | Empty `steam_wand_tip` có trong GLB |
| Phục vụ khách / nhận tiền | cafe feedback | rà soát | |
| Va chạm biển, hồn tách, bụi hồn, mây trôi | intro | ✓ (code) | |
| Cổng trùng sinh | heaven | rà soát | |

"rà soát" = có đầu nối sự kiện nhưng chưa kiểm hình trong phiên redesign.
