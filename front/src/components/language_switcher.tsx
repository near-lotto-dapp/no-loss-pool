import React from 'react';
import {Language} from "@/pages/translations";

interface LanguageSwitcherProps {
    lang: Language;
    setLang: (lang: Language) => void;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ lang, setLang }) => {
    return (
        <div className="d-flex justify-content-end gap-2 mb-2 pt-2">
            <button
                className="btn btn-sm"
                onClick={() => setLang('en')}
                style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s ease',
                    backgroundColor: lang === 'en' ? 'rgba(84, 214, 255, 0.2)' : 'transparent',
                    color: lang === 'en' ? '#54d6ff' : '#838687',
                    border: lang === 'en' ? '2px solid #54d6ff' : '1px solid rgba(131, 134, 135, 0.3)',
                    fontWeight: 'bold',
                    padding: '0',
                    fontSize: '13px'
                }}
            >
                EN
            </button>
            <button
                className="btn btn-sm"
                onClick={() => setLang('ua')}
                style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.3s ease',
                    backgroundColor: lang === 'ua' ? 'rgba(84, 214, 255, 0.2)' : 'transparent',
                    color: lang === 'ua' ? '#54d6ff' : '#838687',
                    border: lang === 'ua' ? '2px solid #54d6ff' : '1px solid rgba(131, 134, 135, 0.3)',
                    fontWeight: 'bold',
                    padding: '0',
                    fontSize: '13px'
                }}
            >
                UA
            </button>
        </div>
    );
};