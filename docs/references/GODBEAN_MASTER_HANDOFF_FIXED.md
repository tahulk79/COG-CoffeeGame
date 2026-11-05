# GODBEAN — MASTER GAME DESIGN & DEVELOPMENT HANDOFF
**Phiên bản:** 1.0 · 04/11/2026  
**Tên:** Godbean: Build Your Own Coffee Empire  
**Trạng thái:** LOCAL DRAFT — CHƯA GỬI GITHUB/CODEX, CHƯA DEPLOY  
**Repository hiện hành:** `https://github.com/tahulk79/TheCoffeeSixSense.git` (giữ tên kỹ thuật cũ)  
**Mục đích:** Tài liệu thống nhất để dev kiểm tra code đang chạy, đối chiếu yêu cầu, sửa và tiếp tục mà không viết lại không cần thiết.

**Quy ước:** **APPROVED** = founder đã chốt; **PROPOSED** = đề xuất chưa chốt chi tiết; **GAP** = chưa có bằng chứng triển khai; **HOLD** = chưa được phép sửa hệ thống đang chạy.

---
# 1. PRODUCT VISION & BRAND
**APPROVED:** Godbean là game xây dựng đế chế cà phê, vừa giải trí vừa giúp người chơi hiểu trồng, sơ chế, rang, xay, pha, phục vụ và kinh doanh; kiến thức có thể ứng dụng ngoài đời. Phải hấp dẫn cả người không thích hoặc chưa hiểu cà phê (**game-first**). Cơ chế cà phê phải có cơ sở khoa học, câu chuyện/phần thưởng có thể hư cấu (**Hybrid Discovery**). Trải nghiệm và khám phá được lưu, so sánh lâu dài (**Persistent Discovery**).

**Ba thông điệp thương hiệu:**
- **Build Your Own Coffee Empire:** gameplay kinh doanh.
- **Decode the Divine:** thần thoại giải mã.
- **Every Bean Holds a Universe:** triết lý thương hiệu, cả game lẫn chuỗi quán tương lai.
- **From Coffee to Consciousness / The Sixth Taste:** chiều sâu trải nghiệm.

**APPROVED:** Web responsive PC/mobile/iPad trước; iOS/Android native sau. Global và đa ngôn ngữ; EN/VI đầu tiên. Founder sử dụng iPad M5, muốn ChatGPT/Codex thực thi tối đa, tránh copy-paste code. Trần ngân sách AI bổ sung **US$300**; ngân sách marketing thử nghiệm riêng **US$3.000**, chỉ sử dụng sau MVP.

# 2. THẦN THOẠI: GODBEAN = DIVINE DATA SEED / DATABEAN
**APPROVED:** Godbean là “hạt của Thánh Thần”, đồng thời là **hạt dữ liệu**: thông điệp được Thánh Thần gửi cho loài người và mã hóa trong hạt. Người chơi phải gieo trồng, biến đổi, thưởng thức, quan sát, thử nghiệm và tự giải mã. Câu hỏi nền: **Nếu Thánh Thần gửi câu trả lời, tại sao con người vẫn phải tự khám phá?** Vì chính quá trình tìm hiểu và vận dụng mới tạo chuyển hóa, và mỗi đáp án mở thêm câu hỏi.

**Giới hạn:** Đây là **lore hư cấu/triết học**, không phải tuyên bố cà phê thật chứa dữ liệu siêu nhiên hay năng lượng thức tỉnh có thể đo khoa học.

## 2.1 The Sixth Taste = The Sixth Key
**APPROVED:** Vị thứ sáu là khoảnh khắc giải mã được **Key** để mở một tầng nhận thức/khám phá mới. Ba chiều:
1. **Know Yourself:** hiểu khẩu vị, ký ức, cảm xúc, giả định và động cơ bản thân.
2. **Understand Others:** hiểu khách hàng, nhân viên, nhà cung cấp, khác biệt nhu cầu, đồng cảm.
3. **Understand the Universe:** hiểu các quan hệ tự nhiên, kinh tế, sinh thái, thời gian, chuyển hóa và hệ thống.

**APPROVED:** Vòng xoắn năm bước **Tò mò → Đúng/Sai → Yêu/Ghét → Đáng yêu/Đáng thương → Tò mò cấp cao**; bước cuối chỉ tạo cơ hội mở vòng mới, không tất yếu. Người chơi có thể ở các vòng khác nhau trong các lĩnh vực khác nhau. Không xếp hạng “giác ngộ” của con người thật.

## 2.2 Nhận diện thương hiệu (đang thiết kế)
**APPROVED hướng:** logo/wordmark Godbean, biểu tượng `db` gợi **quả cà phê xanh chuyển thành hạt cà phê nâu**, nghiêng/đối xứng, đường nối gợi dòng dữ liệu hoặc vô hạn. Tránh lá cây vô lý, biểu tượng thần thánh phức tạp. Hướng custom wordmark **Godbean Signature**, có thể ứng dụng favicon, app icon, biển hiệu, ly, bao bì, chuỗi quán. **GAP:** chưa có logo vector/font độc quyền cuối cùng hoặc xác minh nhãn hiệu; không được tự nhận đã đăng ký.

---
# 3. HAI TẦNG GAMEPLAY CHÍNH
## 3.1 Tầng 1 — LEARN & EARN
**APPROVED:** Người chơi trải nghiệm để kiếm **XP và vốn ban đầu**:
- **Farm Play:** chọn giống, gieo trồng, chăm sóc, thu hoạch, sơ chế.
- **Coffee Shop Play:** rang, xay, pha, phục vụ theo khẩu vị khách, bán hàng.

**PROPOSED:** minigame ngắn, hướng dẫn bằng hành động, NPC, phản hồi dễ hiểu. Vòng lặp `Grow → Harvest → Process → Roast → Grind → Brew → Serve → Earn → Learn`.

## 3.2 Tầng 2 — BUILD & EXPAND
**APPROVED:** Người chơi tự mua đất ở vùng quê để làm farm hoặc mua/thuê mặt bằng thành phố để mở quán; có thể làm cả hai.
- **Farm Owner:** giống, đất, khí hậu, năng suất, chất lượng, nhân công, sơ chế, tồn kho, chi phí/ha, thương mại hạt xanh số lượng lớn, mở rộng vùng trồng.
- **Café Owner:** vị trí, đầu tư, menu, nguyên liệu, giá, thuê nhân viên/robot, đào tạo, tốc độ phục vụ, trải nghiệm khách, marketing, dòng tiền, chuỗi quán toàn cầu.
- **Liên kết hai lõi:** farm cung cấp hạt cho café; có thể bán ra thị trường hoặc mua từ đối tác; đánh đổi **sản lượng – chất lượng – chi phí – giá – nhu cầu – dòng tiền – uy tín**.

**PROPOSED:** cho phép người chơi chuyên Farm, chuyên Café hoặc tích hợp dọc; du lịch vùng trồng và mở rộng theo thành phố là nội dung dài hạn.

## 3.3 Ba tiến trình độc lập
| Trục | Tích lũy | Tác động |
|---|---|---|
| **Wealth** | tiền, đất, thiết bị, quán, tài sản | đầu tư, mở rộng |
| **Mastery** | XP, công thức, kỹ năng, dữ liệu | sản xuất, quản lý tốt hơn |
| **Awakening** | Divine Fragments, Messages, Sixth Keys | góc nhìn, công cụ, lựa chọn mới |

**APPROVED:** Có hai loại chiến thắng: **Economic Victory** (đế chế) và **Discovery Victory** (giải mã); người chơi có thể theo đuổi một hoặc cả hai. Giàu không đồng nghĩa thức tỉnh.

---
# 4. DECODE & AWAKEN — CƠ CHẾ XUYÊN SUỐT HAI TẦNG
**APPROVED:** Không làm tầng chơi thứ ba bắt buộc. Vòng lặp:

`Play → Collect Data → Observe → Hypothesize → Experiment → Decode → Understand → Apply → Sixth Key → Awaken → Expand → New Questions`

- **Decode:** quan sát dữ liệu, thử nghiệm, nhận ra quan hệ/quy luật.
- **Understand:** diễn giải bằng chứng và giới hạn kết luận.
- **Apply:** vận dụng vào tình huống mới.
- **Awaken:** mở Sixth Key, thêm lựa chọn/công cụ/câu chuyện, **không chỉ +20% năng suất hay lợi nhuận**.

## 4.1 Divine Data Fragments (PROPOSED taxonomy)
| Fragment | Hoạt động | Ý nghĩa |
|---|---|---|
| Origin | giống, đất, khí hậu | điều kiện sự sống |
| Transformation | sơ chế, rang | chuyển hóa |
| Extraction | xay, nước, pha | quan hệ biến số |
| Connection | khách, nhân viên | khác biệt và đồng cảm |
| Exchange | mua bán, chuỗi cung ứng | giá trị và trao đổi |
| Reflection | Coffee Memory, cảm xúc | hiểu chính mình |

Fragments được trao vì khám phá/kiểm chứng, không chỉ lặp thao tác. Ghép fragments → Divine Message → vận dụng → Sixth Key.

## 4.2 Awakening Tree (PROPOSED)
Các Key: **Nature, Transformation, Empathy, Balance, Connection, Curiosity**. Mở công cụ phân tích, nhiệm vụ, chiến lược, câu chuyện hoặc vùng khám phá. Không bán Sixth Keys, không một đường phát triển tối ưu, không leaderboard tâm thức.

## 4.3 Nhiệm vụ mẫu
- **Farm — Yield vs Quality:** hai nông trại cùng giống, khác điều kiện; năng suất cao chưa chắc lợi nhuận cao. Decode dữ liệu, thử chiến lược khác, mở Farm Insight.
- **Café — The Bitter Truth:** doanh thu tăng nhưng lợi nhuận giảm và khách quay lại ít. Xem chi phí, menu, nhân viên, thời gian chờ, chất lượng; thử cải tiến và áp dụng cho quán mới → Key of Empathy.
- **MVP — First Sixth Key:** pha hai ly, so sánh, đặt giả thuyết, pha lần ba kiểm chứng → Key of Curiosity.

## 4.4 Resonance Energy & Sixth Realm
**APPROVED hướng:** năng lượng thăng hoa khi thưởng thức cà phê là **biểu tượng**, không phải năng lượng vật lý. **PROPOSED:** Resonance Energy phát triển không gian/câu chuyện cá nhân; Sixth Keys không mua được; không thưởng theo lượng caffeine hoặc ép báo cáo cảm xúc tích cực.

---
# 5. COFFEE SCIENCE, LAB & MEMORY
**APPROVED:** Kiến thức cà phê phải có quan hệ nhân quả hợp lý, không tự nhận thuật toán game dự đoán chính xác hương vị thật. Toàn chuỗi: trồng → thu hoạch → sơ chế → rang → xay → pha → phục vụ. Pour-over là phương pháp đầu tiên trong prototype.

**Coffee Science:** giống Arabica/Robusta và cultivar, vùng trồng, đất, độ cao, mùa vụ; washed/natural/honey processing; profile rang; cỡ xay, nước, nhiệt độ, bloom, nhịp/tốc độ rót, thời gian chiết xuất; khách hàng có gu riêng. Không có một công thức tối ưu cho tất cả.

## 5.1 Coffee Lab — giá trị ngoài đời
**APPROVED:** Game phải giúp người chơi tự pha ly cà phê ngon và biết đánh giá ly mình uống. Phân biệt **đặc tính cảm quan**, **chất lượng kỹ thuật**, **mức yêu thích** và **cảm xúc/ký ức**.

**Sáu chiều cảm quan:** aroma, acidity, sweetness, bitterness, body, aftertaste; có thể thêm balance/clarity. Chua hay đắng cao không tự động tốt/xấu.

## 5.2 Tám nhóm dữ liệu cần hỗ trợ
| Nhóm | Thông tin |
|---|---|
| Bean | giống, origin, sơ chế, rang, ngày rang, bảo quản |
| Recipe | dose, water, ratio, grind, nhiệt, bloom, rót, thời gian |
| Equipment | máy xay, bình rót, phễu, giấy lọc, bình đựng, ly; brand/model |
| Preparation | RDT xịt ẩm hạt, tráng giấy, làm nóng bình/phễu/ly, vệ sinh |
| Ingredients | nguồn nước, TDS, độ cứng/kiềm, sữa, tỷ lệ sữa, thương hiệu |
| Environment | thời tiết, nhiệt độ, độ ẩm, tiếng ồn, ánh sáng, địa điểm |
| Personal State | tâm trạng, sức khỏe cảm nhận, tỉnh táo, tập trung (tùy chọn) |
| Taste/Reflection | sáu thuộc tính, điểm yêu thích, ký ức, insight, giả thuyết |

**Lưu ý khoa học:** TDS không đủ mô tả nước; RDT không mặc định cải thiện vị; thương hiệu dụng cụ không tự quyết định chất lượng. Thông tin sức khỏe/cảm xúc phải tùy chọn và riêng tư.

## 5.3 Coffee Memory — tính năng được founder nhấn mạnh
**APPROVED:** Khi chấm ly mới, game giúp so sánh với các lần pha trước, nhớ ly nào ngon hơn, tìm hiểu **tại sao**, rồi nhập nhận xét/giả thuyết ngược vào nhật ký để làm dữ liệu cá nhân lâu dài.

**Flow:** Brew → Taste độc lập → Compare history → Reflect → Save Insight → Plan next experiment. Nên chấm độc lập trước khi xem điểm cũ để giảm hiệu ứng neo. Lưu riêng **recipe dự định** và **brew session thực tế**; giữ phiên bản/ảnh chụp dữ liệu cũ.

**Chế độ nhập:** Quick Taste (~30 giây mục tiêu), Coffee Journal (~1–2 phút), Coffee Scientist (chuyên sâu). Có Repeat Last Brew, My Coffee Setup, export/delete.

**Phân tích về sau:** Best Match, Best Taste, Last Brew, Coffee DNA, Sweet Spot, Taste Timeline, Equipment Comparison, Coffee Experiment, AI Coffee Assistant. Tách **Observation / Hypothesis / Experiment**; không kết luận nhân quả từ tương quan đơn giản.

**Privacy:** người chơi kiểm soát, sửa/xuất/xóa dữ liệu; nhật ký sức khỏe/cảm xúc không đưa vào analytics quảng cáo; localStorage MVP có nguy cơ mất dữ liệu khi đổi thiết bị/xóa trình duyệt.

---
# 6. COMMUNITY, TOURNAMENT & LIVEOPS
**APPROVED định hướng:** giải đấu **Processing, Roasting, Brewing, Cupping**, có thể mở Farming, Grinding, Latte Art, Sixth Taste. Người chơi có thành tích chia sẻ công thức được cộng đồng áp dụng/ủng hộ sẽ được đề cử; founder cũng đề xuất vé trả tiền tham gia.

**PROPOSED để bảo vệ công bằng:** có vòng loại mở miễn phí; reputation dựa trên người dùng duy nhất áp dụng công thức, đánh giá sau sử dụng, tỷ lệ sử dụng lại và đóng góp kiến thức, không chỉ likes. Công thức có creator/version/forks và quyền chia sẻ. Chống bot/fake engagement.

**Virtual Judges:** giám khảo ảo có gu khác nhau được tạo trước giải và **khóa profile trong cùng bảng thi**. Điểm tính trên backend bằng model deterministic có version, tách Technical Quality, Sensory Quality, Judge Preference và Challenge Fit. Cupping thiên về độ chính xác cảm quan, không chấm chủ yếu theo gu. Có scorecard, audit, tie-break, khiếu nại, chống gian lận.

**Vòng đời:** Announcement → Qualification → Championship → Finals → Rewards. Admin có thể cấu hình lịch, thể lệ, hạng, panel, reward, leaderboard và localization, nhưng không đổi luật ngầm giữa giải.

**Phần thưởng:** tiền/vật phẩm ảo, cosmetics, danh hiệu, Coffee Pass/Coffee Lab Pro, nội dung; tài trợ hiện vật/voucher trong tương lai nếu hợp pháp. **Không mặc định** bán vé có phí vào giải có giải thưởng quy đổi tiền hoặc giá trị thật: cần rà soát luật từng thị trường, chính sách store, thuế và tính công bằng. Không quy đổi premium currency thành tiền mặt.

**MVP tournament:** một Brewing Challenge mô phỏng cá nhân/giám khảo cố định để kiểm chứng; tournament global thực tế **sau MVP**.

# 7. MONETIZATION & GAME ECONOMY
**APPROVED:** mô hình global F2P có thể mở IAP, Coffee Pass, Coffee Lab Pro, rewarded ads tự nguyện, brand partnerships; **không pay-to-win, không bán Sixth Keys hay cấp độ tâm thức, không dùng sức khỏe/cảm xúc để khai thác quảng cáo**.

**PROPOSED dài hạn:**
- **Coffee Coins:** soft currency từ sản xuất, phục vụ, nhiệm vụ; dùng nâng cấp và chi phí game.
- **Coffee Gems:** premium currency cho trang trí, cosmetic và nội dung phù hợp.
- **Coffee Pass:** season pass thiên về nội dung/cosmetic.
- **Coffee Lab Pro:** phân tích nâng cao và AI hạn mức, trong khi nhật ký cơ bản và xuất dữ liệu vẫn miễn phí.
- **Founder's Pack (~US$4.99):** giả thuyết kiếm tiền sớm sau khi có bằng chứng người chơi muốn trả tiền; chưa chốt giá chính thức.

**Game economy backend:** giao dịch server-authoritative, ledger, idempotency, audit log, chống nhân đôi phần thưởng; không tin số dư do client gửi. Chưa cần triển khai commerce thực trong alpha. Giá/điều kiện thanh toán phải tuân thủ chính sách Apple/Google khi phát hành native.

# 8. GLOBAL, ANALYTICS, ADMIN & MARKETING
## 8.1 Kiến trúc sản phẩm
**APPROVED định hướng:** iOS/Android global về sau; hệ thống đa ngôn ngữ từ đầu, nội dung EN/VI đầu tiên, glossary cà phê thống nhất; chuẩn bị hỗ trợ Nhật, Hàn, Tây Ban Nha, Brazil và các thị trường khác sau kiểm chứng. Locale khác market; định dạng tiền tệ/ngày giờ/nhiệt độ phải đúng.

**PROPOSED backend dài hạn:** Identity, Player, Farm/Café Economy, Coffee Simulation, Recipe/Memory, Community, Tournament, Commerce, Remote Config, Content CMS, Localization, Analytics, LiveOps, Admin. Ưu tiên **modular monolith** hoặc BaaS tối giản, không xây microservices sớm.

**MVP stack từng đề xuất:** web HTML/CSS/JS hoặc React/TypeScript (Phaser chỉ khi cần tương tác 2D), GitHub, GitHub Pages, localStorage; backend Supabase Free nếu cần auth/sync, chưa phải quyết định stack cuối. Trước đó từng bàn NestJS/Firebase/BigQuery/Redis nhưng **không nên mặc định đưa vào MVP $300**.

## 8.2 Analytics tracking
**APPROVED:** phải đo được acquisition → activation → engagement → retention → revenue → referral và giá trị học tập. Founder Dashboard cho quyết định.

**Events tối thiểu:** `landing_viewed`, `play_clicked`, `game_started`, `tutorial_completed`, `brew_started`, `brew_completed`, `taste_submitted`, `memory_saved`, `memory_compared`, `discovery_saved`, `challenge_completed`, `result_shared`, `referral_opened`, `feedback_submitted`, `purchase_verified` (chỉ khi có commerce).

**Event metadata:** event_id, anonymous_player_id, session_id, timestamp, app_version, locale, platform, source, campaign_id, model_version khi thích hợp. Không gửi free-text nhật ký/sức khỏe vào analytics mặc định.

**Dashboard:** Visitors, Play Starts, First Brew Completion, D1/D7/D30 retention, Memory repeat use, Compare rate, Share/Referral, Revenue, ARPDAU/LTV khi có mua hàng, economy health, tournament participation, marketing CPAP/CPI/ROAS khi có dữ liệu.

**North Star đề xuất:** Weekly Meaningful Coffee Experiences — người dùng hoàn thành trải nghiệm có giá trị, không chỉ mở app.

## 8.3 LiveOps & Founder Control Center
**PROPOSED:** remote config, economy balancing, nhiệm vụ/sự kiện, tournament panel, nội dung đa ngôn ngữ, monetization offers, dashboards, cảnh báo, phân quyền admin, approval log và rollback. Các quy tắc chấm điểm giải đấu phải đóng băng khi bắt đầu; không bí mật giảm quyền lợi đã mua.

## 8.4 Marketing automation
**APPROVED:** dành **US$3.000** marketing thử nghiệm nhưng **chưa tạo tài khoản social/ads và chưa chạy quảng cáo trước MVP**. Sau MVP: private alpha 20–30 → community beta 100–200 → public beta 500–1.000 nếu có tín hiệu; organic trước, paid test nhỏ (khoảng US$200–300 ban đầu) rồi mới giải ngân phần còn lại.

**Channels dự kiến:** TikTok, Instagram, YouTube Shorts, Facebook, Reddit, Discord, website/landing page, App Store/Google Play về sau. **Content pillars:** khoa học cà phê, coffee challenge, devlog/gameplay, ký ức/cảm xúc, championship.

**Automation đề xuất:** Trend Research → AI Content Draft → Human Approval → Publishing → Analytics → Recommendations → Founder Decision. Không tự chi tiền hoặc đăng nội dung nhạy cảm ngoài quyền được duyệt. Khi có API kết nối, dữ liệu chiến dịch được đưa về backend, phân biệt số thực/ước lượng và tuân thủ quyền riêng tư.

# 9. MVP, PHASES & PRIORITY
**Quyết định gần nhất:** Web responsive trước, **không native** trước khi kiểm chứng. Chưa có xác nhận đầy đủ những module nào đã merge trên repo.

| Phase | Phạm vi | Acceptance criteria |
|---|---|---|
| **0. Audit** | Kiểm tra repo, branch, Pages, build, docs, test, v0.1–v0.3 | Báo cáo bằng chứng; không viết lại |
| **1. Core Brew** | Chọn hạt, grind/temp/ratio/time, bloom/main/final pour, result | Chơi end-to-end trên Safari iPad và PC |
| **2. Coffee Memory** | Ghi ly thật, taste, so sánh, insight, export/delete | Lưu/reload/compare ổn định |
| **3. First Sixth Key** | Pha hai lần → so sánh → giả thuyết → lần ba → Key of Curiosity | Decode/Apply/Awaken chơi được |
| **4. Economy vertical slice** | Farm mini + café mini + bán/kiếm tiền + nâng cấp | Thể hiện lời hứa Coffee Empire |
| **5. Analytics/Alpha** | Event, dashboard tối thiểu, QA, beta | Có số liệu kích hoạt và retention |
| **6. Expansion** | Farm/Café sâu, community, tournaments, monetization, Sixth Realm | Chỉ triển khai sau kiểm chứng |

**Lưu ý quan trọng:** MVP chỉ có Pour-over Simulator **chưa đủ** đại diện định vị mới “Build Your Own Coffee Empire”. Nhưng cũng không nên nhồi toàn bộ game tycoon: cần một **vertical slice kinh tế nhỏ** sau khi core brew và memory ổn định.

**Mốc kiểm chứng tham khảo, chưa phải benchmark:** landing→play ≥25%; tutorial completion ≥70%; first brew ≥60%; D1 ≥25%; D7 ≥10%; share ≥5%; cần kết hợp phỏng vấn 10–15 người và không ra quyết định chỉ từ mẫu nhỏ.

# 10. TRẠNG THÁI SOURCE & REPOSITORY — KHÔNG ĐƯỢC SUY ĐOÁN
**Lịch sử được báo cáo:** Prototype v0.1, v0.2 và v0.3 “The First Pour” đã được đóng gói thành file trong các phiên chat; v0.3 mô tả tương tác Bloom → Main Pour → Final Pour. Founder cho biết đã kết nối GitHub/Codex và build được bản web trên **GitHub Pages**, sau đó yêu cầu **chưa đồng bộ thay đổi Godbean mới**.

**GAP / CHƯA XÁC MINH:** mã nguồn nào đang trên repository, nhánh mặc định, commit mới nhất, tình trạng v0.3, nội dung Pages đang chạy, test, database, production data. Không được tuyên bố đã push/deploy tính năng mới nếu chưa có commit/build/log.

**Repository canonical hiện tại:** `https://github.com/tahulk79/TheCoffeeSixSense.git`. Repo `tahulk79/C6S` là cũ; không sử dụng. Tên repo cũ không đồng nghĩa tên thương hiệu game vẫn là The Coffee Six Sense.

**HOLD:** Founder đã chỉ đạo rõ **tạm thời chỉ lưu quyết định trong tài liệu và hội thoại, KHÔNG cập nhật GitHub, KHÔNG đẩy sang Codex, KHÔNG sửa GitHub Pages/VPS/DNS**. Tài liệu này chỉ để bàn giao khi anh chủ động cho phép.

# 11. TECHNICAL HANDOFF — QUY TRÌNH CHO DEV/CODEX
1. **Audit read-only trước:** `git status`, branches, HEAD, Pages workflow, tree, package scripts, dependencies, README, tests, CI, data schema. Báo cáo những gì đã triển khai với bằng chứng file/commit.
2. **So sánh tài liệu với code:** phân loại từng hạng mục **APPROVED / IMPLEMENTED / PROPOSED / GAP**. Không đánh đồng prototype ZIP với code đã merge.
3. **Lập dependency map:** Coffee Simulation → BrewSession/Memory → Decode/Key → Farm/Café Economy → Tournament/LiveOps; tránh đổi dữ liệu khiến lịch sử cũ mất.
4. **Đề xuất thay đổi nhỏ theo PR:** giữ code đang chạy; refactor có test; không tự đổi repo, package, URL, domain hoặc Pages.
5. **Đảm bảo versioning:** schema, scoring model, judge profiles, game config, recipe snapshot, content/locale.
6. **Bảo mật:** không đưa token/SSH key vào code; quyền admin/ledger server-side; RLS khi có cloud data; privacy-by-design.
7. **CI:** lint/typecheck/build/tests; test deterministic score, responsive, EN/VI, localStorage/export/delete, migration; rollback deploy.
8. **Chỉ sau khi founder duyệt:** cập nhật brand trong UI/docs, mở PR, merge, Pages deploy; tránh đổi production đột ngột.

## 11.1 Acceptance criteria cho các hệ thống chính
- **Brew:** cùng input + model version → cùng kết quả mô phỏng; UI rõ rằng đây là simulation.
- **Memory:** lưu dữ liệu người dùng qua reload, so sánh hai lần, ghi insight, export/delete; không trộn game score và personal rating.
- **Decode:** evidence → hypothesis → experiment → apply → key; không trao key chỉ vì click/đọc lý thuyết.
- **Farm/Café:** giao dịch có nguồn/đích, chi phí và lợi nhuận có thể giải thích; không tạo tiền từ client tùy ý.
- **Tournament:** judge panel cố định và score tái tính; chống duplicate reward.
- **Localization:** toàn bộ copy EN/VI, không hardcode văn bản vào logic.
- **Responsive:** Safari iPad M5 portrait/landscape, điện thoại nhỏ và desktop; không phụ thuộc hover.

# 12. BACKLOG ƯU TIÊN VÀ CÂU HỎI CHƯA CHỐT
| ID | Hạng mục | Ưu tiên |
|---|---|---|
| GB-001 | Audit repository, Pages, source hiện tại | P0 |
| GB-002 | Đối chiếu GDD và code, chốt scope không phá vỡ build | P0 |
| GB-003 | Hoàn thiện Pour-over tương tác 3 giai đoạn | P0 |
| GB-004 | Coffee Memory thật, compare và insight | P0 |
| GB-005 | First Sixth Key vertical slice | P0 |
| GB-006 | Mini Farm + Mini Café + vốn/XP/kinh tế cơ bản | P0/P1 |
| GB-007 | Responsive, EN/VI, QA, CI | P0 |
| GB-008 | Analytics và Founder Dashboard tối thiểu | P1 |
| GB-009 | Recipe sharing, community reputation | P2 |
| GB-010 | Championship và Virtual Judges | P2 |
| GB-011 | Monetization, LiveOps, marketing connectors | P2/P3 |
| GB-012 | Sixth Realm sâu, world map, global native | P3 |

**Cần founder/dev chốt sau audit:** engine/UI stack, nguồn dữ liệu khoa học, mô hình economy và thời gian game, farm/café bắt đầu theo trình tự nào, mức tự động hóa robot, scoring và unlock, data cloud/auth, chính sách offline, hệ thống nhân vật/cốt truyện, quyền sở hữu assets, pháp lý nhãn hiệu, thị trường soft launch.

# 13. LOG QUYẾT ĐỊNH & LỆNH BÀN GIAO
- **Tên trước:** The Coffee Six Sense (C6S), triết lý Sixth Taste.
- **Tên mới được chốt:** **Godbean: Build Your Own Coffee Empire**.
- **Lore mới được chốt:** Divine Data Seed/Databean, Decode the Divine, Every Bean Holds a Universe.
- **Sixth Taste mới được chốt:** decode ra Sixth Key để hiểu mình → hiểu người → hiểu vũ trụ.
- **Game structure mới được chốt:** hai tầng Learn & Earn và Build & Expand, Decode/Awaken chạy xuyên suốt.
- **Lệnh bảo toàn:** chưa đẩy bất kỳ nội dung đổi tên/thiết kế mới sang GitHub, Codex hoặc bản game đang chạy.

## Prompt bàn giao cho dev (CHỈ SỬ DỤNG KHI FOUNDER CHO PHÉP)
> Đọc `GODBEAN_MASTER_HANDOFF_2026-11-04.md`. Trước tiên audit read-only repository `tahulk79/TheCoffeeSixSense`, nhánh, GitHub Pages và code hiện có. Phân loại APPROVED / IMPLEMENTED / PROPOSED / GAP; báo cáo bằng chứng và kế hoạch thay đổi tối thiểu. KHÔNG tự sửa repo, đổi tên package, commit, tạo PR hoặc deploy khi chưa được founder phê duyệt. Sau khi được duyệt, ưu tiên gameplay Pour-over, Coffee Memory, First Sixth Key và vertical slice Farm/Café, giữ nguyên dữ liệu và chức năng đang chạy. Không giả định rằng bản ZIP prototype đã merge.

---
# PHỤ LỤC A — TÀI LIỆU GDD TRƯỚC KHI ĐỔI TÊN
**Lưu ý:** Phần dưới là **tài liệu thiết kế lịch sử** được ghép nguyên văn nhằm bảo toàn các chi tiết trước đó. Nếu có mâu thuẫn, **các quyết định Godbean mới ở phần 1–13 có ưu tiên cao hơn**. Tên cũ, repo cũ và lịch trình cũ ở phần phụ lục chỉ mang tính lịch sử.

# THE COFFEE SIX SENSE
## MASTER GAME DESIGN DOCUMENT (GDD) · PRODUCT BLUEPRINT · MVP SPEC
**Bản tổng hợp làm game — 23/10/2026**  
**Tài liệu sống:** v1.0 · **Ngôn ngữ:** Tiếng Việt  
**Repository chính thức:** `https://github.com/tahulk79/TheCoffeeSixSense.git`  
**Slogan chính:** **Discover Your Sixth Taste**  
**Triết lý:** **From Coffee to Consciousness**

> **Quy ước nguồn gốc quyết định:**  
> **[CHỐT]** = định hướng/giới hạn đã được founder xác nhận.  
> **[ĐÃ THẢO LUẬN]** = thiết kế đã cùng phát triển nhưng chưa chắc là quyết định cuối.  
> **[ĐỀ XUẤT]** = đặc tả được hệ thống hóa để đội phát triển có thể triển khai; cần kiểm chứng.  
> **[CHƯA XÁC MINH]** = trạng thái kỹ thuật chưa có bằng chứng trực tiếp.  
> Các con số cân bằng game, công thức tính điểm, retention và doanh thu là giả thuyết thiết kế, không phải dữ kiện khoa học hoặc kết quả thực nghiệm.

---

# PHẦN I — PRODUCT VISION

## 1. Bản sắc và lời hứa sản phẩm
**The Coffee Six Sense** là trò chơi giáo dục–mô phỏng về specialty coffee, kết hợp trải nghiệm game cozy với kiến thức pha chế thực tế, khả năng ghi nhớ và so sánh các lần pha, thử thách kỹ năng và một lớp khám phá ý nghĩa cá nhân.

- **[CHỐT]** Tên: *The Coffee Six Sense* (viết tắt **C6S**).
- **[CHỐT]** Tagline: *Discover Your Sixth Taste*.
- **[CHỐT]** Triết lý: *From Coffee to Consciousness*.
- **[CHỐT]** “Six” nhấn mạnh **vị thứ sáu**, không đơn thuần là cụm *sixth sense*.
- **[CHỐT]** Vị thứ sáu không được trình bày như một vị giác sinh lý đã được khoa học xác lập. Nó là ý niệm trải nghiệm vượt ra ngoài các mô tả hương vị thông thường.
- **[CHỐT]** Mục tiêu là giúp người chơi **pha cà phê ngon hơn ngoài đời**, đánh giá cà phê tốt hơn, hiểu sự khác biệt trong khẩu vị và phát triển chiều sâu trải nghiệm.

### Định nghĩa làm việc của “Sixth Taste”
**[CHỐT — định hướng]** Kết hợp bốn thành phần, không ép thành một chỉ số tuyệt đối:
A. **Flavor Creativity:** sáng tạo và khám phá tổ hợp hương vị.  
B. **Emotion & Memory:** cảm xúc, ký ức, hoàn cảnh thưởng thức.  
C. **Mastery:** thành thạo kỹ năng, hiểu quy luật pha chế.  
D. **Open Discovery:** khám phá mở, sự bất ngờ và chiêm nghiệm.

**[ĐỀ XUẤT]** Sixth Taste nên được thể hiện như **bộ sưu tập khoảnh khắc khám phá** (discoveries) và những câu chuyện riêng, thay vì điểm “giác ngộ” để cạnh tranh.

## 2. Đối tượng người chơi
- Người tò mò về specialty coffee, kể cả chưa từng pha thủ công.
- Home brewer muốn luyện kỹ thuật pour-over và lưu recipe.
- Người thích cozy simulation, game tiến trình nhẹ nhàng.
- Người chơi thích thử thách, chia sẻ thành tích và học qua trải nghiệm.
- **[ĐỀ XUẤT]** Tránh giả định người chơi đã biết TDS, extraction yield, processing method.

## 3. Định vị trải nghiệm
**[CHỐT]** Phong cách **hybrid cozy + chuyên môn**, thân thiện với người mới nhưng đủ chiều sâu để người có kinh nghiệm quan tâm.

Các nguyên tắc:
1. **Play first, learn naturally:** thao tác dễ hiểu trước, giải thích chuyên môn đúng lúc.
2. **Scientific humility:** mô phỏng là mô phỏng, không tự nhận thay thế thiết bị đo hay nếm thật.
3. **Real-world transfer:** người chơi mang được kiến thức từ game ra tách cà phê thực.
4. **Reflection without pressure:** ký ức và cảm nhận cá nhân không bị xếp hạng.
5. **Fairness:** thử thách đánh giá công bằng, không pay-to-win.
6. **Privacy by default:** nhật ký cá nhân thuộc về người dùng.

---

# PHẦN II — GAME SYSTEMS / WORLD DESIGN

## 4. Bản đồ hệ thống tổng thể
**[ĐÃ THẢO LUẬN]** Hệ sinh thái gồm các trụ cột sau:

| Hệ thống | Vai trò | MVP |
|---|---|---|
| **Coffee World** | Không gian game, tiến trình, phục vụ khách; về sau có chuỗi nông trại đến ly cà phê | Chỉ **Coffee Desk** |
| **Coffee Lab** | Thí nghiệm công thức và học kỹ thuật pha | **Có: Pour-over** |
| **Coffee Memory** | Nhật ký cà phê thật, so sánh, khám phá khẩu vị | **Có: bản tối giản** |
| **Coffee Challenges** | Nhiệm vụ và tiến trình chơi | **Có: cơ bản** |
| **Coffee Championship** | Thi đấu cộng đồng, chấm điểm công bằng | **Sau MVP** |
| **Sixth Realm** | Không gian biểu tượng cho khám phá cá nhân | **Sau MVP** |
| **Growth Intelligence & LiveOps** | Phân tích, quản trị, nội dung và tăng trưởng | **Tracking tối thiểu** |

### Hành trình thế giới mở rộng
**Grow → Harvest → Process → Roast → Brew → Serve.**

Đây là **tầm nhìn dài hạn**, không phải cam kết xây đủ trong MVP.

## 5. Core gameplay loop
**[CHỐT — hướng MVP]**

`Select Beans → Grind → Brew → Taste → Serve → Earn → Improve`

Người chơi:
1. Chọn loại hạt / profile.
2. Chọn thông số pha.
3. Thực hiện pha trong giao diện tương tác.
4. Xem kết quả mô phỏng và giải thích vì sao.
5. Nhận feedback, điểm kinh nghiệm/tiến trình hoặc mở thử thách.
6. Điều chỉnh công thức, thử lại.

### Vòng giá trị ngoài đời
`Brew → Taste → Record → Compare → Discover → Improve`

**[CHỐT]** Đây là yếu tố khác biệt cốt lõi: không chỉ “chơi pha cà phê” mà còn giúp người dùng **nhớ lần pha trước, so sánh và cải thiện lần pha sau**.

## 6. Coffee World — thiết kế dài hạn
**[ĐÃ THẢO LUẬN]**
- Bối cảnh cozy 2D: quầy pha, dụng cụ, ánh sáng ấm, chuyển động nhẹ.
- Các khách hàng có sở thích khác nhau: sáng nhẹ, ngọt cân bằng, body dày, hậu vị dài…
- Tiến trình từ pha chế thủ công đến quán cà phê và chuỗi sản xuất.
- Các hệ thống mở rộng: trồng trọt, thu hoạch, sơ chế, rang, tồn kho, kinh tế quán.

**[KHÔNG LÀM TRONG MVP]** Nông trại nhiều mùa vụ, chuỗi cung ứng phức tạp, mô phỏng kinh tế sâu, nhiều địa điểm, multiplayer.

## 7. Coffee Lab — Pour-over Simulator
**[CHỐT]** Pour-over là phương pháp pha trọng tâm ở phiên bản đầu.

### 7.1 Biến số
| Biến | Mô tả | Trạng thái |
|---|---|---|
| Bean profile | Xuất xứ, phương pháp sơ chế, thiên hướng hương vị | MVP |
| Dose (g) | Lượng cà phê | MVP / nguyên mẫu |
| Water (ml/g) | Lượng nước | MVP / nguyên mẫu |
| Brew ratio | Tỷ lệ cà phê:nước | MVP |
| Grind size | Cỡ xay | MVP |
| Water temperature | Nhiệt độ nước | MVP |
| Brew time | Tổng thời gian pha | MVP |
| Pour pattern | Các nhịp rót, bloom, lưu lượng | **Đề xuất nâng cấp** |
| Water chemistry | Khoáng/TDS nước | Sau MVP |
| Roast/processing control | Tự rang, sơ chế | Sau MVP |

### 7.2 Bean archetypes cho prototype
**[ĐÃ CÓ TRONG WEB TEST/PROTOTYPE]**
- **Ethiopia Washed**
- **Colombia Honey**
- **Brazil Natural**

Các profile chỉ là **ví dụ phục vụ game**; không suy diễn rằng mọi hạt cùng xuất xứ/sơ chế đều có hương vị giống nhau.

### 7.3 Hành vi gameplay
**[ĐỀ XUẤT]**
- Thay đổi một biến → thấy kết quả và giải thích tương quan.
- Có preset cho người mới, chế độ chỉnh tay cho người muốn học sâu.
- Feedback diễn đạt như: “Trong mô hình game, lần pha này có xu hướng…” thay vì “Cà phê thực tế chắc chắn…”.
- Có nút **Retry**, **Save to Memory**, **Compare**, **Share**.
- Mỗi màn phải chơi được bằng cảm ứng trên màn hình dọc, không bắt buộc kéo thả chính xác bằng chuột.

### 7.4 Scoring model
**[ĐÃ THẢO LUẬN]** Chấm điểm **deterministic**, cùng đầu vào → cùng kết quả, dễ kiểm thử.

**[ĐỀ XUẤT — KHÔNG PHẢI CÔNG THỨC ĐÃ CHỐT]**:
- Mỗi bean profile có khoảng mục tiêu cho ratio, grind, temperature, time.
- Tính penalty cho độ lệch có chuẩn hóa.
- Tạo `simulated_balance_score` trong thang 0–100.
- Sinh giải thích dựa trên biến số lệch lớn nhất.
- Nếu có seed ngẫu nhiên cho yếu tố thú vị, phải lưu seed để tái hiện kết quả.

**Bất biến quan trọng:** điểm mô phỏng **không phải** kết quả đo extraction yield/TDS hay thước đo chất lượng khách quan. Điểm **player-perceived taste** là dữ liệu khác, không ghi đè bằng điểm máy.

## 8. Taste Lab — hệ cảm quan
**[ĐÃ THẢO LUẬN VÀ THỂ HIỆN TRONG WEB TEST]** Sáu thuộc tính cảm quan dùng để người chơi ghi nhận cảm nhận:
1. **Aroma** — Hương thơm
2. **Acidity** — Độ chua
3. **Sweetness** — Độ ngọt
4. **Bitterness** — Độ đắng
5. **Body** — Thể chất / độ dày miệng
6. **Aftertaste** — Hậu vị

**[ĐÃ THẢO LUẬN]** Thang đánh giá người dùng: **1–5** mỗi thuộc tính.

> **Quan trọng:** Sáu *thuộc tính mô tả cảm quan* ở đây **không đồng nghĩa** với “Sixth Taste” mang tính triết lý. Hai khái niệm phải tách biệt trong nội dung và UI.

**[ĐỀ XUẤT]** Trình bày radar chart hoặc thanh điểm đơn giản, nhưng tránh suy ra “độ ngon” bằng cách cộng thẳng sáu thuộc tính: chua/đắng cao không mặc nhiên là tốt hay xấu.

## 9. Coffee Memory — nhật ký thực tế
**[CHỐT]** Coffee Memory phải giúp người chơi lưu lại, **xem lại và so sánh** các lần pha trước, gợi lại trải nghiệm và rút ra bài học.

### 9.1 Trường dữ liệu cốt lõi
- ID, thời điểm pha, tên công thức.
- Bean: tên, origin, variety, processing, roast (các trường nâng cao tùy chọn).
- Dose, water, ratio, grind, temperature, brew time.
- Thiết bị/giấy lọc (tùy chọn).
- Sáu thuộc tính cảm quan 1–5.
- Tasting notes: hương vị, cảm nhận thực tế.
- **What to change next time**: dự định cải thiện.
- `simulated_score` nếu xuất phát từ game; không trộn với đánh giá thật.
- Dữ liệu mở rộng tùy chọn: TDS đo thực tế, ảnh, bối cảnh, tâm trạng.

### 9.2 Các thao tác bắt buộc theo lộ trình
**MVP:** Create → View History → Compare → Export → Delete.  
**[ĐỀ XUẤT]** Edit, filter/search, duplicate recipe, trend view sau khi ổn định.

### 9.3 Giá trị học tập
**[ĐỀ XUẤT]** So sánh A/B hai phiên:
- Cái gì thay đổi?
- Kết quả cảm nhận khác nhau thế nào?
- Điều gì chưa thể kết luận vì đã thay đổi nhiều biến cùng lúc?
- Lần thử tiếp theo nên đổi **một biến** nào?

### 9.4 Coffee DNA
**[ĐÃ THẢO LUẬN]** Hồ sơ khẩu vị cá nhân được tích lũy qua nhiều lần pha/nếm, dùng để tự hiểu mình; không biến thành nhãn khoa học hoặc chẩn đoán.

### 9.5 Quyền riêng tư
- **[CHỐT]** Guest-first; dữ liệu lưu trên máy khi chưa đăng nhập.
- Chỉ yêu cầu account khi cần đồng bộ.
- Dữ liệu cảm xúc/sức khỏe nếu có: **tự nguyện, riêng tư, không dùng cho quảng cáo**.
- Có xuất/xóa dữ liệu.
- **Không lưu dữ liệu nhạy cảm không cần thiết**.
- LocalStorage có rủi ro mất dữ liệu khi xóa trình duyệt; phải nói rõ cho người dùng.

## 10. Coffee Challenges
**[CHỐT — MVP tối giản]**
- Các nhiệm vụ nhỏ: hoàn thành lần pha đầu, thử 2 bean profile, cải thiện công thức, lưu nhật ký.
- Có tiến trình và feedback rõ.
- Mục tiêu dạy người chơi **thử nghiệm có chủ đích**, không chỉ tối ưu điểm số.

**[ĐỀ XUẤT]** Ba nhóm:
- **Learn:** hoàn thành hướng dẫn và hiểu thuật ngữ.
- **Experiment:** thay đổi một biến, so sánh kết quả.
- **Master:** đạt mục tiêu mô phỏng với ràng buộc cụ thể.

**Không khóa kiến thức cơ bản sau paywall.**

## 11. Coffee Championship — tầm nhìn sau MVP
**[ĐÃ THẢO LUẬN]**
- Các hạng mục: brewing, roasting, processing, cupping… khi hệ thống tương ứng đủ trưởng thành.
- Giám khảo chấm trên **đầu vào và quy tắc cố định, tái hiện được**, ưu tiên server-side cho cuộc thi có giá trị.
- Công bố tiêu chí và phiên bản scoring; cùng bài thi phải có điều kiện công bằng.
- Có thể phát triển uy tín recipe bằng cộng đồng thực sự áp dụng/đánh giá, không chỉ bằng lượt like.
- Vòng loại miễn phí và chống pay-to-win.
- **Chưa triển khai thi đấu trả phí/giải thưởng giá trị** trước khi rà soát pháp lý tại thị trường mục tiêu.

## 12. Sixth Realm — trải nghiệm biểu tượng
**[ĐÃ THẢO LUẬN]**
- Không gian khám phá mang tính kể chuyện, ký ức, cảm xúc và ý nghĩa cá nhân.
- Mở ra nhờ quá trình trải nghiệm và khám phá, không phải mua điểm “tỉnh thức”.
- Không khẳng định cảm xúc, tâm thức hoặc năng lượng siêu hình là kết quả khoa học đo được.
- Không tạo bảng xếp hạng “giác ngộ”.
- **Sau MVP**; ưu tiên chứng minh gameplay và Coffee Memory trước.

---

# PHẦN III — PLAYER EXPERIENCE / UX

## 13. Nền tảng và thiết kế tương tác
- **[CHỐT MỚI NHẤT]** Web responsive **PC + mobile browser**, thử nghiệm chủ yếu trên **iPad M5**.
- **[CHỐT]** Native iOS/Android chỉ cân nhắc **sau** khi Web MVP được kiểm chứng.
- **[CHỐT]** English + Vietnamese ngay từ đầu.
- **[CHỐT]** Không bắt người chơi đăng ký trước khi thử.
- **[ĐÃ THẢO LUẬN]** Trải nghiệm **portrait-first** từ định hướng mobile ban đầu; desktop tận dụng màn hình ngang, không ép chung một bố cục.

### 13.1 Screen map
| Route / màn | Mục đích | MVP |
|---|---|---|
| `/` — Landing | Giới thiệu, Play CTA | Có |
| `/play` — Coffee Desk | Chọn bean, điều chỉnh, brew | Có |
| `/lab` — Taste Lab | Phân tích/giải thích kết quả | Có hoặc gộp vào Play |
| `/memory` — Coffee Memory | Lưu, xem, so sánh | Có |
| `/challenges` | Nhiệm vụ | Có |
| `/profile` | Hồ sơ và đồng bộ | Tối giản / sau |
| `/admin` | Dashboard quản trị | Sau khi có backend |

Đây là sơ đồ route **đã đề xuất**, chưa phải hợp đồng API/định tuyến cố định.

### 13.2 First-time user experience
**[ĐỀ XUẤT]**
1. Mở trang → nút **Start Brewing**.
2. Chọn một bean với mô tả dễ hiểu.
3. Dùng preset gợi ý.
4. Tinh chỉnh tối đa 1–2 biến.
5. Brew → Taste → Result.
6. Nhận một lời khuyên rõ ràng.
7. Tùy chọn Save / Retry / Share.
8. Giới thiệu Coffee Memory thực tế.

### 13.3 Responsive và accessibility
- Touch target đủ lớn; không phụ thuộc hover.
- Độ tương phản dễ đọc; font không quá nhỏ.
- Không dùng màu sắc làm tín hiệu duy nhất.
- Tránh animation nặng gây nóng máy/hao pin.
- Trên mobile, thông số xếp dọc, nút hành động cố định hoặc dễ chạm.
- Trên desktop, có thể bố trí bàn pha và panel điều khiển song song.

---

# PHẦN IV — PROGRESSION, ECONOMY, SOCIAL

## 14. Progression
**[ĐỀ XUẤT]**
- **Knowledge unlocks:** mở bài học/công cụ qua trải nghiệm, không paywall nội dung căn bản.
- **Recipe mastery:** theo dõi số lần thử và chất lượng giải thích, không chỉ điểm.
- **Personal discoveries:** bộ sưu tập những kết luận người chơi tự ghi nhận.
- **Cosmetic rewards:** skin quầy pha, cốc, background… chỉ cân nhắc sau khi có retention.

## 15. Economy
**[ĐÃ THẢO LUẬN]** Game dài hạn có thể có tiền tệ ảo và quản lý quán, nhưng **chưa chốt công thức earn/spend, sink/source, giá vật phẩm, bảng cân bằng**.

**[ĐỀ XUẤT CHO MVP]** Không xây kinh tế phức tạp. Dùng điểm tiến trình và unlock nhẹ, tránh tiền ảo nếu không phục vụ trải nghiệm.

## 16. Social & viral loop
**[ĐÃ THẢO LUẬN]**
- Kết quả pha có thể chia sẻ dưới dạng scorecard.
- Mẫu thông điệp: “My Brewing Score: 87/100. Can you beat my recipe?”
- Deep link thử thách, ví dụ `/play?challenge=brew01&ref=ABC123`.
- Không tiết lộ tasting notes cá nhân hoặc dữ liệu riêng tư khi chia sẻ nếu chưa có đồng ý.
- Tracking referral ẩn danh ở mức tối thiểu.

## 17. Monetization
**[ĐÃ THẢO LUẬN]** Giả thuyết ban đầu: **Founder’s Pack ~US$4.99 mua một lần**, chỉ mở sau khi đã kiểm chứng nhu cầu.

**[CHỐT — giới hạn]**
- Không vội làm subscription.
- Không làm pay-to-win.
- Coffee Memory cơ bản nên miễn phí.
- Không mua quảng cáo khi chưa có MVP chơi được.
- Không triển khai payment trong prototype.

---

# PHẦN V — MVP BUILD SPEC / ENGINEERING

## 18. Scope cứng của Web MVP
### Phải có
- Web mở được trên Safari iPad, mobile và PC.
- Chọn bean, chỉnh các thông số pour-over, chạy mô phỏng, xem feedback.
- Kết quả đủ rõ để người chơi muốn thử lại.
- Coffee Memory tối giản: lưu, xem, so sánh, xuất/xóa.
- EN/VI.
- Guest play, không cần account để thử.
- Theo dõi sự kiện cơ bản khi có backend.
- Có URL web thử nghiệm công khai hoặc giới hạn người thử.

### Chưa làm
- Full coffee farming, roasting, processing economy.
- Multiplayer và Championship production.
- AI chatbot chạy liên tục.
- Sixth Realm nhiều tầng.
- Native app và app store.
- Backend phức tạp, hệ thống microservices, marketing automation lớn.

## 19. Prototype v0.1 — hiện trạng được ghi nhận
**[ĐÃ BÀN GIAO]** Gói `The_Coffee_Six_Sense_Prototype_v0.1.zip`, gồm:
- `index.html`
- `styles.css`
- `app.js`
- `README.md`

**[ĐÃ ĐƯỢC MÔ TẢ]** Giao diện cozy, ba loại bean, điều chỉnh công thức, chấm điểm mô phỏng, Coffee Memory lưu localStorage, JSON export, EN/VI, responsive.

**[ĐÃ CÓ THÊM WEB TEST TRONG LỊCH SỬ DỰ ÁN]** Một bản `TheCoffeeSixSense-WebTest.html` có Coffee Desk, các biến dose/water/temp/grind, sáu thang cảm quan, ghi chú và đề xuất lần pha sau.

**[CHƯA XÁC MINH]** Bản ZIP và WebTest có cùng một codebase hay không; chưa xác minh kiểm thử trên iPad thực tế, GitHub push hoặc deploy. Không gọi v0.1 là production-ready.

## 20. Kiến trúc kỹ thuật
**[ĐÃ THẢO LUẬN, CHƯA CHỐT CUỐI]**
- Web frontend: **React + TypeScript**; cân nhắc **Phaser** nếu cần minigame 2D thực sự.
- Backend: **Supabase Free** (Postgres/Auth/Edge Functions) khi có nhu cầu sync/analytics.
- Prototype có thể dùng **HTML/CSS/JS tĩnh + localStorage** để giảm chi phí và độ phức tạp.
- Hosting: **Cloudflare Pages** hoặc phương án static hosting tương đương.
- Source control: **GitHub**.

**[ĐỀ XUẤT]** Không chuyển sang Phaser chỉ để vẽ giao diện form/slider; chỉ dùng khi interaction thực sự cần game loop, canvas, sprite hoặc animation chuyên biệt.

### 20.1 Dữ liệu tối thiểu
**[ĐỀ XUẤT]**
```text
BeanProfile(id, name, origin, process, flavor_tags, model_parameters)
BrewSession(id, anonymous_user_id?, bean_id, dose_g, water_g,
            grind, temp_c, time_s, simulated_score, model_version,
            created_at)
TasteEntry(id, brew_session_id?, aroma, acidity, sweetness,
           bitterness, body, aftertaste, notes, next_change, created_at)
Challenge(id, title, rule_version, rule_json, active)
ChallengeAttempt(id, challenge_id, brew_session_id, result, created_at)
```
- Nếu là local-only, cấu trúc trên chỉ là schema logic, **không** hàm ý đã có database.
- Với cloud, cần auth/authorization và row-level security trước khi lưu dữ liệu cá nhân.

### 20.2 Analytics event map
**[ĐÃ THẢO LUẬN]**
`landing_viewed`, `play_clicked`, `game_started`, `tutorial_completed`,
`brew_started`, `brew_completed`, `taste_submitted`, `memory_saved`,
`memory_compared`, `challenge_completed`, `result_shared`,
`referral_opened`, `return_visit`, `feedback_submitted`.

**[ĐỀ XUẤT]** Event envelope:
`event_id`, `anonymous_player_id`, `session_id`, `timestamp`, `app_version`,
`platform`, `locale`, `source`, `campaign_id`.

**Quy tắc:** không gửi nội dung ghi chú cá nhân hoặc dữ liệu sức khỏe/cảm xúc vào analytics mặc định.

### 20.3 Chất lượng kỹ thuật
- Type-check, lint, build, test mô hình điểm số.
- Test determinism: cùng đầu vào → cùng đầu ra.
- Test ranh giới slider, giá trị âm/rỗng, ngôn ngữ EN/VI.
- Test lưu, reload, export, delete dữ liệu.
- Test mobile portrait/tablet/desktop.
- Version model scoring để không làm hỏng khả năng so sánh lịch sử.
- Không lưu token/API key trong frontend hoặc repository.

---

# PHẦN VI — VALIDATION & GO-TO-MARKET

## 21. Phân kỳ phát triển
| Giai đoạn | Sản phẩm bàn giao | Tiêu chí nghiệm thu |
|---|---|---|
| **M1 — Playable Prototype** | Coffee Desk, Brew, Result, responsive, EN/VI | Chơi được end-to-end trên Safari iPad và desktop |
| **M2 — Coffee Memory** | Log thực tế, history, compare, export/delete | Lưu/reload và so sánh hai lần pha chính xác |
| **M3 — Backend & Analytics** | Sync tùy chọn, tracking, admin tối thiểu | Quyền truy cập dữ liệu đúng; event đo được |
| **M4 — Private Alpha** | Web URL cho 20–30 người | Phản hồi định tính, lỗi chính được xử lý |
| **M5 — Growth Experiment** | Share/referral và community beta | Đo retention và activation trước khi mở rộng |

**[ĐÃ THẢO LUẬN]** Ước lượng 6–8 tuần cho MVP trong điều kiện lý tưởng, **không phải cam kết tiến độ**; phụ thuộc khả năng công cụ, phạm vi và QA.

## 22. Thử nghiệm người dùng
**[ĐÃ THẢO LUẬN]**
- **Wave 1:** 20–30 private alpha, ưu tiên quan sát người chơi và phỏng vấn.
- **Wave 2:** 100–200 community beta.
- **Wave 3:** 500–1.000 public beta nếu chỉ số giữ chân có tín hiệu tốt.
- Thực hiện khoảng **10–15 cuộc phỏng vấn** để hiểu nguyên nhân bỏ cuộc, độ thú vị, mức hữu ích của Coffee Memory.

### KPI giả thuyết, chưa phải benchmark
- Landing → Play ≥25%.
- Tutorial completion ≥70%.
- First brew completion ≥60%.
- D1 retention ≥25%.
- D7 retention ≥10%.
- Share rate ≥5%.
- Positive qualitative feedback ≥70%.

**Cảnh báo:** Mẫu alpha nhỏ, chưa đủ để kết luận thống kê chắc chắn; dùng KPI như tín hiệu quyết định thử tiếp/sửa lại, không phải chứng minh thành công.

## 23. Marketing và ngân sách
**[CHỐT]**
- Trần **US$300** dành cho AI coding/công cụ bổ sung.
- Ngân sách **US$3.000 marketing riêng biệt**.
- **Không chi quảng cáo trước khi có MVP**; chưa cần domain, social/ad accounts riêng trước thời điểm thích hợp.
- Organic-first, không tiêu hết marketing budget cùng lúc.

**[ĐÃ THẢO LUẬN]** Thử nghiệm sau MVP: private alpha $0, community beta organic hoặc chi rất ít, rồi paid experiment nhỏ (ví dụ tổng **$300** đầu tiên của ngân sách marketing); giữ phần còn lại cho vòng đã có tín hiệu.

### Creative themes
- “Can You Brew Better Coffee?”
- “Why Does Your Coffee Taste Different?”
- “Beat the Coffee Judge.”

### Đo hiệu quả
Ưu tiên **Cost per Activated Player**, first brew completion, D1/D7 retention, Coffee Memory use và referral conversion; không tối ưu chỉ theo lượt xem.

---

# PHẦN VII — FOUNDER OPERATING MODEL & DELIVERY

## 24. Vibe coding 100% qua ChatGPT
**[CHỐT]**
- Founder dùng **iPad M5**.
- Founder **không muốn copy-paste code/prompt qua lại** giữa ChatGPT và Replit.
- ChatGPT là đầu mối điều phối: đặc tả → code → test → gói bàn giao → hướng dẫn triển khai → sửa lỗi.
- Founder phụ trách định hướng, phê duyệt chi phí/quyền truy cập, kiểm thử trải nghiệm.
- **Không mua Replit Agent khi chưa thực sự cần**.
- Không coi ChatGPT Work là điều kiện bắt buộc; founder không thấy Work trên iPad tại thời điểm trao đổi.

**[GIỚI HẠN THỰC TẾ]** Kết nối một ứng dụng trong Settings không đồng nghĩa phiên chat có quyền gọi API đọc/ghi. Phải kiểm tra công cụ thực tế trước khi tuyên bố đã push hoặc deploy.

## 25. Repository và phát hành
**[CHỐT]** Repository chính thức:
`https://github.com/tahulk79/TheCoffeeSixSense.git`

Repository cũ `tahulk79/C6S` **không còn dùng**.

**[ĐÃ XÁC NHẬN BỞI FOUNDER]** GitHub đã được kết nối với ChatGPT qua Safari sau khi lỗi trong app.

**[CHƯA XÁC MINH]** Quyền đọc/ghi qua connector trong phiên hiện tại; branch mặc định; các file đã có trên repo; commit/push; hosting/deployment.

### Release checklist
- [ ] Kiểm tra nội dung repo mới và branch mặc định.
- [ ] Kiểm tra thực tế khả năng đọc/ghi GitHub.
- [ ] Đối chiếu ZIP v0.1, WebTest và repo để chọn source chuẩn.
- [ ] Chạy build/test và kiểm tra trực quan.
- [ ] Commit code có README, changelog, license decision.
- [ ] Deploy lên static hosting; mở link trên Safari iPad M5.
- [ ] Ghi nhận lỗi, sửa v0.2, phát hành lại.
- [ ] Chỉ sau khi playable MVP ổn định mới mở beta/marketing.

## 26. Rủi ro cần quản trị
1. **Scope creep:** xây cả nông trại, giải đấu, Sixth Realm trước khi core brew loop hấp dẫn.
2. **Giả khoa học:** người chơi hiểu điểm mô phỏng là chất lượng cà phê thật.
3. **UX quá kỹ thuật:** người mới bỏ cuộc trước khi pha xong.
4. **Dữ liệu dễ mất:** localStorage không được backup hoặc đồng bộ.
5. **Chi phí AI:** vòng lặp agent sửa đi sửa lại không có giới hạn.
6. **Phụ thuộc nền tảng:** code nằm trong công cụ AI, không có bản lưu độc lập.
7. **Không đo được retention:** chạy marketing khi chưa biết ai quay lại.
8. **Bảo mật/quyền riêng tư:** log cảm xúc/ghi chú bị đưa vào analytics.
9. **Công bằng thi đấu:** chấm điểm thiếu tái hiện, pay-to-win hoặc vấn đề pháp lý.
10. **Nhầm trạng thái triển khai:** kết nối plugin thành công nhưng chưa có quyền ghi hoặc website chạy được.

---

# PHẦN VIII — BACKLOG CÓ THỂ ĐƯA VÀO DEVELOPMENT

## 27. User stories ưu tiên
| ID | User story | Priority | Acceptance criteria tóm tắt |
|---|---|---|---|
| C6S-001 | Là người mới, tôi chơi thử mà không đăng nhập | P0 | Từ landing đến brew không cần tài khoản |
| C6S-002 | Tôi chọn được bean profile | P0 | Có tối thiểu 3 lựa chọn; mô tả EN/VI |
| C6S-003 | Tôi chỉnh công thức pour-over | P0 | Input có giới hạn hợp lý, dùng được trên touch |
| C6S-004 | Tôi nhận điểm và giải thích mô phỏng | P0 | Cùng input cùng output; có disclaimer |
| C6S-005 | Tôi thử lại với một thay đổi | P0 | Giữ công thức trước để chỉnh tiếp |
| C6S-006 | Tôi lưu lần pha vào Coffee Memory | P0 | Persist qua reload trong cùng browser |
| C6S-007 | Tôi nhập 6 thuộc tính cảm quan thực | P0 | 1–5, độc lập điểm mô phỏng |
| C6S-008 | Tôi xem lịch sử và so sánh hai lần pha | P0 | Hiển thị biến thay đổi và ghi chú |
| C6S-009 | Tôi xuất/xóa dữ liệu cá nhân | P0 | JSON export và delete rõ ràng |
| C6S-010 | Tôi chuyển EN/VI | P0 | Không mất dữ liệu khi đổi ngôn ngữ |
| C6S-011 | Tôi hoàn thành thử thách đầu tiên | P1 | Tiến trình và điều kiện rõ ràng |
| C6S-012 | Tôi chia sẻ scorecard | P1 | Không tự lộ dữ liệu riêng tư |
| C6S-013 | Tôi đồng bộ dữ liệu giữa thiết bị | P2 | Account tùy chọn, auth an toàn |
| C6S-014 | Tôi dự giải đấu | P3 | Chỉ sau khi scoring, pháp lý và fairness đủ chuẩn |
| C6S-015 | Tôi khám phá Sixth Realm | P3 | Không xếp hạng tâm thức |

## 28. Các quyết định còn mở
- Mô hình điểm số cụ thể, trọng số, phạm vi tham số và cách kiểm định bằng chuyên gia cà phê.
- Gameplay tương tác rót nước: slider/form trước hay minigame thời gian thực.
- Stack cuối cùng: giữ HTML/CSS/JS hay chuyển React/TypeScript/Phaser.
- Schema dữ liệu cloud, auth provider, chính sách backup.
- Art direction chi tiết, assets, âm thanh và accessibility testing.
- Quy tắc XP/challenges và economy.
- Chính sách Founder’s Pack, nội dung trả phí và thời điểm mở bán.
- Mức độ public/private của nhật ký và dữ liệu chia sẻ.
- Hosting/domain cuối cùng, cách triển khai tự động từ GitHub.
- Cách vận hành analytics phù hợp luật bảo vệ dữ liệu theo thị trường.

## 29. Definition of Done — Web MVP
Một tính năng chỉ được coi là **Done** khi:
1. Có source code được lưu phiên bản.
2. Có thể chạy lại và test được.
3. Dùng được bằng cảm ứng trên iPad M5 và màn hình mobile phổ biến.
4. Có nội dung EN/VI tương ứng.
5. Không làm hỏng Coffee Memory đã lưu.
6. Không lộ thông tin riêng tư hay khóa bí mật.
7. Có mô tả giới hạn của điểm mô phỏng.
8. Có link build thử nghiệm và người thật đã kiểm tra.

---

# PHỤ LỤC — CÂU LỆNH BÀN GIAO CHO PHIÊN CHAT SAU

> Hãy tiếp tục phát triển The Coffee Six Sense dựa trên `TheCoffeeSixSense_Game_Design_Master_GDD.md`. Repository chính thức là `tahulk79/TheCoffeeSixSense`. Ưu tiên web responsive, EN/VI, iPad M5, ChatGPT-first, không copy-paste code qua các AI, ngân sách AI bổ sung tối đa $300 và không marketing trước khi có playable MVP. Trước khi triển khai, kiểm tra repo và trạng thái code thực tế; không tự nhận đã push/deploy nếu chưa kiểm chứng. Bắt đầu từ core Pour-over Brew Simulator, Taste Lab 6 thuộc tính, Coffee Memory thực tế có so sánh và feedback cải thiện. Không xây scope dài hạn trước khi core loop hoạt động tốt.

**Kết luận:** Đây là bản **tổng hợp các thiết kế game đã cùng làm rõ**, được phân tầng thành phần đã chốt, phần từng thảo luận và đặc tả đề xuất để lập trình. Nó **không thay thế** mã nguồn, tài sản đồ họa hay những bản GDD chi tiết chưa được tìm thấy trong ngữ cảnh hiện tại.
