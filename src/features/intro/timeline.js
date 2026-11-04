import { t } from '../../i18n/index.js';

export const START_TIME = 1;
export const LANDING_TIME = 14.5;
export const LANDING_PAUSE = 1.5;
export const PLAYBACK_RATE = 1;
export const DURATION = 22 + LANDING_PAUSE;
export const beats = [
  [0, '', ''],
  [1.5, t('intro.speaker.bicycle'), t('intro.line.bell')],
  [2.4, 'BẠN', t('intro.line.watchOut')],
  [3.4, '', t('intro.line.bonk')],
  [4.3, t('intro.speaker.narrator'), t('intro.line.sign')],
  [6, 'NHÂN VIÊN Y TẾ', t('intro.line.medic')],
  [9, 'THẦN CHẾT', t('intro.line.reaperGo')],
  [12, 'BẠN', t('intro.line.coffee')],
  [LANDING_TIME, 'THẦN CHẾT', t('intro.line.landing')],
  [LANDING_TIME + LANDING_PAUSE, 'THẦN CHẾT', t('intro.line.walk')],
  [20, 'THẦN CHẾT', t('intro.line.gate')],
  [22.5, '', ''],
];
export function beatAt(time) {
  return beats.findLast(([start]) => time >= start) ?? beats[0];
}

export function nextDialogueTime(time) {
  return beats.find(([start, , text]) => start > time + .01 && text)?.[0] ?? DURATION;
}
