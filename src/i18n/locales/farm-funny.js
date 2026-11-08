// Funny farm incidents (docs/design/farm-crew.md §10): 10 levels each, level 10 is what a stat-1 unit gets up to.
const LINES = {
  phone: ['Liếc tin nhắn một cái', 'Rep tin nhắn crush', 'Lướt Facebook quên giờ', 'Xem clip mèo cười rung vai', 'Bình luận dạo khắp xóm', 'Đánh game giữa ruộng', 'Livestream hái cà phê', 'Bán kem trộn online', 'Mở giải esport tại ruộng', 'Xin nghỉ làm KOL'],
  flirt: ['Liếc cô bán nước', 'Huýt sáo theo người ta', 'Xin số điện thoại', 'Hái hoa tặng crush', 'Làm thơ trên bao tải', 'Hát tình ca dưới cửa sổ', 'Tán hai cô một lúc', 'Bồ cũ tới ruộng tìm', 'Dẫn người yêu ra mắt', 'Tổ chức đám cưới giữa ruộng'],
  nap: ['Ngáp một cái rõ dài', 'Tựa gốc cây chợp mắt', 'Gật gù đứng ngủ', 'Ngủ trên bao cà phê', 'Ngáy to hơn máy cày', 'Mơ thấy trúng số', 'Nói mơ gọi tên sếp', 'Ngủ quên qua vụ', 'Treo võng giữa ruộng', 'Ngủ đông như gấu'],
  gossip: ['Hỏi thăm hàng xóm', 'Bàn chuyện giá cà phê', 'Kể chuyện nhà bà Tư', 'Buôn dưa lê sau bồn nước', 'Lập hội bà tám', 'Đồn sếp có bồ', 'Phát thanh viên của làng', 'Họp báo giữa ruộng', 'Viết sớ tố cáo cái bơm', 'Mở podcast chuyện làng'],
  refuse: ['Bảo để lát làm', 'Kêu việc này khó quá', 'Đòi được khen trước', 'Khoanh tay không làm', 'Đòi tăng lương bằng thơ', 'Treo biển đang suy nghĩ', 'Biểu tình một người', 'Lập công đoàn với con dê', 'Khởi kiện cây cà phê', 'Tuyên bố độc lập ô đất'],
  karaoke: ['Ngân nga một câu', 'Hát bolero nhỏ nhỏ', 'Cầm cuốc làm micro', 'Hát sai tông cả dốc', 'Mở loa kẹo kéo', 'Song ca với con gà', 'Thi hát với đội bạn', 'Mở show giữa ruộng', 'Bán vé xem hát', 'Đi lưu diễn bốn tầng'],
  snack: ['Nhai quả cà phê thử', 'Trốn đi ăn bánh mì', 'Lén pha mì tôm', 'Nướng bắp sau kho', 'Mở tiệc ốc giữa giờ', 'Ăn hết cơm đồng nghiệp', 'Mời cả làng nhậu', 'Vỗ béo con gà để ăn', 'Mở quán ăn ven ruộng', 'Thi ăn phở vô địch tỉnh'],
  bet: ['Cá một xu trời mưa', 'Cá quả nào rụng trước', 'Đá gà bằng lời', 'Đặt kèo con dê chạy', 'Mở sòng dưới gốc cây', 'Thua luôn đôi ủng', 'Cầm cố cái cuốc', 'Thua luôn tiền lương', 'Thế chấp ô đất của sếp', 'Lập sòng bạc bốn tầng'],
  dance: ['Lắc nhẹ cái tay', 'Nhún theo nhạc', 'Xoay một vòng khoe', 'Nhảy robot đúng nghĩa', 'Moonwalk trên luống', 'Breakdance vỡ bùn', 'Mở lớp nhảy cho gà', 'Lên TikTok triệu view', 'Đi thi Tìm kiếm Tài năng', 'Thành vũ công toàn cầu'],
  sing: ['Bíp theo điệu nhạc', 'Phát một đoạn bolero', 'Hát bằng còi báo động', 'Song ca với máy bơm', 'Mở album tự sáng tác', 'Rap về pin yếu', 'Đòi thu âm phòng thu', 'Mở đêm nhạc robot', 'Hát cả đêm không tắt', 'Đòi đoạt giải Grammy'],
  broken: ['Kêu cót két nhẹ', 'Lỏng một con ốc', 'Rơi mất cái bánh', 'Tay gắp vẫy lung tung', 'Bốc khói nhẹ', 'Đi giật lùi không rõ lý do', 'Tháo ốc của chính mình', 'Rụng cả cánh tay', 'Đòi về nhà máy', 'Tan xác rồi tự ghép sai'],
  virus: ['Nháy đèn lạ', 'Hiện quảng cáo trên màn', 'Đòi nhập mật khẩu', 'Gửi spam cho máy bơm', 'Đào tiền ảo giữa ruộng', 'Tưởng mình là tủ lạnh', 'Đổi tên thành Bảo Bình', 'Đòi tiền chuộc 10 xu', 'Lây sang con dê', 'Chiếm quyền cả nông trại'],
  drunk: ['Uống nhầm một giọt dầu', 'Đi hơi loạng choạng', 'Nấc ra tia lửa', 'Ôm cột điện tâm sự', 'Đòi lái xe tải', 'Hát say khắp ruộng', 'Cãi nhau với bù nhìn', 'Ngủ trong rãnh nước', 'Lao vào bồn dầu tắm', 'Say tới tận bản cập nhật sau'],
  crush: ['Liếc cái máy bơm', 'Đỏ đèn khi thấy xe', 'Gửi tín hiệu tỏ tình', 'Tặng ốc vít làm quà', 'Viết thơ bằng mã nhị phân', 'Đứng chờ xe công nông', 'Ghen với cái xe máy', 'Bỏ nhà theo xe tải', 'Xin sếp cưới máy cày', 'Sinh ra máy cắt cỏ con'],
};
const TAG = { phone: 'Lướt ĐT', flirt: 'Đi tán gái', nap: 'Ngủ gật', gossip: 'Buôn chuyện', refuse: 'Không chịu làm', karaoke: 'Hát hò', snack: 'Trốn đi ăn', bet: 'Cá độ', dance: 'Nhảy múa', sing: 'Ca hát', broken: 'Hỏng máy', virus: 'Nhiễm virus', drunk: 'Say dầu', crush: 'Đang yêu' };
const EN = { phone: 'On the phone', flirt: 'Off flirting', nap: 'Napping', gossip: 'Gossiping', refuse: 'Refuses to work', karaoke: 'Singing karaoke', snack: 'Sneaking a snack', bet: 'Betting', dance: 'Dancing', sing: 'Singing', broken: 'Broken', virus: 'Has a virus', drunk: 'Drunk on oil', crush: 'In love' };
const JOB_TAG = { en: { openField: 'Opening field', expand: 'Opening land', build: 'Building', livestock: 'Setting up barn' }, vi: { openField: 'Mở ruộng', expand: 'Mở đất', build: 'Đang xây', livestock: 'Chăn nuôi' } };
const jobTags = lang => Object.fromEntries(Object.entries(JOB_TAG[lang]).map(([k, v]) => [`realm.staff.tag.x_${k}`, v]));
const pack = (line, tag) => Object.fromEntries(Object.keys(LINES).flatMap(id => [
  ...Array.from({ length: 10 }, (_, i) => [`funny.${id}.${i + 1}`, line(id, i)]),
  [`realm.staff.tag.f_${id}`, tag(id)],
]));
export default {
  en: { ...pack((id, i) => `${EN[id]} (level ${i + 1})`, id => EN[id]), ...jobTags('en') },
  vi: { ...pack((id, i) => LINES[id][i], id => TAG[id]), ...jobTags('vi') },
};
