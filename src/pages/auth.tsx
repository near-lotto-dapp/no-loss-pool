import { useState, useEffect } from 'react';
import { Navigation } from '@/components/navigation';
import { Footer } from '@/components/footer';
import { LanguageSwitcher } from '@/components/language_switcher';
import { AuthForm } from '@/components/auth_form';
import { supabase } from '@/utils/supabaseClient';
import styles from '@/styles/app.module.css';
import {Language, translations} from "@/pages/translations.ts";

export default function AuthPage() {
    const [lang, setLang] = useState<Language>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('lang') as Language) || 'en';
        }
        return 'en';
    });

    const [user, setUser] = useState<any>(null);
    const [loadingSession, setLoadingSession] = useState(true);

    const t = translations[lang];

    useEffect(() => {
        localStorage.setItem('lang', lang);
    }, [lang]);

    useEffect(() => {
        // Отримуємо поточну сесію
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoadingSession(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    return (
        <>
            <Navigation />

            <main className="container position-relative mt-0 mb-4" style={{ minHeight: '70vh' }}>
                <div
                    className="position-absolute d-flex justify-content-end align-items-center"
                    style={{
                        top: '-45px',
                        right: '15px',
                        zIndex: 1000,
                        width: 'fit-content',
                        height: '38px'
                    }}
                >
                    <LanguageSwitcher lang={lang} setLang={setLang}/>
                </div>

                <div className="d-flex justify-content-center align-items-center w-100 mt-5">
                    {loadingSession ? (
                        <div className="spinner-border text-info" role="status"></div>
                    ) : user ? (
                        <div className={`${styles.card} ${styles.stakingCard} text-center`} style={{ maxWidth: '450px', width: '100%' }}>
                            <h3 className="text-white mb-2">{t.welcomeUser || "Welcome!"}</h3>
                            <p className="text-white-50 mb-4">{user.email}</p>

                            {/* Generated wallet */}
                            <div className="p-3 bg-dark rounded mb-4 border border-secondary text-start">
                                <small className="text-white-50 d-block mb-1">{t.walletStatus || "NEAR Wallet Status:"}</small>
                                <div className="d-flex justify-content-between align-items-center">
                                    <span className="text-info fw-bold">In progress...</span>
                                </div>
                            </div>

                            <button
                                onClick={handleLogout}
                                className="btn btn-outline-danger w-100 fw-bold"
                            >
                                <i className="bi bi-box-arrow-right me-2"></i>
                                {t.logoutBtn || "Log Out"}
                            </button>
                        </div>
                    ) : (
                        <AuthForm t={t} />
                    )}
                </div>

            </main>

            <Footer t={t}/>
        </>
    );
}