// Strings drawn inside the 3D realm (world-space labels). Owner: src/features/realm.
export default {
  en: {
    'realm.forSale': ({ price }) => `🪙 ${price}`,
    'realm.roundLocked': ({ n }) => `🔒 Round ${n}`,
    'realm.needsRoad': '🚧 Open the road first',
    'realm.openRoad': ({ price }) => `🚧 🪙 ${price}`,
    'realm.level': ({ level }) => `Lv ${level}`,
    'realm.sign.order': 'ORDER',
    'realm.sign.brew': 'BREW',
    'realm.cafeSign': '☕ Godbean Café',
  },
  vi: {
    'realm.forSale': ({ price }) => `🪙 ${price}`,
    'realm.roundLocked': ({ n }) => `🔒 Vòng ${n}`,
    'realm.needsRoad': '🚧 Cần mở đường trước',
    'realm.openRoad': ({ price }) => `🚧 🪙 ${price}`,
    'realm.level': ({ level }) => `Cấp ${level}`,
    'realm.sign.order': 'GỌI MÓN',
    'realm.sign.brew': 'PHA CHẾ',
    'realm.cafeSign': '☕ Quán Godbean',
  },
};
