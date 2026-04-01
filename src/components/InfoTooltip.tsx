import React, { useState, useRef, useEffect } from 'react';

interface InfoTooltipProps {
    text: string;
    className?: string;
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ text, className = "" }) => {
    const [isVisible, setIsVisible] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
                setIsVisible(false);
            }
        };
        if (isVisible) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isVisible]);

    return (
        <div
            className={`d-inline-block position-relative ${className}`}
            ref={tooltipRef}
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
                    className="position-absolute bg-secondary text-white p-2 rounded shadow-lg animate__animated animate__fadeIn"
                    style={{
                        bottom: '140%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        zIndex: 1050,
                        width: '220px',
                        fontSize: '0.75rem',
                        lineHeight: '1.2',
                        pointerEvents: 'none'
                    }}
                >
                    {text}
                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: '50%',
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