// F-35 UI read model (docs/shared/decode-awaken.md §8): pure helpers, no DOM, no storage. The panels in ui.js stay thin.
import { FRAGMENT_TYPES, KEY_OF, KEY_DIMENSION, FRAGMENTS_PER_MESSAGE } from './rules.js';

const ORDER = { ready: 0, trying: 1, open: 2, solved: 3, locked: 4 };
/** UI state: 'locked' when the rules cannot detect the question yet (unavailable, shown with its reason). */
export const uiState = q => q.available ? q.state : 'locked';
/** Ready first, then trying, open, solved, locked; list order kept inside a state. */
export const sortQuestions = list => list.map((q, i) => [q, i]).sort((x, y) => ORDER[uiState(x[0])] - ORDER[uiState(y[0])] || x[1] - y[1]).map(x => x[0]);
/** Ids that deserve the badge dot: ready to decode, or the First Sixth Key question before a hypothesis exists. */
export const attentionIds = (list, A) => list.filter(q => q.available && (q.state === 'ready' || (q.id === 'adjust' && q.state === 'trying' && A.firstKey.step < 3))).map(q => q.id);
/** Decode evidence is one i18n string; ' | ' splits it into one line per lot / cup / shift. */
export const evidenceLines = text => String(text).split(' | ').map(s => s.trim()).filter(Boolean);

/** Six rows type -> Key with 0..3 fragment pips. */
export const fragmentRows = A => FRAGMENT_TYPES.map(type => ({
  type, key: KEY_OF[type], dimension: KEY_DIMENSION[KEY_OF[type]],
  count: Math.min(FRAGMENTS_PER_MESSAGE, A.fragments.filter(f => f.type === type).length),
  message: A.messages.includes(type), applied: A.applied.includes(type), hasKey: A.keys.some(k => k.id === KEY_OF[type]),
}));
export const pips = count => '●'.repeat(count) + '○'.repeat(FRAGMENTS_PER_MESSAGE - count);

/** Steps 1-7 of the First Sixth Key. `step` in the save = highest finished step; 6 = decoded, apply pending; 7 = Key. */
export function firstKeyView(A) {
  const fk = A.firstKey, step = fk.step;
  const done = [1, 2, 3, 4, 5, 6, 7].map(i => i <= 5 ? step >= i : step >= 7);
  return {
    step, done, current: done.indexOf(false) + 1 || 8, variable: fk.variable, direction: fk.direction, attribute: fk.attribute, rejected: fk.rejected,
    canHypothesis: step === 2, canDecode: step === 4 && A.questions.adjust.state === 'ready', applyPending: step === 6, finished: step >= 7,
  };
}
/** True when `pair` (two entries) are exactly the first two V60 cups of the First Sixth Key. */
export const isFirstPair = (A, pair) => A.firstKey.entries.length >= 2 && pair.length === 2 && pair.every(e => e && A.firstKey.entries.slice(0, 2).includes(e.id)) && pair[0].id !== pair[1].id;
