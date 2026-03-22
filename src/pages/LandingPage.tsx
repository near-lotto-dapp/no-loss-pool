import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Footer } from '@/components/footer';
import { LanguageSwitcher } from '@/components/language_switcher';
import {supabase} from "@/utils/supabaseClient.ts";
import {usePageTitle} from "@/hooks/usePageTitle.ts";
import {useLanguage} from "@/hooks/useLanguage.ts";

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
            <div className="w-100 d-flex justify-content-between align-items-center mb-4 pt-4">
                <Link
                    to="/auth"
                    className="text-info text-decoration-none fw-bold fs-5 d-flex align-items-center gap-2"
                    style={{ transition: 'opacity 0.2s', maxWidth: '70%' }}
                    onMouseOver={(e) => (e.currentTarget.style.opacity = '0.8')}
                    onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
                >
                    <i className="bi bi-person-circle flex-shrink-0"></i>
                    <span className="text-truncate">
                    {user ? user.email : t.enterCabinetBtn}
                </span>
                </Link>

                <LanguageSwitcher lang={lang} setLang={setLang}/>
            </div>

            {/* Top Section */}
            <main className="flex-grow-1">
                <header className="container py-3 text-center">
                    <p className="lead fs-3 mb-3 text-white-50">
                        {t.landingSubtitle}
                    </p>
                </header>

                {/* Risk Distribution Section */}
                <section className="container py-3">
                    <h2 className="text-center mb-5">{t.chooseRiskLevel}</h2>
                    <div className="row g-4">
                        {/* Conservative */}
                        <div className="col-md-4">
                            <div className="card h-100 bg-dark border-success p-4">
                                <span className="badge bg-success mb-3 w-25">{t.conservative}</span>
                                <h3>Private Staking</h3>
                                <p className="text-white-50 flex-grow-1">
                                    {t.privateStakingDesc}
                                </p>
                                <Link to="/auth" className="btn btn-outline-success mt-3">
                                    {t.openVaultBtn}
                                </Link>
                            </div>
                        </div>

                        {/* Balanced */}
                        <div className="col-md-4">
                            <div className="card h-100 bg-dark border-info p-4">
                                <span className="badge bg-info mb-3 w-25">{t.balanced}</span>
                                <h3>No-Loss Pool</h3>
                                <p className="text-white-50 flex-grow-1">
                                    {t.noLossPoolDesc}
                                </p>
                                <Link to="/no-loss-pool" className="btn btn-info mt-3 fw-bold">
                                    {t.toPoolBtn}
                                </Link>
                            </div>
                        </div>

                        {/* Aggressive */}
                        <div className="col-md-4">
                            <div className="card h-100 bg-dark border-danger p-4">
                                <span className="badge bg-danger mb-3 w-25">{t.aggressive}</span>
                                <h3>Lotto Pool</h3>
                                <p className="text-white-50 flex-grow-1">
                                    {t.lottoPoolDesc}
                                </p>
                                <a href="https://pool.codes/" target="_blank" rel="noopener noreferrer" className="btn btn-outline-danger mt-3">
                                    {t.tryLuckBtn}
                                </a>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Security Section */}
                <section className="container py-5 border-top border-secondary mt-5">
                    <div className="row align-items-center">
                        <div className="col-md-6">
                            <h2 className="mb-4">{t.securityFirst}</h2>
                            <ul className="list-unstyled">
                                <li className="mb-3">🔒 <strong>AES-256 Encryption:</strong> {t.encryptionDesc}</li>
                                <li className="mb-3">📱 <strong>Mandatory 2FA:</strong> {t.mfaDesc}</li>
                                <li className="mb-3">⚡ <strong>Edge Execution:</strong> {t.edgeDesc}</li>
                            </ul>
                        </div>
                        <div className="col-md-6 text-center">
                            <i className="bi bi-shield-lock-fill text-info" style={{ fontSize: '10rem' }}></i>
                        </div>
                    </div>
                </section>
            </main>
            <Footer t={t} />
        </div>
    );
}