import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import translationEN from './locales/en/translation.json';
import translationUA from './locales/ua/translation.json';
import translationES from './locales/es/translation.json';
import translationES_AR from './locales/es-AR/translation.json';
import translationPT_BR from './locales/pt-BR/translation.json';
import translationVI from './locales/vi/translation.json';
import translationKO from './locales/ko/translation.json';
import translationID from './locales/id/translation.json';
import translationMS from './locales/ms/translation.json';
import translationTL from './locales/tl/translation.json';
import translationPCM from './locales/pcm/translation.json';
import translationSW from './locales/sw/translation.json';

const resources = {
    en: { translation: translationEN },
    ua: { translation: translationUA },
    es: { translation: translationES },
    'es-AR': { translation: translationES_AR },
    'pt-BR': { translation: translationPT_BR },
    vi: { translation: translationVI },
    ko: { translation: translationKO },
    id: { translation: translationID },
    ms: { translation: translationMS },
    tl: { translation: translationTL },
    pcm: { translation: translationPCM },
    sw: { translation: translationSW }
};

const savedLanguage = localStorage.getItem('lang') || 'en';

i18n
    .use(initReactI18next)
    .init({
        resources,
        lng: savedLanguage,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false
        }
    });

export default i18n;