import { useState, useEffect } from 'react';
import { Footer } from '@/components/footer';
import { LanguageSwitcher } from '@/components/language_switcher';
import { AuthForm } from '@/components/auth_form';
import { supabase } from '@/utils/supabaseClient';
import QRCode from 'react-qr-code';
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

    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [loadingWallet, setLoadingWallet] = useState(false);
    const [copied, setCopied] = useState(false);

    // НОВІ СТАНИ ДЛЯ БАЛАНСУ ТА ПОПОВНЕННЯ
    const [balance, setBalance] = useState<string | null>(null);
    const [loadingBalance, setLoadingBalance] = useState(false);
    const [showDeposit, setShowDeposit] = useState(false);

    const t = translations[lang];

    useEffect(() => {
        localStorage.setItem('lang', lang);
    }, [lang]);

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

    const fetchBalance = async (accountId: string, isSilent = false) => {
        if (!isSilent) setLoadingBalance(true);
        try {
            const response = await fetch(import.meta.env.VITE_NEAR_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: "dontcare",
                    method: "query",
                    params: {
                        request_type: "view_account",
                        finality: "optimistic",
                        account_id: accountId
                    }
                })
            });
            const data = await response.json();

            if (data.result?.amount) {
                const nearBalance = (Number(data.result.amount) / 1e24).toFixed(2);
                setBalance(nearBalance);
            } else {
                setBalance("0.00");
            }
        } catch (error) {
            console.error("Error fetching balance:", error);
            if (!balance) setBalance("0.00");
        } finally {
            if (!isSilent) setLoadingBalance(false);
        }
    };

    useEffect(() => {
        const fetchWalletAndBalance = async () => {
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
                        await fetchBalance(data.near_account_id);
                    }
                } catch (err) {
                    console.error("Error fetching wallet:", err);
                } finally {
                    setLoadingWallet(false);
                }
            } else {
                setWalletAddress(null);
                setBalance(null);
            }
        };

        fetchWalletAndBalance();
    }, [user]);

    useEffect(() => {
        let intervalId: NodeJS.Timeout;

        if (walletAddress) {
            intervalId = setInterval(() => {
                fetchBalance(walletAddress, true);
            }, 10000);
        }

        return () => {
            if (intervalId) clearInterval(intervalId);
        };
    }, [walletAddress]);

    const handleGenerateWallet = async () => {
        if (!user) return;
        setLoadingWallet(true);
        try {
            const response = await fetch('/api/auth/setup-wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id, email: user.email })
            });
            const data = await response.json();
            if (response.ok && data.wallet?.accountId) {
                setWalletAddress(data.wallet.accountId);
                await fetchBalance(data.wallet.accountId);
            } else {
                alert(t.generationError || "Failed to generate wallet.");
            }
        } catch (err) {
            alert(t.generationError || "Network error.");
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
        if (address.length > 15) {
            return `${address.slice(0, 6)}...${address.slice(-6)}`;
        }
        return address;
    };

    return (
        <>

            <main className="container position-relative mt-0 mb-4" style={{ minHeight: '70vh' }}>
                <div className="w-100 d-flex justify-content-end align-items-center gap-2 mb-3 mt-sm-0 mt-3">
                    <LanguageSwitcher lang={lang} setLang={setLang}/>
                </div>

                <div className="d-flex justify-content-center align-items-center w-100 mt-5">
                    {loadingSession ? (
                        <div className="spinner-border text-info" role="status"></div>
                    ) : user ? (
                        <div className={`${styles.card} ${styles.stakingCard} text-center`} style={{ maxWidth: '450px', width: '100%' }}>
                            <h3 className="text-white mb-2">{t.welcomeUser || "Welcome!"}</h3>
                            <p className="text-white-50 mb-4">{user.email}</p>

                            {/* Balance */}
                            <div className="p-4 bg-dark rounded mb-4 border border-secondary text-start position-relative">

                                <div className="d-flex justify-content-between align-items-center mb-1">
                                    <small className="text-white-50">{t.balance || "Balance:"}</small>

                                    {walletAddress && (
                                        <span className="badge bg-dark border border-secondary text-white-50 d-flex align-items-center" style={{ fontSize: '0.7rem' }}>
                                            <span className="spinner-grow spinner-grow-sm text-success me-1" style={{ width: '6px', height: '6px' }}></span>
                                            Live
                                        </span>
                                    )}
                                </div>

                                <div className="mb-4">
                                    {loadingBalance && !balance ? (
                                        <div className="spinner-border spinner-border-sm text-info mt-2" role="status"></div>
                                    ) : (
                                        <h2 className="text-white m-0 fw-bold animate__animated animate__fadeIn">
                                            {balance !== null ? balance : "0.00"} <span className="text-info fs-4">NEAR</span>
                                        </h2>
                                    )}
                                </div>

                                <small className="text-white-50 d-block mb-2">{t.yourWallet || "Your NEAR Wallet:"}</small>
                                <div className="d-flex justify-content-between align-items-center bg-black p-2 rounded border border-dark mb-3" style={{ minHeight: '42px' }}>
                                    {loadingWallet ? (
                                        <span className="spinner-border spinner-border-sm text-info mx-auto" role="status"></span>
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
                                        <button onClick={handleGenerateWallet} className="btn btn-sm btn-outline-info fw-bold w-100">
                                            <i className="bi bi-tools me-2"></i>{t.generateWalletBtn || "Generate Wallet"}
                                        </button>
                                    )}
                                </div>

                                {/* DEPOSIT */}
                                {walletAddress && (
                                    <button
                                        onClick={() => setShowDeposit(!showDeposit)}
                                        className={`btn w-100 fw-bold ${showDeposit ? 'btn-secondary' : 'btn-info'}`}
                                    >
                                        <i className={`bi bi-qr-code me-2`}></i>
                                        {t.depositBtn || "Deposit"}
                                    </button>
                                )}

                                {/* QR */}
                                {showDeposit && walletAddress && (
                                    <div className="mt-3 p-3 bg-black rounded text-center border border-secondary animate__animated animate__fadeIn">
                                        <p className="text-white-50 small mb-3">{t.scanToDeposit || "Scan to deposit NEAR"}</p>
                                        <div className="bg-white p-2 d-inline-block rounded mb-2">
                                            <QRCode value={walletAddress} size={150} level="M" />
                                        </div>
                                        <p className="text-warning small m-0 mt-2">
                                            {t.nearAlert || "⚠️ Send only NEAR Protocol tokens to this address."}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <button onClick={handleLogout} className="btn btn-outline-danger w-100 fw-bold">
                                <i className="bi bi-box-arrow-right me-2"></i> {t.logoutBtn || "Log Out"}
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