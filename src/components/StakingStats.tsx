import React from 'react';

interface StakingStatsProps {
    t: any;
    totalDeposited: string;
    unstakedAmountNEAR: string;
    totalWithdrawn: string;
    totalShares: string;
    lifetimeProfit: string;
}

export const StakingStats: React.FC<StakingStatsProps> = ({
                                                              t,
                                                              totalDeposited,
                                                              unstakedAmountNEAR,
                                                              totalWithdrawn,
                                                              totalShares,
                                                              lifetimeProfit
                                                          }) => {
    return (
        <div className="mb-3 p-3 bg-dark rounded border border-secondary">
            <h6 className="text-white mb-3" style={{ fontSize: '0.85rem' }}>
                {t('staking.performance') || 'Your Performance'}
            </h6>

            <div className="d-flex justify-content-between mb-1">
                <small className="text-white-50">{t('staking.total_deposited') || 'Total Deposited'}</small>
                <span className="text-white fw-bold">{totalDeposited} NEAR</span>
            </div>

            {parseFloat(unstakedAmountNEAR) > 0 && (
                <div className="d-flex justify-content-between mb-1">
                    <small className="text-white-50">{t('inUnstakeProcess') || 'In Unstaking'}</small>
                    <span className="text-warning fw-bold">{unstakedAmountNEAR} NEAR</span>
                </div>
            )}

            <div className="d-flex justify-content-between mb-1">
                <small className="text-white-50">{t('staking.total_withdrawn') || 'Total Withdrawn'}</small>
                <span className="text-white fw-bold">{totalWithdrawn} NEAR</span>
            </div>

            <div className="d-flex justify-content-between pt-1 mt-1">
                <small className="text-white-50">{t('staking.total_shares') || 'Total Shares (Inc. Hold)'}</small>
                <span className="text-info fw-bold">{totalShares} LiNEAR</span>
            </div>

            <div className="d-flex justify-content-between pt-2 mt-2 border-top border-secondary">
                <small className="text-white-50">{t('staking.lifetime_profit') || 'Lifetime Earned'}</small>
                <span
                    className="text-success fw-bold"
                    style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.5px' }}
                >
                    +{lifetimeProfit} NEAR
                </span>
            </div>
        </div>
    );
};