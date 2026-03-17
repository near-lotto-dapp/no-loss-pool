import { useState, useEffect } from 'react';
import { useNearWallet } from 'near-connect-hooks';
import { poolContract } from '@/contracts/pool_contract';
import { formatNearAmount } from '@near-js/utils';
import styles from '@/styles/app.module.css';

import { PoolStats } from './pool_stats';

interface StakingPanelProps {
    t: any;
}

export const StakingPanel = ({ t }: StakingPanelProps) => {
    const { signedAccountId, callFunction, loading } = useNearWallet();
    const [activeBalance, setActiveBalance] = useState<string>("0");
    const [pendingBalance, setPendingBalance] = useState<string>("0");
    const [currentPrize, setCurrentPrize] = useState<string>("0");
    const [totalTvl, setTotalTvl] = useState<string>("0");
    const [amount, setAmount] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
    const [totalActivePool, setTotalActivePool] = useState<string>("0");

    // Unstaking states
    const [unstakingBalance, setUnstakingBalance] = useState<string>("0");
    const [unlockTime, setUnlockTime] = useState<number>(0);
    const [now, setNow] = useState<number>(Date.now());

    useEffect(() => {
        fetchPoolData();
        if (signedAccountId) {
            fetchUserBalance();
        }

        const uiInterval = setInterval(() => {
            setNow(Date.now());
        }, 1000);

        return () => {
            clearInterval(uiInterval);
        };
    }, [signedAccountId]);

    const fetchPoolData = async () => {
        try {
            const poolInfo = await poolContract.getPoolInfo();
            const linearBalanceStr = await poolContract.getLinearBalance();

            const active = BigInt(poolInfo.total_active || "0");
            const pending = BigInt(poolInfo.total_pending || "0");
            const stakedOriginal = BigInt(poolInfo.total_staked || "0");
            const linearCurrent = BigInt(linearBalanceStr || "0");
            const activeWorkingV = active + pending;

            setTotalTvl(formatNearAmount(activeWorkingV.toString()));
            setTotalActivePool(formatNearAmount(active.toString()));

            let prize = linearCurrent - stakedOriginal;
            if (prize < 0n) {
                prize = 0n;
            }
            setCurrentPrize(formatNearAmount(prize.toString()));

        } catch (error) {
            console.error("Failed to fetch pool info:", error);
        }
    };

    const fetchUserBalance = async () => {
        try {
            const userData = await poolContract.getUserStaked(signedAccountId!);
            if (userData) {
                setActiveBalance(formatNearAmount(userData.active_balance));
                setPendingBalance(formatNearAmount(userData.pending_balance));
                setUnstakingBalance(formatNearAmount(userData.unstaking_balance || "0"));
                setUnlockTime(Number(userData.unstake_unlock_time || "0") / 1000000);
            } else {
                setActiveBalance("0");
                setPendingBalance("0");
                setUnstakingBalance("0");
                setUnlockTime(0);
            }
        } catch (error) {
            console.error("Fetch balance error:", error);
        }
    };

    const getTimeRemaining = (targetTime: number) => {
        const total = targetTime - now;
        if (total <= 0) return null;

        const seconds = Math.floor((total / 1000) % 60);
        const minutes = Math.floor((total / 1000 / 60) % 60);
        const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
        const days = Math.floor(total / (1000 * 60 * 60 * 24));

        return { days, hours, minutes, seconds };
    };

    const handleDeposit = async () => {
        if (!amount || isNaN(Number(amount))) return;
        setIsLoading(true);
        try {
            await poolContract.deposit(callFunction, amount);

            await fetchUserBalance();
            await fetchPoolData();
            setAmount("");
        } catch (error) {
            console.error("Deposit error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleWithdraw = async () => {
        if (!amount || isNaN(Number(amount))) return;
        setIsLoading(true);
        try {
            await poolContract.withdraw(callFunction, amount);

            await fetchUserBalance();
            await fetchPoolData();
            setAmount("");
        } catch (error) {
            console.error("Withdraw error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleClaim = async () => {
        setIsLoading(true);
        try {
            await poolContract.claim(callFunction);

            await fetchUserBalance();
            await fetchPoolData();
        } catch (error) {
            console.error("Claim error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const setMaxAmount = () => {
        const total = Number(activeBalance) + Number(pendingBalance);
        setAmount(total.toFixed(4));
    };

    const isButtonDisabled = () => {
        if (isLoading || !amount || loading) return true;

        const numAmount = Number(amount);
        if (activeTab === 'deposit') {
            return numAmount < 10;
        } else {
            return numAmount <= 0;
        }
    };

    const userActiveNum = Number(activeBalance);
    let totalActiveNum = Number(totalActivePool);

    if (totalActiveNum < userActiveNum) {
        totalActiveNum = userActiveNum;
    }

    const calculatedChance = totalActiveNum > 0
        ? (userActiveNum / totalActiveNum) * 100
        : 0;

    const winChance = Math.min(calculatedChance, 100).toFixed(2);

    const isReadyToClaim = now >= unlockTime;
    const timeLeft = getTimeRemaining(unlockTime);
    const triggerHeaderLogin = () => {
        const headerLoginBtn = Array.from(document.querySelectorAll('button')).find(
            btn => btn.innerText.includes('Login') || btn.innerText.includes('Connect') || btn.innerText.includes('Підключити')
        );
        if (headerLoginBtn) {
            headerLoginBtn.click();
        } else {
            console.warn("No login button in header");
        }
    };

    return (
        <div className={styles.center}>
            <div className={`${styles.card} ${styles.stakingCard}`}>
                <h2 className="text-center mb-4">{t.title}</h2>

                <PoolStats
                    totalTvl={totalTvl}
                    currentPrize={currentPrize}
                    t={t}
                />

                {signedAccountId ? (
                    <div className="d-flex flex-column gap-4">

                        {/* Your Tickets */}
                        <div className={`${styles.description} d-flex flex-column gap-2 py-3`}>
                            <h6 className="text-center text-white-50 mb-3">{t.yourTickets}</h6>

                            {/* Active Balance */}
                            <div className="d-flex flex-column flex-sm-row align-items-center justify-content-sm-between w-100 px-3 mb-3 gap-2">
                                <span className="text-white-50 text-center text-sm-start mb-1 mb-sm-0">
                                    {t.activeBalanceLabel}:
                                </span>
                                <div className="text-center text-sm-end">
                                    <code className={`${styles.code} ${styles.stakedBalance} d-block fs-5`}>
                                        {Number(activeBalance).toFixed(4)} NEAR
                                    </code>
                                    {userActiveNum > 0 && (
                                        <span className="badge bg-info text-dark mt-1" style={{ fontSize: '0.75rem', boxShadow: '0 0 8px rgba(13, 202, 240, 0.5)' }}>
                                            🍀 {winChance}% {t.winChance}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Pending Balance */}
                            <div className="d-flex flex-column flex-sm-row align-items-center justify-content-sm-between w-100 px-3 mb-3 gap-2">
                                <span className="text-white-50 text-center text-sm-start mb-1 mb-sm-0">
                                    {t.pendingBalanceLabel}:
                                </span>
                                <div className="text-center text-sm-end">
                                    <code className={`${styles.code} ${styles.pendingBalance} d-block fs-5`}>
                                        {Number(pendingBalance).toFixed(4)} NEAR
                                    </code>
                                </div>
                            </div>

                            {/* UNSTAKING & CLAIM */}
                            {Number(unstakingBalance) > 0 && (
                                <div
                                    className="w-100 mt-3 p-4 d-flex flex-column align-items-center justify-content-center rounded"
                                    style={{
                                        backgroundColor: 'rgba(255, 193, 7, 0.05)',
                                        border: '1px solid rgba(255, 193, 7, 0.2)'
                                    }}
                                >
                                    <span className="text-warning mb-2 text-center w-100" style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                                        <i className="bi bi-hourglass-split me-1"></i> Unstaking:
                                    </span>

                                    <h3 className="text-warning fw-bold mb-4 text-center w-100" style={{ textShadow: '0 0 10px rgba(255, 193, 7, 0.2)' }}>
                                        {Number(unstakingBalance).toFixed(4)} NEAR
                                    </h3>

                                    <button
                                        onClick={handleClaim}
                                        disabled={!isReadyToClaim || isLoading}
                                        className="btn btn-warning w-100 fw-bold border-0 shadow-none text-center"
                                        style={{
                                            color: '#000',
                                            opacity: !isReadyToClaim ? 0.7 : 1,
                                            padding: '12px 0',
                                            borderRadius: '8px'
                                        }}
                                    >
                                        {isLoading ? (
                                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                        ) : isReadyToClaim ? (
                                            `${t.claimReady}`
                                        ) : timeLeft ? (
                                            `⏳ ${timeLeft.days > 0 ? timeLeft.days + 'd ' : ''}${timeLeft.hours}h ${timeLeft.minutes}m ${timeLeft.seconds}s`
                                        ) : (
                                            `${t.calculating}`
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Tabs */}
                        <ul className={`nav nav-pills nav-fill bg-dark rounded p-1 ${styles.tabList}`}>
                            <li className="nav-item">
                                <button
                                    className={`nav-link fw-bold ${activeTab === 'deposit' ? `active ${styles.gradientPrimary}` : 'text-white-50'}`}
                                    onClick={() => { setActiveTab('deposit'); setAmount(""); }}
                                >
                                    {t.depositTab}
                                </button>
                            </li>
                            <li className="nav-item">
                                <button
                                    className={`nav-link fw-bold ${activeTab === 'withdraw' ? `active ${styles.gradientPrimary}` : 'text-white-50'}`}
                                    onClick={() => { setActiveTab('withdraw'); setAmount(""); }}
                                >
                                    {t.withdrawTab}
                                </button>
                            </li>
                        </ul>

                        {/* Entering field */}
                        <div className="form-group position-relative">
                            <label htmlFor="txAmount" className="mb-2 text-white-50">
                                {activeTab === 'deposit' ? t.depositAmount : t.withdrawAmount}
                            </label>
                            <div className="input-group">
                                <input
                                    id="txAmount"
                                    name="txAmount"
                                    type="number"
                                    min={activeTab === 'deposit' ? "10" : "0.01"}
                                    step={activeTab === 'deposit' ? "1" : "any"}
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    placeholder={activeTab === 'deposit' ? (t.depositPlaceholder) : (t.withdrawPlaceholder)}
                                    className={`form-control form-control-lg bg-dark text-white border-end-0 ${styles.customInput}`}
                                />

                                {activeTab === 'withdraw' && (
                                    <button
                                        className={`btn btn-outline-secondary text-info border-start-0 ${styles.maxBtn}`}
                                        type="button"
                                        onClick={setMaxAmount}
                                    >
                                        {t.maxBtn}
                                    </button>
                                )}
                            </div>

                            {activeTab === 'withdraw' && (
                                <div className="alert alert-warning mt-3 mb-0 p-3" style={{ backgroundColor: 'rgba(255, 193, 7, 0.1)', borderColor: 'rgba(255, 193, 7, 0.3)', color: '#ffc107', fontSize: '0.85rem' }}>
                                    <div className="d-flex align-items-start">
                                        <i className="bi bi-info-circle me-2 mt-1 fs-5"></i>
                                        <div>
                                            <strong>{t.withdrawWarningTitle}:</strong> {t.withdrawWarningDesc}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Buttons */}
                        <button
                            onClick={activeTab === 'deposit' ? handleDeposit : handleWithdraw}
                            disabled={isButtonDisabled()}
                            className={`btn btn-lg w-100 fw-bold text-white ${styles.gradientPrimary}`}
                            style={{ opacity: isButtonDisabled() ? 0.5 : 1 }}
                        >
                            {isLoading ? (
                                <>
                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                    {t.confirmingTx}
                                </>
                            ) : (
                                activeTab === 'deposit' ? t.makeDepositBtn : t.withdrawBtn
                            )}
                        </button>
                    </div>
                ) : (
                    <div className={`${styles.description} d-flex flex-column align-items-center justify-content-center p-4`}>
                        <i className="bi bi-wallet2 text-white-50 mb-3" style={{ fontSize: '2.5rem' }}></i>
                        <p className="w-100 text-center text-white-50 mb-4" style={{ fontSize: '0.95rem' }}>
                            {t.connectToDeposit}
                        </p>
                        <button
                            onClick={triggerHeaderLogin}
                            className={`btn btn-lg w-100 fw-bold text-white ${styles.gradientPrimary}`}
                            style={{ borderRadius: '12px' }}
                        >
                            {t.connectBtn}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};