// World map by city (docs/design/world-cities.md, the user's coffee-culture document): country.*, regionName.*, city.*, culture.*
// and the atlas city/culture labels. Region ids `<cc>-<n>` follow the city order in src/core/config/world.js.
// city.<id>.vibe is omitted where the document has "—" (the UI falls back to culture.<cc>.rhythm).
// culture.<cc>.menu: items joined with ' | '. Menus, rhythm and tips are country-level (not verified per city).
// Every key has en and vi.

export default {
  en: {
    // Atlas UI
    'atlas.cities': 'Cities',
    'atlas.cityCount': '{n} cities',
    'atlas.culture.rhythm': 'Coffee rhythm',
    'atlas.culture.tips': 'Habits & tips',
    'atlas.culture.menu': 'Menu · {n} drinks',
    'atlas.culture.menuNote': 'Sample menu at country level, not verified per city.',
    'atlas.culture.more': 'Coffee culture',

    // Countries (document order)
    'country.jp': 'Japan', 'country.fr': 'France', 'country.gb': 'United Kingdom', 'country.us': 'United States',
    'country.au': 'Australia', 'country.de': 'Germany', 'country.tr': 'Türkiye', 'country.sa': 'Saudi Arabia',
    'country.vn': 'Vietnam', 'country.cn': 'China', 'country.br': 'Brazil', 'country.in': 'India',
    'country.ca': 'Canada', 'country.kr': 'South Korea', 'country.tw': 'Taiwan', 'country.id': 'Indonesia',
    'country.my': 'Malaysia', 'country.ru': 'Russia',

    // 🇯🇵 Japan
    'regionName.jp-1': 'Tokyo', 'regionName.jp-2': 'Kyoto', 'regionName.jp-3': 'Osaka', 'regionName.jp-4': 'Nagoya',
    'city.jp-1.vibe': 'Specialty and chains',
    'city.jp-2.vibe': 'Kissaten and old houses',
    'city.jp-3.vibe': 'Casual cafés, iced coffee',
    'city.jp-4.vibe': 'Morning set',
    'culture.jp.intro': 'Classic kissaten, technique-focused specialty cafés, canned coffee and convenience stores all live side by side. Nagoya is famous for its morning set.',
    'culture.jp.rhythm': 'Mornings with toast or eggs; takeaway at lunch; quiet afternoons reading or meeting friends. Some kissaten favour dark roasts and syphon or nel drip.',
    'culture.jp.tips': 'Respect the quiet in music cafés; do not assume every café welcomes long work sessions.',
    'culture.jp.menu': 'Blend coffee (ブレンドコーヒー) | hand drip | iced coffee (アイスコーヒー) | café au lait | latte | cold brew | canned coffee',

    // 🇫🇷 France
    'regionName.fr-1': 'Paris', 'regionName.fr-2': 'Lyon', 'regionName.fr-3': 'Marseille', 'regionName.fr-4': 'Bordeaux',
    'city.fr-1.vibe': 'Terraces and specialty',
    'city.fr-2.vibe': 'Neighbourhood cafés',
    'city.fr-3.vibe': 'Espresso with a Mediterranean mix',
    'city.fr-4.vibe': 'Café–pâtisserie',
    'culture.fr.intro': 'Pavement cafés, bars and pastry shops are spaces for city social life; espresso is usually small and quick. Specialty is growing in the big cities.',
    'culture.fr.rhythm': 'Café crème or espresso with a croissant in the morning; espresso after meals; sitting on the terrace watching the street.',
    'culture.fr.tips': 'Café au lait is usually a breakfast drink; a noisette is espresso with a dash of milk, not hazelnut syrup.',
    'culture.fr.menu': 'Un café / expresso | café crème | noisette | allongé | café au lait | cappuccino | filtre',

    // 🇬🇧 United Kingdom
    'regionName.gb-1': 'London', 'regionName.gb-2': 'Manchester', 'regionName.gb-3': 'Edinburgh', 'regionName.gb-4': 'Bristol',
    'city.gb-1.vibe': 'Diverse specialty',
    'city.gb-2.vibe': 'Independent cafés',
    'city.gb-3.vibe': 'Small cafés and bakes',
    'city.gb-4.vibe': 'Craft roasters',
    'culture.gb.intro': 'Chain cafés, takeaway and specialty espresso; the flat white is very popular in cities, though tea culture still matters.',
    'culture.gb.rhythm': 'Takeaway coffee on the morning commute; weekend brunch; cafés as places to meet or work.',
    'culture.gb.tips': 'A flat white is usually smaller and stronger than a latte, but the recipe varies by café.',
    'culture.gb.menu': 'Flat white | latte | cappuccino | americano | espresso | filter coffee | iced latte | cold brew',

    // 🇺🇸 United States
    'regionName.us-1': 'New York', 'regionName.us-2': 'Seattle', 'regionName.us-3': 'Los Angeles', 'regionName.us-4': 'San Francisco',
    'regionName.us-5': 'Chicago',
    'city.us-1.vibe': 'Coffee to go',
    'city.us-2.vibe': 'Espresso and roasteries',
    'city.us-5.vibe': 'Diners and specialty',
    'culture.us.intro': 'From diner refills and drip coffee to big chains, drive-throughs, specialty and customised drinks.',
    'culture.us.rhythm': 'A big takeaway cup in the morning; drip or iced coffee all day; weekend brunch; strong demand for cold drinks.',
    'culture.us.tips': 'Drinks come in many sizes with custom milks and syrups; do not assume every American café means sweet drinks.',
    'culture.us.menu': 'Drip coffee | americano | latte | cold brew | iced coffee | flavored latte | mocha | nitro cold brew',

    // 🇦🇺 Australia
    'regionName.au-1': 'Melbourne', 'regionName.au-2': 'Sydney', 'regionName.au-3': 'Brisbane', 'regionName.au-4': 'Perth',
    'city.au-1.vibe': 'Laneway cafés, magic',
    'city.au-2.vibe': 'Brunch and seaside cafés',
    'culture.au.intro': 'A culture of independent cafés, high-quality espresso, brunch and professional baristas; the flat white is an icon.',
    'culture.au.rhythm': 'An espresso-based drink before work; weekend brunch; drinks made to order are highly valued.',
    'culture.au.tips': 'A long black is usually espresso poured over hot water; the term "magic" is not standard across the country.',
    'culture.au.menu': 'Flat white | long black | piccolo latte | latte | cappuccino | magic (some Melbourne cafés) | batch brew',

    // 🇩🇪 Germany
    'regionName.de-1': 'Berlin', 'regionName.de-2': 'Hamburg', 'regionName.de-3': 'Munich', 'regionName.de-4': 'Cologne',
    'city.de-1.vibe': 'Specialty and creative spaces',
    'city.de-2.vibe': 'Roasters and the harbour',
    'city.de-3.vibe': 'Café–bakery',
    'city.de-4.vibe': 'Neighbourhood cafés',
    'culture.de.intro': 'Kaffee und Kuchen (coffee and cake) goes hand in hand with modern espresso; filter coffee has a long tradition.',
    'culture.de.rhythm': 'Coffee with bread in the morning; coffee and cake in the afternoon; meeting friends at a café or bakery.',
    'culture.de.tips': 'In Germany, Eiskaffee can mean cold coffee with vanilla ice cream, not just coffee over ice.',
    'culture.de.menu': 'Filterkaffee | Milchkaffee | cappuccino | espresso | latte macchiato | Eiskaffee (often with ice cream) | flat white',

    // 🇹🇷 Türkiye
    'regionName.tr-1': 'Istanbul', 'regionName.tr-2': 'Ankara', 'regionName.tr-3': 'Izmir',
    'city.tr-1.vibe': 'Tradition and specialty',
    'city.tr-2.vibe': 'Office-district cafés',
    'city.tr-3.vibe': 'Seaside cafés',
    'culture.tr.intro': 'Türk kahvesi is brewed in a cezve and served in small cups with the grounds settled at the bottom; a ritual of hospitality, conversation and sometimes fortune-telling from the grounds.',
    'culture.tr.rhythm': 'After meals, when receiving guests and while chatting; tea is also a dominant everyday drink.',
    'culture.tr.tips': 'Wait for the grounds to settle and do not drink to the bottom; ask how sweet the guest wants it before brewing; menengiç is made from pistacia berries and contains no coffee in the usual sense.',
    'culture.tr.menu': 'Türk kahvesi | sade (no sugar) | orta (medium sweet) | şekerli (sweet) | menengiç coffee (not made from coffee beans) | espresso | latte',

    // 🇸🇦 Saudi Arabia
    'regionName.sa-1': 'Riyadh', 'regionName.sa-2': 'Jeddah', 'regionName.sa-3': 'Dammam', 'regionName.sa-4': 'Al Khobar',
    'city.sa-1.vibe': 'Growing specialty scene',
    'city.sa-2.vibe': 'Seaside cafés',
    'culture.sa.intro': 'Saudi coffee (qahwa) is bound to hospitality, the dallah and the finjan cup; usually lightly roasted with cardamom, alongside a modern specialty scene.',
    'culture.sa.rhythm': 'Offered to guests at home, in the majlis and at festivals; in the cities young people also love espresso bars and cold brew.',
    'culture.sa.tips': 'Usually served with dates; serve with the right hand; in the traditional ritual, gently shake the cup when you do not want a refill.',
    'culture.sa.menu': 'Saudi coffee / qahwa | espresso | latte | Spanish latte | V60 | iced americano | cold brew',

    // 🇻🇳 Vietnam
    'regionName.vn-1': 'Hanoi', 'regionName.vn-2': 'Ho Chi Minh City', 'regionName.vn-3': 'Da Nang', 'regionName.vn-4': 'Hue',
    'city.vn-1.vibe': 'Nâu đá, egg coffee',
    'city.vn-2.vibe': 'Sữa đá, bạc xỉu',
    'city.vn-3.vibe': 'Tourist cafés and specialty',
    'city.vn-4.vibe': 'Salt coffee',
    'culture.vn.intro': 'Phin filters, Robusta, condensed milk, iced coffee and a culture of lingering at cafés; specialty and Arabica are growing alongside.',
    'culture.vn.rhythm': 'Pavement coffee in the morning; meeting up or working at noon and in the afternoon; many cafés stay open into the evening.',
    'culture.vn.tips': 'The name "nâu đá" is common in the North; recipes for egg coffee, salt coffee and bạc xỉu vary by café.',
    'culture.vn.menu': 'Cà phê đen đá (iced black) | nâu đá / cà phê sữa đá (iced milk coffee) | bạc xỉu | cà phê trứng (egg coffee) | cà phê muối (salt coffee) | espresso | pour-over | cold brew',

    // 🇨🇳 China
    'regionName.cn-1': 'Shanghai', 'regionName.cn-2': 'Beijing', 'regionName.cn-3': 'Shenzhen', 'regionName.cn-4': 'Chengdu',
    'regionName.cn-5': 'Kunming',
    'city.cn-1.vibe': 'Specialty and creativity',
    'city.cn-2.vibe': 'Cafés for working',
    'city.cn-3.vibe': 'Chains and app ordering',
    'city.cn-5.vibe': 'Yunnan coffee',
    'culture.cn.intro': 'Café chains, app ordering and delivery; milky and iced drinks and creative twists; Yunnan is an important Arabica-growing region.',
    'culture.cn.rhythm': 'Coffee for work, study and meeting friends; mobile ordering with counter pickup or delivery.',
    'culture.cn.tips': 'Fruit, coconut and seasonal flavours change fast; do not take a viral drink for a long-standing tradition.',
    'culture.cn.menu': 'Americano (美式咖啡) | latte (拿铁) | coconut latte (生椰拿铁) | iced latte | flat white | pour-over (手冲咖啡) | fruit coffee',

    // 🇧🇷 Brazil
    'regionName.br-1': 'São Paulo', 'regionName.br-2': 'Rio de Janeiro', 'regionName.br-3': 'Belo Horizonte', 'regionName.br-4': 'Curitiba',
    'city.br-1.vibe': 'Padarias and specialty',
    'city.br-3.vibe': 'Coffee with pão de queijo',
    'city.br-4.vibe': 'Roaster cafés',
    'culture.br.intro': 'A cafezinho is a small, strong, often sweet cup of coffee, tied to hospitality and breaks. Brazil also has a large specialty market.',
    'culture.br.rhythm': 'Mornings with bread; after lunch or during meetings; the bakery or padaria is an everyday stop.',
    'culture.br.tips': 'A cafezinho is not always espresso; brewing methods and sugar levels differ.',
    'culture.br.menu': 'Cafezinho | café coado | café com leite | pingado | cappuccino brasileiro (with cocoa/cinnamon variants) | espresso | iced latte',

    // 🇮🇳 India
    'regionName.in-1': 'Mumbai', 'regionName.in-2': 'Delhi', 'regionName.in-3': 'Bengaluru', 'regionName.in-4': 'Chennai',
    'regionName.in-5': 'Hyderabad',
    'city.in-5.vibe': 'Cafés mixing many styles',
    'culture.in.intro': 'South India is famous for filter kaapi with milk and sugar, poured between tumbler and dabara; cities have café chains, espresso and cold coffee.',
    'culture.in.rhythm': 'Filter coffee in the morning in the South; meeting friends in the afternoon; modern cafés serve study and work.',
    'culture.in.tips': 'Traditional filter kaapi may use a coffee–chicory blend; it is not the same across every region of India.',
    'culture.in.menu': 'South Indian filter coffee / kaapi | cold coffee | cappuccino | latte | americano | iced coffee | coffee with chicory',

    // 🇨🇦 Canada
    'regionName.ca-1': 'Toronto', 'regionName.ca-2': 'Vancouver', 'regionName.ca-3': 'Montreal', 'regionName.ca-4': 'Calgary',
    'city.ca-1.vibe': 'Chains and specialty',
    'city.ca-2.vibe': 'Espresso and roasters',
    'city.ca-3.vibe': 'French-influenced cafés',
    'city.ca-4.vibe': 'Takeaway',
    'culture.ca.intro': 'Takeaway coffee and chains are common; double-double and drip culture coexist with specialty, especially in big cities.',
    'culture.ca.rhythm': 'Takeaway on the way to work in the morning; drive-throughs in the suburbs; cafés for meeting friends and working.',
    'culture.ca.tips': 'In common usage a double-double means coffee with two creams and two sugars, not an internationally standard recipe.',
    'culture.ca.menu': 'Double-double | brewed coffee | americano | latte | flat white | iced coffee | cold brew | cappuccino',

    // 🇰🇷 South Korea
    'regionName.kr-1': 'Seoul', 'regionName.kr-2': 'Busan', 'regionName.kr-3': 'Daegu', 'regionName.kr-4': 'Incheon',
    'city.kr-1.vibe': 'Concept cafés and specialty',
    'city.kr-2.vibe': 'Sea-view cafés',
    'city.kr-3.vibe': 'Neighbourhood cafés',
    'city.kr-4.vibe': 'Tourist cafés',
    'culture.kr.intro': 'Cafés as spaces to socialise, study and take photos; iced americano is everywhere; dessert cafés are thriving.',
    'culture.kr.rhythm': 'Takeaway in the morning; study or work in the afternoon; evening meetups at cafés; cold drinks all year round.',
    'culture.kr.tips': 'Dalgona coffee is famous worldwide but is not the everyday staple of every Korean café.',
    'culture.kr.menu': 'Iced americano (아이스 아메리카노) | latte | vanilla latte | dalgona coffee | Einspänner | cold brew | hand drip',

    // 🇹🇼 Taiwan
    'regionName.tw-1': 'Taipei', 'regionName.tw-2': 'Taichung', 'regionName.tw-3': 'Kaohsiung', 'regionName.tw-4': 'Tainan',
    'city.tw-1.vibe': 'Specialty and roasteries',
    'city.tw-2.vibe': 'Design cafés',
    'city.tw-3.vibe': 'Harbourside cafés',
    'city.tw-4.vibe': 'Cafés in old houses',
    'culture.tw.intro': 'Specialty cafés, independent shops and design spaces coexist with bubble-tea culture; pour-over has a clear place.',
    'culture.tw.rhythm': 'Takeaway coffee in the morning; afternoons studying or working in cafés; weekend café visits with pastries.',
    'culture.tw.tips': 'Do not lump bubble tea in with coffee; the two drink cultures grow side by side.',
    'culture.tw.menu': 'Americano (美式咖啡) | latte (拿鐵) | hand drip (手沖咖啡) | iced coffee | cold brew | espresso | flavored latte',

    // 🇮🇩 Indonesia
    'regionName.id-1': 'Jakarta', 'regionName.id-2': 'Bandung', 'regionName.id-3': 'Yogyakarta', 'regionName.id-4': 'Surabaya',
    'regionName.id-5': 'Medan',
    'city.id-1.vibe': 'Iced milk coffee',
    'city.id-2.vibe': 'Specialty',
    'city.id-3.vibe': 'Warungs and student cafés',
    'city.id-5.vibe': 'Sumatran coffee',
    'culture.id.intro': 'Traditional kopi tubruk, warung stalls and the kopi susu gula aren wave; beans from many islands bring a wide range of flavours.',
    'culture.id.rhythm': 'Morning or afternoon at the warung; young people grab iced kopi susu to go; cafés are where friends meet.',
    'culture.id.tips': 'Tubruk has settled grounds; kopi talua is a regional speciality, not a default menu item across Indonesia.',
    'culture.id.menu': 'Kopi tubruk | kopi susu gula aren | es kopi susu | kopi hitam | V60 | espresso | latte | kopi talua (West Sumatran speciality)',

    // 🇲🇾 Malaysia
    'regionName.my-1': 'Kuala Lumpur', 'regionName.my-2': 'Penang', 'regionName.my-3': 'Ipoh', 'regionName.my-4': 'Johor Bahru',
    'city.my-1.vibe': 'Kopitiam and specialty',
    'city.my-2.vibe': 'Heritage kopitiam',
    'city.my-3.vibe': 'White coffee',
    'city.my-4.vibe': 'Modern cafés',
    'culture.my.intro': 'Kopitiam and Hainanese/Nanyang ordering codes; coffee is usually strong, with condensed or evaporated milk; specialty is growing in the cities.',
    'culture.my.rhythm': 'Mornings at the kopitiam with kaya toast or roti; a midday break; modern cafés serve takeaway and brunch.',
    'culture.my.tips': 'Kopi O usually comes with sugar; for no sugar, order kosong. Ipoh white coffee is not simply coffee with lots of milk.',
    'culture.my.menu': 'Kopi | kopi O | kopi C | kopi peng | kopi O kosong | cham (tea + coffee) | white coffee (Ipoh) | latte',

    // 🇷🇺 Russia
    'regionName.ru-1': 'Moscow', 'regionName.ru-2': 'Saint Petersburg', 'regionName.ru-3': 'Kazan', 'regionName.ru-4': 'Novosibirsk',
    'city.ru-1.vibe': 'Chains and specialty',
    'city.ru-2.vibe': 'Artsy cafés',
    'city.ru-3.vibe': 'Local cafés',
    'city.ru-4.vibe': 'City cafés',
    'culture.ru.intro': 'Espresso, cappuccino and milky drinks are common in cities; cafés are places to meet, work and escape the cold; raf coffee is a local variant.',
    'culture.ru.rhythm': 'Takeaway in the morning; cafés in the afternoon and evening; hot drinks in the cold season, iced drinks in summer.',
    'culture.ru.tips': 'Raf coffee is usually espresso steamed with cream and vanilla sugar; the recipe varies between cafés.',
    'culture.ru.menu': 'Raf coffee (раф-кофе) | cappuccino | latte | americano | flat white | espresso | filter coffee',
  },
  vi: {
    // Atlas UI
    'atlas.cities': 'Thành phố',
    'atlas.cityCount': '{n} thành phố',
    'atlas.culture.rhythm': 'Nhịp uống cà phê',
    'atlas.culture.tips': 'Thói quen & lưu ý',
    'atlas.culture.menu': 'Menu tham khảo · {n} món',
    'atlas.culture.menuNote': 'Menu minh họa ở cấp quốc gia, chưa xác minh theo từng thành phố.',
    'atlas.culture.more': 'Văn hóa cà phê',

    // Quốc gia (thứ tự tài liệu)
    'country.jp': 'Nhật Bản', 'country.fr': 'Pháp', 'country.gb': 'Anh', 'country.us': 'Mỹ',
    'country.au': 'Úc', 'country.de': 'Đức', 'country.tr': 'Thổ Nhĩ Kỳ', 'country.sa': 'Ả Rập Saudi',
    'country.vn': 'Việt Nam', 'country.cn': 'Trung Quốc', 'country.br': 'Brazil', 'country.in': 'Ấn Độ',
    'country.ca': 'Canada', 'country.kr': 'Hàn Quốc', 'country.tw': 'Đài Loan', 'country.id': 'Indonesia',
    'country.my': 'Malaysia', 'country.ru': 'Nga',

    // 🇯🇵 Nhật Bản
    'regionName.jp-1': 'Tokyo', 'regionName.jp-2': 'Kyoto', 'regionName.jp-3': 'Osaka', 'regionName.jp-4': 'Nagoya',
    'city.jp-1.vibe': 'specialty và chuỗi',
    'city.jp-2.vibe': 'kissaten/nhà cổ',
    'city.jp-3.vibe': 'quán bình dân, iced coffee',
    'city.jp-4.vibe': 'morning set',
    'culture.jp.intro': 'Kissaten cổ điển, quán specialty chú trọng kỹ thuật, cà phê lon và cửa hàng tiện lợi cùng tồn tại. Nagoya nổi tiếng morning set.',
    'culture.jp.rhythm': 'Sáng uống kèm bánh mì/trứng; trưa mua mang đi; chiều ngồi yên, đọc sách hoặc gặp bạn. Một số kissaten chuộng rang đậm và syphon/nel drip.',
    'culture.jp.tips': 'Tôn trọng không gian yên tĩnh tại quán nghe nhạc; không mặc định quán nào cũng cho làm việc lâu.',
    'culture.jp.menu': 'Blend coffee (ブレンドコーヒー) | hand drip | iced coffee (アイスコーヒー) | café au lait | latte | cold brew | canned coffee',

    // 🇫🇷 Pháp
    'regionName.fr-1': 'Paris', 'regionName.fr-2': 'Lyon', 'regionName.fr-3': 'Marseille', 'regionName.fr-4': 'Bordeaux',
    'city.fr-1.vibe': 'terrace và specialty',
    'city.fr-2.vibe': 'café khu phố',
    'city.fr-3.vibe': 'espresso và giao thoa Địa Trung Hải',
    'city.fr-4.vibe': 'café–pâtisserie',
    'culture.fr.intro': 'Café vỉa hè, quầy bar và bánh ngọt là không gian giao tiếp đô thị; espresso thường nhỏ, nhanh. Specialty tăng hiện diện tại các thành phố lớn.',
    'culture.fr.rhythm': 'Sáng café crème hoặc espresso với croissant; sau bữa ăn thường espresso; ngồi sân hiên quan sát phố.',
    'culture.fr.tips': 'Café au lait thường gắn với bữa sáng; noisette là espresso thêm chút sữa, không phải siro hạt phỉ.',
    'culture.fr.menu': 'Un café / expresso | café crème | noisette | allongé | café au lait | cappuccino | filtre',

    // 🇬🇧 Anh
    'regionName.gb-1': 'London', 'regionName.gb-2': 'Manchester', 'regionName.gb-3': 'Edinburgh', 'regionName.gb-4': 'Bristol',
    'city.gb-1.vibe': 'specialty đa dạng',
    'city.gb-2.vibe': 'independent café',
    'city.gb-3.vibe': 'quán nhỏ và bánh',
    'city.gb-4.vibe': 'rang xay thủ công',
    'culture.gb.intro': 'Café chuỗi, takeaway và specialty espresso; flat white rất phổ biến ở đô thị, song văn hóa trà vẫn quan trọng.',
    'culture.gb.rhythm': 'Sáng cà phê mang đi trên đường đi làm; brunch cuối tuần; quán là nơi gặp gỡ hoặc làm việc.',
    'culture.gb.tips': 'Flat white thường nhỏ và đậm vị hơn latte, nhưng công thức thay đổi theo quán.',
    'culture.gb.menu': 'Flat white | latte | cappuccino | americano | espresso | filter coffee | iced latte | cold brew',

    // 🇺🇸 Mỹ
    'regionName.us-1': 'New York', 'regionName.us-2': 'Seattle', 'regionName.us-3': 'Los Angeles', 'regionName.us-4': 'San Francisco',
    'regionName.us-5': 'Chicago',
    'city.us-1.vibe': 'coffee-to-go',
    'city.us-2.vibe': 'espresso/roastery',
    'city.us-5.vibe': 'diner và specialty',
    'culture.us.intro': 'Từ diner refill và drip coffee tới chuỗi lớn, drive-through, specialty và đồ uống tùy biến.',
    'culture.us.rhythm': 'Sáng cốc lớn mang đi; cả ngày dùng drip/iced coffee; cuối tuần brunch; nhu cầu đồ uống lạnh mạnh.',
    'culture.us.tips': 'Đồ uống nhiều cỡ và tùy biến sữa/siro; không coi mọi quán Mỹ là đồ uống ngọt.',
    'culture.us.menu': 'Drip coffee | americano | latte | cold brew | iced coffee | flavored latte | mocha | nitro cold brew',

    // 🇦🇺 Úc
    'regionName.au-1': 'Melbourne', 'regionName.au-2': 'Sydney', 'regionName.au-3': 'Brisbane', 'regionName.au-4': 'Perth',
    'city.au-1.vibe': 'laneway cafés, magic',
    'city.au-2.vibe': 'brunch và quán ven biển',
    'culture.au.intro': 'Văn hóa quán độc lập, espresso chất lượng cao, brunch và barista chuyên nghiệp; flat white là biểu tượng.',
    'culture.au.rhythm': 'Sáng mua espresso-based trước giờ làm; cuối tuần brunch; đồ uống pha tại chỗ được coi trọng.',
    'culture.au.tips': 'Long black thường rót espresso lên nước nóng; thuật ngữ magic không chuẩn hóa toàn quốc.',
    'culture.au.menu': 'Flat white | long black | piccolo latte | latte | cappuccino | magic (một số quán Melbourne) | batch brew',

    // 🇩🇪 Đức
    'regionName.de-1': 'Berlin', 'regionName.de-2': 'Hamburg', 'regionName.de-3': 'Munich', 'regionName.de-4': 'Cologne',
    'city.de-1.vibe': 'specialty và không gian sáng tạo',
    'city.de-2.vibe': 'rang xay, cảng',
    'city.de-3.vibe': 'café–bakery',
    'city.de-4.vibe': 'quán khu phố',
    'culture.de.intro': 'Kaffee und Kuchen (cà phê và bánh) song hành với espresso hiện đại; filter coffee có truyền thống lâu dài.',
    'culture.de.rhythm': 'Buổi sáng cà phê với bánh mì; chiều café và bánh; gặp bạn tại quán hoặc bakery.',
    'culture.de.tips': 'Eiskaffee ở Đức có thể là cà phê lạnh với kem vani, không chỉ là cà phê thêm đá.',
    'culture.de.menu': 'Filterkaffee | Milchkaffee | cappuccino | espresso | latte macchiato | Eiskaffee (thường với kem) | flat white',

    // 🇹🇷 Thổ Nhĩ Kỳ
    'regionName.tr-1': 'Istanbul', 'regionName.tr-2': 'Ankara', 'regionName.tr-3': 'Izmir',
    'city.tr-1.vibe': 'truyền thống và specialty',
    'city.tr-2.vibe': 'quán công sở',
    'city.tr-3.vibe': 'café ven biển',
    'culture.tr.intro': 'Türk kahvesi nấu trong cezve, phục vụ cốc nhỏ có bã lắng; là nghi thức hiếu khách, trò chuyện và đôi khi bói bã cà phê.',
    'culture.tr.rhythm': 'Sau ăn, lúc tiếp khách và trò chuyện; trà cũng là đồ uống thường nhật nổi trội.',
    'culture.tr.tips': 'Đợi bã lắng, không uống cạn đáy; hỏi mức đường trước khi pha; menengiç làm từ quả pistacia, không chứa cà phê theo nghĩa thông thường.',
    'culture.tr.menu': 'Türk kahvesi | sade (không đường) | orta (ngọt vừa) | şekerli (ngọt) | menengiç coffee (không phải cà phê hạt) | espresso | latte',

    // 🇸🇦 Ả Rập Saudi
    'regionName.sa-1': 'Riyadh', 'regionName.sa-2': 'Jeddah', 'regionName.sa-3': 'Dammam', 'regionName.sa-4': 'Al Khobar',
    'city.sa-1.vibe': 'specialty phát triển',
    'city.sa-2.vibe': 'café ven biển',
    'culture.sa.intro': 'Saudi coffee (qahwa) gắn với hiếu khách, dallah và chén finjan; thường rang nhạt, thêm bạch đậu khấu; song song là specialty hiện đại.',
    'culture.sa.rhythm': 'Mời khách trong nhà, majlis, lễ hội; tại thành phố giới trẻ cũng chuộng quán espresso và cold brew.',
    'culture.sa.tips': 'Thường dùng với chà là; phục vụ bằng tay phải; lắc nhẹ chén khi không muốn rót thêm trong nghi thức truyền thống.',
    'culture.sa.menu': 'Saudi coffee / qahwa | espresso | latte | Spanish latte | V60 | iced americano | cold brew',

    // 🇻🇳 Việt Nam
    'regionName.vn-1': 'Hà Nội', 'regionName.vn-2': 'TP.HCM', 'regionName.vn-3': 'Đà Nẵng', 'regionName.vn-4': 'Huế',
    'city.vn-1.vibe': 'nâu đá, trứng',
    'city.vn-2.vibe': 'sữa đá, bạc xỉu',
    'city.vn-3.vibe': 'café du lịch và specialty',
    'city.vn-4.vibe': 'cà phê muối',
    'culture.vn.intro': 'Phin, Robusta, sữa đặc, cà phê đá và văn hóa ngồi quán lâu; specialty và cà phê Arabica phát triển song song.',
    'culture.vn.rhythm': 'Sáng cà phê vỉa hè; trưa/chiều gặp gỡ, làm việc; nhiều quán mở tới tối.',
    'culture.vn.tips': 'Tên nâu đá phổ biến ở miền Bắc; công thức trứng, muối và bạc xỉu thay đổi theo quán.',
    'culture.vn.menu': 'Cà phê đen đá | nâu đá/cà phê sữa đá | bạc xỉu | cà phê trứng | cà phê muối | espresso | pour-over | cold brew',

    // 🇨🇳 Trung Quốc
    'regionName.cn-1': 'Thượng Hải', 'regionName.cn-2': 'Bắc Kinh', 'regionName.cn-3': 'Thâm Quyến', 'regionName.cn-4': 'Thành Đô',
    'regionName.cn-5': 'Côn Minh',
    'city.cn-1.vibe': 'specialty và sáng tạo',
    'city.cn-2.vibe': 'café làm việc',
    'city.cn-3.vibe': 'chuỗi/đặt app',
    'city.cn-5.vibe': 'cà phê Vân Nam',
    'culture.cn.intro': 'Chuỗi café, đặt qua ứng dụng và giao hàng; đồ uống sữa/đá và biến thể sáng tạo; Vân Nam là vùng sản xuất Arabica quan trọng.',
    'culture.cn.rhythm': 'Cà phê khi đi làm, học tập và gặp bạn; đặt hàng di động, nhận tại quầy/giao tận nơi.',
    'culture.cn.tips': 'Các vị trái cây, dừa và món theo mùa biến động nhanh; không coi một món viral là truyền thống lâu đời.',
    'culture.cn.menu': 'Americano (美式咖啡) | latte (拿铁) | coconut latte (生椰拿铁) | iced latte | flat white | pour-over (手冲咖啡) | fruit coffee',

    // 🇧🇷 Brazil
    'regionName.br-1': 'São Paulo', 'regionName.br-2': 'Rio de Janeiro', 'regionName.br-3': 'Belo Horizonte', 'regionName.br-4': 'Curitiba',
    'city.br-1.vibe': 'padaria và specialty',
    'city.br-3.vibe': 'café với pão de queijo',
    'city.br-4.vibe': 'quán rang xay',
    'culture.br.intro': 'Cafezinho là cốc cà phê nhỏ, đậm, thường ngọt; gắn với hiếu khách và giờ nghỉ. Brazil đồng thời có thị trường specialty lớn.',
    'culture.br.rhythm': 'Sáng cùng bánh; sau bữa trưa hoặc trong các cuộc gặp; quán bakery/padaria là điểm dừng thường ngày.',
    'culture.br.tips': 'Cafezinho không phải lúc nào cũng là espresso; cách pha và lượng đường khác nhau.',
    'culture.br.menu': 'Cafezinho | café coado | café com leite | pingado | cappuccino brasileiro (có biến thể cacao/quế) | espresso | iced latte',

    // 🇮🇳 Ấn Độ
    'regionName.in-1': 'Mumbai', 'regionName.in-2': 'Delhi', 'regionName.in-3': 'Bengaluru', 'regionName.in-4': 'Chennai',
    'regionName.in-5': 'Hyderabad',
    'city.in-5.vibe': 'quán pha trộn nhiều phong cách',
    'culture.in.intro': 'Nam Ấn nổi tiếng filter kaapi với sữa và đường, rót giữa tumbler–dabara; đô thị có café chuỗi, espresso và cold coffee.',
    'culture.in.rhythm': 'Sáng filter coffee ở miền Nam; chiều gặp bạn; quán hiện đại phục vụ học tập, làm việc.',
    'culture.in.tips': 'Filter kaapi truyền thống có thể dùng hỗn hợp cà phê–chicory; không đồng nhất mọi vùng Ấn Độ.',
    'culture.in.menu': 'South Indian filter coffee / kaapi | cold coffee | cappuccino | latte | americano | iced coffee | coffee with chicory',

    // 🇨🇦 Canada
    'regionName.ca-1': 'Toronto', 'regionName.ca-2': 'Vancouver', 'regionName.ca-3': 'Montreal', 'regionName.ca-4': 'Calgary',
    'city.ca-1.vibe': 'chuỗi và specialty',
    'city.ca-2.vibe': 'espresso và rang xay',
    'city.ca-3.vibe': 'café chịu ảnh hưởng Pháp',
    'city.ca-4.vibe': 'takeaway',
    'culture.ca.intro': 'Cà phê mang đi và chuỗi phổ biến; văn hóa double-double và drip tồn tại cùng specialty, đặc biệt tại đô thị lớn.',
    'culture.ca.rhythm': 'Sáng takeaway trên đường làm; drive-through ở ngoại ô; café gặp bạn và làm việc.',
    'culture.ca.tips': 'Double-double thường chỉ cà phê với hai phần kem và hai phần đường theo cách gọi phổ biến, không phải tên một công thức chuẩn quốc tế.',
    'culture.ca.menu': 'Double-double | brewed coffee | americano | latte | flat white | iced coffee | cold brew | cappuccino',

    // 🇰🇷 Hàn Quốc
    'regionName.kr-1': 'Seoul', 'regionName.kr-2': 'Busan', 'regionName.kr-3': 'Daegu', 'regionName.kr-4': 'Incheon',
    'city.kr-1.vibe': 'café concept và specialty',
    'city.kr-2.vibe': 'café nhìn biển',
    'city.kr-3.vibe': 'café khu phố',
    'city.kr-4.vibe': 'café du lịch',
    'culture.kr.intro': 'Café như không gian xã hội, học tập và chụp ảnh; iced americano cực kỳ dễ bắt gặp; dessert café phát triển.',
    'culture.kr.rhythm': 'Sáng mua mang đi; chiều học/làm việc; tối hẹn gặp tại quán; đồ uống lạnh dùng quanh năm.',
    'culture.kr.tips': 'Dalgona coffee nổi tiếng toàn cầu nhưng không phải thức uống thường nhật chủ đạo của mọi quán Hàn.',
    'culture.kr.menu': 'Iced americano (아이스 아메리카노) | latte | vanilla latte | dalgona coffee | Einspänner | cold brew | hand drip',

    // 🇹🇼 Đài Loan
    'regionName.tw-1': 'Đài Bắc', 'regionName.tw-2': 'Đài Trung', 'regionName.tw-3': 'Cao Hùng', 'regionName.tw-4': 'Đài Nam',
    'city.tw-1.vibe': 'specialty/roastery',
    'city.tw-2.vibe': 'café thiết kế',
    'city.tw-3.vibe': 'quán ven cảng',
    'city.tw-4.vibe': 'café trong nhà cổ',
    'culture.tw.intro': 'Café specialty, quán độc lập và không gian thiết kế cùng tồn tại với văn hóa trà sữa; pour-over có chỗ đứng rõ rệt.',
    'culture.tw.rhythm': 'Sáng cà phê takeaway; chiều ngồi quán học/làm việc; cuối tuần café kết hợp bánh ngọt.',
    'culture.tw.tips': 'Không đánh đồng trà sữa trân châu với cà phê; hai văn hóa đồ uống cùng phát triển.',
    'culture.tw.menu': 'Americano (美式咖啡) | latte (拿鐵) | hand drip (手沖咖啡) | iced coffee | cold brew | espresso | flavored latte',

    // 🇮🇩 Indonesia
    'regionName.id-1': 'Jakarta', 'regionName.id-2': 'Bandung', 'regionName.id-3': 'Yogyakarta', 'regionName.id-4': 'Surabaya',
    'regionName.id-5': 'Medan',
    'city.id-1.vibe': 'iced milk coffee',
    'city.id-2.vibe': 'specialty',
    'city.id-3.vibe': 'warung và café sinh viên',
    'city.id-5.vibe': 'cà phê Sumatra',
    'culture.id.intro': 'Kopi tubruk truyền thống, quán warung và làn sóng kopi susu gula aren; nguồn hạt đa đảo tạo đa dạng hương vị.',
    'culture.id.rhythm': 'Sáng hoặc chiều tại warung; giới trẻ dùng kopi susu đá mang đi; quán là nơi gặp bạn.',
    'culture.id.tips': 'Tubruk có bã lắng; kopi talua là đặc sản vùng, không phải menu mặc định toàn Indonesia.',
    'culture.id.menu': 'Kopi tubruk | kopi susu gula aren | es kopi susu | kopi hitam | V60 | espresso | latte | kopi talua (đặc sản Tây Sumatra)',

    // 🇲🇾 Malaysia
    'regionName.my-1': 'Kuala Lumpur', 'regionName.my-2': 'Penang', 'regionName.my-3': 'Ipoh', 'regionName.my-4': 'Johor Bahru',
    'city.my-1.vibe': 'kopitiam và specialty',
    'city.my-2.vibe': 'kopitiam di sản',
    'city.my-3.vibe': 'white coffee',
    'city.my-4.vibe': 'café hiện đại',
    'culture.my.intro': 'Kopitiam và mã gọi đồ uống Hainanese/Nanyang; cà phê thường đậm, kết hợp sữa đặc hoặc sữa bay hơi; specialty phát triển ở thành phố.',
    'culture.my.rhythm': 'Sáng ở kopitiam cùng bánh mì kaya/roti; nghỉ giữa ngày; quán hiện đại phục vụ takeaway và brunch.',
    'culture.my.tips': 'Kopi O thường có đường; muốn không đường gọi kosong. White coffee Ipoh không đơn giản là cà phê pha nhiều sữa.',
    'culture.my.menu': 'Kopi | kopi O | kopi C | kopi peng | kopi O kosong | cham (trà + cà phê) | white coffee (Ipoh) | latte',

    // 🇷🇺 Nga
    'regionName.ru-1': 'Moscow', 'regionName.ru-2': 'Saint Petersburg', 'regionName.ru-3': 'Kazan', 'regionName.ru-4': 'Novosibirsk',
    'city.ru-1.vibe': 'chuỗi và specialty',
    'city.ru-2.vibe': 'café nghệ thuật',
    'city.ru-3.vibe': 'quán địa phương',
    'city.ru-4.vibe': 'café đô thị',
    'culture.ru.intro': 'Espresso, cappuccino và đồ uống sữa phổ biến ở đô thị; café là nơi gặp gỡ, làm việc, tránh lạnh; raf coffee là biến thể địa phương.',
    'culture.ru.rhythm': 'Sáng takeaway; chiều/tối quán café; đồ uống nóng mùa lạnh, iced drinks mùa hè.',
    'culture.ru.tips': 'Raf coffee thường đánh nóng espresso với kem và đường vani; công thức thay đổi giữa các quán.',
    'culture.ru.menu': 'Raf coffee (раф-кофе) | cappuccino | latte | americano | flat white | espresso | filter coffee',
  },
};
