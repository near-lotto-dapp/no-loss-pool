import { useState, useEffect, useCallback } from 'react';
import { stakingService, UserMetrics } from '../services/near.ts';
import { formatNearAmount } from "@near-js/utils";
import { supabase } from '@/utils/supabaseClient';
import Big from 'big.js';
import { UI_DISPLAY_DECIMALS, PROFIT_DECIMALS, APY_VALUE, MIN_STAKE_AMOUNT } from '@/utils/constants';
import { fetchWithFallback } from '@/utils/rpc';
import { TxSuccessAlert } from "@/components/TxSuccessAlert.tsx";
import { TxErrorAlert } from "@/components/TxErrorAlert.tsx";
import { StakingStats } from "@/components/StakingStats.tsx";

interface StakingPanelProps {
    balance: string | null;
    walletAddress: string | null;
    t: any;
    onSuccess: () => void;
}

const safeTruncateStaking = (value: string | number, decimals: number) => {
    const str = typeof value === 'number' ? value.toFixed(10) : value.toString();
    const [whole, fraction] = str.split('.');
    if (!fraction) return whole;
    const truncated = fraction.slice(0, decimals);
    return parseFloat(`${whole}.${truncated}`).toString();
};

export function StakingPanel({ balance, walletAddress, t, onSuccess }: StakingPanelProps) {
    const [activeTab, setActiveTab] = useState<'stake' | 'unstake'>('stake');
    const [amount, setAmount] = useState('');
    const [selectedProvider, setSelectedProvider] = useState('linear-protocol.near');
    const [stakedBalance, setStakedBalance] = useState<string>('0');
    const [metrics, setMetrics] = useState<UserMetrics | null>(null);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [directRequest, setDirectRequest] = useState<any>(null);
    const [directTimeStr, setDirectTimeStr] = useState<string>('');
    const [unstakeStartTime, setUnstakeStartTime] = useState<string | null>(null);
    const [historicalWithdrawn, setHistoricalWithdrawn] = useState<string>('0');
    const [lifetimeProfit, setLifetimeProfit] = useState<string>((0).toFixed(PROFIT_DECIMALS));
    const [isProcessing, setIsProcessing] = useState(false);
    const [txError, setTxError] = useState<string | null>(null);
    const [successHash, setSuccessHash] = useState<string | null>(null);
    const [inputError, setInputError] = useState<string | null>(null);
    const [inputInfo, setInputInfo] = useState<string | null>(null);

    const fetchStakingData = useCallback(async (isSilent: boolean = false) => {
        if (!walletAddress) return;

        if (!isSilent) setIsLoadingData(true);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            let dbStartTime = null;
            let dbHistorical = "0";

            if (session?.user?.id) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('unstake_start_time, historical_withdrawn')
                    .eq('id', session.user.id)
                    .single();

                dbStartTime = profile?.unstake_start_time;
                if (profile?.historical_withdrawn) {
                    dbHistorical = profile.historical_withdrawn;
                }
            }
            setUnstakeStartTime(dbStartTime);
            setHistoricalWithdrawn(dbHistorical);

            const [sharesYocto, userMetrics, priceYocto] = await Promise.all([
                stakingService.getUserShares(walletAddress, selectedProvider),
                stakingService.getUserMetrics(walletAddress),
                stakingService.getLinearPrice()
            ]);

            setStakedBalance(formatNearAmount(sharesYocto));
            setMetrics(userMetrics);

            // Fetch direct request from LiNEAR Pool
            let activeDirect = null;
            try {
                const linearAcc = await fetchWithFallback({
                    jsonrpc: "2.0",
                    id: "dontcare",
                    method: "query",
                    params: {
                        request_type: "call_function",
                        finality: "optimistic",
                        account_id: selectedProvider,
                        method_name: "get_account",
                        args_base64: btoa(JSON.stringify({ account_id: walletAddress }))
                    }
                });

                if (linearAcc.result?.result) {
                    const accInfo = JSON.parse(String.fromCharCode(...linearAcc.result.result));
                    if (BigInt(accInfo.unstaked_balance || "0") > 0n) {
                        activeDirect = {
                            amount: accInfo.unstaked_balance,
                            can_withdraw: accInfo.can_withdraw
                        };
                    }
                }
            } catch (e) {
                console.error("Failed to fetch direct pool data", e);
            }
            setDirectRequest(activeDirect);

            // Calculate Total Wealth & Profit Logic
            if (userMetrics) {
                const price = new Big(priceYocto || '1000000000000000000000000').div(1e24);
                const shares = new Big(sharesYocto || '0').div(1e24);
                const directNearBig = activeDirect ? new Big(activeDirect.amount).div(1e24) : new Big(0);

                const activeValueNEAR = shares.times(price);
                const totalCurrentWealth = activeValueNEAR.plus(directNearBig);

                const withdrawnProxy = new Big(userMetrics.total_withdrawn || '0').div(1e24);
                const withdrawnHistorical = new Big(dbHistorical).div(1e24);
                const totalWithdrawnAll = withdrawnProxy.plus(withdrawnHistorical);

                const deposited = new Big(userMetrics.total_deposited || '0').div(1e24);

                let profit = totalCurrentWealth.plus(totalWithdrawnAll).minus(deposited);
                if (profit.lt(0)) profit = new Big(0);

                setLifetimeProfit(profit.toFixed(PROFIT_DECIMALS));
            }

        } catch (err) {
            console.error("Failed to load staking data", err);
        } finally {
            if (!isSilent) setIsLoadingData(false);
        }
    }, [walletAddress, selectedProvider]);

    // Global fetch interval
    useEffect(() => {
        fetchStakingData(false);
        const intervalId = setInterval(() => fetchStakingData(true), 60000);
        return () => clearInterval(intervalId);
    }, [fetchStakingData]);

    // Timers for direct channel unstaking
    useEffect(() => {
        const updateTimers = () => {
            if (directRequest) {
                if (directRequest.can_withdraw) {
                    setDirectTimeStr(t('staking.status_ready'));
                } else if (unstakeStartTime) {
                    const diff = (new Date(unstakeStartTime).getTime() + 72 * 3600 * 1000) - Date.now();
                    if (diff <= 0) {
                        setDirectTimeStr('⏳ Pool is unlocking funds...');
                    } else {
                        const d = Math.floor(diff / 86400000);
                        const h = Math.floor((diff / 3600000) % 24);
                        const m = Math.floor((diff / 60000) % 60);

                        const dayStr = t('time.day_short');
                        const hourStr = t('time.hour_short');
                        const minStr = t('time.min_short');
                        const daysDisplay = d > 0 ? `${d}${dayStr} ` : '';

                        setDirectTimeStr(`~ ${daysDisplay}${h.toString().padStart(2, '0')}${hourStr} ${m.toString().padStart(2, '0')}${minStr}`);
                    }
                } else {
                    setDirectTimeStr('⏳ Processing...');
                }
            }
        };

        updateTimers();
        const interval = setInterval(updateTimers, 60000);
        return () => clearInterval(interval);
    }, [directRequest, unstakeStartTime, t]);

    // Input Validation
    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val !== '' && !/^\d*\.?\d*$/.test(val)) return;
        setAmount(val);
        validateInput(val, activeTab);
    };

    const validateInput = (val: string, currentTab: 'stake' | 'unstake') => {
        setInputError(null);
        setInputInfo(null);
        if (!val) return;
        const numVal = parseFloat(val);

        if (currentTab === 'stake') {
            const maxStakeAllowed = parseFloat(balance || '0');
            if (numVal < MIN_STAKE_AMOUNT) {
                setInputError(t('staking.min_stake_error'));
            } else if (numVal > maxStakeAllowed) {
                setInputError(t('insufficientBalance'));
            }
        } else {
            const currentShares = parseFloat(stakedBalance);
            if (numVal > currentShares) {
                setInputError(t('insufficientBalanceError'));
            }
        }
    };

    // Reset state on tab switch
    useEffect(() => {
        setInputError(null);
        setInputInfo(null);
        setAmount('');
        setTxError(null);
        setSuccessHash(null);
    }, [activeTab]);

    const maxStakeAmount = parseFloat(balance || '0');
    const isStakeValid = parseFloat(amount) >= MIN_STAKE_AMOUNT && parseFloat(amount) <= maxStakeAmount;
    const isUnstakeValid = parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(stakedBalance);
    const canCreateDelayedUnstake = isUnstakeValid && !directRequest;

    const invokeStakingAction = async (payload: any) => {
        setIsProcessing(true);
        setTxError(null);
        setSuccessHash(null);

        // Save the amount BEFORE it resets post-transaction
        const pendingClaimAmount = directRequest?.amount || "0";

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error("Session expired. Please log in again.");

            const { data, error } = await supabase.functions.invoke('jomo-staking', {
                body: payload
            });

            if (error) throw new Error(error.message);
            if (data?.error) throw new Error(data.error);

            if (data?.hash) {
                let txFailed = false;
                let txErrorMsg = "";
                let attempts = 0;
                let isFound = false;

                while (!isFound && attempts < 4) {
                    await new Promise(res => setTimeout(res, 2000));
                    try {
                        const txData = await fetchWithFallback({
                            jsonrpc: "2.0", id: "dontcare", method: "EXPERIMENTAL_tx_status", params: [data.hash, walletAddress]
                        });

                        if (txData.error) { attempts++; continue; }
                        isFound = true;

                        if (txData.result?.status?.Failure) {
                            txFailed = true;
                            txErrorMsg = JSON.stringify(txData.result.status.Failure);
                        } else {
                            const outcomes = txData.result?.receipts_outcome || [];
                            for (const outcome of outcomes) {
                                if (outcome.outcome?.status?.Failure) {
                                    txFailed = true;
                                    txErrorMsg = JSON.stringify(outcome.outcome.status.Failure);
                                    break;
                                }
                            }
                        }
                    } catch (e) {
                        attempts++;
                    }
                }

                if (txFailed) {
                    throw new Error(`TxOnChainFailure: ${txErrorMsg}`);
                }

                setSuccessHash(data.hash);

                // Add successful direct claim to DB historical withdrawn
                if (payload.action === 'claim' && payload.claimType === 'direct') {
                    const currentHist = new Big(historicalWithdrawn || "0");
                    const newHist = currentHist.plus(new Big(pendingClaimAmount)).toString();

                    await supabase.from('profiles').update({ historical_withdrawn: newHist }).eq('id', session.user.id);
                    setHistoricalWithdrawn(newHist);
                }
            }

            setAmount('');
            setInputInfo(null);
            setInputError(null);
            onSuccess();
            await fetchStakingData(false);
        } catch (err: any) {
            console.error("Transaction failed:", err);
            const errMsg = err.message || "";
            if (errMsg.includes("not yet available due to unstaking delay") || errMsg.includes("Smart contract panicked")) {
                setTxError(t('staking.epoch_sync_error'));
            } else if (errMsg.includes("TxOnChainFailure")) {
                setTxError("Transaction failed on the blockchain. See explorer for details.");
            } else {
                setTxError(errMsg || "Action failed. Please try again.");
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleStake = () => invokeStakingAction({ action: 'stake', amount: String(amount), providerId: selectedProvider });
    const handleUnstake = () => invokeStakingAction({ action: 'unstake', amount: String(amount), providerId: selectedProvider });
    const handleClaimDirect = () => invokeStakingAction({ action: 'claim', claimType: 'direct', providerId: selectedProvider });

    // Shares
    const totalSharesStr = new Big(stakedBalance || "0").toFixed(UI_DISPLAY_DECIMALS);

    // Unstaking (Direct Pool)
    const directNearBig = directRequest ? new Big(directRequest.amount).div(1e24) : new Big(0);
    const unstakedAmountNEARStr = directNearBig.toFixed(UI_DISPLAY_DECIMALS);

    // Deposited
    const depositedBig = metrics ? new Big(metrics.total_deposited || "0").div(1e24) : new Big(0);
    const totalDepositedStr = depositedBig.toFixed(UI_DISPLAY_DECIMALS);

    // Withdrawn (Proxy + DB Historical)
    const withdrawnProxyBig = metrics ? new Big(metrics.total_withdrawn || "0").div(1e24) : new Big(0);
    const withdrawnHistoricalBig = new Big(historicalWithdrawn || "0").div(1e24);
    const totalWithdrawnStr = withdrawnProxyBig.plus(withdrawnHistoricalBig).toFixed(UI_DISPLAY_DECIMALS);

    return (
        <div className="mt-3 p-3 bg-black rounded border border-secondary animate__animated animate__fadeIn">

            <div className="d-flex mb-3 border-bottom border-secondary">
                <button
                    className={`btn flex-grow-1 rounded-0 border-0 ${activeTab === 'stake' ? 'btn-success text-dark fw-bold' : 'text-white-50'}`}
                    onClick={() => setActiveTab('stake')}
                >
                    {t('actions.stake')}
                </button>
                <button
                    className={`btn flex-grow-1 rounded-0 border-0 ${activeTab === 'unstake' ? 'btn-warning text-dark fw-bold' : 'text-white-50'}`}
                    onClick={() => setActiveTab('unstake')}
                >
                    {t('actions.withdraw')}
                </button>
            </div>

            <div className="mb-3">
                <label className="text-white-50 small mb-1">{t('chooseValidator')}</label>
                <select className="form-select bg-dark text-white border-secondary" value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value)} disabled={isProcessing}>
                    <option value="linear-protocol.near">Linear Protocol</option>
                </select>
            </div>

            {activeTab === 'stake' && (
                <>
                    <div className="mb-3 p-3 bg-dark rounded border border-secondary">
                        <div className="row text-center mb-3">
                            <div className="col-6 border-end border-secondary">
                                <div className="text-white-50 fw-semibold mb-1" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                                    {t('staking.estimated_apy').toUpperCase()}
                                </div>
                                <div className="text-success fw-bold fs-4">{ APY_VALUE }</div>
                            </div>
                            <div className="col-6">
                                <div className="text-white-50 fw-semibold mb-1" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                                    {t('staking.mint_token').toUpperCase()}
                                </div>
                                <div className="text-info fw-bold fs-4">LiNEAR</div>
                            </div>
                        </div>
                        <div className="text-center border-top border-secondary pt-2">
                            <small className="text-info" style={{ fontSize: '0.75rem' }}>
                                <i className="bi bi-info-circle me-1"></i>
                                {t('staking.liquid_token_info')}
                            </small>
                        </div>
                    </div>

                    <StakingStats
                        t={t}
                        totalDeposited={totalDepositedStr}
                        unstakedAmountNEAR={unstakedAmountNEARStr}
                        totalWithdrawn={totalWithdrawnStr}
                        totalShares={totalSharesStr}
                        lifetimeProfit={lifetimeProfit}
                    />
                </>
            )}

            <div className="mb-3">
                <div className="d-flex justify-content-between align-items-end mb-1">
                    <label className="text-white-50 small mb-0">
                        {activeTab === 'stake' ? t('staking.stakeAmount') : t('staking.amount_shares')}
                    </label>
                    <div className="text-end">
                        <small className="text-white-50 d-block">
                            {t('staking.available')} {isLoadingData
                            ? <span className="spinner-border spinner-border-sm ms-1" style={{width: '10px', height: '10px'}}></span>
                            : (activeTab === 'stake' ? `${balance || (0).toFixed(UI_DISPLAY_DECIMALS)} NEAR` : `${Number(stakedBalance).toFixed(UI_DISPLAY_DECIMALS)} Shares`)}
                        </small>
                    </div>
                </div>

                <div className="input-group">
                    <input
                        type="text"
                        inputMode="decimal"
                        className={`form-control bg-dark text-white ${inputError ? 'border-danger' : 'border-secondary'}`}
                        placeholder={activeTab === 'stake' ? `Min ${MIN_STAKE_AMOUNT}` : "0.0"}
                        value={amount}
                        onChange={handleAmountChange}
                        disabled={isProcessing}
                    />
                    <button
                        className="btn btn-outline-secondary"
                        onClick={() => {
                            let valToSet = '';
                            if (activeTab === 'stake') {
                                const maxStakeNum = parseFloat(balance || '0');
                                valToSet = maxStakeNum > 0 ? safeTruncateStaking(maxStakeNum, UI_DISPLAY_DECIMALS) : '0';
                            } else {
                                const sharesNum = parseFloat(stakedBalance || '0');
                                valToSet = sharesNum > 0 ? safeTruncateStaking(sharesNum, UI_DISPLAY_DECIMALS) : '0';
                            }
                            setAmount(valToSet);
                            validateInput(valToSet, activeTab);
                        }}
                        disabled={isProcessing}
                    >
                        {t('maxBtn')}
                    </button>
                </div>

                {inputError && (
                    <div className="text-danger small mt-1 animate__animated animate__fadeIn">
                        <i className="bi bi-exclamation-circle me-1"></i> {inputError}
                    </div>
                )}
                {inputInfo && !inputError && (
                    <div className="text-info small mt-1 animate__animated animate__fadeIn">
                        <i className="bi bi-info-circle me-1"></i> {inputInfo}
                    </div>
                )}
            </div>

            {activeTab === 'stake' ? (
                <button className="btn btn-success w-100 fw-bold py-2" disabled={!isStakeValid || isProcessing || isLoadingData} onClick={handleStake}>
                    {isProcessing ? <span className="spinner-border spinner-border-sm me-2"></span> : `${t('actions.stakeBtn')} ${amount || '0'} NEAR`}
                </button>
            ) : (
                <>
                    <div className="d-flex gap-2">
                        <button
                            className="btn btn-warning w-100 fw-bold position-relative text-dark"
                            disabled={!canCreateDelayedUnstake || isProcessing}
                            onClick={handleUnstake}
                            title={directRequest ? t('staking.active_req_tooltip') : ""}
                        >
                            {isProcessing ? <span className="spinner-border spinner-border-sm"></span> : t('staking.delayed_btn')}
                        </button>
                    </div>

                    <div className="d-flex justify-content-center mt-2 px-1 text-white-50" style={{ fontSize: '0.65rem', lineHeight: '1.2' }}>
                        <span className="text-center">
                            {t('staking.delayed_desc')}
                        </span>
                    </div>

                    <div className="mt-4 border-top border-secondary pt-3">
                        <h6 className="text-white mb-3">{t('staking.unstake_request')}</h6>
                        {!directRequest ? (
                            <p className="text-white-50 small text-center">{t('staking.no_active_requests')}</p>
                        ) : (
                            <div className="d-flex flex-column gap-2">
                                <div className="p-2 bg-dark rounded border border-info d-flex justify-content-between align-items-center">
                                    <div>
                                        <div className="small text-info mb-1" style={{fontSize: '0.65rem', letterSpacing: '0.5px'}}>DIRECT POOL UNSTAKE</div>
                                        <div className="fw-bold text-white">{Number(formatNearAmount(directRequest.amount)).toFixed(UI_DISPLAY_DECIMALS)} NEAR</div>
                                        <div className="small fw-bold" style={{ color: directRequest.can_withdraw ? '#28a745' : '#ffc107', letterSpacing: '0.5px' }}>
                                            {directRequest.can_withdraw ? t('staking.status_ready') : directTimeStr}
                                        </div>
                                    </div>
                                    <button
                                        className={`btn btn-sm fw-bold ${directRequest.can_withdraw ? 'btn-success' : 'btn-outline-secondary'}`}
                                        disabled={!directRequest.can_withdraw || isProcessing}
                                        onClick={handleClaimDirect}
                                    >
                                        {t('staking.claim_btn')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </>
            )}

            <TxErrorAlert error={txError} onClose={() => setTxError(null)} />
            <TxSuccessAlert hash={successHash} message={t('successTx')} t={t} onClose={() => setSuccessHash(null)} />
        </div>
    );
}