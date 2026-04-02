import React, { useState, useRef, useEffect } from 'react';

interface InfoTooltipProps {
    text: string;
    className?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, className = "" }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [offsetX, setOffsetX] = useState(0); // Стан для зсуву по горизонталі

    const containerRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsVisible(false);
            }
        };
        if (isVisible) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isVisible]);

    useEffect(() => {
        if (isVisible && popupRef.current) {
            const rect = popupRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const safeMargin = 15;

            let shift = 0;
            if (rect.left < safeMargin) {
                shift = safeMargin - rect.left;
            } else if (rect.right > viewportWidth - safeMargin) {
                shift = (viewportWidth - safeMargin) - rect.right;
            }

            setOffsetX(shift);
        } else {
            setOffsetX(0);
        }
    }, [isVisible, text]);

    return (
        <div
            className={`d-inline-block position-relative ${className}`}
            ref={containerRef}
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
            style={{ lineHeight: 0 }}
        >
            <i
                className="bi bi-info-circle text-white-50"
                style={{ cursor: 'help' }}
                onClick={() => setIsVisible(!isVisible)}
            ></i>

            {isVisible && (
                <div
                    ref={popupRef}
                    className="position-absolute bg-secondary text-white p-2 rounded shadow-lg animate__animated animate__fadeIn"
                    style={{
                        bottom: '140%',
                        left: '50%',
                        transform: `translateX(calc(-50% + ${offsetX}px))`,
                        zIndex: 1050,
                        width: 'max-content',
                        maxWidth: '260px',
                        fontSize: '0.75rem',
                        lineHeight: '1.4',
                        pointerEvents: 'none',
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word'
                    }}
                >
                    {text}

                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: `calc(50% - ${offsetX}px)`,
                        marginLeft: '-5px',
                        borderWidth: '5px',
                        borderStyle: 'solid',
                        borderColor: 'var(--bs-secondary) transparent transparent transparent'
                    }}></div>
                </div>
            )}
        </div>
    );
};