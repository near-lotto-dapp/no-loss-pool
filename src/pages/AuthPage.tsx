import { useState, useEffect } from 'react';
import { Footer } from '@/components/footer';
import { AuthForm } from '@/components/auth_form';
import { supabase } from '@/utils/supabaseClient';
import styles from '@/styles/app.module.css';
import { WalletDashboard } from "@/contracts/wallet_dashboard.tsx";
import { usePageTitle } from "@/hooks/usePageTitle.ts";
import { useLanguage } from "@/hooks/useLanguage.ts";
import {TopNav} from "@/components/top_nav.tsx";

let memoryMfaCache: { factorId: string, qrCode: string, secret: string } | null = null;

const saveMfaCache = (userId: string, data: any) => {
    memoryMfaCache = data;
    const key = `mfa_setup_${userId}`;
    try { sessionStorage.setItem(key, JSON.stringify(data)); } catch(e) {}
    try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) {}
};

const getMfaCache = (userId: string) => {
    if (memoryMfaCache) return memoryMfaCache;
    const key = `mfa_setup_${userId}`;
    try {
        const s = sessionStorage.getItem(key) || localStorage.getItem(key);
        if (s) {
            const parsed = JSON.parse(s);
            memoryMfaCache = parsed;
            return parsed;
        }
    } catch(e) {}
    return null;
};

const clearMfaCache = (userId: string) => {
    memoryMfaCache = null;
    const key = `mfa_setup_${userId}`;
    try { sessionStorage.removeItem(key); } catch(e) {}
    try { localStorage.removeItem(key); } catch(e) {}
};

export default function AuthPage() {
    const { lang, setLang, t } = useLanguage();
    usePageTitle(t.accountPageTitle);

    const [user, setUser] = useState<any>(null);
    const [loadingSession, setLoadingSession] = useState(true);

    const [mfaStatus, setMfaStatus] = useState<'loading' | 'needs_setup' | 'needs_challenge' | 'verified'>('loading');
    const [mfaSetupData, setMfaSetupData] = useState<{ factorId: string, qrCode: string, secret: string } | null>(null);
    const [mfaCode, setMfaCode] = useState('');
    const [factorId, setFactorId] = useState('');
    const [loadingMfa, setLoadingMfa] = useState(false);
    const [mfaError, setMfaError] = useState<string | null>(null);

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
        if (!user?.id) return;

        const checkMfa = async () => {
            const cachedSetup = getMfaCache(user.id);
            if (cachedSetup && cachedSetup.secret) {
                setMfaSetupData(cachedSetup);
                setMfaStatus('needs_setup');
                return;
            }

            setMfaStatus('loading');
            try {
                const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
                if (factorsError) throw factorsError;

                const verifiedFactor = factors?.totp?.find(f => (f.status as string) === 'verified');

                if (verifiedFactor) {
                    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
                    if (aal?.currentLevel === 'aal1') {
                        setFactorId(verifiedFactor.id);
                        setMfaStatus('needs_challenge');
                    } else {
                        setMfaStatus('verified');
                    }
                    return;
                }

                setMfaStatus('needs_setup');

                const unverifiedFactors = factors?.totp?.filter(f => (f.status as string) === 'unverified') || [];

                if (unverifiedFactors.length > 0) {
                    const latestUnverified = unverifiedFactors[unverifiedFactors.length - 1];
                    setMfaSetupData({ factorId: latestUnverified.id, qrCode: '', secret: '' });
                    return;
                }

                const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
                    factorType: 'totp',
                    friendlyName: `JOMO-${Date.now()}`
                });

                if (enrollError) throw enrollError;

                if (enrollData) {
                    const newSetupData = {
                        factorId: enrollData.id,
                        qrCode: enrollData.totp.qr_code,
                        secret: enrollData.totp.secret
                    };
                    saveMfaCache(user.id, newSetupData);
                    setMfaSetupData(newSetupData);
                }

            } catch (error: any) {
                console.error("MFA Error:", error);
                setMfaError(error.message);
                setMfaStatus('needs_setup');
            }
        };

        checkMfa();
    }, [user?.id]);

    const handleMfaSetupVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mfaSetupData || !user?.id) return;
        setLoadingMfa(true); setMfaError(null);
        try {
            const challenge = await supabase.auth.mfa.challenge({ factorId: mfaSetupData.factorId });
            if (challenge.error) throw challenge.error;
            const verify = await supabase.auth.mfa.verify({
                factorId: mfaSetupData.factorId, challengeId: challenge.data.id, code: mfaCode
            });
            if (verify.error) throw verify.error;

            clearMfaCache(user.id);

            setMfaStatus('verified');
            setMfaCode('');
        } catch (err) {
            setMfaError(t.mfaError || "Invalid code. Try again.");
        } finally {
            setLoadingMfa(false);
        }
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
        } catch (err) {
            setMfaError(t.mfaError);
        } finally {
            setLoadingMfa(false);
        }
    };

    const handleGenerateNewQr = async () => {
        if (!user?.id) return;
        setLoadingMfa(true);
        setMfaError(null);
        try {
            const { data: factors } = await supabase.auth.mfa.listFactors();
            const unverified = factors?.totp?.filter(f => (f.status as string) === 'unverified') || [];
            for (const f of unverified) {
                await supabase.auth.mfa.unenroll({ factorId: f.id });
            }
            await new Promise(res => setTimeout(res, 500));

            const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
                factorType: 'totp',
                friendlyName: `JOMO-${Date.now()}`
            });
            if (enrollError) throw enrollError;

            if (enrollData) {
                const newSetupData = {
                    factorId: enrollData.id,
                    qrCode: enrollData.totp.qr_code,
                    secret: enrollData.totp.secret
                };
                saveMfaCache(user.id, newSetupData);
                setMfaSetupData(newSetupData);
            }
        } catch (err: any) {
            setMfaError(err.message);
        } finally {
            setLoadingMfa(false);
        }
    };

    const handleLogout = async () => {
        if (user?.id) clearMfaCache(user.id);
        await supabase.auth.signOut();
        setMfaStatus('loading');
        setMfaError(null);
        setMfaSetupData(null);
    };

    return (
        <>
            <main className="container position-relative mt-0 mb-4" style={{ minHeight: '70vh' }}>
                <TopNav
                    lang={lang}
                    setLang={setLang}
                    title={t.homeBtn}
                />

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

                            {mfaStatus === 'loading' && (
                                <div className="py-4 w-100 text-center">
                                    <div className="spinner-border text-info" role="status"></div>
                                    <p className="text-white-50 mt-3 small text-center w-100">{t.securityStatus}</p>
                                </div>
                            )}

                            {mfaStatus === 'needs_setup' && (
                                <div className="p-4 bg-dark rounded mb-4 border border-warning w-100 animate__animated animate__fadeIn">
                                    <h5 className="text-warning mb-3 d-flex justify-content-center align-items-center">
                                        <i className="bi bi-shield-exclamation me-2"></i>{t.setupRequired || "Setup Required"}
                                    </h5>

                                    {mfaSetupData ? (
                                        <div className="d-flex flex-column align-items-center w-100">

                                            {mfaSetupData.qrCode ? (
                                                <>
                                                    <p className="text-white-50 small mb-4 text-center mx-auto" style={{ maxWidth: '300px' }}>
                                                        {t.setup2faDesc || "Enable 2FA to access your wallet. Scan this QR code with your authenticator app."}
                                                    </p>
                                                    <div className="bg-white p-3 rounded mb-3 shadow-sm d-inline-block">
                                                        <div style={{ display: 'block', lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: mfaSetupData.qrCode }} />
                                                    </div>

                                                    <div className="mb-4 text-center w-100">
                                                        <p className="text-white-50 small mb-2" style={{ fontSize: '0.8rem' }}>
                                                            {t.cantScanCode || "Can't scan? Copy this setup key: "}
                                                        </p>
                                                        <div className="input-group input-group-sm mx-auto shadow-sm" style={{ maxWidth: '280px' }}>
                                                            <input
                                                                type="text"
                                                                className="form-control bg-black text-info text-center font-monospace border-secondary"
                                                                value={mfaSetupData.secret}
                                                                readOnly
                                                                style={{ letterSpacing: '2px', fontSize: '0.9rem' }}
                                                            />
                                                            <button
                                                                className="btn btn-outline-secondary"
                                                                type="button"
                                                                onClick={(e) => {
                                                                    navigator.clipboard.writeText(mfaSetupData.secret);
                                                                    const icon = e.currentTarget.querySelector('i');
                                                                    if (icon) {
                                                                        icon.className = "bi bi-check2 text-success";
                                                                        setTimeout(() => icon.className = "bi bi-copy", 2000);
                                                                    }
                                                                }}
                                                            >
                                                                <i className="bi bi-copy"></i>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="alert alert-info py-3 mb-4 text-start small border border-info" style={{ backgroundColor: 'rgba(13, 202, 240, 0.1)' }}>
                                                    <i className="bi bi-info-circle-fill me-2 fs-5 float-start"></i>
                                                    <span style={{ display: 'block', paddingLeft: '30px' }}>
                                                        {t.pageRefreshedMsg || "Page refreshed. If you already copied the code to your Authenticator, just enter the 6 digits below to finish."}
                                                    </span>
                                                </div>
                                            )}

                                            <form onSubmit={handleMfaSetupVerify} className="w-100 d-flex flex-column gap-3 align-items-center">
                                                <div className="w-100 text-center">
                                                    <label className="text-white-50 small mb-2 d-block text-center">{t.verificationCode || "Verification Code"}</label>
                                                    <input
                                                        type="text" required maxLength={6} value={mfaCode}
                                                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                                                        className="form-control form-control-lg bg-black text-white border-secondary text-center fw-bold mx-auto"
                                                        placeholder="000000" style={{ letterSpacing: '0.6rem', width: '220px', fontSize: '1.6rem', paddingLeft: '1.2rem' }}
                                                    />
                                                </div>
                                                {mfaError && <div className="alert alert-danger py-2 m-0 small w-100 text-center">{mfaError}</div>}
                                                <button type="submit" disabled={loadingMfa || mfaCode.length < 6} className="btn btn-warning w-100 fw-bold mt-2" style={{ height: '50px' }}>
                                                    {loadingMfa ? <span className="spinner-border spinner-border-sm"></span> : (t.verifyAndEnable || "Verify & Enable")}
                                                </button>

                                                <button type="button" onClick={handleGenerateNewQr} className="btn btn-link text-white-50 small mt-2 p-0 text-decoration-none">
                                                    {mfaSetupData.qrCode
                                                        ? (t.restartSetup || "Restart setup")
                                                        : (t.generateNewQr || "I didn't copy it. Generate a new code")}
                                                </button>
                                            </form>
                                        </div>
                                    ) : (
                                        <div className="py-5 text-center"><div className="spinner-border text-warning" role="status"></div></div>
                                    )}
                                </div>
                            )}

                            {mfaStatus === 'needs_challenge' && (
                                <div className="p-4 bg-dark rounded mb-4 border border-info w-100 animate__animated animate__fadeIn">
                                    <h5 className="text-info mb-3 d-flex justify-content-center align-items-center"><i className="bi bi-shield-lock me-2"></i>{t.enter2faCode || "Enter 2FA Code"}</h5>
                                    <p className="text-white-50 small mb-4 text-center mx-auto" style={{ maxWidth: '300px' }}>{t.enter2faDesc || "Open Google Authenticator and enter your 6-digit code."}</p>

                                    <form onSubmit={handleMfaChallengeVerify} className="d-flex flex-column align-items-center gap-3 w-100">
                                        <input
                                            type="text" required maxLength={6} value={mfaCode}
                                            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                                            className="form-control form-control-lg bg-black text-white border-secondary text-center fw-bold mx-auto"
                                            placeholder="000000" style={{ letterSpacing: '0.5rem', width: '180px', fontSize: '1.5rem' }}
                                        />
                                        {mfaError && <div className="alert alert-danger py-2 m-0 small w-100 text-center">{mfaError}</div>}
                                        <button type="submit" disabled={loadingMfa || mfaCode.length < 6} className="btn btn-info w-100 fw-bold">
                                            {loadingMfa ? <span className="spinner-border spinner-border-sm"></span> : (t.verifyBtn || "Verify")}
                                        </button>
                                    </form>
                                </div>
                            )}

                            {mfaStatus === 'verified' && (
                                <WalletDashboard user={user} t={t} onLogout={handleLogout} />
                            )}
                        </div>
                    )}
                </div>
            </main>
            <Footer t={t}/>
        </>
    );
}