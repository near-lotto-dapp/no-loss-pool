import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Footer } from '@/components/footer';
import { LanguageSwitcher } from '@/components/language_switcher';
import { Language, translations } from "@/pages/translations.ts";
import { supabase } from '@/utils/supabaseClient';
import { StakingPanel } from '@/components/staking_panel';
import {WinnerRecord, WinnersHistory} from "@/components/winners_history.tsx";
import HowItWorks from "@/pages/how_it_works.tsx";
import About from "@/pages/about.tsx";
import {poolContract} from "@/contracts/pool_contract.ts";

export default function NoLossPoolPage() {
    const [lang, setLang] = useState<Language>(() => {
        if (typeof window !== 'undefined') return (localStorage.getItem('lang') as Language) || 'en';
        return 'en';
    });

    useEffect(() => { localStorage.setItem('lang', lang); }, [lang]);
    const t = translations[lang];

    useEffect(() => {
        document.title = `${t.noLossPageTitle}`;
    }, [lang]);

    const [dbTvl, setDbTvl] = useState<number>(0);
    const [dbPrizePool, setDbPrizePool] = useState<number>(0);
    const [isLoadingDb, setIsLoadingDb] = useState<boolean>(true);
    const [winners, setWinners] = useState<WinnerRecord[]>([]);

    useEffect(() => {
        const fetchWinners = async () => {
            const data = await poolContract.getWinnersHistory();
            if (data && data.length > 0) {
                setWinners(data);
            }
        };
        fetchWinners();
    }, []);

    useEffect(() => {
        const fetchGlobalStats = async () => {
            setIsLoadingDb(true);
            try {
                const { data, error } = await supabase
                    .from('pool_stats')
                    .select('total_tvl, prize_pool')
                    .eq('id', 1)
                    .single();

                if (data && !error) {
                    setDbTvl(data.total_tvl || 0);
                    setDbPrizePool(data.prize_pool || 0);
                }
            } catch (err) {
            } finally {
                setIsLoadingDb(false);
            }
        };

        fetchGlobalStats();
        const interval = setInterval(fetchGlobalStats, 60000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-vh-100 text-white d-flex flex-column">
            <nav className="container pt-4 pb-3 d-flex justify-content-between align-items-center">
                <Link to="/" className="text-decoration-none h4 fw-bold m-0 transition-all hover-glow" style={{ color: '#00C9FF' }}>
                    <i className="bi bi-arrow-left me-2"></i> {t.homeBtn}
                </Link>

                <div className="d-flex align-items-center gap-3">
                    <LanguageSwitcher lang={lang} setLang={setLang}/>
                </div>
            </nav>

            <main className="flex-grow-1 container py-4 d-flex flex-column align-items-center">

                <div className="w-100 animate__animated animate__fadeIn" style={{ maxWidth: '650px' }}>
                    <StakingPanel
                        t={t}
                        dbTvl={dbTvl}
                        dbPrizePool={dbPrizePool}
                        isLoadingDb={isLoadingDb}
                    />
                </div>

                <WinnersHistory t={t} winners={winners} />
                <HowItWorks lang={lang}/>
                <About lang={lang} contractId={import.meta.env.VITE_CONTRACT_ID}/>
            </main>


            <Footer t={t}/>

            <style>{`
                .hover-glow:hover { text-shadow: 0 0 10px rgba(0, 201, 255, 0.8); }
            `}</style>
        </div>
    );
}