const names = ['An Nhiên', 'Minh Anh', 'Bảo An', 'Khánh An', 'Gia Linh', 'Thiên An', 'Hải Anh', 'Nhật Minh', 'Mộc Miên', 'Tuệ Lâm', 'Thanh Trúc', 'Hoài An'];
export const DEFAULT_NAME = names[0];

export function randomName(current) {
  const choices = names.filter(name => name !== current.trim());
  return choices[Math.floor(Math.random() * choices.length)];
}
