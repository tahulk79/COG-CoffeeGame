# Analytics theo sự kiện (F-38)

| | |
|---|---|
| Trạng thái | **Đã chốt 04/11/2026 (Quang): analytics theo sự kiện, triển khai từ MVP. Chưa code.** Nơi nhận dữ liệu (endpoint) chưa chọn — xem mục 5 |
| Nguồn | Tài liệu chuẩn tr. 6–7 §8.2 (APPROVED), Phụ lục tr. 20 §20.2; quyết định Q-11 |
| Mục đích | Đánh giá tutorial, giữ chân, kinh tế; trả lời câu hỏi của Founder Dashboard (tr. 7) |

## 1. Nguyên tắc riêng tư

- Ẩn danh: `anonymous_player_id` là chuỗi ngẫu nhiên tạo một lần, lưu trong localStorage, không gắn email/tên nhân vật.
- **Không gửi** chữ tự do (ghi chú, ký ức, insight, tên nhân vật, biển tên), dữ liệu `personal` của Memory, hay giá trị cảm quan từng mục — chỉ gửi đếm và cờ.
- Cài đặt ▸ Dữ liệu có công tắc **"Gửi thống kê ẩn danh"**, mặc định bật, ghi rõ gửi gì; tắt thì xóa hàng chờ chưa gửi.
- Không dùng dữ liệu để quảng cáo cá nhân hóa.

## 2. Envelope (mọi sự kiện)

`event_id` (uuid), `event`, `anonymous_player_id`, `session_id`, `timestamp` (ISO), `app_version` (`package.json`), `locale`, `platform` (`desktop`/`mobile`/`tablet` + `touch`), `source`, `campaign_id` (từ `utm_*` lần mở đầu, nếu có), `region` (nơi trùng sinh), `model_version` (khi liên quan điểm ly), `props` (object nhỏ, chỉ số và chuỗi mã).

## 3. Danh sách sự kiện

| Sự kiện (PDF tr. 6) | Khi nào trong game | `props` |
|---|---|---|
| `landing_viewed` | Trang tải xong (màn tải) | `first_visit` |
| `play_clicked` | Bấm «Vào game» ở màn chọn nhân vật | — |
| `game_started` | Intro bắt đầu (hoặc vào thẳng màn đã lưu) | `resumed`, `screen` |
| `tutorial_completed` | Bán ly đầu (bước 4 hướng dẫn quán) **hoặc** xong nhiệm vụ cuối chuỗi 9.2 | `step`, `ms_since_start` |
| `brew_started` | Mở bàn pha một món | `recipe`, `mode` (`hand`/`quick`/`auto`) |
| `brew_completed` | Ra kết quả ly | `recipe`, `mode`, `score`, `stars` |
| `taste_submitted` | Chốt Quick Taste/Journal | `kind` (`game`/`real`), `level` (`quick`/`journal`/`scientist`) |
| `memory_saved` | Lưu mục Memory | `kind`, `has_insight` |
| `memory_compared` | Mở so sánh A/B | `same_kind`, `vars_changed` |
| `discovery_saved` | Nhận Fragment / Message / Key | `type`, `what` (`fragment`/`message`/`key`) |
| `challenge_completed` | Xong nhiệm vụ (chuỗi, vùng) | `quest` |
| `result_shared` | (chưa có tính năng chia sẻ — giữ tên) | — |
| `referral_opened` | Mở link có `ref=` | `ref` |
| `return_visit` | Phiên mới cách phiên trước ≥ 30 phút | `days_since_first` |
| `feedback_submitted` | (khi có form góp ý trong game) | — |
| `purchase_verified` | Chỉ khi có thanh toán thật | — |

Sự kiện riêng của game (để đo kinh tế và luồng):

| Sự kiện | Khi nào | `props` |
|---|---|---|
| `heaven_completed` | Qua cổng thiên đàng | `skipped`, `correct` (0–6), `gift` (save mới luôn `seeds`), `mode` (`mini`/`full`), `region_type` (`both`/`farm`/`cafe`) — `mode`, `region_type` thêm 05/11/2026 (F-44) |
| `region_selected` | Chốt nơi trùng sinh | `region`, `type`, `preselected` (boolean: true khi bản đồ đã thật sự chọn sẵn lần đầu (không bị hủy vì người chơi tự chạm/kéo trước), chốt đúng nơi đó và chưa chạm cờ nơi khác; scene gọi `onPick(id, { preselected })`) — `preselected` thêm 05/11/2026 (F-44) |
| `field_bought` | Mua ruộng | `index`, `level` |
| `shift_ended` | Hết ca quán | `cups`, `tier` (fail/bronze/silver/gold), `left`, `revenue`, `costs`, `learning` (boolean: ca tập; thêm 05/11/2026, F-45). Từ 05/11/2026 (F-47) ca tập đầu tiên (chưa có `cafe-intro`, kết thúc ở ly đầu) **không** phát sự kiện này; ly đầu đo bằng `tutorial_completed {step:'first_cup'}` |
| `council_answered` | Trả lời một câu ở Hội đồng (lượt đầu, 05/11/2026, F-45) | `expert` (`growing`/`brewing`/`business`), `questionId`, `correct` — đo tỉ lệ gặp từng chuyên gia |
| `workday_ended` | Hết ngày công farm (khi đang chơi) | `level`, `coins_bucket` (làm tròn 100), `market_floor_hit` |
| `victory_reached` | Đạt mục tiêu thắng | `type` |
| `auto_started` | Bật Auto | `runs_left` |

Đã nối (T-07c): `tutorial_completed` (bán ly đầu), `challenge_completed`, `field_bought`, `shift_ended`, `workday_ended`, `victory_reached`, `auto_started`, `council_answered` (F-45) qua `farm.onEvent` + `wireFarm`; `taste_submitted` (`kind`,`level`) và `memory_saved` (`kind`,`has_insight` = đủ 3 ô Insight). Đã nối `discovery_saved` (T-08a). Chưa nối: `memory_compared` props, `return_visit`... Ca học việc trượt mục tiêu không gọi `act('shift')` nên không phát `shift_ended`.

## 4. Gửi và hàng chờ

- Ghi vào hàng chờ localStorage `godbean-analytics` (tối đa 500 sự kiện, đầy thì bỏ cũ nhất).
- Gửi theo lô mỗi 30 s và khi trang ẩn (`visibilitychange` → `navigator.sendBeacon`). Lỗi mạng thì giữ lại, thử lần sau. Không chặn khung hình, không chặn lưu game.
- Không có endpoint (biến môi trường `VITE_ANALYTICS_URL` trống) → chỉ ghi hàng chờ; xem được bằng `?debug=analytics`. Đây là chế độ dev.

## 5. Còn chọn

- **Nơi nhận:** tài liệu chuẩn tr. 6 §8.1 gợi ý Supabase Free cho MVP (bảng `events` + RLS chỉ cho insert ẩn danh). Cần người có quyền tạo project và cấp URL/khóa công khai. Không đưa khóa bí mật vào frontend.
- Founder Dashboard (tr. 7): ngoài phạm vi code game; truy vấn trên bảng `events`.

## 6. Tiêu chí nghiệm thu

1. Mọi sự kiện mục 3 có envelope đủ trường; không có chữ tự do hay dữ liệu `personal`.
2. Tắt công tắc thì không ghi và xóa hàng chờ.
3. Mất mạng không làm mất sự kiện (trong giới hạn 500) và không làm giật game.
4. Funnel `landing_viewed → play_clicked → game_started → tutorial_completed → brew_completed` dựng được từ dữ liệu.
