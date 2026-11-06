// Strings drawn inside the 3D realm (world-space labels). Owner: src/features/realm.
export default {
  en: {
    'realm.forSale': ({ price }) => `🪙 ${price}`,
    'realm.level': ({ level }) => `Lv ${level}`,
    'realm.sign.order': 'ORDER',
    'realm.sign.brew': 'BREW',
    'realm.cafeSign': '☕ Godbean Café',
    'realm.staff.wake': 'Wake up',
    'realm.place.hint': 'Drag to move · tap ✓ to build',
    'realm.place.noRoom': 'No free space — buy another café lot',
    'realm.place.noRoomFarm': 'No free grass nearby — drag the building',
    'realm.staff.recharge': 'Recharge',
  },
  vi: {
    'realm.forSale': ({ price }) => `🪙 ${price}`,
    'realm.level': ({ level }) => `Cấp ${level}`,
    'realm.sign.order': 'GỌI MÓN',
    'realm.sign.brew': 'PHA CHẾ',
    'realm.cafeSign': '☕ Quán Godbean',
    'realm.staff.wake': 'Gọi dậy',
    'realm.place.hint': 'Kéo để di chuyển · bấm ✓ để xây',
    'realm.place.noRoom': 'Hết chỗ trống — mua thêm lô quán',
    'realm.place.noRoomFarm': 'Hết cỏ trống gần đây — kéo công trình đi',
    'realm.staff.recharge': 'Sạc pin',
  },
};
