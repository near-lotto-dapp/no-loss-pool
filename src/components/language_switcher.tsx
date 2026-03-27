import { useState, useEffect, useRef } from 'react';
import styles from '@/styles/app.module.css';
import {Language} from "@/pages/translations.ts";

interface LanguageSwitcherProps {
    lang: Language;
    setLang: (lang: Language) => void;
}

const LANGUAGES = [
    { code: 'en', label: 'EN', flag: '🇬🇧' },
    { code: 'es', label: 'ES', flag: '🇪🇸' },
    { code: 'ua', label: 'UA', flag: '🇺🇦' },
] as const;

export const LanguageSwitcher = ({ lang, setLang }: LanguageSwitcherProps) => {
    const [isOpen, setIsOpen] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);

    const currentLang = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (isOpen && dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleLangChange = (newLang: Language) => {
        setLang(newLang);
        setIsOpen(false);
    };

    return (
        <div className={styles.languageSwitcher} ref={dropdownRef}>
            <button
                type="button"
                className={styles.langDropdownBtn}
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                <span className="fs-6">{currentLang.flag}</span>
                <span>{currentLang.label}</span>
                <span className={`${styles.dropdownArrow} ms-1`}>▼</span>
            </button>

            <ul className={`${styles.langDropdownMenu} ${isOpen ? styles.showMenu : ''}`} role="listbox">
                {LANGUAGES.map((item) => (
                    <li
                        key={item.code}
                        role="option"
                        aria-selected={item.code === lang}
                        className={`${styles.dropdownItem} ${item.code === lang ? styles.activeLang : ''}`}
                        onClick={() => handleLangChange(item.code as Language)}
                    >
                        <span className="fs-5">{item.flag}</span>
                        <span>{item.label}</span>

                        {item.code === lang && <i className="bi bi-check2 ms-auto text-info"></i>}
                    </li>
                ))}
            </ul>
        </div>
    );
};