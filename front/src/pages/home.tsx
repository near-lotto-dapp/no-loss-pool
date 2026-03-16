import {useState} from 'react';
import {translations, Language} from './translations';
import HowItWorks from "./how_it_works";
import About from './about';
import {Footer} from "@/components/footer";
import {LanguageSwitcher} from "@/components/language_switcher";
import {StakingPanel} from "@/components/staking_panel.tsx";


export default function Home() {
    const [lang, setLang] = useState<Language>(
        (localStorage.getItem('lang') as Language) || 'en'
    );
    const t = translations[lang];



    return (
        <main className="container mt-4 mb-5">
            <LanguageSwitcher lang={lang} setLang={setLang} />
            <StakingPanel t={t} />
            <HowItWorks lang={lang}/>
            <About lang={lang} contractId={import.meta.env.VITE_CONTRACT_ID}/>
            <Footer t={t} />

        </main>
    );
}