import { useState, useEffect } from 'react';
import { useNearWallet } from 'near-connect-hooks';
import { poolContract } from '@/contracts/pool_contract';
import { formatNearAmount } from '@near-js/utils';
import styles from '@/styles/app.module.css';

interface StakingPanelProps {
    t: any;
    dbTvl?: string | number;
    dbPrizePool?: string | number;
    isLoadingDb?: boolean;
}

const useNextDrawTimer = (drawingNowText: string) => {
    const [drawTimeLeft, setDrawTimeLeft] = useState<string>("...");

    useEffect(() => {
        const calculateTimeLeft = () => {
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
                setDrawTimeLeft(`${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`);
            } else {
                setDrawTimeLeft(drawingNowText);
            }
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 1000);
        return () => clearInterval(timer);
    }, [drawingNowText]);

    return drawTimeLeft;
};

const formatNear = (value: string | number | undefined, decimals: number): string => {
    if (value === undefined) return "0.00";
    const num = Number(value);
    return isNaN(num) ? "0.00" : num.toFixed(decimals);
};

export const StakingPanel = ({ t, dbTvl, dbPrizePool, isLoadingDb }: StakingPanelProps) => {
    const { signedAccountId, callFunction, loading, signIn, signOut } = useNearWallet();

    const [activeBalance, setActiveBalance] = useState<string>("0");
    const [pendingBalance, setPendingBalance] = useState<string>("0");
    const [amount, setAmount] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');
    const [totalActivePool, setTotalActivePool] = useState<string>("0");

    // Unstaking states
    const [unstakingBalance, setUnstakingBalance] = useState<string>("0");
    const [unlockTime, setUnlockTime] = useState<number>(0);
    const [now, setNow] = useState<number>(Date.now());

    const drawTimeLeft = useNextDrawTimer(t.drawingNow || "Draw...");
    const hasActiveUnstake = Number(unstakingBalance) > 0;

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
            const active = BigInt(poolInfo.total_active || "0");
            setTotalActivePool(formatNearAmount(active.toString()));
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
        const num = Number(activeBalance);
        const safeMax = Math.floor(num * 10000) / 10000;

        if (safeMax > 0) {
            setAmount(safeMax.toString());
        } else {
            setAmount("0");
        }
    };

    const isButtonDisabled = () => {
        if (isLoading || !amount || loading) return true;

        const numAmount = Number(amount);
        if (activeTab === 'deposit') {
            return numAmount < 10;
        } else {
            return numAmount <= 0 || hasActiveUnstake;
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

    return (
        <div className={styles.center}>
            <div className={`${styles.card} ${styles.stakingCard}`}>
                <h2 className="text-center mb-4">{t.title}</h2>

                <div className="w-100 mb-4">
                    <div className="text-center mb-4">
                        <div className="badge bg-dark border border-secondary p-2 mt-2 shadow-sm">
                            <span className="text-white-50 me-2">{t.nextDrawIn}</span>
                            <span className="text-info fw-bold font-monospace timer-text" style={{ fontSize: '1.05rem' }}>
                                {drawTimeLeft}
                            </span>
                        </div>
                    </div>

                    <div className="bg-dark rounded p-3 mb-4 text-center tvl-card">
                        <h6 className="text-white-50 mb-2">{t.poolTvl}</h6>
                        <h3 className="text-success m-0 fw-bold text-glow-success">
                            {isLoadingDb ? "..." : `${formatNear(dbTvl, 4)} NEAR`}
                        </h3>
                        <div className="mt-2 d-flex justify-content-center align-items-center gap-2">
                            <span className="badge bg-success-subtle text-success border border-success-subtle small">
                                {t.apyLabel}
                            </span>
                        </div>
                    </div>

                    <div className="bg-dark rounded p-3 mb-4 text-center border border-warning prize-card">
                        <h6 className="text-warning mb-1">{t.prizePoolLabel}</h6>
                        <h4 className="text-warning m-0 fw-bold text-glow-warning">
                            {isLoadingDb ? "..." : `${formatNear(dbPrizePool, 5)} NEAR`}
                        </h4>
                    </div>
                </div>

                {signedAccountId ? (
                    <div className="d-flex flex-column gap-4">

                        <div className="d-flex justify-content-between align-items-center p-3 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <div className="d-flex align-items-center gap-2 text-truncate me-2">
                                <i className="bi bi-wallet2 text-info fs-5"></i>
                                <span className="font-monospace text-white fw-bold text-truncate">
                                    {signedAccountId}
                                </span>
                            </div>
                            <button
                                onClick={() => signOut()}
                                className="btn btn-sm btn-outline-secondary text-white-50 border-0 flex-shrink-0"
                                style={{ fontSize: '0.85rem' }}
                            >
                                <i className="bi bi-box-arrow-right me-1"></i> {t.logoutBtn}
                            </button>
                        </div>

                        <div className={`${styles.description} d-flex flex-column gap-2 py-3`}>
                            <h6 className="text-center text-white-50 mb-3">{t.yourTickets}</h6>

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

                            {Number(unstakingBalance) > 0 && (
                                <div
                                    className="w-100 mt-3 p-4 d-flex flex-column align-items-center justify-content-center rounded"
                                    style={{
                                        backgroundColor: 'rgba(255, 193, 7, 0.05)',
                                        border: '1px solid rgba(255, 193, 7, 0.2)'
                                    }}
                                >
                                    <span className="text-warning mb-2 text-center w-100" style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                                        <i className="bi bi-hourglass-split me-1"></i> {t.unstaking}
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
                                    disabled={activeTab === 'withdraw' && hasActiveUnstake}
                                />

                                {activeTab === 'withdraw' && (
                                    <button
                                        className={`btn btn-outline-secondary text-info border-start-0 ${styles.maxBtn}`}
                                        type="button"
                                        onClick={setMaxAmount}
                                        disabled={hasActiveUnstake}
                                    >
                                        {t.maxBtn}
                                    </button>
                                )}
                            </div>

                            {activeTab === 'withdraw' && hasActiveUnstake && (
                                <div className="alert alert-danger mt-3 mb-0 p-3" style={{ fontSize: '0.85rem' }}>
                                    <div className="d-flex align-items-start">
                                        <i className="bi bi-exclamation-triangle-fill me-2 mt-1 fs-5"></i>
                                        <div>
                                            <strong>{t.warning || "Warning"}:</strong> {t.activeUnstakeWarning || `You already have an active unstake request (${Number(unstakingBalance).toFixed(4)} NEAR). Please wait for the timer and click Claim before withdrawing new funds.`}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'withdraw' && !hasActiveUnstake && (
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
                            onClick={() => signIn()}
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