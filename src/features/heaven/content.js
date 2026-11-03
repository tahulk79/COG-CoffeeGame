export const EXPERTS = [
  {
    id: 'growing', name: 'Thần Nông Cà Phê', icon: '❧', color: '#70946c', position: [-13, -2],
    greeting: 'Muốn mở quán thì phải biết hạt từ đâu ra. Không phải từ cái túi trong siêu thị đâu nhé.',
    seal: 'Am hiểu hạt cà phê',
    questions: [
      {
        id: 'ripe', text: 'Đến mùa hái, con ưu tiên chọn quả nào?',
        options: [
          { id: 'ripe', text: 'Quả chín đạt màu đặc trưng của giống.' },
          { id: 'green', text: 'Quả còn xanh, hái sớm cho đỡ phải chờ.' },
          { id: 'all', text: 'Tuốt hết một lượt. Năng suất là chân ái.' },
        ],
        correct: 'ripe', explanation: 'Chọn quả chín giúp mẻ thu hoạch đồng đều hơn. Màu khi chín tùy giống, không phải giống nào cũng đỏ.',
        wrong: 'Nhanh tay chưa chắc ngon ly. Quả chưa chín làm chất lượng mẻ hạt kém đồng đều.',
      },
      {
        id: 'water', text: 'Đất quanh gốc đang ướt sũng sau mưa. Con làm gì?',
        options: [
          { id: 'more', text: 'Tưới thêm. Cây uống nhiều thì tỉnh lâu.' },
          { id: 'drain', text: 'Kiểm tra thoát nước, chưa tưới thêm.' },
          { id: 'coffee', text: 'Tưới cà phê cho cây nhớ nguồn cội.' },
        ],
        correct: 'drain', explanation: 'Cây cần nước nhưng rễ cũng cần không khí. Tránh để gốc bị úng; lượng tưới phải theo điều kiện đất và thời tiết.',
        wrong: 'Cây cà phê không đăng ký lớp bơi. Đất đang sũng nước thì nên xử lý thoát nước trước.',
      },
    ],
  },
  {
    id: 'brewing', name: 'Thần Pha Chế', icon: '☕', color: '#b28b53', position: [-7, -12],
    greeting: 'Ta chấm bằng vị giác. Con không thể chữa ly cà phê cháy bằng một cái tên tiếng Ý.',
    seal: 'Hiểu cách pha chế',
    questions: [
      {
        id: 'recipe', text: 'Muốn các ly pha ra ổn định, con nên bắt đầu từ đâu?',
        options: [
          { id: 'feel', text: 'Mỗi lần một nắm hạt. Pha bằng cảm xúc.' },
          { id: 'cup', text: 'Đổi sang chiếc cốc đắt nhất.' },
          { id: 'measure', text: 'Cân cà phê, đo nước và ghi công thức.' },
        ],
        correct: 'measure', explanation: 'Đo lượng cà phê và nước giúp lặp lại công thức. Sau đó mới điều chỉnh độ xay, thời gian và các yếu tố khác.',
        wrong: 'Cảm xúc có hôm lên hôm xuống, khách thì vẫn muốn ly quen thuộc. Hãy chọn cách đo được và lặp lại được.',
      },
      {
        id: 'adjust', text: 'Thử một công thức mới chưa vừa ý. Làm sao biết thay đổi nào có ích?',
        options: [
          { id: 'one', text: 'Giữ công thức gốc, đổi một yếu tố mỗi lần rồi nếm.' },
          { id: 'everything', text: 'Đổi cả hạt, độ xay, lượng nước và thời gian.' },
          { id: 'sugar', text: 'Thêm đường đến khi quên câu hỏi.' },
        ],
        correct: 'one', explanation: 'Đổi một yếu tố mỗi lần giúp tìm ra nguyên nhân và ghi lại cách pha phù hợp. Nếm và so sánh là một phần của việc học.',
        wrong: 'Đổi hết cùng lúc thì có ngon cũng chẳng biết vì sao. Mỗi lần nên thay một yếu tố có thể so sánh.',
      },
    ],
  },
  {
    id: 'business', name: 'Thần Thương Hội', icon: '₫', color: '#788ba6', position: [6, -12],
    greeting: 'Ta không thu học phí. Nhưng con vừa đứng trên nền nhà tính khấu hao của ta đấy.',
    seal: 'Hiểu việc kinh doanh',
    questions: [
      {
        id: 'costs', text: 'Ly bán 30.000đ, nguyên liệu hết 12.000đ. Đã chắc lãi 18.000đ chưa?',
        options: [
          { id: 'yes', text: 'Chắc rồi. Cho con mở chuỗi luôn.' },
          { id: 'no', text: 'Chưa, còn nhân công, thuê mặt bằng và chi phí khác.' },
          { id: 'luck', text: 'Còn tùy màu áo chủ quán hôm đó.' },
        ],
        correct: 'no', explanation: '18.000đ mới là phần còn lại sau nguyên liệu. Muốn biết lãi phải tính cả các chi phí liên quan khác.',
        wrong: 'Máy tính của con đúng phép trừ nhưng thiếu hóa đơn tiền nhà. Hãy tính đủ chi phí trước khi gọi đó là lợi nhuận.',
      },
      {
        id: 'customer', text: 'Khách nói ly cà phê khác mọi ngày. Con xử lý thế nào?',
        options: [
          { id: 'argue', text: 'Giải thích rằng vị giác của khách đang sai.' },
          { id: 'ignore', text: 'Bật nhạc to hơn để giảm phản hồi.' },
          { id: 'listen', text: 'Lắng nghe, kiểm tra công thức và đề nghị xử lý phù hợp.' },
        ],
        correct: 'listen', explanation: 'Lắng nghe và kiểm tra giúp giải quyết vấn đề, đồng thời phát hiện chỗ vận hành chưa ổn định.',
        wrong: 'Khách đến mua cà phê, không đến tranh biện. Cần tôn trọng khách và tìm được nguyên nhân.',
      },
    ],
  },
];

export const GIFTS = [
  { id: 'seeds', icon: '❧', name: 'Túi hạt giống', description: 'Hành trang cho trang trại cà phê đầu tiên.' },
  { id: 'tools', icon: '☕', name: 'Bộ dụng cụ pha', description: 'Hành trang cho những ly cà phê đầu tiên.' },
  { id: 'capital', icon: '₫', name: 'Túi vốn nhỏ', description: 'Hành trang để tự chọn cách khởi nghiệp.' },
];

export const NPCS = [
  { id: 'reaper', name: 'Thần Chết', icon: '☠', color: '#48576c', position: [-4, 7] },
  ...EXPERTS,
  { id: 'clerk', name: 'Thần Tiếp Nhận', icon: '▤', color: '#b38269', position: [13, -2] },
  { id: 'portal', name: 'Cổng trùng sinh', icon: '↗', color: '#ceb376', position: [0, 13] },
];

export const WELCOME = [
  ['BẠN', 'Vậy là em chết thật rồi à?'],
  ['THẦN CHẾT', 'Theo quy trình thì đúng.'],
  ['BẠN', 'Sao anh nói nghe không chắc vậy?'],
  ['THẦN CHẾT', 'Anh làm vận chuyển. Bên tiếp nhận mới kiểm hàng.'],
  ['THẦN CHẾT', 'Muốn trở về mở quán thì gặp ba chuyên gia lấy dấu trước. Chết không cần bằng, sống có nghề thì cần học nhé.'],
];

export const REVEAL = [
  ['THẦN TIẾP NHẬN', 'Đủ ba dấu. Để ta kiểm tra hồ sơ trùng sinh…'],
  ['THẦN TIẾP NHẬN', 'Khoan. Người này CHƯA CHẾT. Chỉ ngất vì va đầu vào biển!'],
  ['BẠN', 'Thế ai kéo em lên đây?!'],
  ['THẦN CHẾT', 'Anh thấy nằm im… tưởng xong rồi.'],
  ['BẠN', 'Anh không kiểm tra à?'],
  ['THẦN CHẾT', 'Thường khách không phản hồi.'],
  ['THẦN TIẾP NHẬN', 'Con chưa hết kiếp. Xem như chuyến học thử. Kiến thức và quà cứ giữ; trở về mà sống cho khác đi.'],
];

export const FAREWELL = [
  ['THẦN CHẾT', 'Lần sau nhớ nhìn biển.'],
  ['BẠN', 'Không có lần sau đâu anh!'],
  ['THẦN CHẾT', 'Khách nào cũng nói vậy. Đi đi, lần này anh trả đúng địa chỉ.'],
];
