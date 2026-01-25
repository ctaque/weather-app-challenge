import { fr, type Translations } from "./fr";
import { en } from "./en";

export type Language = "fr" | "en";

const translations: Record<Language, Translations> = {
  fr,
  en,
};

export function getTranslations(lang: Language): Translations {
  return translations[lang] || translations.fr;
}

export { fr, en };
export type { Translations };
