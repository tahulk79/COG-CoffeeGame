import { getLang } from '../i18n/index.js';

// Tên mặc định theo ngôn ngữ đang chọn và giới tính nhân vật; màn chọn không còn ô nhập tên.
const NAMES = {
  vi: {
    female: ['An Nhiên', 'Minh Anh', 'Gia Linh', 'Khánh An', 'Thanh Trúc', 'Mộc Miên', 'Hoài An', 'Bảo Ngọc', 'Thu Hà', 'Diệp Chi'],
    male: ['Minh Khang', 'Gia Huy', 'Nhật Minh', 'Bảo An', 'Hải Đăng', 'Tuệ Lâm', 'Đức Anh', 'Quang Vinh', 'Thiên An', 'Trung Kiên'],
  },
  en: {
    female: ['Emma', 'Olivia', 'Lily', 'Grace', 'Chloe', 'Ruby', 'Hazel', 'Ivy', 'Rose', 'Nora'],
    male: ['Liam', 'Noah', 'Oliver', 'Leo', 'Owen', 'Finn', 'Miles', 'Jack', 'Theo', 'Ethan'],
  },
};
const pool = gender => (NAMES[getLang()] ?? NAMES.en)[gender === 'male' ? 'male' : 'female'];

export const DEFAULT_NAME = pool('female')[0];

export function randomName(gender = 'female', current = '') {
  const names = pool(gender), choices = names.filter(name => name !== current.trim());
  return choices[Math.floor(Math.random() * choices.length)] ?? names[0];
}
