import translations from "./data/languages.json";
import { useLotteryStore } from "./store";

export type TranslationKey = keyof typeof translations.en;

export function useI18n() {
  const language = useLotteryStore(state => state.languageMode ?? "en");
  const t = (key: TranslationKey, variables?: Record<string, string | number>) => {
    let text = translations[language][key] ?? translations.en[key] ?? key;
    Object.entries(variables ?? {}).forEach(([name, value]) => { text = text.replaceAll(`{${name}}`, String(value)); });
    return text;
  };
  return { language, t };
}
