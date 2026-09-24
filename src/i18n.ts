import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import esCommon from '@/locales/es/common.json';
import esChrome from '@/locales/es/chrome.json';
import esDialogs from '@/locales/es/dialogs.json';
import esTours from '@/locales/es/tours.json';
import esPanelsColor from '@/locales/es/panelsColor.json';
import esPanelsPaint from '@/locales/es/panelsPaint.json';
import enCommon from '@/locales/en/common.json';
import enChrome from '@/locales/en/chrome.json';
import enDialogs from '@/locales/en/dialogs.json';
import enTours from '@/locales/en/tours.json';
import enPanelsColor from '@/locales/en/panelsColor.json';
import enPanelsPaint from '@/locales/en/panelsPaint.json';

export const NAMESPACES = ['common', 'chrome', 'dialogs', 'tours', 'panelsColor', 'panelsPaint'] as const;

// Only the app's core "chrome" is translated so far (see src/store/languageStore.ts's docblock
// for the full list of what isn't yet) — fallbackLng: 'es' means anything not wrapped in `t()`
// yet, or any key missing from en.json, just shows the original Spanish instead of a broken key
// or a blank gap.
void i18n.use(initReactI18next).init({
  resources: {
    es: { common: esCommon, chrome: esChrome, dialogs: esDialogs, tours: esTours, panelsColor: esPanelsColor, panelsPaint: esPanelsPaint },
    en: { common: enCommon, chrome: enChrome, dialogs: enDialogs, tours: enTours, panelsColor: enPanelsColor, panelsPaint: enPanelsPaint },
  },
  lng: 'es',
  fallbackLng: 'es',
  ns: NAMESPACES,
  defaultNS: 'common',
  interpolation: { escapeValue: false }, // React already escapes; double-escaping breaks « » etc.
  react: { useSuspense: false },
});

export default i18n;
