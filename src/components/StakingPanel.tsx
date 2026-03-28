import { useState, useEffect, useCallback } from 'react';
import { stakingService, UserMetrics } from '../services/near.ts';
import { formatNearAmount } from "@near-js/utils";
import { supabase } from '@/utils/supabaseClient';
import Big from 'big.js';
import { UI_DISPLAY_DECIMALS, PROFIT_DECIMALS } from '@/utils/constants';
import { fetchWithFallback, checkContractClaimReadiness } from '@/utils/rpc';

interface StakingPanelProps {
    balance: string | null;
    walletAddress: string | null;
    t: any;
    onSuccess: () => void;
}

const MIN_STAKE_AMOUNT = 1;
const STAKING_GAS_RESERVE = 0.05;

const safeTruncate = (value: string | number, decimals: number) => {
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
    const [currentEpoch, setCurrentEpoch] = useState<number>(0);
    const [isLoadingData, setIsLoadingData] = useState(false);

    // DUAL CHANNEL REQUESTS
    const [legacyRequest, setLegacyRequest] = useState<any>(null);
    const [directRequest, setDirectRequest] = useState<any>(null);

    // UI states
    const [isLegacyReady, setIsLegacyReady] = useState(false);
    const [legacyTimeStr, setLegacyTimeStr] = useState<string>('');
    const [directTimeStr, setDirectTimeStr] = useState<string>('');
    const [unstakeStartTime, setUnstakeStartTime] = useState<string | null>(null);

    const [lifetimeProfit, setLifetimeProfit] = useState<string>((0).toFixed(PROFIT_DECIMALS));
    const [linearPrice, setLinearPrice] = useState<string>('1000000000000000000000000');

    const [isProcessing, setIsProcessing] = useState(false);
    const [txError, setTxError] = useState<string | null>(null);
    const [successHash, setSuccessHash] = useState<string | null>(null);

    const [inputError, setInputError] = useState<string | null>(null);
    const [inputInfo, setInputInfo] = useState<string | null>(null);

    const fetchStakingData = useCallback(async (isSilent: boolean = false) => {
        if (!walletAddress) return;

        if (!isSilent) setIsLoadingData(true);

        try {
            // Fetch DB start time
            const { data: { session } } = await supabase.auth.getSession();
            let dbStartTime = null;
            if (session?.user?.id) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('unstake_start_time')
                    .eq('id', session.user.id)
                    .single();
                dbStartTime = profile?.unstake_start_time;
            }
            setUnstakeStartTime(dbStartTime);

            // Fetch JOMO blockchain data
            const [sharesYocto, requestData, userMetrics, priceYocto, epochNum] = await Promise.all([
                stakingService.getUserShares(walletAddress, selectedProvider),
                stakingService.getUserUnstakeRequest(walletAddress),
                stakingService.getUserMetrics(walletAddress),
                stakingService.getLinearPrice(),
                stakingService.getCurrentEpoch()
            ]);

            setStakedBalance(formatNearAmount(sharesYocto));
            setCurrentEpoch(epochNum);
            setMetrics(userMetrics);

            // 1. LEGACY REQUEST (JOMO Proxy)
            let activeLegacy = null;
            if (requestData && !requestData.is_claimed) {
                activeLegacy = requestData;
                const isJomoEpochReady = epochNum > requestData.unlock_epoch;
                const proxyAccountId = import.meta.env.VITE_CONTRACT_ID || "proxy.jomo-vault.near";

                if (isJomoEpochReady) {
                    const isPoolReady = await checkContractClaimReadiness(proxyAccountId, selectedProvider);
                    setIsLegacyReady(isPoolReady);
                } else {
                    setIsLegacyReady(false);
                }
            } else {
                setIsLegacyReady(false);
            }
            setLegacyRequest(activeLegacy);

            // 2. DIRECT REQUEST (LiNEAR Pool)
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

            // --- Total Wealth & Profit Logic ---
            setLinearPrice(priceYocto);
            if (userMetrics) {
                const price = new Big(priceYocto || '1000000000000000000000000').div(1e24);
                const shares = new Big(sharesYocto || '0').div(1e24);

                const legacySharesBig = activeLegacy ? new Big(activeLegacy.amount).div(1e24) : new Big(0);
                const directNearBig = activeDirect ? new Big(activeDirect.amount).div(1e24) : new Big(0);

                const activeValueNEAR = shares.times(price);
                const legacyValueNEAR = legacySharesBig.times(price);
                const totalCurrentWealth = activeValueNEAR.plus(legacyValueNEAR).plus(directNearBig);

                const withdrawn = new Big(userMetrics.total_withdrawn || '0').div(1e24);
                const deposited = new Big(userMetrics.total_deposited || '0').div(1e24);

                let profit = totalCurrentWealth.plus(withdrawn).minus(deposited);
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

    // --- TIMERS FOR BOTH CHANNELS ---
    useEffect(() => {
        const updateTimers = () => {
            // Legacy Timer
            if (legacyRequest) {
                const isJomoEpochReady = currentEpoch > legacyRequest.unlock_epoch;
                if (isLegacyReady) {
                    setLegacyTimeStr(t.staking?.status_ready || 'Ready');
                } else if (isJomoEpochReady) {
                    setLegacyTimeStr('⏳ Finalizing in proxy...');
                } else {
                    const epochs = Math.max(1, (legacyRequest.unlock_epoch + 1) - currentEpoch);
                    setLegacyTimeStr(epochs === 1 ? t.staking?.unlocks_soon || '~ 12h' : `~ ${epochs * 12}h`);
                }
            }

            // Direct Timer (Web2.5 Smooth UX)
            if (directRequest) {
                if (directRequest.can_withdraw) {
                    setDirectTimeStr(t.staking?.status_ready || 'Ready');
                } else if (unstakeStartTime) {
                    const diff = (new Date(unstakeStartTime).getTime() + 72 * 3600 * 1000) - Date.now();
                    if (diff <= 0) {
                        setDirectTimeStr('⏳ Pool is unlocking funds...');
                    } else {
                        const d = Math.floor(diff / 86400000);
                        const h = Math.floor((diff / 3600000) % 24);
                        const m = Math.floor((diff / 60000) % 60);

                        const dayStr = t.time?.day_short || 'd';
                        const hourStr = t.time?.hour_short || 'h';
                        const minStr = t.time?.min_short || 'm';
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
    }, [legacyRequest, directRequest, isLegacyReady, currentEpoch, unstakeStartTime, t]);

    // --- Validation ---
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
            const maxStakeAllowed = parseFloat((parseFloat(balance || '0') - STAKING_GAS_RESERVE).toFixed(6));
            if (numVal < MIN_STAKE_AMOUNT) {
                setInputError(t.staking?.min_stake_error || `Minimum stake is ${MIN_STAKE_AMOUNT} NEAR`);
            } else if (numVal > maxStakeAllowed) {
                setInputError(t.insufficientBalanceGas || `Leave ${STAKING_GAS_RESERVE} NEAR for gas.`);
            } else if (numVal === parseFloat(safeTruncate(maxStakeAllowed, UI_DISPLAY_DECIMALS))) {
                setInputInfo(`Reserved ${STAKING_GAS_RESERVE} NEAR for network fees.`);
            }
        } else {
            const currentShares = parseFloat(stakedBalance);
            if (numVal > currentShares) {
                setInputError(t.insufficientBalanceError || "Insufficient shares balance.");
            }
        }
    };

    useEffect(() => {
        setInputError(null);
        setInputInfo(null);
        setAmount('');
        setTxError(null);
        setSuccessHash(null);
    }, [activeTab]);

    const maxStakeAmount = parseFloat((parseFloat(balance || '0') - STAKING_GAS_RESERVE).toFixed(6));
    const isStakeValid = parseFloat(amount) >= MIN_STAKE_AMOUNT && parseFloat(amount) <= maxStakeAmount;
    const isUnstakeValid = parseFloat(amount) > 0 && parseFloat(amount) <= parseFloat(stakedBalance);
    const canCreateDelayedUnstake = isUnstakeValid && !legacyRequest && !directRequest;

    const invokeStakingAction = async (payload: any) => {
        setIsProcessing(true);
        setTxError(null);
        setSuccessHash(null);

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
                            jsonrpc: "2.0",
                            id: "dontcare",
                            method: "EXPERIMENTAL_tx_status",
                            params: [data.hash, walletAddress]
                        });

                        if (txData.error) {
                            attempts++;
                            continue;
                        }

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
                setTxError(t.staking?.epoch_sync_error || "The pool is unlocking funds. Please wait.");
            } else if (errMsg.includes("TxOnChainFailure")) {
                setTxError("Transaction failed on the blockchain. See explorer for details.");
            } else {
                setTxError(errMsg || "Action failed. Please try again.");
            }
        } finally {
            setIsProcessing(false);
        }
    };

    const handleStake = () => invokeStakingAction({ action: 'stake', amount, providerId: selectedProvider });
    const handleUnstake = () => invokeStakingAction({ action: 'unstake', amount, providerId: selectedProvider });
    const handleClaimLegacy = () => invokeStakingAction({ action: 'claim', claimType: 'legacy', providerId: selectedProvider });
    const handleClaimDirect = () => invokeStakingAction({ action: 'claim', claimType: 'direct', providerId: selectedProvider });

    const activeSharesNum = parseFloat(stakedBalance);
    const legacySharesNum = legacyRequest ? parseFloat(formatNearAmount(legacyRequest.amount)) : 0;
    const directNearNum = directRequest ? parseFloat(formatNearAmount(directRequest.amount)) : 0;
    const priceNum = parseFloat(formatNearAmount(linearPrice)) || 1;

    const totalShares = activeSharesNum + legacySharesNum;
    const unstakedAmountNEAR = (legacySharesNum * priceNum) + directNearNum;
    const totalDeposited = metrics ? parseFloat(formatNearAmount(metrics.total_deposited)) : 0;
    const totalWithdrawn = metrics ? parseFloat(formatNearAmount(metrics.total_withdrawn)) : 0;

    return (
        <div className="mt-3 p-3 bg-black rounded border border-secondary animate__animated animate__fadeIn">
            {successHash && (
                <div className="alert alert-success py-2 small mb-3 animate__animated animate__bounceIn">
                    <div className="d-flex justify-content-between align-items-center">
                        <span><i className="bi bi-check-circle-fill me-2"></i>{t.successTx || "Success!"}</span>
                        <button type="button" className="btn-close btn-close-white" style={{fontSize: '0.6rem'}} onClick={() => setSuccessHash(null)}></button>
                    </div>
                    <a href={`https://nearblocks.io/txns/${successHash}`} target="_blank" rel="noopener noreferrer" className="text-decoration-underline text-success d-block mt-1">
                        {t.viewExplorer || "View on Near Explorer"}
                    </a>
                </div>
            )}

            {txError && (
                <div className="alert alert-danger py-2 small text-center mb-3 animate__animated animate__shakeX">
                    <i className="bi bi-exclamation-octagon me-2"></i>{txError}
                </div>
            )}

            <div className="d-flex mb-3 border-bottom border-secondary">
                <button
                    className={`btn flex-grow-1 rounded-0 border-0 ${activeTab === 'stake' ? 'btn-success text-dark fw-bold' : 'text-white-50'}`}
                    onClick={() => setActiveTab('stake')}
                >
                    {t.actions?.stake || 'Stake'}
                </button>
                <button
                    className={`btn flex-grow-1 rounded-0 border-0 ${activeTab === 'unstake' ? 'btn-warning text-dark fw-bold' : 'text-white-50'}`}
                    onClick={() => setActiveTab('unstake')}
                >
                    {t.actions?.withdraw || 'Unstake'}
                </button>
            </div>

            <div className="mb-3">
                <label className="text-white-50 small mb-1">{t.chooseValidator || "Validator"}</label>
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
                                    {t.staking?.estimated_apy?.toUpperCase() || "ESTIMATED APY"}
                                </div>
                                <div className="text-success fw-bold fs-4">~4.3%</div>
                            </div>
                            <div className="col-6">
                                <div className="text-white-50 fw-semibold mb-1" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                                    {t.staking?.mint_token?.toUpperCase() || "MINT TOKEN"}
                                </div>
                                <div className="text-info fw-bold fs-4">LiNEAR</div>
                            </div>
                        </div>
                        <div className="text-center border-top border-secondary pt-2">
                            <small className="text-info" style={{ fontSize: '0.75rem' }}>
                                <i className="bi bi-info-circle me-1"></i>
                                {t.staking?.liquid_token_info || "You receive liquid tokens instantly while earning rewards"}
                            </small>
                        </div>
                    </div>

                    <div className="mb-3 p-3 bg-dark rounded border border-secondary">
                        <h6 className="text-white mb-3" style={{ fontSize: '0.85rem' }}>{t.staking?.performance || "Your Performance"}</h6>
                        <div className="d-flex justify-content-between mb-1">
                            <small className="text-white-50">{t.staking?.total_deposited || "Total Deposited"}</small>
                            <span className="text-white fw-bold">{totalDeposited.toFixed(UI_DISPLAY_DECIMALS)} NEAR</span>
                        </div>

                        {unstakedAmountNEAR > 0 && (
                            <div className="d-flex justify-content-between mb-1">
                                <small className="text-white-50">{t.inUnstakeProcess || "In Unstaking"}</small>
                                <span className="text-warning fw-bold">{unstakedAmountNEAR.toFixed(UI_DISPLAY_DECIMALS)} NEAR</span>
                            </div>
                        )}

                        <div className="d-flex justify-content-between mb-1">
                            <small className="text-white-50">{t.staking?.total_withdrawn || "Total Withdrawn"}</small>
                            <span className="text-white fw-bold">{totalWithdrawn.toFixed(UI_DISPLAY_DECIMALS)} NEAR</span>
                        </div>

                        <div className="d-flex justify-content-between pt-1 mt-1">
                            <small className="text-white-50">{t.staking?.total_shares || "Total Shares (Inc. Hold)"}</small>
                            <span className="text-info fw-bold">{totalShares.toFixed(UI_DISPLAY_DECIMALS)} LiNEAR</span>
                        </div>

                        <div className="d-flex justify-content-between pt-2 mt-2 border-top border-secondary">
                            <small className="text-white-50">{t.staking?.lifetime_profit || "Lifetime Earned"}</small>
                            <span
                                className="text-success fw-bold"
                                style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '0.5px' }}
                            >
                                +{lifetimeProfit} NEAR
                            </span>
                        </div>
                    </div>
                </>
            )}

            <div className="mb-3">
                <div className="d-flex justify-content-between">
                    <label className="text-white-50 small mb-1">
                        {activeTab === 'stake' ? (t.staking?.amount_near || "Amount (NEAR)") : (t.staking?.amount_shares || "Amount (Shares)")}
                    </label>
                    <small className="text-white-50">
                        {t.staking?.available || "Available:"} {isLoadingData
                        ? <span className="spinner-border spinner-border-sm ms-1" style={{width: '10px', height: '10px'}}></span>
                        : (activeTab === 'stake' ? `${balance || (0).toFixed(UI_DISPLAY_DECIMALS)} NEAR` : `${Number(stakedBalance).toFixed(UI_DISPLAY_DECIMALS)} Shares`)}
                    </small>
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
                                const maxStakeNum = Math.max(0, parseFloat(balance || '0') - STAKING_GAS_RESERVE);
                                valToSet = maxStakeNum > 0 ? safeTruncate(maxStakeNum, UI_DISPLAY_DECIMALS) : '0';
                            } else {
                                const sharesNum = parseFloat(stakedBalance || '0');
                                valToSet = sharesNum > 0 ? safeTruncate(sharesNum, UI_DISPLAY_DECIMALS) : '0';
                            }
                            setAmount(valToSet);
                            validateInput(valToSet, activeTab);
                        }}
                        disabled={isProcessing}
                    >
                        {t.maxBtn || "MAX"}
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
                    {isProcessing ? <span className="spinner-border spinner-border-sm me-2"></span> : `${t.actions?.stake || 'Stake'} ${amount || '0'} NEAR`}
                </button>
            ) : (
                <>
                    <div className="d-flex gap-2">
                        <button
                            className="btn btn-warning w-100 fw-bold position-relative text-dark"
                            disabled={!canCreateDelayedUnstake || isProcessing}
                            onClick={handleUnstake}
                            title={(legacyRequest || directRequest) ? (t.staking?.active_req_tooltip || "You already have an active request") : ""}
                        >
                            {isProcessing ? <span className="spinner-border spinner-border-sm"></span> : (t.staking?.delayed_btn || "Unstake")}
                        </button>
                    </div>

                    <div className="d-flex justify-content-center mt-2 px-1 text-white-50" style={{ fontSize: '0.65rem', lineHeight: '1.2' }}>
                        <span className="text-center">
                            {t.staking?.delayed_desc || "⏳ Unstaking takes ~2-3 days. Fee: 0.3% JOMO."}
                        </span>
                    </div>

                    <div className="mt-4 border-top border-secondary pt-3">
                        <h6 className="text-white mb-3">{t.staking?.unstake_request || "Unstake Request"}</h6>
                        {!legacyRequest && !directRequest ? (
                            <p className="text-white-50 small text-center">{t.staking?.no_active_requests || "No active requests"}</p>
                        ) : (
                            <div className="d-flex flex-column gap-2">

                                {/* old unstake logic */}
                                {legacyRequest && (
                                    <div className="p-2 bg-dark rounded border border-secondary d-flex justify-content-between align-items-center">
                                        <div>
                                            <div className="fw-bold text-white">{Number(formatNearAmount(legacyRequest.amount)).toFixed(UI_DISPLAY_DECIMALS)} Shares</div>
                                            <div className="small fw-bold" style={{ color: isLegacyReady ? '#28a745' : '#ffc107', letterSpacing: '0.5px' }}>
                                                {isLegacyReady ? (t.staking?.status_ready || "Ready") : legacyTimeStr}
                                            </div>
                                        </div>
                                        <button
                                            className={`btn btn-sm fw-bold ${isLegacyReady ? 'btn-success' : 'btn-outline-secondary'}`}
                                            disabled={!isLegacyReady || isProcessing}
                                            onClick={handleClaimLegacy}
                                        >
                                            {t.staking?.claim_btn || "Claim"}
                                        </button>
                                    </div>
                                )}

                                {/* direct unstake*/}
                                {directRequest && (
                                    <div className="p-2 bg-dark rounded border border-info d-flex justify-content-between align-items-center">
                                        <div>
                                            <div className="small text-info mb-1" style={{fontSize: '0.65rem', letterSpacing: '0.5px'}}>DIRECT POOL UNSTAKE</div>
                                            <div className="fw-bold text-white">{Number(formatNearAmount(directRequest.amount)).toFixed(UI_DISPLAY_DECIMALS)} NEAR</div>
                                            <div className="small fw-bold" style={{ color: directRequest.can_withdraw ? '#28a745' : '#ffc107', letterSpacing: '0.5px' }}>
                                                {directRequest.can_withdraw ? (t.staking?.status_ready || "Ready") : directTimeStr}
                                            </div>
                                        </div>
                                        <button
                                            className={`btn btn-sm fw-bold ${directRequest.can_withdraw ? 'btn-success' : 'btn-outline-secondary'}`}
                                            disabled={!directRequest.can_withdraw || isProcessing}
                                            onClick={handleClaimDirect}
                                        >
                                            {t.staking?.claim_btn || "Claim"}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}