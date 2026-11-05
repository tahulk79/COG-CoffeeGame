import { t } from '../../i18n/index.js';

// Bản đồ thế giới (docs/screens/02b-world-map/README.md). Nguồn duy nhất của danh sách địa điểm.
// type: 'both' = nông trại + quán, 'farm' = chỉ nông trại, 'cafe' = chỉ quán. Mọi nơi đều chọn được; luật theo loại ở docs 02b mục "Luật theo loại".
// lon/lat: tọa độ thật của vùng (độ), dùng để đặt mảnh đất + cờ trên bản đồ.
// outline: đường biên rút gọn của quốc gia/vùng (độ: [kinh, vĩ]) — vừa để chạm trúng nước, vừa để dựng khối nước nổi lên.
const RAW = [
  // islands: quần đảo thuộc chủ quyền Việt Nam (Hoàng Sa, Trường Sa) — đảo nhỏ dựng riêng, chạm vào cũng chọn Việt Nam. islets: [kinh, vĩ].
  { id: 'vn', type: 'both', lon: 108.3, lat: 13.5,
    islands: [
      { id: 'hoangSa', lon: 112, lat: 16.5, islets: [[112.33, 16.83], [111.6, 16.53], [111.2, 15.78], [111.5, 17.1], [112.73, 16.67]] },
      { id: 'truongSa', lon: 113.8, lat: 9.8, islets: [[111.92, 8.65], [114.33, 11.43], [114.36, 10.3], [114.33, 9.6], [113.6, 10.8], [112.92, 7.87], [113.3, 9.2]] },
    ],
    outline: [[102.2, 22.4], [105.5, 23.3], [108, 21.6], [106.7, 20.5], [105.7, 19], [106.6, 17.5], [108.8, 15.4], [109.3, 12.5], [109, 11.3], [107, 10.4], [106.6, 9.5], [104.8, 8.6], [105, 10], [106.2, 11.7], [107.5, 12.3], [107.6, 14.5], [107.5, 16], [106.6, 16.5], [105, 18.2], [104, 19.3], [103.1, 19.6], [104.3, 20.9], [103, 21.6]] },
  { id: 'br', type: 'both', lon: -45, lat: -19, outline: [[-60, 5], [-52, 4], [-50, 0], [-44, -2.5], [-35, -5], [-35, -9], [-39, -15], [-41, -22], [-48, -26], [-53, -33.7], [-57.6, -30.2], [-54, -27], [-55, -24], [-58, -20], [-58, -16], [-60.5, -13.5], [-65, -11], [-70, -11], [-73.9, -7.3], [-70, -4], [-69.5, 1], [-67, 1.7], [-64, 4]] },
  { id: 'co', type: 'farm', lon: -75, lat: 5, outline: [[-77, 8.6], [-75, 10.8], [-72, 12.4], [-71, 9], [-72.5, 7], [-67.5, 6.2], [-67.8, 2], [-70, 1.5], [-69.5, -1], [-70, -4.2], [-73.4, -.3], [-75.3, 0], [-77.5, .8], [-78.9, 1.6], [-77.4, 4], [-77.3, 7]] },
  { id: 'ke', type: 'farm', lon: 37, lat: 0, outline: [[34, 4.6], [36, 4.5], [38.7, 3.6], [41.9, 4], [41, 2.8], [41, -1.7], [39.2, -4.7], [37.7, -3.1], [34, -1], [34, .5], [35, 1.9]] },
  { id: 'id', type: 'farm', lon: 100, lat: 0, outline: [[95.2, 5.6], [98, 4.2], [100.5, 2], [104, -1.5], [106, -3], [105.8, -5.8], [104.5, -5.9], [102, -4], [99.5, -1], [97.5, 1.5], [95.5, 4]] },
  { id: 'it', type: 'cafe', lon: 13, lat: 42, outline: [[7, 44], [7.5, 45.9], [10.5, 46.8], [13.7, 46.5], [13.6, 45.6], [12.3, 44.6], [13.5, 43.6], [16, 41.9], [18.5, 40.2], [17, 39], [16.6, 38], [15.6, 38], [16, 39.5], [15, 40.2], [12.5, 41.5], [10.5, 43], [8.8, 44.4]] },
  { id: 'jp', type: 'cafe', lon: 139.7, lat: 35.7, outline: [[130.6, 31.2], [131.9, 33], [135, 33.5], [136.9, 34.6], [138.8, 34.6], [140.8, 35.7], [141, 38], [142, 39.5], [141.6, 41.4], [143, 42], [145.5, 43.3], [145.4, 44.2], [142, 45.5], [141.5, 43.3], [140.1, 41.5], [139.8, 39], [138.5, 37.5], [136.8, 37], [135.8, 35.6], [133, 35.5], [131, 34.4], [129.8, 32.6]] },
  { id: 'us', type: 'cafe', lon: -120, lat: 46, outline: [[-124.7, 48.4], [-123, 49], [-95, 49], [-89, 48], [-83, 46], [-82.5, 42], [-79, 43.5], [-75, 45], [-71, 45], [-67, 47], [-67, 44.6], [-70.5, 41.8], [-74, 40.5], [-76, 38], [-75.5, 35.2], [-81, 31.5], [-80, 26], [-81.5, 25], [-82.7, 28], [-84, 30], [-89, 30.2], [-94, 29.6], [-97.2, 26], [-99.5, 27.5], [-104.5, 29.5], [-106.5, 31.8], [-111, 31.3], [-114.8, 32.5], [-117.1, 32.5], [-120.6, 34.5], [-122.5, 37.5], [-124.2, 40.3], [-124, 46]] },
];
// Thông tin địa lý hiện khi chạm (trước khi chốt): chỉ địa hình, khí hậu, nhiệt độ, lượng mưa, độ cao — không lộ trồng/quán.
export const FACTS = [['terrain', '🏔️'], ['climate', '🌦️'], ['temp', '🌡️'], ['rain', '🌧️'], ['elevation', '📏']];
export const REGIONS = RAW.map(region => ({
  ...region,
  name: t(`world.region.${region.id}.name`),
  place: t(`world.region.${region.id}.place`),
  teaser: t(`world.region.${region.id}.teaser`),
  crops: t(`world.region.${region.id}.crops`),
  note: t(`world.region.${region.id}.note`),
  facts: FACTS.map(([key, icon]) => ({ key, icon, value: t(`world.region.${region.id}.${key}`) })),
}));
export const DEFAULT_REGION = 'vn';
// Save cũ (trước bản đồ) hoặc id lạ → Việt Nam, giữ nguyên lối chơi cũ.
export const regionId = id => REGIONS.some(region => region.id === id) ? id : DEFAULT_REGION;
export const regionById = id => REGIONS.find(region => region.id === regionId(id));
export const regionType = id => regionById(id).type;
export const TYPE_ICON = { both: '🌱☕', farm: '🌱', cafe: '☕' };
// Màu loại dùng chung cho cờ 3D, nhãn, chú giải và thẻ.
export const TYPE_COLOR = { both: '#e0a93a', farm: '#5f9a3c', cafe: '#b5523a' };
