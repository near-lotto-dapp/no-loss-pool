import { useState, useEffect } from 'react';

export const usePoolData = () => {
    const [tvl, setTvl] = useState<string | number>("0");
    const [prizePool, setPrizePool] = useState<string | number>("0");
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Звертаємося до нашого API на Vercel
                const response = await fetch('/api/pool-stats');
                const data = await response.json();

                if (data.tvl !== undefined) setTvl(data.tvl);
                if (data.prizePool !== undefined) setPrizePool(data.prizePool);
            } catch (error) {
                console.error("Помилка завантаження статистики:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStats();

        // Оновлюємо кожні 30 секунд
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

    return { tvl, prizePool, isLoading };
};