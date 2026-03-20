import {Language} from "@/pages/translations.ts";


interface LanguageSwitcherProps {
    lang: Language;
    setLang: (lang: Language) => void;
}

export const LanguageSwitcher = ({ lang, setLang }: LanguageSwitcherProps) => {
    const languages: { code: Language; label: string; flag: string }[] = [
        { code: 'ua', label: 'UA', flag: '🇺🇦' },
        { code: 'en', label: 'EN', flag: '🇬🇧' },
        { code: 'es', label: 'ES', flag: '🇪🇸' },
    ];

    return (
        <div className="d-flex justify-content-end mb-4">
            <div className="btn-group shadow-sm" role="group" style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                {languages.map((l) => (
                    <button
                        key={l.code}
                        type="button"
                        onClick={() => setLang(l.code)}
                        className={`btn btn-sm px-3 py-2 ${lang === l.code ? 'btn-primary' : 'btn-dark'}`}
                        style={{
                            fontSize: '0.85rem',
                            fontWeight: '600',
                            backgroundColor: lang === l.code ? '#00b3ff' : '#1a1a1a',
                            border: 'none',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <span className="me-1">{l.flag}</span> {l.label}
                    </button>
                ))}
            </div>
        </div>
    );
};