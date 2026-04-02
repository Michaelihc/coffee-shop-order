import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import en from "./locales/en.json";
import zh from "./locales/zh.json";
import ko from "./locales/ko.json";

const STORAGE_KEY = "coffee-shop-lang";

/**
 * Normalize a Teams/browser locale string (e.g. "en-us", "zh-cn", "ko-kr")
 * to one of our supported language codes.
 */
function normalizeLocale(locale: string | undefined): string | undefined {
  if (!locale) return undefined;
  const lang = locale.toLowerCase().split("-")[0];
  if (["en", "zh", "ko"].includes(lang)) return lang;
  return undefined;
}

export function initI18n(teamsLocale?: string) {
  const detectedLang = normalizeLocale(teamsLocale);

  return i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        zh: { translation: zh },
        ko: { translation: ko },
      },
      lng: localStorage.getItem(STORAGE_KEY) || detectedLang || undefined,
      fallbackLng: "en",
      supportedLngs: ["en", "zh", "ko"],
      interpolation: {
        escapeValue: false,
      },
      detection: {
        order: ["localStorage", "navigator"],
        lookupLocalStorage: STORAGE_KEY,
      },
    });
}

/** Persist language choice and update html lang attribute */
i18n.on("languageChanged", (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
  document.documentElement.lang = lng;
});

export default i18n;
