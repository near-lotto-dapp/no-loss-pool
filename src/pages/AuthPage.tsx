import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Footer } from '@/components/footer';
import { LanguageSwitcher } from '@/components/language_switcher';
import { AuthForm } from '@/components/auth_form';
import { supabase } from '@/utils/supabaseClient';
import styles from '@/styles/app.module.css';
import { WalletDashboard } from "@/contracts/wallet_dashboard.tsx";
import {usePageTitle} from "@/hooks/usePageTitle.ts";
import {useLanguage} from "@/hooks/useLanguage.ts";

export default function AuthPage() {
    const { lang, setLang, t } = useLanguage();
    usePageTitle(t.accountPageTitle);

    const [user, setUser] = useState<any>(null);
    const [loadingSession, setLoadingSession] = useState(true);

    // 2FA
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

                    const savedDataStr = localStorage.getItem('mfa_setup_data');
                    let savedData = null;
                    if (savedDataStr) {
                        try { savedData = JSON.parse(savedDataStr); } catch (e) {}
                    }

                    const isSavedValid = savedData && unverifiedFactors.some(f => f.id === savedData.factorId);

                    if (isSavedValid) {
                        setMfaSetupData(savedData);
                    } else {
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
                            const newSetupData = {
                                factorId: enrollData.id,
                                qrCode: enrollData.totp.qr_code,
                                secret: enrollData.totp.secret
                            };
                            setMfaSetupData(newSetupData);
                            localStorage.setItem('mfa_setup_data', JSON.stringify(newSetupData));
                        }
                    }
                } else {
                    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
                    if (aal?.currentLevel === 'aal1') {
                        setFactorId(verifiedFactor.id);
                        setMfaStatus('needs_challenge');
                    } else {
                        setMfaStatus('verified');
                    }
                }
            } catch (error: any) {
                setMfaError(error.message);
                setMfaStatus('needs_setup');
            }
        };
        checkMfa();
    }, [user]);

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
            localStorage.removeItem('mfa_setup_data');
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
            setMfaError(t.mfaError || "Invalid code. Try again.");
        } finally {
            setLoadingMfa(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setMfaStatus('loading');
        setMfaError(null);
        setMfaSetupData(null);
    };

    return (
        <>
            <main className="container position-relative mt-0 mb-4" style={{ minHeight: '70vh' }}>
                <div className="w-100 d-flex justify-content-between align-items-center mb-4 pt-4">
                    <Link
                        to="/"
                        className="text-info text-decoration-none fw-bold fs-5 d-flex align-items-center gap-2"
                        style={{ transition: 'opacity 0.2s' }}
                        onMouseOver={(e) => (e.currentTarget.style.opacity = '0.8')}
                        onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
                    >
                        <i className="bi bi-arrow-left"></i> {t.homeBtn}
                    </Link>

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

                            {mfaStatus === 'loading' && (
                                <div className="py-4 w-100 text-center">
                                    <div className="spinner-border text-info" role="status"></div>
                                    <p className="text-white-50 mt-3 small text-center w-100">Verifying security status...</p>
                                </div>
                            )}

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
                                                        title={t.copyBtn || "Copy"}
                                                    >
                                                        <i className="bi bi-copy"></i>
                                                    </button>
                                                </div>
                                            </div>

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