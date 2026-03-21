import { useState, useEffect } from 'react';
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

    // New states for wallet fetching and UI feedback
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [loadingWallet, setLoadingWallet] = useState(false);
    const [copied, setCopied] = useState(false);

    const t = translations[lang];

    useEffect(() => {
        localStorage.setItem('lang', lang);
    }, [lang]);

    // Handle Session
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoadingSession(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Fetch Wallet Address when user is logged in
    useEffect(() => {
        const fetchWallet = async () => {
            if (user) {
                setLoadingWallet(true);
                try {
                    const { data, error } = await supabase
                        .from('profiles')
                        .select('near_account_id')
                        .eq('id', user.id)
                        .single();

                    if (data && !error) {
                        setWalletAddress(data.near_account_id);
                    }
                } catch (err) {
                    console.error("Error fetching wallet:", err);
                } finally {
                    setLoadingWallet(false);
                }
            } else {
                setWalletAddress(null);
            }
        };

        fetchWallet();
    }, [user]);

    const handleGenerateWallet = async () => {
        if (!user) return;
        setLoadingWallet(true);

        try {
            const response = await fetch('/api/auth/setup-wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: user.id,
                    email: user.email
                })
            });

            const data = await response.json();

            if (response.ok && data.wallet?.accountId) {
                setWalletAddress(data.wallet.accountId);
            } else {
                console.error("Manual generation failed:", data.error);
                alert(t.generationError || "Failed to generate wallet. Please try again.");
            }
        } catch (err) {
            console.error("Network error during wallet generation:", err);
            alert(t.generationError || "Network error. Please try again.");
        } finally {
            setLoadingWallet(false);
        }
    };

    const handleCopy = () => {
        if (walletAddress) {
            navigator.clipboard.writeText(walletAddress);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const formatAddress = (address: string) => {
        if (address.length > 20) {
            return `${address.slice(0, 6)}...${address.slice(-6)}`;
        }
        return address;
    };

    return (
        <>

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

                            {/* Wallet Display Section */}
                            <div className="p-3 bg-dark rounded mb-4 border border-secondary text-start">
                                <small className="text-white-50 d-block mb-2">{t.yourWallet || "Your NEAR Wallet:"}</small>

                                <div className="d-flex justify-content-between align-items-center bg-black p-2 rounded border border-dark">
                                    {loadingWallet ? (
                                        <span className="text-secondary">{t.generating || "Loading..."}</span>
                                    ) : walletAddress ? (
                                        <>
                                            <span className="text-info fw-bold font-monospace" style={{ fontSize: '0.9rem' }}>
                                                {formatAddress(walletAddress)}
                                            </span>
                                            <button
                                                onClick={handleCopy}
                                                className={`btn btn-sm ${copied ? 'btn-success' : 'btn-outline-secondary'}`}
                                                style={{ padding: '2px 8px', fontSize: '0.8rem' }}
                                            >
                                                {copied ? (t.copiedBtn || "Copied!") : (t.copyBtn || "Copy")}
                                            </button>
                                        </>
                                    ) : (
                                        <div className="w-100 text-center">
                                            <button
                                                onClick={handleGenerateWallet}
                                                className="btn btn-sm btn-outline-info fw-bold w-100"
                                            >
                                                <i className="bi bi-tools me-2"></i>
                                                {t.generateWalletBtn || "Generate Wallet"}
                                            </button>
                                        </div>
                                    )}
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