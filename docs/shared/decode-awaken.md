# Decode & Awaken (F-35)

| | |
|---|---|
| Trạng thái | **Đã chốt hướng 04/11/2026 (Quang). Lõi logic đã code (T-08a, `features/awakening/rules.js`) giao diện đã code (T-08b, `features/awakening/ui.js`, `view.js`) và 6 phần mở của Key (mục 6) đã code (T-08c, `features/awakening/unlocks.js`).** Danh sách Fragment ↔ Key là bản v1 theo đề xuất trong tài liệu chuẩn (PROPOSED), chỉnh được khi playtest |
| Nguồn | Tài liệu chuẩn tr. 2 §2.1, tr. 3 §4–4.2, tr. 4 §4.3–4.4 (APPROVED + PROPOSED), tr. 9 §11.1; quyết định Q-03 (kết hợp mẹo + câu hỏi mở), Q-04, Q-06 |
| Liên quan | [coffee-memory.md](coffee-memory.md), [progression.md](progression.md), [02-heaven/gameplay.md](../screens/02-heaven/gameplay.md), [contracts.md](contracts.md) mục 8 |

## 1. Nguyên tắc (APPROVED)

- **Lớp phủ trên farm + quán, không phải màn hay tầng chơi thứ ba bắt buộc.** Người chơi bỏ qua Decode vẫn chơi trọn kinh tế.
- Vòng: Play → Collect Data → Observe → Hypothesize → Experiment → Decode → Understand → Apply → Sixth Key → Awaken → Expand → New Questions.
- **Không trao Fragment hay Key chỉ vì bấm hay đọc lý thuyết.** Phải có dữ liệu do chính người chơi tạo ra trong game (lô hàng, ly, ca) và một bước người chơi tự nói ra quan sát/giả thuyết.
- Awaken mở **lựa chọn, công cụ, câu chuyện** — không cộng % năng suất hay lợi nhuận.
- Không bán Fragment/Key, không đổi xu lấy Fragment/Key, không có bảng xếp hạng "giác ngộ", không một đường tối ưu duy nhất (thứ tự Key tùy người chơi).
- Lore là hư cấu: Godbean = Divine Data Seed / Databean. Không tuyên bố cà phê thật chứa dữ liệu hay năng lượng đo được.

## 2. Khái niệm

| Khái niệm | Nghĩa trong game |
|---|---|
| **Câu hỏi mở** | Một câu hỏi người chơi mang từ thiên đàng hoặc phát sinh khi chơi; hiện ở Sổ tay thiên đàng (Hướng dẫn) với trạng thái Mở / Đang thử / Đã giải |
| **Thử nghiệm** | Điều kiện dữ liệu mà game tự nhận ra (mục 4). Khi đủ, câu hỏi chuyển "Sẵn sàng giải mã" |
| **Giải mã** | Hộp thoại ngắn: game đưa đúng dữ liệu của người chơi (vd. 2 lô, 2 ly), người chơi chọn quan sát đúng trong 3 lựa chọn (dựa trên số liệu thật vừa thấy) |
| **Divine Data Fragment** | Phần thưởng của một lần giải mã; có loại (mục 3) |
| **Divine Message** | Ghép **3 Fragment cùng loại** → một đoạn lore + một câu "vận dụng" |
| **Vận dụng (Apply)** | Một nhiệm vụ dùng hiểu biết đó ở tình huống mới (món khác, ruộng khác, ca khác) |
| **Sixth Key** | Vận dụng xong → mở Key của dòng đó |

## 3. Sáu loại Fragment và Key (v1)

| Fragment | Hoạt động | Ý nghĩa | Key mở | Chiều Sixth Key |
|---|---|---|---|---|
| Origin | giống, đất, vùng | điều kiện sự sống | **Nature** | Hiểu vũ trụ |
| Transformation | phơi, rang | chuyển hóa | **Transformation** | Hiểu vũ trụ |
| Extraction | xay, nước, pha | quan hệ biến số | **Curiosity** | Hiểu vũ trụ |
| Connection | khách, nhân viên | khác biệt và đồng cảm | **Empathy** | Hiểu người |
| Exchange | mua bán, chuỗi cung ứng | giá trị và trao đổi | **Balance** | Hiểu người |
| Reflection | Coffee Memory, cảm xúc | hiểu chính mình | **Connection** | Hiểu mình |

Mỗi dòng cần 3 Fragment → Message → Vận dụng → Key. 6 Key = **Discovery Victory** ([progression.md](progression.md)).

## 4. Câu hỏi mở và cách kiểm chứng

### 4.1 Sáu câu từ thiên đàng (Q-03: mẹo vẫn giữ)

Mỗi câu ở thiên đàng (đúng hay sai) để lại một câu hỏi mở. Trả lời đúng ở thiên đàng **không** cho Fragment; chỉ cho mẹo như cũ.

| Câu thiên đàng | Câu hỏi mở | Thử nghiệm (game tự nhận) | Giải mã | Fragment |
|---|---|---|---|---|
| `ripe` | "Quả hái chín và quả thợ hái khác nhau thế nào?" | Trong cùng 1 ngày công có ≥ 1 lô quả **bạn hái tay** và ≥ 1 lô **thợ/robot hái** cùng giống. 05/11/2026 (F-44…F-48, L1): «bạn hái tay» = lô nhân vật chính hái khi **Auto tắt**; lô hái lúc Auto bật ghi `by:'auto'` (suy từ `via` của act), và `auto` không đứng ở bên nào của cặp (`rules.js`: cặp chỉ gồm `player` với `staff`). Mẹo ripe +5 chất lượng và `stats.harvested` giữ nguyên trong Auto | So 2 lô (chất lượng); chọn quan sát đúng | Origin |
| `water` | "Đất ướt sũng có cần tưới thêm?" | Sau một trận mưa, có ô nước ≥ 90 mà bạn không tưới và cây vẫn lớn; hoặc ô nước ≤ 15 ngừng lớn | So tiến độ 2 ô | Origin |
| `recipe` | "Cân đo giúp ly ổn định thế nào?" | 2 ly game **cùng món** tự pha, giá trị lệch vạch < 5% ở mọi bước, đã ghi Quick Taste | So 2 mục Memory | Extraction |
| `adjust` | "Đổi một biến thì biết được gì?" | Là **First Sixth Key** (mục 5) | — | Extraction (3 cái, đủ Message) |
| `costs` | "Doanh thu cao có chắc lãi cao?" | 2 ca có doanh thu A > B nhưng lãi (doanh thu − vật tư − lương − hạt nhập) A < B | Báo cáo ca so 2 ca; chọn nguyên nhân (lương/vật tư/hạt) đúng theo số | Exchange |
| `customer` | "Vì sao khách nói ly khác mọi ngày?" | Một ca có ≥ 2 khách bỏ về hoặc chê, ca sau đổi đúng một thứ (thêm người, ít món, đổi sữa/nước) và ít khách bỏ hơn | So 2 báo cáo ca | Connection |

### 4.2 Câu hỏi phát sinh khi chơi (để đủ 3 Fragment mỗi dòng)

| Fragment | Câu hỏi | Thử nghiệm |
|---|---|---|
| Origin | "Ruộng bón và ruộng tỉa, ruộng nào lời hơn?" (Yield vs Quality, tài liệu chuẩn tr. 4 §4.3) | Một ruộng chỉ bón, một ruộng chỉ tỉa, hái cùng lứa; bán/giao và so xu thu (F-41) |
| Origin | "Cùng giống, vùng khác có khác không?" | Có lô cùng giống từ 2 vùng. **Chưa khả dụng (khóa, hiện lý do cho người chơi)**: nhật ký thu hoạch (`samples.harvests`) không lưu vùng; mỗi save chỉ có một `farm.region` chọn lúc trùng sinh; không có nhập hạt theo vùng. `awakening` (gồm `samples`) được chép qua trùng sinh nên về lý thuyết có lô của hai đời ở hai vùng, nhưng lô không mang nhãn vùng. Cần: ghi `region` vào mỗi lô thu hoạch trong `samples.harvests` (thêm trường vào `HARVEST_SCHEMA`, có migrate) rồi so 2 lô cùng giống khác vùng; đổi dữ liệu này phải cập nhật contracts.md và có kế hoạch migrate. Không trao Fragment khi chưa có dữ liệu thật (§9.1) |
| Transformation | "Nhân tốt có cho hạt rang tốt hơn?" | Rang 2 mẻ từ nhân chất lượng chênh ≥ 10; so lô hạt rang |
| Transformation | "Phơi lâu chờ nhận có hỏng không?" | Một mẻ nhận ngay, một mẻ để ≥ 1 ngày công; so chất lượng (luật hiện tại: không hỏng → người chơi học là không hỏng) |
| Transformation | "Hạt rang để lâu ảnh hưởng gì tới ly?" | Ly pha từ lô mới và lô cũ ≥ 3 ngày công (cần luật hạn hạt — nếu chưa có thì thay bằng so lô hai giống). **Hiện:** `roast-age` khóa (không có luật hạn hạt rang, không thêm); câu `variety` (2 mẻ rang khác giống, so chất lượng) là bản thay thế đang chạy |
| Connection | "Khách chờ lâu thì sao?" | Ca có thời gian chờ trung bình chênh ≥ 15 s giữa 2 ca; so tip/khách bỏ |
| Connection | "Nhân viên mệt làm gì khác?" **(đã code T-08b)** | Ca "mệt" = ≥ 3 ly nhân viên người pha và ≥ 2 ly pha lúc năng lượng < ngưỡng mệt (F-29); ca "khỏe" = ≥ 3 ly và 0 ly pha lúc mệt; so sao TB các ly nhân viên (tốc độ giây/ly hiện cùng số liệu). Robot không tính |
| Exchange | "Bán hết ở chợ một lần có thiệt?" | Một ngày công bán chạm sàn 30%; so giá/gram đầu và cuối ngày |
| Exchange | "Giá cao hơn có lời hơn?" | 2 ca khác hệ số giá món (F-42); so doanh thu và số khách |
| Reflection | "Ly nào mình thích nhất, vì sao?" | ≥ 5 mục Memory có mức thích; chọn đặc điểm chung của 2 ly thích nhất |
| Reflection | "Ly ngoài đời của mình khác ly trong game?" | ≥ 1 mục ly ngoài đời và ≥ 1 ly game cùng phương pháp |
| Reflection | "Ký ức có làm ly ngon hơn?" | ≥ 3 mục có ô ký ức; tự chọn 1 câu nhận xét (không có đáp án sai — Fragment trao khi hoàn tất, không chấm đúng/sai) |
| Extraction | (đủ 3 từ `recipe` + First Sixth Key) | — |

Giải mã có câu trả lời sai: không mất gì, câu hỏi về "Đang thử", được thử lại sau khi có dữ liệu mới (không đoán lại liên tục trên cùng dữ liệu).

## 5. First Sixth Key — Key of Curiosity (vertical slice, GB-005)

Tài liệu chuẩn tr. 4 §4.3: pha hai ly, so sánh, đặt giả thuyết, pha lần ba kiểm chứng.

| Bước | Người chơi làm | Game kiểm |
|---|---|---|
| 1 | Pha ly A món Pour-over V60 (F-40), ghi Quick Taste | Mục Memory game, có `taste` |
| 2 | Pha ly B cùng món, ghi Quick Taste | Mục thứ hai |
| 3 | Mở So sánh A/B, viết hoặc chọn giả thuyết: "Nếu đổi [biến] thì [thuộc tính] sẽ [tăng/giảm]" | Có `insight.hypothesis` với đúng **một** biến |
| 4 | Pha ly C chỉ đổi biến đó | C khác B đúng 1 biến (lệch còn lại < 5%); ghi Quick Taste |
| 5 | Giải mã: game hiện kết quả mô hình + cảm nhận B → C; người chơi chọn "giả thuyết đúng / sai / chưa đủ dữ liệu" | Mọi lựa chọn đều hợp lệ nếu khớp dữ liệu (vd. chọn "đúng" mà thuộc tính không đổi theo hướng dự đoán → game nhắc lại số, cho chọn lại) |
| 6 | Nhận 3 Fragment Extraction → Message → vận dụng: áp dụng biến đó cho món khác (Phin/espresso) một lần | Ly món khác có đổi biến cùng loại |
| 7 | **Key of Curiosity** | |

Mở First Sixth Key: khi xong câu hỏi mở `recipe` hoặc khi người chơi đạt ly V60 ★★ lần đầu, Sổ tay thiên đàng hiện "Câu hỏi của Thần Pha Chế đã sẵn sàng".

## 6. Awaken — mỗi Key mở gì

| Key | Mở (lựa chọn / công cụ / câu chuyện) |
|---|---|
| Curiosity | Chế độ **Coffee Scientist** trong sổ tay; công cụ "Thí nghiệm" (khóa các biến, chỉ cho đổi một); đoạn lore Databean 1 |
| Nature | Lớp xem **hệ số vùng** trên bản đồ thế giới và trong thẻ giống (F-43); đoạn lore 2 |
| Transformation | Biểu đồ chất lượng theo mẻ ở sân phơi/lò rang; đoạn lore 3 |
| Empathy | Thẻ khách hiện **gu** (thích chua nhẹ / ngọt / body dày) và ghi nhớ khách quen khi tính năng có; đoạn lore 4 |
| Balance | Báo cáo lãi theo món và theo ca (doanh thu, vật tư, lương, hạt); đoạn lore 5 |
| Connection | **Coffee DNA** trong sổ tay (hồ sơ khẩu vị từ các mục đã ghi, không phải nhãn khoa học); đoạn lore 6 |

Không Key nào cộng sản lượng, giá bán, tốc độ hay uy tín.

**Đã code (T-08c, 04/11/2026)** — mọi mục cổng bằng `hasKey(progress, id)` (`awakening.keys`), chỉ thông tin/công cụ: Curiosity = chế độ Scientist (đủ 8 nhóm) + nút «Thí nghiệm» ở ly ngoài đời (điền sẵn từ ly gần nhất, chọn MỘT biến để đổi và khóa các ô công thức còn lại, hoặc «Mở khóa hết» để chỉ tô/cảnh báo khi đổi > 1 biến; thêm «Bộ dụng cụ của tôi» lưu/điền dụng cụ + nước/sữa/thương hiệu); Nature = con số vùng trên thẻ giống ở cửa hàng giống **và** trên thẻ kết quả của bản đồ thế giới (mục «Hệ số vùng theo giống», chữ + icon ✓/–/✗; `createWorldMap({ hasNature })` do `app/game.js` truyền từ `hasKey(readProgress(), 'nature')`; chỉ hiện ở nơi có farm và sau khi chốt, vì trước khi chốt thẻ chỉ có địa lý). Bản đồ chỉ mở từ cổng thiên đàng; Key nằm trong `awakening` được giữ qua trùng sinh nên lớp này chỉ thấy từ lần trùng sinh sau khi đã có Key Nature, chưa có đường mở lại bản đồ giữa đời; Transformation = 10 mẻ gần nhất trong bảng sân phơi/lò rang (bản này chế biến giữ nguyên chất lượng nên vào = ra); Empathy = gu theo màu khách trên phiếu gọi món (chưa có «khách quen»); Balance = lãi ca + doanh thu/số ly theo món trong báo cáo ca (chi phí chỉ theo ca); Connection = Coffee DNA trong Lịch sử sổ tay. Đoạn lore 1–6 gắn theo Key (`awakening.lore.key.<keyId>`: curiosity=1, nature=2, transformation=3, empathy=4, balance=5, connection=6): chỉ hiện trong tab Fragment/Key sau khi Key đó đã mở, kèm nhãn «Divine Message (hư cấu)» và dòng «Lore hư cấu»; chữ giữ chỗ 2 câu, EN/VI. Đoạn Divine Message theo loại Fragment (`awakening.lore.<type>`) vẫn hiện từ lúc ghép đủ 3 Fragment. Tab Fragment/Key ghi rõ mỗi Key mở gì.

## 7. Dữ liệu

Trường cấp 1 mới `awakening` trong `godbean-progress` (dùng được ở mọi loại nơi, kể cả chỉ quán):

```js
awakening: {
  version: 1,
  questions: { [id]: { state: 'open'|'trying'|'ready'|'solved', since, evidence: [refs] } },
  fragments: [{ id, type, questionId, at }],
  messages: [type],           // đã ghép
  applied: [type],            // đã vận dụng
  keys: [{ id, at }],         // Sixth Key đã mở
  firstKey: { step: 0–7, entries: [memoryIds], variable }
}
```

`evidence` chỉ giữ tham chiếu (id lô, id ca, id mục Memory), không chép dữ liệu riêng tư. Save cũ không có `awakening` → tạo mặc định với 6 câu hỏi thiên đàng ở trạng thái `open` (nếu `heaven.skipped` thì vẫn tạo, câu hỏi hiện "Chưa gặp chuyên gia" kèm nội dung câu).

**Hội đồng so le (05/11/2026, F-45):** 6 câu hỏi mở vẫn ở trạng thái `open` từ đầu, **không phụ thuộc** việc đã gặp chuyên gia ở Hội đồng (`farm.lessons.met`). Trả lời đúng ở Hội đồng chỉ cho mẹo, **không trao Fragment** và không đổi trạng thái câu hỏi mở. First Sixth Key vẫn mở theo "V60 ★★ lần đầu" hoặc khi giải câu mở `recipe`, không cần gặp Hội đồng (đề xuất Q1 R14).

Cần ghi lịch sử ca (doanh thu, chi phí, lương, khách bỏ, chờ TB) ít nhất **10 ca gần nhất** để kiểm chứng `costs`, `customer` — trường `cafe.shiftLog` mới ([contracts.md](contracts.md) mục 8).

## 8. Giao diện (**đã code T-08b**)

Cách vào: **farm** — nút 📖 Hướng dẫn ▸ tab *Câu hỏi mở* / *Fragment / Key*; **quán** (không có nút Hướng dẫn) — Sổ tay cà phê ▸ tab *Câu hỏi / Key*. Hộp giải mã: nút *Giải mã* ở câu "Sẵn sàng giải mã". First Sixth Key: Sổ tay cà phê ▸ Lịch sử ▸ chọn 2 ly V60 đầu ▸ So sánh ▸ khối 🧪 Key of Curiosity. Giao diện chỉ gọi `act('awakening', ...)`; lore là chữ giữ chỗ hư cấu, ghi rõ "Lore hư cấu".

- Không thêm màn. Sổ tay thiên đàng (Hướng dẫn ▸ Sổ tay thiên đàng, đã có) thêm tab **Câu hỏi mở** và **Fragment / Key**.
- Câu hỏi chuyển "Sẵn sàng giải mã" → toast một lần + chấm trên nút Hướng dẫn. Không ép mở ngay.
- Hộp giải mã là modal giữa màn hình, hiện đúng số liệu của người chơi (2 lô, 2 ly, 2 ca) bằng chữ + icon, không chỉ bằng màu.
- Nhận Fragment: hiệu ứng hạt sáng bay vào biểu tượng Sổ tay (theo `ui-audio-vfx.md`).
- **Lối tắt Hội đồng (05/11/2026, F-45):** khi có chuyên gia đang chờ, đầu tab *Câu hỏi mở* / *Fragment / Key* (farm) và *Câu hỏi / Key* (quán) có dòng «<tên> đang chờ ở Hội đồng (n câu)» + nút **Gặp Hội đồng**: đóng hộp Sổ tay; ở farm lia camera tới Cổng Hội đồng rồi mở hội thoại, ở quán mở ngay nếu cửa đóng (đang mở ca thì báo chờ đóng cửa). Sổ tay thiên đàng (Hướng dẫn): câu chưa gặp hiện "Chưa gặp chuyên gia" kèm nút Gặp Hội đồng (tắt khi chuyên gia chưa có mặt), không có "Ôn lại". Luật: [onboarding-flow](onboarding-flow.md) mục 3.1.

## 9. Tiêu chí nghiệm thu

1. Không có đường nào nhận Fragment/Key mà không có dữ liệu chơi của chính người chơi (test: chỉ bấm mọi nút trong sổ tay không mở được gì).
2. First Sixth Key chỉ mở khi ly C khác ly B đúng một biến.
3. Bỏ qua toàn bộ Decode vẫn chơi trọn kinh tế, không bị chặn tính năng kinh tế nào.
4. Key không thay đổi số liệu kinh tế (test so sim có/không có Key).
5. Save cũ được thêm `awakening` mà không mất dữ liệu khác.
6. Chữ EN/VI đủ; lore ghi rõ là hư cấu ở Hướng dẫn.

## 10. Ngoài phạm vi bản đầu

Sixth Realm, Resonance Energy, Awakening Tree nhiều tầng, vòng xoắn 5 bước theo lĩnh vực (tài liệu chuẩn tr. 2 §2.1) — ghi nhận là hướng dài hạn.
