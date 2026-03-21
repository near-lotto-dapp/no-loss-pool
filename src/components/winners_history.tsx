import styles from '@/styles/app.module.css';

export interface WinnerRecord {
    timestamp: number;
    account_id: string;
    amount: string;
}

interface WinnersHistoryProps {
    t: any;
    winners?: WinnerRecord[];
}

export const WinnersHistory = ({ t, winners = [] }: WinnersHistoryProps) => {
    return (
        <div className={`${styles.card} ${styles.stakingCard} mt-4`} style={{ maxWidth: '650px' }}>
            <h4 className="text-center mb-3 fw-bold text-white">🏆 {t.lastJackpot}</h4>

            <div className="table-responsive">
                <table className="table table-dark table-hover table-borderless text-center align-middle mb-0" style={{ backgroundColor: 'transparent' }}>
                    <thead style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <tr>
                        <th className="text-white-50 fw-normal pb-2">{t.historyDate}</th>
                        <th className="text-white-50 fw-normal pb-2">{t.historyWallet}</th>
                        <th className="text-white-50 fw-normal pb-2">{t.historyAmount}</th>
                    </tr>
                    </thead>
                    <tbody>
                    {winners.length > 0 ? (
                        winners.map((winner, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <td className="py-3" style={{ fontSize: '0.9rem' }}>
                                    {new Date(winner.timestamp).toLocaleString()}
                                </td>
                                <td className="py-3 fw-bold text-info">
                                    {winner.account_id.length > 15
                                        ? `${winner.account_id.slice(0, 6)}...${winner.account_id.slice(-4)}`
                                        : winner.account_id}
                                </td>
                                <td className="py-3 fw-bold" style={{ color: '#38ef7d', textShadow: '0 0 8px rgba(56, 239, 125, 0.3)' }}>
                                    +{winner.amount} NEAR
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan={3} className="py-4 text-white-50">
                                {t.emptyHistory}
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};