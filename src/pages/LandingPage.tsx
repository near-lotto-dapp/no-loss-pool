import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from "@/utils/supabaseClient.ts";
import { usePageTitle } from "@/hooks/usePageTitle.ts";
import { useLanguage } from "@/hooks/useLanguage.ts";
import { TopNav } from "@/components/TopNav.tsx";
import { FooterWallet } from "@/components/FooterWallet.tsx";
import { NearPriceChart } from "@/components/NearPriceChart.tsx";
import { APY_VALUE } from "@/utils/constants.ts";

export default function LandingPage() {
    const { lang, setLang, t } = useLanguage();
    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    usePageTitle(t('homePageTitle'));

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <div className="container position-relative mt-0 mb-4" style={{ minHeight: '70vh' }}>
            <TopNav
                lang={lang}
                setLang={setLang}
                title={user ? user.email : t('enterCabinetBtn')}
                to={user ? "/wallet" : "/auth"}
                icon="bi-person-circle"
            />

            <main className="flex-grow-1 animate__animated animate__fadeIn">

                {/* --- TOP BLOCK --- */}
                <header className="container py-5 mb-3">
                    <div className="row align-items-center">

                        <div className="col-lg-6 text-center text-lg-start mb-5 mb-lg-0">
                            <h1 className="display-4 fw-bold text-white mb-3" dangerouslySetInnerHTML={{ __html: t('landingHeroTitle') }}></h1>
                            <p className="lead mb-4 text-white-50 mx-auto mx-lg-0" style={{ maxWidth: '500px' }}>
                                {t('landingSubtitle')}
                            </p>

                            <div style={{ minHeight: '60px' }} className="d-flex justify-content-center justify-content-lg-start align-items-center mt-2">
                                {isLoading ? (
                                    <div className="spinner-border text-info opacity-50" role="status"></div>
                                ) : (
                                    <Link to={user ? "/wallet" : "/auth"} className="btn btn-info btn-lg fw-bold px-5 rounded-pill shadow animate__animated animate__fadeIn">
                                        {user ? t('enterCabinetBtn') : t('startEarningBtn')}
                                    </Link>
                                )}
                            </div>
                        </div>

                        <div className="col-lg-6 text-center d-none d-lg-block">
                            <div className="position-relative d-inline-block animate__animated animate__zoomIn animate__slow">

                                <div className="position-absolute top-50 start-50 translate-middle rounded-circle"
                                     style={{ width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(13,202,240,0.15) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(20px)' }}>
                                </div>

                                <div className="position-relative" style={{ zIndex: 2 }}>
                                    <i className="bi bi-safe-fill text-dark" style={{
                                        fontSize: '14rem',
                                        filter: 'drop-shadow(0 0 15px rgba(13,202,240,0.6))',
                                        WebkitTextStroke: '2px #0dcaf0'
                                    }}></i>

                                    <div className="position-absolute top-50 start-50 translate-middle" style={{ marginTop: '10px' }}>
                                        <i className="bi bi-shield-check text-info" style={{ fontSize: '4.5rem', textShadow: '0 0 20px #0dcaf0' }}></i>
                                    </div>
                                </div>

                                <div className="position-absolute top-0 start-0 translate-middle animate__animated animate__pulse animate__infinite animate__slower">
                                    <i className="bi bi-stars text-warning" style={{ fontSize: '2.5rem', filter: 'drop-shadow(0 0 15px rgba(255,193,7,0.8))' }}></i>
                                </div>

                                <div className="position-absolute bottom-0 end-0 translate-middle animate__animated animate__pulse animate__infinite animate__slower" style={{ animationDelay: '1s' }}>
                                    <span className="badge bg-dark border border-info text-info fs-6 px-3 py-2 shadow" style={{ boxShadow: '0 0 15px rgba(13,202,240,0.5) !important' }}>
                                        NEAR Protocol
                                    </span>
                                </div>

                            </div>
                        </div>

                    </div>
                </header>

                {/* User Flow & Business Logic Section */}
                <section className="container py-5 mt-3 border-top border-secondary">
                    <h3 className="text-center mb-5 fw-bold text-white">{t('howItWorksTitleLanding')}</h3>
                    <div className="row g-4">

                        {/* Step 1: Security */}
                        <div className="col-md-4">
                            <div className="card h-100 bg-black border-secondary p-4 text-center hover-lift transition-all">
                                <div className="mb-3">
                                    <i className="bi bi-shield-check text-success" style={{ fontSize: '2.5rem' }}></i>
                                </div>
                                <h5 className="text-white fw-bold">{t('hwStep1Title')}</h5>
                                <p className="text-white-50 small mb-0 mt-2" dangerouslySetInnerHTML={{ __html: t('hwStep1Desc') }}></p>
                            </div>
                        </div>

                        {/* Step 2: Auto Wallet */}
                        <div className="col-md-4">
                            <div className="card h-100 bg-black border-secondary p-4 text-center hover-lift transition-all">
                                <div className="mb-3">
                                    <i className="bi bi-cloud text-info" style={{ fontSize: '2.5rem' }}></i>
                                </div>
                                <h5 className="text-white fw-bold">{t('hwStep2Title')}</h5>
                                <p className="text-white-50 small mb-0 mt-2" dangerouslySetInnerHTML={{ __html: t('step2Desc', { apy: APY_VALUE }) }}></p>
                            </div>
                        </div>

                        {/* Step 3: Fees */}
                        <div className="col-md-4">
                            <div className="card h-100 bg-black border-secondary p-4 text-center hover-lift transition-all">
                                <div className="mb-3">
                                    <i className="bi bi-arrow-left-right text-warning" style={{ fontSize: '2.5rem' }}></i>
                                </div>
                                <h5 className="text-white fw-bold">{t('hwStep3Title')}</h5>
                                <p className="text-white-50 small mb-0 mt-2" dangerouslySetInnerHTML={{ __html: t('hwStep3Desc') }}></p>
                            </div>
                        </div>

                    </div>
                </section>

                {/* Staking & Future Private Wallet Section */}
                <section className="container py-5">
                    <div className="row g-4">

                        {/* Staking Block */}
                        <div className="col-md-6">
                            <div className="card h-100 bg-dark border-success p-4 position-relative overflow-hidden">
                                <div className="position-absolute top-0 end-0 p-3 opacity-25">
                                    <i className="bi bi-layers-fill text-success" style={{ fontSize: '8rem' }}></i>
                                </div>
                                <span className="badge bg-success mb-3 w-auto align-self-start px-3 py-2">{t('actions.stake')}</span>
                                <h3 className="text-white position-relative z-1">{t('stakingTitle', { apy: APY_VALUE })}</h3>
                                <p className="text-white-50 mt-2 position-relative z-1" style={{ lineHeight: '1.6' }}>
                                    {t('stakingDesc')}
                                </p>
                                <ul className="list-unstyled text-white-50 small mt-3 position-relative z-1">
                                    <li className="mb-2"><i className="bi bi-check-circle-fill text-success me-2"></i> <span dangerouslySetInnerHTML={{ __html: t('stakingBullet1') }}></span></li>
                                    <li className="mb-2"><i className="bi bi-clock-fill text-warning me-2"></i> <span dangerouslySetInnerHTML={{ __html: t('stakingBullet2') }}></span></li>
                                    <li className="mb-2"><i className="bi bi-exclamation-triangle-fill text-danger me-2"></i> <span dangerouslySetInnerHTML={{ __html: t('stakingBullet3') }}></span></li>
                                </ul>
                            </div>
                        </div>

                        {/* Private Wallet Block (Non-Custodial) */}
                        <div className="col-md-6">
                            <div className="card h-100 bg-dark border-secondary p-4 position-relative overflow-hidden" style={{ filter: 'grayscale(0.3)' }}>
                                <div className="position-absolute top-0 end-0 p-3 opacity-25">
                                    <i className="bi bi-shield-lock-fill text-secondary" style={{ fontSize: '8rem' }}></i>
                                </div>
                                <span className="badge bg-secondary text-light mb-3 w-auto align-self-start px-3 py-2">
                                    <i className="bi bi-tools me-1"></i> {t('wallet_types.coming_soon')}
                                </span>
                                <h3 className="text-white position-relative z-1">{t('cloudWalletTitle')} <span className="fs-5 text-white-50 fw-normal">{t('cloudWalletSubtitle')}</span></h3>
                                <p className="text-white-50 mt-2 position-relative z-1" style={{ lineHeight: '1.6' }}>
                                    {t('cloudWalletDesc')}
                                </p>
                                <div className="mt-3 p-3 bg-black rounded border border-secondary position-relative z-1">
                                    <p className="small text-white-50 mb-0">
                                        {t('cloudWalletNote')} <br/><br/>
                                        <span dangerouslySetInnerHTML={{ __html: t('trueWeb3Rule') }}></span>
                                    </p>
                                </div>
                            </div>
                        </div>

                    </div>
                </section>

                {/* Security Section */}
                <section className="container py-5 border-top border-secondary mt-2">
                    <div className="row align-items-center">
                        <div className="col-md-7">
                            <h2 className="mb-4 text-white">{t('securityFirst')}</h2>
                            <ul className="list-unstyled text-white-50">
                                <li className="mb-4 d-flex align-items-start">
                                    <i className="bi bi-shield-lock text-info fs-4 me-3 mt-1"></i>
                                    <div>
                                        <strong className="text-white d-block">AES-256 Encryption:</strong>
                                        {t('encryptionDesc')}
                                    </div>
                                </li>
                                <li className="mb-4 d-flex align-items-start">
                                    <i className="bi bi-phone-vibrate text-info fs-4 me-3 mt-1"></i>
                                    <div>
                                        <strong className="text-white d-block">Mandatory 2FA:</strong>
                                        {t('mfaDesc')}
                                    </div>
                                </li>
                                <li className="mb-3 d-flex align-items-start">
                                    <i className="bi bi-lightning-charge text-info fs-4 me-3 mt-1"></i>
                                    <div>
                                        <strong className="text-white d-block">Edge Execution:</strong>
                                        {t('edgeDesc')}
                                    </div>
                                </li>
                            </ul>
                        </div>
                        <div className="col-md-5 text-center d-none d-md-block">
                            <div className="position-relative d-inline-block">
                                <div className="position-absolute top-50 start-50 translate-middle rounded-circle bg-info opacity-10 blur-glow" style={{ width: '250px', height: '250px', filter: 'blur(50px)' }}></div>
                                <i className="bi bi-shield-lock-fill text-info position-relative" style={{ fontSize: '12rem', textShadow: '0 0 30px rgba(13, 202, 240, 0.3)' }}></i>
                            </div>
                        </div>
                    </div>
                </section>

                {/* --- LIVE PRICE --- */}
                <section className="container py-4 mt-2 border-top border-secondary">
                    <div className="text-center mb-4">
                        <h3 className="fw-bold text-white">{t('marketOverview')}</h3>
                        <p className="text-white-50 small">{t('marketOverviewDesc')}</p>
                    </div>

                    <div className="card bg-black border-secondary rounded-4 shadow-lg overflow-hidden mx-auto" style={{ height: '400px', maxWidth: '1000px' }}>
                        <NearPriceChart />
                    </div>
                </section>

            </main>
            <FooterWallet t={t} />
        </div>
    );
}