import { useState, useEffect } from 'react';
import { Language, translations } from '@/pages/translations';

export const useLanguage = () => {
    const [lang, setLang] = useState<Language>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('lang') as Language) || 'en';
        }
        return 'en';
    });

    useEffect(() => {
        localStorage.setItem('lang', lang);
    }, [lang]);

    const t = translations[lang];

    return { lang, setLang, t };
};