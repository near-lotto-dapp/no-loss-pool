import { Link } from 'react-router-dom';
import { LanguageSwitcher } from '@/components/LanguageSwitcher.tsx';
import type { Language } from '@/hooks/useLanguage.ts';

interface TopNavProps {
    lang: Language;
    setLang: (lang: Language) => void;
    title: string | React.ReactNode;
    to?: string;
    icon?: string;
}

export const TopNav = ({
                           lang,
                           setLang,
                           title,
                           to = "/",
                           icon = "bi-arrow-left"
                       }: TopNavProps) => {
    return (
        <nav className="container pt-4 pb-3 d-flex justify-content-between align-items-center">
            <Link
                to={to}
                className="text-info text-decoration-none fw-bold fs-5 d-flex align-items-center gap-2"
                style={{ transition: 'opacity 0.2s', maxWidth: '70%' }}
                onMouseOver={(e) => (e.currentTarget.style.opacity = '0.8')}
                onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
            >
                <i className={`bi ${icon} flex-shrink-0`}></i>
                <span className="text-truncate">
                    {title}
                </span>
            </Link>

            <div className="d-flex align-items-center gap-3">
                <LanguageSwitcher lang={lang} setLang={setLang}/>
            </div>
        </nav>
    );
};