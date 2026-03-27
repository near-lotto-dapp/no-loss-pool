import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from "@/utils/supabaseClient.ts";
import { usePageTitle } from "@/hooks/usePageTitle.ts";
import { useLanguage } from "@/hooks/useLanguage.ts";
import { TopNav } from "@/components/top_nav.tsx";
import {FooterWallet} from "@/components/FooterWallet.tsx";

export default function LandingPage() {
    const { lang, setLang, t } = useLanguage();
    const [user, setUser] = useState<any>(null);
    usePageTitle(t.homePageTitle);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <div className="container position-relative mt-0 mb-4" style={{ minHeight: '70vh' }}>
            <TopNav
                lang={lang}
                setLang={setLang}
                title={user ? user.email : t.enterCabinetBtn}
                to="/auth"
                icon="bi-person-circle"
            />

            <main className="flex-grow-1 animate__animated animate__fadeIn">
                {/* Top Section */}
                <header className="container py-4 text-center">
                    <h1 className="display-5 fw-bold text-white mb-3" dangerouslySetInnerHTML={{ __html: t.landingHeroTitle }}></h1>
                    <p className="lead mb-4 text-white-50" style={{ maxWidth: '600px', margin: '0 auto' }}>
                        {t.landingSubtitle}
                    </p>
                    {!user && (
                        <Link to="/auth" className="btn btn-info btn-lg fw-bold px-5 rounded-pill mt-2 shadow">
                            {t.startEarningBtn}
                        </Link>
                    )}
                </header>

                {/* User Flow & Business Logic Section */}
                <section className="container py-5 mt-3">
                    <h3 className="text-center mb-5 fw-bold text-white">{t.howItWorksTitleLanding}</h3>
                    <div className="row g-4">

                        {/* Step 1: Security */}
                        <div className="col-md-4">
                            <div className="card h-100 bg-black border-secondary p-4 text-center hover-lift transition-all">
                                <div className="mb-3">
                                    <i className="bi bi-shield-check text-success" style={{ fontSize: '2.5rem' }}></i>
                                </div>
                                <h5 className="text-white fw-bold">{t.hwStep1Title}</h5>
                                <p className="text-white-50 small mb-0 mt-2" dangerouslySetInnerHTML={{ __html: t.hwStep1Desc }}></p>
                            </div>
                        </div>

                        {/* Step 2: Auto Wallet */}
                        <div className="col-md-4">
                            <div className="card h-100 bg-black border-secondary p-4 text-center hover-lift transition-all">
                                <div className="mb-3">
                                    <i className="bi bi-wallet2 text-info" style={{ fontSize: '2.5rem' }}></i>
                                </div>
                                <h5 className="text-white fw-bold">{t.hwStep2Title}</h5>
                                <p className="text-white-50 small mb-0 mt-2" dangerouslySetInnerHTML={{ __html: t.hwStep2Desc }}></p>
                            </div>
                        </div>

                        {/* Step 3: Zero Fees */}
                        <div className="col-md-4">
                            <div className="card h-100 bg-black border-secondary p-4 text-center hover-lift transition-all">
                                <div className="mb-3">
                                    <i className="bi bi-arrow-left-right text-warning" style={{ fontSize: '2.5rem' }}></i>
                                </div>
                                <h5 className="text-white fw-bold">{t.hwStep3Title}</h5>
                                <p className="text-white-50 small mb-0 mt-2" dangerouslySetInnerHTML={{ __html: t.hwStep3Desc }}></p>
                            </div>
                        </div>

                    </div>
                </section>

                {/* Staking & Future Cloud Wallet Section */}
                <section className="container py-5">
                    <div className="row g-4">

                        {/* Staking Block */}
                        <div className="col-md-6">
                            <div className="card h-100 bg-dark border-success p-4 position-relative overflow-hidden">
                                <div className="position-absolute top-0 end-0 p-3 opacity-25">
                                    <i className="bi bi-layers-fill text-success" style={{ fontSize: '8rem' }}></i>
                                </div>
                                <span className="badge bg-success mb-3 w-auto align-self-start px-3 py-2">{t.actions?.stake || "Private Staking"}</span>
                                <h3 className="text-white position-relative z-1">{t.stakingTitle}</h3>
                                <p className="text-white-50 mt-2 position-relative z-1" style={{ lineHeight: '1.6' }}>
                                    {t.stakingDesc}
                                </p>
                                <ul className="list-unstyled text-white-50 small mt-3 position-relative z-1">
                                    <li className="mb-2"><i className="bi bi-check-circle-fill text-success me-2"></i> <span dangerouslySetInnerHTML={{ __html: t.stakingBullet1 }}></span></li>
                                    <li className="mb-2"><i className="bi bi-clock-fill text-warning me-2"></i> <span dangerouslySetInnerHTML={{ __html: t.stakingBullet2 }}></span></li>
                                    <li className="mb-2"><i className="bi bi-exclamation-triangle-fill text-danger me-2"></i> <span dangerouslySetInnerHTML={{ __html: t.stakingBullet3 }}></span></li>
                                </ul>
                            </div>
                        </div>

                        {/* Cloud Wallet Block (Non-Custodial) */}
                        <div className="col-md-6">
                            <div className="card h-100 bg-dark border-secondary p-4 position-relative overflow-hidden" style={{ filter: 'grayscale(0.3)' }}>
                                <div className="position-absolute top-0 end-0 p-3 opacity-25">
                                    <i className="bi bi-cloud-slash-fill text-secondary" style={{ fontSize: '8rem' }}></i>
                                </div>
                                <span className="badge bg-secondary text-light mb-3 w-auto align-self-start px-3 py-2">
                                    <i className="bi bi-tools me-1"></i> {t.wallet_types?.coming_soon}
                                </span>
                                <h3 className="text-white position-relative z-1">{t.cloudWalletTitle} <span className="fs-5 text-white-50 fw-normal">{t.cloudWalletSubtitle}</span></h3>
                                <p className="text-white-50 mt-2 position-relative z-1" style={{ lineHeight: '1.6' }}>
                                    {t.cloudWalletDesc}
                                </p>
                                <div className="mt-3 p-3 bg-black rounded border border-secondary position-relative z-1">
                                    <p className="small text-white-50 mb-0">
                                        {t.cloudWalletNote} <br/><br/>
                                        <span dangerouslySetInnerHTML={{ __html: t.trueWeb3Rule }}></span>
                                    </p>
                                </div>
                            </div>
                        </div>

                    </div>
                </section>

                {/* Security Section (Original) */}
                <section className="container py-5 border-top border-secondary mt-2">
                    <div className="row align-items-center">
                        <div className="col-md-7">
                            <h2 className="mb-4 text-white">{t.securityFirst}</h2>
                            <ul className="list-unstyled text-white-50">
                                <li className="mb-4 d-flex align-items-start">
                                    <i className="bi bi-shield-lock text-info fs-4 me-3 mt-1"></i>
                                    <div>
                                        <strong className="text-white d-block">AES-256 Encryption:</strong>
                                        {t.encryptionDesc}
                                    </div>
                                </li>
                                <li className="mb-4 d-flex align-items-start">
                                    <i className="bi bi-phone-vibrate text-info fs-4 me-3 mt-1"></i>
                                    <div>
                                        <strong className="text-white d-block">Mandatory 2FA:</strong>
                                        {t.mfaDesc}
                                    </div>
                                </li>
                                <li className="mb-3 d-flex align-items-start">
                                    <i className="bi bi-lightning-charge text-info fs-4 me-3 mt-1"></i>
                                    <div>
                                        <strong className="text-white d-block">Edge Execution:</strong>
                                        {t.edgeDesc}
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
            </main>
            <FooterWallet t={t} />
        </div>
    );
}