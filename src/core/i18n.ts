import vi from '../data/locales/vi.json';
import en from '../data/locales/en.json';

type Dict = Record<string, string>;

/** The languages offered in Settings. `note` says how much of the game is translated. */
export const LANGUAGES = [
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'en', label: 'English' },
] as const;
export type LocaleCode = (typeof LANGUAGES)[number]['code'];

const locales: Record<string, Dict> = { vi, en };
const KEY = 'tcss.locale';

function stored(): string {
  try {
    return window.localStorage.getItem(KEY) ?? 'vi';
  } catch {
    return 'vi';
  }
}

let code: string = locales[stored()] ? stored() : 'vi';
let active: Dict = locales[code]!;

export function getLocale(): string {
  return code;
}

/** Switches language and remembers it. Strings already drawn keep their text: the UI is rebuilt by reloading. */
export function setLocale(next: string): void {
  code = locales[next] ? next : 'vi';
  active = locales[code]!;
  try {
    window.localStorage.setItem(KEY, code);
  } catch {
    /* storage blocked: the choice lasts for this session only */
  }
}

/** Look up a UI string; `{name}` placeholders are filled from params. A key missing in the chosen language falls back to Vietnamese, then to the key itself. */
export function t(key: string, params: Record<string, string | number> = {}): string {
  const raw = active[key] ?? vi[key as keyof typeof vi] ?? key;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? `{${k}}`));
}
