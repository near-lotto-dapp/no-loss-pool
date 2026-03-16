import { useState, useEffect } from 'react';

interface PoolStatsProps {
    totalTvl: string;
    currentPrize: string;
    t: any;
}

export const PoolStats = ({ totalTvl, currentPrize, t }: PoolStatsProps) => {
    const [timeLeft, setTimeLeft] = useState<string>("00:00:00:00");

    useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            const nextSunday = new Date();

            nextSunday.setUTCHours(23, 59, 59, 999);
            const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
            nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday);

            const diff = nextSunday.getTime() - now.getTime();

            if (diff > 0) {
                const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
                const m = Math.floor((diff / 1000 / 60) % 60);
                const s = Math.floor((diff / 1000) % 60);

                setTimeLeft(`${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`);
            } else {
                setTimeLeft(t.drawingNow);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [t.drawingNow]);

    return (
        <div className="w-100">
            {/* timer */}
            <div className="text-center mb-4">
                <div className="badge bg-dark border border-secondary p-2 mt-2 shadow-sm">
                    <span className="text-white-50 me-2">{t.nextDrawIn}</span>
                    <span className="text-info fw-bold font-monospace timer-text">
                        {timeLeft}
                    </span>
                </div>
            </div>

            {/* TVL */}
            <div className="bg-dark rounded p-3 mb-4 text-center tvl-card">
                <h6 className="text-white-50 mb-2">{t.poolTvl}</h6>
                <h3 className="text-success m-0 fw-bold text-glow-success">
                    {Number(totalTvl).toFixed(2)} NEAR
                </h3>

                {/* APY */}
                <div className="mt-2 d-flex justify-content-center align-items-center gap-2">
                    <span className="badge bg-success-subtle text-success border border-success-subtle small">
                        {t.apyLabel}
                    </span>
                </div>
            </div>

            {/* PRIZE */}
            <div className="bg-dark rounded p-3 mb-4 text-center border border-warning prize-card">
                <h6 className="text-warning mb-1">{t.prizePoolLabel}</h6>
                <h4 className="text-warning m-0 fw-bold text-glow-warning">
                    {Number(currentPrize).toFixed(5)} NEAR
                </h4>
            </div>

        </div>
    );
};