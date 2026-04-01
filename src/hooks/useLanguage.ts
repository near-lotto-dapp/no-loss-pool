import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export type Language =
    | 'en'
    | 'ua'
    | 'es'
    | 'es-AR'
    | 'pt-BR'
    | 'vi'
    | 'ko'
    | 'id'
    | 'ms'
    | 'tl'
    | 'pcm'
    | 'sw';

export const useLanguage = () => {
    const { t, i18n } = useTranslation();
    const lang = (i18n.language || 'en') as Language;

    const setLang = (newLang: Language) => {
        i18n.changeLanguage(newLang);
        localStorage.setItem('lang', newLang);
    };

    useEffect(() => {
        const savedLang = localStorage.getItem('lang') as Language;
        if (savedLang && savedLang !== i18n.language) {
            i18n.changeLanguage(savedLang);
        }
    }, [i18n]);

    return { lang, setLang, t };
};