import {useState, useEffect} from 'react';
import {Footer} from '@/components/footer';
import {AuthForm} from '@/components/auth_form';
import {supabase} from '@/utils/supabaseClient';
import styles from '@/styles/app.module.css';
import {WalletDashboard} from "@/contracts/wallet_dashboard.tsx";
import {usePageTitle} from "@/hooks/usePageTitle.ts";
import {useLanguage} from "@/hooks/useLanguage.ts";
import {TopNav} from "@/components/top_nav.tsx";

let memoryMfaCache: { factorId: string, qrCode: string, secret: string } | null = null;

const saveMfaCache = (userId: string, data: any) => {
    memoryMfaCache = data;
    const key = `mfa_setup_${userId}`;
    try {
        sessionStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
    }
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
    }
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
    } catch (e) {
    }
    return null;
};

const clearMfaCache = (userId: string) => {
    memoryMfaCache = null;
    const key = `mfa_setup_${userId}`;
    try {
        sessionStorage.removeItem(key);
    } catch (e) {
    }
    try {
        localStorage.removeItem(key);
    } catch (e) {
    }
};

export default function AuthPage() {
    const {lang, setLang, t} = useLanguage();
    usePageTitle(t.accountPageTitle);

    const [user, setUser] = useState<any>(null);
    const [loadingSession, setLoadingSession] = useState(true);
    const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
    const [mfaStatus, setMfaStatus] = useState<'loading' | 'needs_setup' | 'needs_challenge' | 'show_recovery_codes' | 'needs_recovery' | 'verified'>('loading');
    const [recoveryInput, setRecoveryInput] = useState('');
    const [mfaSetupData, setMfaSetupData] = useState<{ factorId: string, qrCode: string, secret: string } | null>(null);
    const [mfaCode, setMfaCode] = useState('');
    const [factorId, setFactorId] = useState('');
    const [loadingMfa, setLoadingMfa] = useState(false);
    const [mfaError, setMfaError] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({data: {session}}) => {
            setUser(session?.user ?? null);
            setLoadingSession(false);
        });

        const {data: {subscription}} = supabase.auth.onAuthStateChange((_event, session) => {
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
                const {data: factors, error: factorsError} = await supabase.auth.mfa.listFactors();
                if (factorsError) throw factorsError;

                const verifiedFactor = factors?.totp?.find(f => (f.status as string) === 'verified');

                if (verifiedFactor) {
                    const {data: aal} = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
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
                    setMfaSetupData({factorId: latestUnverified.id, qrCode: '', secret: ''});
                    return;
                }

                const {data: enrollData, error: enrollError} = await supabase.auth.mfa.enroll({
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

    const generateRecoveryCodes = () => {
        const codes = [];
        for (let i = 0; i < 10; i++) {
            const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
            const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
            codes.push(`${part1}-${part2}`);
        }
        return codes;
    };

    const handleMfaSetupVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mfaSetupData || !user?.id) return;
        setLoadingMfa(true);
        setMfaError(null);
        try {
            const challenge = await supabase.auth.mfa.challenge({factorId: mfaSetupData.factorId});
            if (challenge.error) throw challenge.error;

            const verify = await supabase.auth.mfa.verify({
                factorId: mfaSetupData.factorId, challengeId: challenge.data.id, code: mfaCode
            });
            if (verify.error) throw verify.error;

            const newCodes = generateRecoveryCodes();

            const codesToInsert = newCodes.map(code => ({
                user_id: user.id,
                code: code,
                is_used: false
            }));

            const {error: dbError} = await supabase
                .from('user_recovery_codes')
                .insert(codesToInsert);

            if (dbError) throw dbError;

            clearMfaCache(user.id);

            setRecoveryCodes(newCodes);
            setMfaStatus('show_recovery_codes');
            setMfaCode('');
        } catch (err) {
            setMfaError(t.mfaError);
        } finally {
            setLoadingMfa(false);
        }
    };

    const handleMfaChallengeVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoadingMfa(true);
        setMfaError(null);
        try {
            const challenge = await supabase.auth.mfa.challenge({factorId});
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

    const handleRecoverySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoadingMfa(true);
        setMfaError(null);

        try {
            const {error} = await supabase.rpc('recover_access_with_code', {
                entered_code: recoveryInput.trim()
            });

            if (error) throw error;

            if (user?.id) clearMfaCache(user.id);
            await supabase.auth.signOut();

            alert(t.recoverySuccessMsg);
            window.location.reload();

        } catch (err) {
            setMfaError(t.invalidRecoveryCode);
        } finally {
            setLoadingMfa(false);
        }
    };

    const handleGenerateNewQr = async () => {
        if (!user?.id) return;
        setLoadingMfa(true);
        setMfaError(null);
        try {
            const {data: factors} = await supabase.auth.mfa.listFactors();
            const unverified = factors?.totp?.filter(f => (f.status as string) === 'unverified') || [];
            for (const f of unverified) {
                await supabase.auth.mfa.unenroll({factorId: f.id});
            }
            await new Promise(res => setTimeout(res, 500));

            const {data: enrollData, error: enrollError} = await supabase.auth.mfa.enroll({
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

    const handleDownloadCodes = () => {
        if (!recoveryCodes) return;

        const text = `${t.recoveryFileHeader}\n\n${recoveryCodes.join('\n')}\n\n${t.recoveryFileFooter}`;

        const blob = new Blob([text], {type: 'text/plain'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'jomo-recovery-codes.txt';
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleCopyCodes = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!recoveryCodes) return;

        const text = `${t.recoveryFileHeader}\n\n${recoveryCodes.join('\n')}\n\n${t.recoveryFileFooter}`;

        navigator.clipboard.writeText(text);

        const btn = e.currentTarget;
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<i class="bi bi-check2-all"></i> ${t.copiedBtn}`;
        btn.classList.replace('btn-info', 'btn-success');

        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.classList.replace('btn-success', 'btn-info');
        }, 2500);
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
            <main className="container position-relative mt-0 mb-4" style={{minHeight: '70vh'}}>
                <TopNav
                    lang={lang}
                    setLang={setLang}
                    title={t.homeBtn}
                />

                <div className="row justify-content-center">
                    {loadingSession ? (
                        <div className="spinner-border text-info" role="status"></div>
                    ) : !user ? (
                        <AuthForm t={t}/>
                    ) : (
                        <div
                            className={`${styles.card} ${styles.stakingCard} text-center d-flex flex-column align-items-center`}
                            style={{maxWidth: '650px', width: '100%'}}>
                            <h3 className="text-white mb-2 w-100 text-center">{t.welcomeUser}</h3>
                            <p className="text-light mb-4 w-100 text-center"
                               style={{fontSize: '1rem', fontWeight: '500'}}>
                                {user.email}
                            </p>

                            {mfaStatus === 'loading' && (
                                <div className="py-4 w-100 text-center">
                                    <div className="spinner-border text-info" role="status"></div>
                                    <p className="text-white-50 mt-3 small text-center w-100">{t.securityStatus}</p>
                                </div>
                            )}

                            {mfaStatus === 'needs_setup' && (
                                <div
                                    className="p-4 bg-dark rounded mb-4 border border-warning w-100 animate__animated animate__fadeIn">
                                    <h5 className="text-warning mb-3 d-flex justify-content-center align-items-center">
                                        <i className="bi bi-shield-exclamation me-2"></i>{t.setupRequired}
                                    </h5>

                                    {mfaSetupData ? (
                                        <div className="d-flex flex-column align-items-center w-100">

                                            {mfaSetupData.qrCode ? (
                                                <>
                                                    <p className="text-white-50 small mb-4 text-center mx-auto"
                                                       style={{maxWidth: '300px'}}>
                                                        {t.setup2faDesc}
                                                    </p>
                                                    <div className="bg-white p-3 rounded mb-3 shadow-sm d-inline-block">
                                                        <div style={{display: 'block', lineHeight: 0}}
                                                             dangerouslySetInnerHTML={{__html: mfaSetupData.qrCode}}/>
                                                    </div>

                                                    <div className="mb-4 text-center w-100">
                                                        <p className="text-white-50 small mb-2"
                                                           style={{fontSize: '0.8rem'}}>
                                                            {t.cantScanCode}
                                                        </p>
                                                        <div className="input-group input-group-sm mx-auto shadow-sm"
                                                             style={{maxWidth: '280px'}}>
                                                            <input
                                                                type="text"
                                                                className="form-control bg-black text-info text-center font-monospace border-secondary"
                                                                value={mfaSetupData.secret}
                                                                readOnly
                                                                style={{letterSpacing: '2px', fontSize: '0.9rem'}}
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
                                                <div
                                                    className="alert alert-info py-3 mb-4 text-start small border border-info"
                                                    style={{backgroundColor: 'rgba(13, 202, 240, 0.1)'}}>
                                                    <i className="bi bi-info-circle-fill me-2 fs-5 float-start"></i>
                                                    <span style={{display: 'block', paddingLeft: '30px'}}>
                                                        {t.pageRefreshedMsg}
                                                    </span>
                                                </div>
                                            )}

                                            <form onSubmit={handleMfaSetupVerify}
                                                  className="w-100 d-flex flex-column gap-3 align-items-center">
                                                <div className="w-100 text-center">
                                                    <label
                                                        className="text-white-50 small mb-2 d-block text-center">{t.verificationCode}</label>
                                                    <input
                                                        type="text" required maxLength={6} value={mfaCode}
                                                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                                                        className="form-control form-control-lg bg-black text-white border-secondary text-center fw-bold mx-auto"
                                                        placeholder="000000" style={{
                                                        letterSpacing: '0.6rem',
                                                        width: '220px',
                                                        fontSize: '1.6rem',
                                                        paddingLeft: '1.2rem'
                                                    }}
                                                    />
                                                </div>
                                                {mfaError && <div
                                                    className="alert alert-danger py-2 m-0 small w-100 text-center">{mfaError}</div>}
                                                <button type="submit" disabled={loadingMfa || mfaCode.length < 6}
                                                        className="btn btn-warning w-100 fw-bold mt-2"
                                                        style={{height: '50px'}}>
                                                    {loadingMfa ? <span
                                                        className="spinner-border spinner-border-sm"></span> : (t.verifyAndEnable)}
                                                </button>

                                                <div
                                                    className="pt-3 w-100 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={handleGenerateNewQr}
                                                        className="btn btn-link text-info small text-decoration-none d-inline-flex align-items-center gap-1 py-1 px-2"
                                                    >
                                                        <i className="bi bi-arrow-repeat"></i>
                                                        <span>
                                                              {mfaSetupData.qrCode
                                                                  ? (t.restartSetup)
                                                                  : (t.generateNewQr)}
                                                        </span>
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    ) : (
                                        <div className="py-5 text-center">
                                            <div className="spinner-border text-warning" role="status"></div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {mfaStatus === 'needs_challenge' && (
                                <div
                                    className="p-4 bg-dark rounded mb-4 border border-info w-100 animate__animated animate__fadeIn">
                                    <h5 className="text-info mb-3 d-flex justify-content-center align-items-center"><i
                                        className="bi bi-shield-lock me-2"></i>{t.enter2faCode}</h5>
                                    <p className="text-white-50 small mb-4 text-center mx-auto"
                                       style={{maxWidth: '300px'}}>{t.enter2faDesc}</p>

                                    <form onSubmit={handleMfaChallengeVerify}
                                          className="d-flex flex-column align-items-center gap-3 w-100">
                                        <input
                                            type="text" required maxLength={6} value={mfaCode}
                                            onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))}
                                            className="form-control form-control-lg bg-black text-white border-secondary text-center fw-bold mx-auto"
                                            placeholder="000000"
                                            style={{letterSpacing: '0.5rem', width: '180px', fontSize: '1.5rem'}}
                                        />
                                        {mfaError && <div
                                            className="alert alert-danger py-2 m-0 small w-100 text-center">{mfaError}</div>}
                                        <button type="submit" disabled={loadingMfa || mfaCode.length < 6}
                                                className="btn btn-info w-100 fw-bold">
                                            {loadingMfa ? <span
                                                className="spinner-border spinner-border-sm"></span> : (t.verifyBtn)}
                                        </button>
                                        <div className="pt-2 w-100 text-center">
                                            <button
                                                type="button"
                                                onClick={() => { setMfaStatus('needs_recovery'); setMfaError(null); }}
                                                className="btn btn-link text-light small text-decoration-none hover-underline d-inline-flex align-items-center gap-1 py-1 px-2"
                                                style={{ opacity: 0.8 }}
                                            >
                                                <i className="bi bi-life-preserver"></i>
                                                <span>{t.lostAuthenticatorBtn}</span>
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* saving reserve codes */}
                            {mfaStatus === 'show_recovery_codes' && recoveryCodes && (
                                <div
                                    className="p-4 bg-dark rounded mb-4 border border-success w-100 animate__animated animate__fadeIn">
                                    <h5 className="text-success mb-3 d-flex justify-content-center align-items-center">
                                        <i className="bi bi-shield-check me-2"></i>{t.recoveryCodesTitle}
                                    </h5>

                                    <div className="alert alert-warning py-2 small text-start mb-3">
                                        <strong>⚠️ {t.crucialStep}:</strong> {t.recoveryWarning}
                                    </div>

                                    <div className="alert py-2 small text-start mb-4" style={{
                                        backgroundColor: 'rgba(13, 202, 240, 0.05)',
                                        borderColor: 'rgba(13, 202, 240, 0.2)',
                                        color: '#a5e8f3'
                                    }}>
                                        <i className="bi bi-info-circle-fill text-info me-2 float-start mt-1"></i>
                                        <div style={{marginLeft: '25px'}}>
                                            <strong className="text-info">{t.securityTipTitle}</strong> <span
                                            style={{opacity: 0.9}}>{t.securityTipDesc}</span>
                                        </div>
                                    </div>

                                    <div
                                        className="bg-black p-3 rounded mb-4 font-monospace text-info text-center shadow-inner"
                                        style={{fontSize: '1.1rem', letterSpacing: '2px'}}>
                                        <div className="row">
                                            {recoveryCodes.map((c, i) => (
                                                <div key={i} className="col-6 mb-2">{c}</div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="d-flex flex-column gap-2 w-100 mb-4">

                                        <button
                                            onClick={handleCopyCodes}
                                            className="btn btn-info fw-bold d-flex justify-content-center align-items-center gap-2 py-2"
                                        >
                                            <i className="bi bi-copy"></i> {t.copyCodesBtn}
                                        </button>

                                        <button
                                            onClick={handleDownloadCodes}
                                            className="btn btn-outline-secondary d-flex justify-content-center align-items-center gap-2 py-2"
                                        >
                                            <i className="bi bi-download"></i> {t.downloadTxtBtn}
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => setMfaStatus('verified')}
                                        className="btn btn-success w-100 fw-bold py-3"
                                        style={{fontSize: '1.1rem'}}
                                    >
                                        {t.iSavedThemBtn} <i className="bi bi-arrow-right ms-1"></i>
                                    </button>
                                </div>
                            )}

                            {mfaStatus === 'needs_recovery' && (
                                <div
                                    className="p-4 bg-dark rounded mb-4 border border-danger w-100 animate__animated animate__fadeIn">
                                    <h5 className="text-danger mb-3 d-flex justify-content-center align-items-center">
                                        <i className="bi bi-life-preserver me-2"></i>{t.accountRecoveryTitle}
                                    </h5>
                                    <p className="text-white-50 small mb-4 text-center mx-auto"
                                       style={{maxWidth: '300px'}}>
                                        {t.enterRecoveryCodeDesc}
                                    </p>

                                    <form onSubmit={handleRecoverySubmit}
                                          className="d-flex flex-column align-items-center gap-3 w-100">
                                        <input
                                            type="text"
                                            required
                                            value={recoveryInput}
                                            onChange={(e) => setRecoveryInput(e.target.value.toUpperCase())}
                                            className="form-control form-control-lg bg-black text-danger border-secondary text-center fw-bold mx-auto font-monospace"
                                            placeholder="XXXX-XXXX"
                                            style={{letterSpacing: '0.2rem', width: '220px', fontSize: '1.2rem'}}
                                        />

                                        {mfaError && <div
                                            className="alert alert-danger py-2 m-0 small w-100 text-center">{mfaError}</div>}

                                        <button type="submit" disabled={loadingMfa || recoveryInput.length < 8}
                                                className="btn btn-danger w-100 fw-bold">
                                            {loadingMfa ? <span
                                                className="spinner-border spinner-border-sm"></span> : (t.disable2faBtn)}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMfaStatus('needs_challenge');
                                                setMfaError(null);
                                                setRecoveryInput('');
                                            }}
                                            className="btn btn-link text-white-50 small mt-2 p-0 text-decoration-none"
                                        >
                                            <i className="bi bi-arrow-left"></i> {t.backToLoginBtn}
                                        </button>
                                    </form>
                                </div>
                            )}

                            {mfaStatus === 'verified' && (
                                <WalletDashboard user={user} t={t} onLogout={handleLogout}/>
                            )}
                        </div>
                    )}
                </div>
            </main>
            <Footer t={t}/>
        </>
    );
}