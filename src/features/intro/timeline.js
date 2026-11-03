export const START_TIME = 1;
export const LANDING_TIME = 14.5;
export const LANDING_PAUSE = 1.5;
export const PLAYBACK_RATE = 1;
export const DURATION = 22 + LANDING_PAUSE;
export const beats = [
  [0, '', ''],
  [1.5, 'XE ĐẠP', 'Kính coong!'],
  [2.4, 'BẠN', 'Đi đứng phải nhìn chứ!'],
  [3.4, '', 'CỐP!'],
  [4.3, 'NGƯỜI DẪN CHUYỆN', 'Né được xe. Không né được cái biển.'],
  [6, 'NHÂN VIÊN Y TẾ', 'Có người bị nạn! Đưa cáng tới!'],
  [9, 'THẦN CHẾT', 'Đi thôi em. Chuyến này khỏi đặt xe.'],
  [12, 'BẠN', 'Còn ly cà phê của em!'],
  [LANDING_TIME, 'THẦN CHẾT', 'Tới đầu đường rồi. Đứng vững chưa?'],
  [LANDING_TIME + LANDING_PAUSE, 'THẦN CHẾT', 'Đi nào. Cổng ngay phía trước.'],
  [20, 'THẦN CHẾT', 'Cổng tự mở. Khỏi bấm chuông nhé!'],
  [22.5, '', ''],
];
export function beatAt(time) {
  return beats.findLast(([start]) => time >= start) ?? beats[0];
}

export function nextDialogueTime(time) {
  return beats.find(([start, , text]) => start > time + .01 && text)?.[0] ?? DURATION;
}
