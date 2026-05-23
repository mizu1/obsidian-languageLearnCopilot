import { UIStrings } from './types';
import { zhCN } from './zh-CN';
import { en } from './en';
import { LanguageCode } from '../types';

const maps: Record<LanguageCode, UIStrings> = { 'zh-CN': zhCN, 'en': en, 'ja': zhCN };
let current: UIStrings = zhCN;

export function setLang(lang: LanguageCode): void { current = maps[lang] || en; }
export function i18n(): UIStrings { return current; }
