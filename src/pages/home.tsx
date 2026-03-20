import {translations, Language} from './translations';
import HowItWorks from "./how_it_works";
import About from './about';
import {Footer} from "@/components/footer";
import {LanguageSwitcher} from "@/components/language_switcher";
import {StakingPanel} from "@/components/staking_panel.tsx";
import { useState, useEffect } from 'react';
import { poolContract } from '@/contracts/pool_contract';
import { WinnersHistory, WinnerRecord } from "@/components/winners_history";


export default function Home() {
    const [lang, setLang] = useState<Language>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('lang') as Language) || 'en';
        }
        return 'en';
    });

    const t = translations[lang];

    useEffect(() => {
        localStorage.setItem('lang', lang);
    }, [lang]);


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
        <main className="container mt-1 mb-4">
            <LanguageSwitcher lang={lang} setLang={setLang}/>
            <StakingPanel t={t}/>
            <WinnersHistory t={t} winners={winners} />
            <HowItWorks lang={lang}/>
            <About lang={lang} contractId={import.meta.env.VITE_CONTRACT_ID}/>
            <Footer t={t}/>

        </main>
    );
}