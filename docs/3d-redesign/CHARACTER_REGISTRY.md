# Character registry

| Nhân vật | Cảnh | Hiện tại | Rig/anim | Cần |
|---|---|---|---|---|
| Người chơi nam | mọi cảnh | `public/models/male.glb` (21,5 MB) | rig, clip walk; ngã = keyframe code | Nén texture (Phase 12); thêm idle/interact |
| Người chơi nữ | mọi cảnh | `public/models/girl.glb` (25,5 MB) | như trên | như trên |
| Linh hồn | intro | bản sao người chơi + vật liệu | theo player | giữ |
| Người đi xe đạp | intro | khối tạm trong slot `intro/bicycle` | không | Meshy (chờ credit) |
| Nhân viên y tế ×2 | intro | `createPerson(color,{medical:true})` | IK tay trong `rescue.js` | Model rig dùng chung skeleton |
| Thần Chết | intro + thiên đàng | khối tạm (`intro/reaper`, `heaven/reaper`) | không | Meshy |
| Thần Nông Cà Phê | thiên đàng | khối tạm trong `heaven/growing` | không | Meshy |
| Thần Pha Chế | thiên đàng | `heaven/brewing` | không | Meshy |
| Thần Thương Hội | thiên đàng | `heaven/business` | không | Meshy |
| Thần Tiếp Nhận | thiên đàng | `heaven/clerk` | không | Meshy |
| Thợ nông trại | farm | `createPerson` qua `crew.js`, slot `farm/worker/<id>` | code | Meshy + rig, clip idle/walk/work/carry |
| Khách quán (14 tên: mai, lan, khoa, vy, phat, ngan, tuan, hung, thao, duy, bay, tu, quang, hanh) | quán | `createPerson` × 0,88 | code | Meshy, tóc/áo thay được |
| Nhân viên quán (cashier, barista, waiter, cleaner, manager) | quán | `createPerson` | code | dùng chung skeleton khách |

Thông số chung: người chơi cao 2; khách 1,76; pivot giữa hai chân; nhìn +Z; ≤ 8k tris; texture 1024.
