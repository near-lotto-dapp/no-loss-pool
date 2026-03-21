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
        if (typeof window !== 'undefined') return (localStorage.getItem('lang') as Language) || 'en';
        return 'en';
    });

    const [user, setUser] = useState<any>(null);
    const [loadingSession, setLoadingSession] = useState(true);

    // wallet
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [loadingWallet, setLoadingWallet] = useState(false);
    const [balance, setBalance] = useState<string | null>(null);
    const [loadingBalance, setLoadingBalance] = useState(false);
    const [showDeposit, setShowDeposit] = useState(false);
    const [copied, setCopied] = useState(false);

    // 2FA
    const [mfaStatus, setMfaStatus] = useState<'loading' | 'needs_setup' | 'needs_challenge' | 'verified'>('loading');
    const [mfaSetupData, setMfaSetupData] = useState<{ factorId: string, qrCode: string } | null>(null);
    const [mfaCode, setMfaCode] = useState('');
    const [factorId, setFactorId] = useState('');
    const [loadingMfa, setLoadingMfa] = useState(false);
    const [mfaError, setMfaError] = useState<string | null>(null);

    const t = translations[lang];

    useEffect(() => { localStorage.setItem('lang', lang); }, [lang]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoadingSession(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setLoadingSession(false);
        });
        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        const checkMfa = async () => {
            if (!user) return;

            setMfaStatus('loading');

            try {
                const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
                if (factorsError) throw factorsError;

                const verifiedFactor = factors?.totp?.find(f => (f.status as string) === 'verified');
                const unverifiedFactors = factors?.totp?.filter(f => (f.status as string) === 'unverified') || [];

                if (!verifiedFactor) {
                    setMfaStatus('needs_setup');

                    for (const factor of unverifiedFactors) {
                        await supabase.auth.mfa.unenroll({ factorId: factor.id });
                    }

                    await new Promise(res => setTimeout(res, 500));

                    const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
                        factorType: 'totp',
                        friendlyName: `JOMO-${Date.now()}`
                    });

                    if (enrollError) throw enrollError;

                    if (enrollData) {
                        setMfaSetupData({ factorId: enrollData.id, qrCode: enrollData.totp.qr_code });
                    }
                } else {
                    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
                    if (aal?.currentLevel === 'aal1') {
                        setFactorId(verifiedFactor.id);
                        setMfaStatus('needs_challenge');
                    } else {
                        setMfaStatus('verified');
                        fetchWalletAndBalance();
                    }
                }
            } catch (error: any) {
                setMfaError(error.message);
                setMfaStatus('needs_setup');
            }
        };

        checkMfa();
    }, [user]);

    //  2FA
    const handleMfaSetupVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mfaSetupData) return;
        setLoadingMfa(true); setMfaError(null);
        try {
            const challenge = await supabase.auth.mfa.challenge({ factorId: mfaSetupData.factorId });
            if (challenge.error) throw challenge.error;

            const verify = await supabase.auth.mfa.verify({
                factorId: mfaSetupData.factorId, challengeId: challenge.data.id, code: mfaCode
            });
            if (verify.error) throw verify.error;

            setMfaStatus('verified');
            setMfaCode('');
            fetchWalletAndBalance();
        } catch (err) { setMfaError(t.mfaError || "Invalid code. Try again."); } finally { setLoadingMfa(false); }
    };

    const handleMfaChallengeVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoadingMfa(true); setMfaError(null);
        try {
            const challenge = await supabase.auth.mfa.challenge({ factorId });
            if (challenge.error) throw challenge.error;

            const verify = await supabase.auth.mfa.verify({
                factorId, challengeId: challenge.data.id, code: mfaCode
            });
            if (verify.error) throw verify.error;

            setMfaStatus('verified');
            setMfaCode('');
            fetchWalletAndBalance();
        } catch (err) { setMfaError(t.mfaError || "Invalid code. Try again."); } finally { setLoadingMfa(false); }
    };

    // wallet and balance
    const fetchBalance = async (accountId: string, isSilent = false) => {
        if (!isSilent) setLoadingBalance(true);
        try {
            const res = await fetch(import.meta.env.VITE_NEAR_URL, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jsonrpc: "2.0", id: "dontcare", method: "query", params: { request_type: "view_account", finality: "optimistic", account_id: accountId } })
            });
            const data = await res.json();
            setBalance(data.result?.amount ? (Number(data.result.amount) / 1e24).toFixed(4) : "0.0000");
        } catch (err) { setBalance("0.00"); } finally { if (!isSilent) setLoadingBalance(false); }
    };

    const fetchWalletAndBalance = async () => {
        if (!user) return;
        setLoadingWallet(true);
        try {
            const { data } = await supabase.from('profiles').select('near_account_id').eq('id', user.id).single();
            if (data) {
                setWalletAddress(data.near_account_id);
                await fetchBalance(data.near_account_id);
            }
        } catch (err) { console.error(err); } finally { setLoadingWallet(false); }
    };

    useEffect(() => {
        let intervalId: NodeJS.Timeout;
        if (walletAddress && mfaStatus === 'verified') {
            intervalId = setInterval(() => { fetchBalance(walletAddress, true); }, 10000);
        }
        return () => { if (intervalId) clearInterval(intervalId); };
    }, [walletAddress, mfaStatus]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setMfaStatus('loading');
        setWalletAddress(null);
        setBalance(null);
        setMfaError(null);
        setMfaSetupData(null);
    };

    // --- UI ---
    return (
        <>
            <main className="container position-relative mt-0 mb-4" style={{ minHeight: '70vh' }}>
                <div className="d-flex justify-content-end align-items-center gap-2 mb-4">
                    <LanguageSwitcher lang={lang} setLang={setLang}/>
                </div>

                <div className="row justify-content-center">
                    {loadingSession ? (
                        <div className="spinner-border text-info" role="status"></div>
                    ) : !user ? (
                        <AuthForm t={t} />
                    ) : (
                        <div className={`${styles.card} ${styles.stakingCard} text-center d-flex flex-column align-items-center`} style={{ maxWidth: '450px', width: '100%' }}>
                            <h3 className="text-white mb-2 w-100 text-center">{t.welcomeUser || "Welcome to your account"}</h3>

                            <p className="text-light mb-4 w-100 text-center" style={{ fontSize: '1rem', fontWeight: '500' }}>
                                {user.email}
                            </p>

                            {/* Spinner 2FA */}
                            {mfaStatus === 'loading' && (
                                <div className="py-4 w-100 text-center">
                                    <div className="spinner-border text-info" role="status"></div>
                                    <p className="text-white-50 mt-3 small text-center w-100">Verifying security status...</p>
                                </div>
                            )}

                            {/* Setup 2FA (QR code) */}
                            {mfaStatus === 'needs_setup' && (
                                <div className="p-4 bg-dark rounded mb-4 border border-warning w-100 animate__animated animate__fadeIn">
                                    <h5 className="text-warning mb-3 d-flex justify-content-center align-items-center">
                                        <i className="bi bi-shield-exclamation me-2"></i>{t.setupRequired || "Setup Required"}
                                    </h5>
                                    <p className="text-white-50 small mb-4 text-center mx-auto" style={{ maxWidth: '300px' }}>
                                        {t.setup2faDesc || "Enable 2FA to access your wallet. Scan this QR code with your authenticator app."}
                                    </p>

                                    {mfaSetupData ? (
                                        <div className="d-flex flex-column align-items-center w-100">
                                            <div className="bg-white p-3 rounded mb-4 shadow-sm d-inline-block">
                                                <div
                                                    style={{ display: 'block', lineHeight: 0 }}
                                                    dangerouslySetInnerHTML={{ __html: mfaSetupData.qrCode }}
                                                />
                                            </div>

                                            <form onSubmit={handleMfaSetupVerify} className="w-100 d-flex flex-column gap-3 align-items-center">
                                                <div className="w-100 text-center">
                                                    <label className="text-white-50 small mb-2 d-block text-center">{t.verificationCode || "Verification Code"}</label>
                                                    <input
                                                        type="text"
                                                        required
                                                        maxLength={6}
                                                        value={mfaCode}
                                                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                                                        className="form-control form-control-lg bg-black text-white border-secondary text-center fw-bold mx-auto"
                                                        placeholder="000000"
                                                        style={{
                                                            letterSpacing: '0.6rem',
                                                            width: '220px',
                                                            fontSize: '1.6rem',
                                                            paddingLeft: '1.2rem'
                                                        }}
                                                    />
                                                </div>

                                                {mfaError && <div className="alert alert-danger py-2 m-0 small w-100 text-center">{mfaError}</div>}

                                                <button
                                                    type="submit"
                                                    disabled={loadingMfa || mfaCode.length < 6}
                                                    className="btn btn-warning w-100 fw-bold mt-2"
                                                    style={{ height: '50px' }}
                                                >
                                                    {loadingMfa ? <span className="spinner-border spinner-border-sm"></span> : (t.verifyAndEnable || "Verify & Enable")}
                                                </button>
                                            </form>
                                        </div>
                                    ) : (
                                        <div className="py-5 text-center">
                                            <div className="spinner-border text-warning" role="status"></div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Login 2FA code */}
                            {mfaStatus === 'needs_challenge' && (
                                <div className="p-4 bg-dark rounded mb-4 border border-info w-100 animate__animated animate__fadeIn">
                                    <h5 className="text-info mb-3 d-flex justify-content-center align-items-center"><i className="bi bi-shield-lock me-2"></i>{t.enter2faCode || "Enter 2FA Code"}</h5>
                                    <p className="text-white-50 small mb-4 text-center mx-auto" style={{ maxWidth: '300px' }}>{t.enter2faDesc || "Open Google Authenticator and enter your 6-digit code."}</p>

                                    <form onSubmit={handleMfaChallengeVerify} className="d-flex flex-column align-items-center gap-3 w-100">
                                        <input type="text" required maxLength={6} value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))} className="form-control form-control-lg bg-black text-white border-secondary text-center fw-bold mx-auto" placeholder="000000" style={{ letterSpacing: '0.5rem', width: '180px', fontSize: '1.5rem' }} />
                                        {mfaError && <div className="alert alert-danger py-2 m-0 small w-100 text-center">{mfaError}</div>}
                                        <button type="submit" disabled={loadingMfa || mfaCode.length < 6} className="btn btn-info w-100 fw-bold">
                                            {loadingMfa ? <span className="spinner-border spinner-border-sm"></span> : (t.verifyBtn || "Verify")}
                                        </button>
                                    </form>
                                </div>
                            )}

                            {/* Access to wallet */}
                            {mfaStatus === 'verified' && (
                                <div className="p-4 bg-dark rounded mb-4 border border-secondary text-start position-relative w-100 animate__animated animate__fadeIn">
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                        <small className="text-white-50">{t.balance || "Balance:"}</small>
                                        <span className="badge bg-dark border border-secondary text-white-50 d-flex align-items-center" style={{ fontSize: '0.7rem' }}>
                                        <span className="spinner-grow spinner-grow-sm text-success me-1" style={{ width: '6px', height: '6px' }}></span> Live
                                    </span>
                                    </div>

                                    <div className="mb-4">
                                        {loadingBalance && !balance ? (
                                            <div className="spinner-border spinner-border-sm text-info mt-2" role="status"></div>
                                        ) : (
                                            <h2 className="text-white m-0 fw-bold animate__animated animate__fadeIn">
                                                {balance !== null ? parseFloat(balance).toFixed(4) : "0.0000"} <span className="text-info fs-4">NEAR</span>
                                            </h2>
                                        )}
                                    </div>

                                    <small className="text-white-50 d-block mb-2">{t.yourWallet || "Your NEAR Wallet:"}</small>
                                    <div className="d-flex justify-content-between align-items-center bg-black p-2 rounded border border-dark mb-3" style={{ minHeight: '42px' }}>
                                        {loadingWallet ? (
                                            <span className="spinner-border spinner-border-sm text-info mx-auto"></span>
                                        ) : walletAddress ? (
                                            <>
                                            <span className="text-info fw-bold font-monospace" style={{ fontSize: '0.9rem' }}>
                                                {walletAddress.slice(0, 10)}...{walletAddress.slice(-10)}
                                            </span>
                                                <button onClick={() => { navigator.clipboard.writeText(walletAddress); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className={`btn btn-sm ${copied ? 'btn-success' : 'btn-outline-secondary'}`}>
                                                    {copied ? "Copied!" : "Copy"}
                                                </button>
                                            </>
                                        ) : (
                                            <span className="text-warning small mx-auto">Wallet error</span>
                                        )}
                                    </div>

                                    {walletAddress && (
                                        <button onClick={() => setShowDeposit(!showDeposit)} className={`btn w-100 fw-bold ${showDeposit ? 'btn-secondary' : 'btn-info'}`}>
                                            <i className="bi bi-qr-code me-2"></i>{t.depositBtn || "Deposit"}
                                        </button>
                                    )}

                                    {showDeposit && walletAddress && (
                                        <div className="mt-3 p-3 bg-black rounded border border-secondary animate__animated animate__fadeIn d-flex flex-column align-items-center">
                                            <p className="text-white-50 small mb-3 text-center w-100">
                                                {t.scanToDeposit || "Scan to deposit NEAR"}
                                            </p>

                                            <div className="bg-white p-2 d-inline-block rounded mb-2">
                                                <QRCode value={walletAddress} size={150} level="M" />
                                            </div>

                                            <p className="text-warning small m-0 mt-2 text-center w-100 mx-auto" style={{ maxWidth: '250px' }}>
                                                ⚠️ {t.nearAlert || "Send only NEAR Protocol tokens to this address."}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <button onClick={handleLogout} className="btn btn-outline-danger w-100 fw-bold mt-2">
                                <i className="bi bi-box-arrow-right me-2"></i> {t.logoutBtn || "Log Out"}
                            </button>
                        </div>
                    )}
                </div>
            </main>
            <Footer t={t}/>
        </>
    );
}