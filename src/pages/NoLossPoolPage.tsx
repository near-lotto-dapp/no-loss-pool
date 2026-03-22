import { useState, useEffect } from 'react';
import { Footer } from '@/components/footer';
import { supabase } from '@/utils/supabaseClient';
import { StakingPanel } from '@/components/staking_panel';
import {WinnerRecord, WinnersHistory} from "@/components/winners_history.tsx";
import HowItWorks from "@/pages/how_it_works.tsx";
import About from "@/pages/about.tsx";
import {poolContract} from "@/contracts/pool_contract.ts";
import {usePageTitle} from "@/hooks/usePageTitle.ts";
import {useLanguage} from "@/hooks/useLanguage.ts";
import {TopNav} from "@/components/top_nav.tsx";

export default function NoLossPoolPage() {
    const { lang, setLang, t } = useLanguage();
    usePageTitle(t.noLossPageTitle);

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
            <TopNav
                lang={lang}
                setLang={setLang}
                title={t.homeBtn}
            />

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