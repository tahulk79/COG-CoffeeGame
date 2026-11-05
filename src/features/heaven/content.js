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

const gift = (id, icon) => ({ id, icon, name: t(`heaven.gift.${id}.name`), description: t(`heaven.gift.${id}.description`) });
export const GIFTS = [gift('seeds', '❧'), gift('tools', '☕'), gift('capital', '₫')];

// Five daises on one circle (r 11) round the plaza centre (0, -3), 72° apart; the gap at the south leads to the portal.
export const NPCS = [
  { id: 'reaper', name: t('heaven.npc.reaper'), icon: '☠', color: '#48576c', position: [-6.47, 5.9] },
  ...EXPERTS,
  { id: 'clerk', name: t('heaven.npc.clerk'), icon: '▤', color: '#b38269', position: [6.47, 5.9] },
  { id: 'portal', name: t('heaven.npc.portal'), icon: '↗', color: '#ceb376', position: [0, 13] },
];

// Người nói: 'BẠN', 'THẦN CHẾT' là mã (dialogue.js dịch); Thần Tiếp Nhận không có mã nên truyền tên đã dịch.
export const CLERK = t('heaven.npc.clerk');

// Phần tử thứ ba (tùy chọn): mã con dấu hiện cùng câu thoại.
export const WELCOME = [
  ['BẠN', t('heaven.welcome.1')],
  ['THẦN CHẾT', t('heaven.welcome.2')],
  ['THẦN CHẾT', t('heaven.welcome.3')],
];

export const REVEAL = [
  [CLERK, t('heaven.reveal.1'), 'notDead'],
  ['BẠN', t('heaven.reveal.2')],
  ['THẦN CHẾT', t('heaven.reveal.3')],
  [CLERK, t('heaven.reveal.4')],
];

export const FAREWELL = [
  ['THẦN CHẾT', t('heaven.farewell.1')],
  ['BẠN', t('heaven.farewell.2')],
];
