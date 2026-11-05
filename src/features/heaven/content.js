import { t } from '../../i18n/index.js';

// Chữ hiển thị lấy từ locale theo id (src/i18n/locales/heaven.js); đúng/sai luôn so theo id.
const question = (id, optionIds, correct) => ({
  id, text: t(`heaven.q.${id}.text`),
  options: optionIds.map(option => ({ id: option, text: t(`heaven.q.${id}.option.${option}`) })),
  perk: { name: t(`heaven.q.${id}.perk.name`), effect: t(`heaven.q.${id}.perk.effect`) },
  correct, explanation: t(`heaven.q.${id}.explanation`), wrong: t(`heaven.q.${id}.wrong`),
});
const expert = (id, icon, color, position, questions) => ({
  id, name: t(`heaven.expert.${id}.name`), icon, color, position,
  greeting: t(`heaven.expert.${id}.greeting`), seal: t(`heaven.expert.${id}.seal`), questions,
});

export const EXPERTS = [
  expert('growing', '❧', '#70946c', [-10.46, -6.4], [
    question('ripe', ['ripe', 'green', 'all'], 'ripe'),
    question('water', ['more', 'drain', 'coffee'], 'drain'),
  ]),
  expert('brewing', '♨', '#b28b53', [0, -14], [
    question('recipe', ['feel', 'cup', 'measure'], 'measure'),
    question('adjust', ['one', 'everything', 'sugar'], 'one'),
  ]),
  expert('business', '₫', '#788ba6', [10.46, -6.4], [
    question('costs', ['yes', 'no', 'luck'], 'no'),
    question('customer', ['argue', 'ignore', 'listen'], 'listen'),
  ]),
];
// Chuyên gia đã gặp đủ câu (dấu ✓ ở Hội đồng, F-45 Q1 R13).
export const expertsDone = (met = []) => EXPERTS.filter(e => e.questions.every(q => met.includes(q.id))).map(e => e.id);

const gift = (id, icon) => ({ id, icon, name: t(`heaven.gift.${id}.name`), description: t(`heaven.gift.${id}.description`) });
// Kiểu quà giữ 'seeds'|'tools'|'capital' cho save cũ; save mới luôn nhận Túi hạt giống (05/11/2026, F-44, đề xuất Q2).
export const GIFTS = [gift('seeds', '❧'), gift('tools', '☕'), gift('capital', '₫')];
export const STARTING_GIFT = 'seeds';

// 02-mini (05/11/2026, F-44): Thần Chết và Thần Tiếp Nhận đứng sẵn cạnh chỗ xuất hiện (0, 7), không bệ riêng (noDais).
// Ba chuyên gia đã xuống trần gian (Hội đồng so le): giữ trong danh sách để sân vẽ đúng bệ của sân gốc, nhưng ẩn và không chạm được.
export const SPAWN = [0, 7];
export const NPCS = [
  { id: 'reaper', name: t('heaven.npc.reaper'), icon: '☠', color: '#48576c', position: [-3.2, 5.4], noDais: true },
  ...EXPERTS.map(expert => ({ ...expert, initialVisible: false })),
  { id: 'clerk', name: t('heaven.npc.clerk'), icon: '▤', color: '#b38269', position: [3.2, 5.4], noDais: true },
  { id: 'portal', name: t('heaven.npc.portal'), icon: '↗', color: '#ceb376', position: [0, 13] },
];

// Người nói: 'THẦN CHẾT' là mã (dialogue.js dịch); Thần Tiếp Nhận không có mã nên truyền tên đã dịch.
export const CLERK = t('heaven.npc.clerk');

// Hộp 1–4 của 02-mini (Thần Chết 2, Thần Tiếp Nhận 2); hộp 5 là lời tiễn kèm nút Nhận (game.js). Phần tử thứ ba: mã con dấu.
export const MINI = [
  ['THẦN CHẾT', t('heaven.mini.1')],
  ['THẦN CHẾT', t('heaven.mini.2')],
  [CLERK, t('heaven.mini.3'), 'notDead'],
  [CLERK, t('heaven.mini.4')],
];
