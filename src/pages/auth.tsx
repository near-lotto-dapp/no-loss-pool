import { useState, useEffect } from 'react';
import { Footer } from '@/components/footer';
import { LanguageSwitcher } from '@/components/language_switcher';
import { RegistrationForm } from '@/components/registration_form';
import {Language, translations} from "@/pages/translations.ts";

export default function AuthPage() {
    const [lang, setLang] = useState<Language>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('lang') as Language) || 'en';
        }
        return 'en';
    });

    const t = translations[lang];

    useEffect(() => {
        localStorage.setItem('lang', lang);
    }, [lang]);

    return (
        <>

            <main className="container position-relative mt-0 mb-4" style={{ minHeight: '70vh' }}>

                <div
                    className="position-absolute d-flex justify-content-end"
                    style={{
                        top: '-55px',
                        right: '15px',
                        zIndex: 1000,
                        width: 'fit-content'
                    }}
                >
                    <LanguageSwitcher lang={lang} setLang={setLang}/>
                </div>

                <div className="d-flex justify-content-center align-items-center w-100 mt-5">
                    <RegistrationForm t={t} onSuccess={() => console.log("User registered! Next step: generate NEAR wallet.")} />
                </div>

            </main>

            <Footer t={t}/>
        </>
    );
}