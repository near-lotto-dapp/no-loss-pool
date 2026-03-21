import { translations, Language } from './translations';
import HowItWorks from "./how_it_works";
import About from './about';
import { Footer } from "@/components/footer";
import { LanguageSwitcher } from "@/components/language_switcher";
import { StakingPanel } from "@/components/staking_panel.tsx";
import { useState, useEffect } from 'react';
import { poolContract } from '@/contracts/pool_contract';
import { WinnersHistory, WinnerRecord } from "@/components/winners_history";
import { usePoolData } from '@/hooks/usePoolData';
import {Link} from "react-router";
import {supabase} from "@/utils/supabaseClient.ts";

export default function Home() {
    const [lang, setLang] = useState<Language>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('lang') as Language) || 'en';
        }
        return 'en';
    });

    const t = translations[lang];
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        localStorage.setItem('lang', lang);
    }, [lang]);

    const { tvl, prizePool, isLoading } = usePoolData();
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

    return (
        <main className="container position-relative mt-0 mb-4">
            <div
                className="position-absolute d-flex justify-content-end align-items-center gap-3"
                style={{
                    top: '-30px',
                    right: '15px',
                    zIndex: 1000,
                    width: 'fit-content'
                }}
            >
                <Link
                    to="/auth"
                    className="btn btn-outline-info fw-bold d-flex align-items-center m-0"
                    style={{
                        borderRadius: '8px',
                        padding: '6px 16px',
                        height: '38px',
                        maxWidth: '200px'
                    }}
                >
                    <i className="bi bi-person-circle me-2"></i>
                    <span className="text-truncate">
                            {user ? user.email : (t.accountBtn || "Account")}
                        </span>
                </Link>

                <LanguageSwitcher lang={lang} setLang={setLang}/>
            </div>

            <StakingPanel
                t={t}
                dbTvl={tvl}
                dbPrizePool={prizePool}
                isLoadingDb={isLoading}
            />

            <WinnersHistory t={t} winners={winners} />
            <HowItWorks lang={lang}/>
            <About lang={lang} contractId={import.meta.env.VITE_CONTRACT_ID}/>
            <Footer t={t}/>
        </main>
    );
}