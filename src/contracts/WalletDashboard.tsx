import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { supabase } from '@/utils/supabaseClient';
import { StakingPanel } from "@/components/StakingPanel.tsx";
import { UI_DISPLAY_DECIMALS } from '@/utils/constants';

interface WalletDashboardProps {
    user: any;
    t: any;
}

// Define possible view tabs
type ViewType = 'cloud' | 'stake' | 'private';

export function WalletDashboard({ user, t }: WalletDashboardProps) {

    // --- Navigation State ---
    const [currentView, setCurrentView] = useState<ViewType>('cloud');
    const [hoveredTab, setHoveredTab] = useState<ViewType | null>(null);

    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [loadingWallet, setLoadingWallet] = useState(false);
    const [balance, setBalance] = useState<string | null>(null);
    const [loadingBalance, setLoadingBalance] = useState(false);

    const [isGeneratingWallet, setIsGeneratingWallet] = useState(false);

    const [showDeposit, setShowDeposit] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showWithdraw, setShowWithdraw] = useState(false);

    const [withdrawAddress, setWithdrawAddress] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [loadingWithdraw, setLoadingWithdraw] = useState(false);
    const [withdrawError, setWithdrawError] = useState<string | null>(null);
    const [withdrawSuccess, setWithdrawSuccess] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);
    const [addressError, setAddressError] = useState<string | null>(null);
    const [amountError, setAmountError] = useState<string | null>(null);

    const GAS_RESERVE = 0.015;

    const safeTruncate = (value: string | number, decimals: number) => {
        const str = typeof value === 'number' ? value.toFixed(10) : value.toString();
        const [whole, fraction] = str.split('.');
        if (!fraction) return whole;
        const truncated = fraction.slice(0, decimals);
        return parseFloat(`${whole}.${truncated}`).toString();
    };

    const fetchBalance = async (accountId: string, isSilent = false) => {
        if (!isSilent) setLoadingBalance(true);
        try {
            const res = await fetch(import.meta.env.VITE_NEAR_URL, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jsonrpc: "2.0", id: "dontcare", method: "query", params: { request_type: "view_account", finality: "optimistic", account_id: accountId } })
            });
            const data = await res.json();
            setBalance(data.result?.amount ? (Number(data.result.amount) / 1e24).toFixed(UI_DISPLAY_DECIMALS) : (0).toFixed(UI_DISPLAY_DECIMALS));
        } catch (err) {
            setBalance((0).toFixed(UI_DISPLAY_DECIMALS));
        } finally {
            if (!isSilent) setLoadingBalance(false);
        }
    };

    useEffect(() => {
        const fetchWalletAndBalance = async () => {
            if (!user) return;
            setLoadingWallet(true);
            try {
                const { data } = await supabase.from('profiles').select('near_account_id').eq('id', user.id).maybeSingle();
                if (data && data.near_account_id) {
                    setWalletAddress(data.near_account_id);
                    await fetchBalance(data.near_account_id);
                }
                await supabase
                    .from('profiles')
                    .update({ last_activity: new Date().toISOString() })
                    .eq('id', user.id);
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingWallet(false);
            }
        };
        fetchWalletAndBalance();
    }, [user]);

    useEffect(() => {
        let intervalId: NodeJS.Timeout;
        if (walletAddress) {
            intervalId = setInterval(() => { fetchBalance(walletAddress, true); }, 10000);
        }
        return () => clearInterval(intervalId);
    }, [walletAddress]);

    const handleRegenerateWallet = async () => {
        setIsGeneratingWallet(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error("Session expired. Please log in again.");

            const { data, error } = await supabase.functions.invoke('create-near-wallet', {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });

            if (error) throw new Error(error.message);

            if (data && data.account_id) {
                setWalletAddress(data.account_id);
                await fetchBalance(data.account_id);
            }
        } catch (err: any) {
            console.error("Regeneration failed:", err);
            alert(err.message || "Failed to regenerate wallet.");
        } finally {
            setIsGeneratingWallet(false);
        }
    };

    const handleWithdraw = async () => {
        setLoadingWithdraw(true);
        setWithdrawError(null);
        setWithdrawSuccess(false);
        setTxHash(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error("Session expired. Please log in again.");

            const { data, error } = await supabase.functions.invoke('withdraw-near', {
                body: { recipientId: withdrawAddress, amount: withdrawAmount },
                headers: { Authorization: `Bearer ${session.access_token}` }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            if (data?.hash) {
                setTxHash(data.hash);
                setWithdrawSuccess(true);
                setWithdrawAmount('');
                setWithdrawAddress('');
                setTimeout(() => { if (walletAddress) fetchBalance(walletAddress, true); }, 2000);
            }
        } catch (err: any) {
            setWithdrawError(err.message || "Withdrawal failed");
        } finally {
            setLoadingWithdraw(false);
        }
    };

    const validateNearAddress = (address: string) => {
        if (!address) { setAddressError(null); return true; }
        if (address.length < 2 || address.length > 64) { setAddressError(t.invalidNearLength || "Address must be between 2 and 64 characters."); return false; }
        if (address.startsWith('0x')) { setAddressError(t.invalidNearFormat || "NEAR addresses do not start with 0x."); return false; }
        if (address === walletAddress) { setAddressError("You cannot withdraw to your own wallet."); return false; }
        if (address.length !== 64 && !address.includes('.')) { setAddressError(t.invalidNearFormat || "Address must contain a domain (e.g. .near, .tg) or be 64 characters long."); return false; }

        const nearRegex = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
        if (!nearRegex.test(address)) { setAddressError(t.invalidNearFormat || "Invalid NEAR format."); return false; }
        if (address.length === 64 && !/^[a-f0-9]{64}$/.test(address)) { setAddressError(t.invalidNearFormat || "Invalid 64-character account ID (must be hex)."); return false; }

        setAddressError(null);
        return true;
    };

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (val !== '' && !/^\d*\.?\d*$/.test(val)) return;
        setWithdrawAmount(val);
        validateAmount(val);
    };

    const validateAmount = (val: string) => {
        if (!val) { setAmountError(null); return true; }
        const numVal = parseFloat(val);
        const maxBalance = parseFloat(balance || '0');

        if (isNaN(numVal) || numVal <= 0) { setAmountError(t.invalidAmountZero || "Amount must be greater than 0"); return false; }
        const maxAllowed = parseFloat((maxBalance - GAS_RESERVE).toFixed(6));
        if (numVal > maxAllowed) {
            const errorMsg = (t.insufficientGasReserve || `Insufficient balance. Reserve ${GAS_RESERVE} NEAR for gas.`).replace('{{reserve}}', GAS_RESERVE.toString());
            setAmountError(errorMsg);
            return false;
        }
        setAmountError(null);
        return true;
    };

    const formatAddressShort = (address: string) => {
        if (!address) return '';
        if (address.length <= 15) return address;
        return `${address.slice(0, 6)}...${address.slice(-6)}`;
    };
    const formatAddressLong = (address: string) => {
        if (!address) return '';
        if (address.length <= 35) return address;
        return `${address.slice(0, 16)}...${address.slice(-16)}`;
    };

    return (
        <div className="w-100 animate__animated animate__fadeIn">

            {/* --- NAVIGATION MENU (Tabs) --- */}
            <div className="d-flex bg-black rounded p-1 mb-4 border border-secondary shadow-sm">
                <button
                    onClick={() => setCurrentView('cloud')}
                    onMouseEnter={() => setHoveredTab('cloud')}
                    onMouseLeave={() => setHoveredTab(null)}
                    className={`btn flex-grow-1 rounded border-0 py-2 d-flex flex-column flex-sm-row justify-content-center align-items-center gap-1 ${
                        currentView === 'cloud'
                            ? 'bg-dark text-info fw-bold shadow'
                            : hoveredTab === 'cloud'
                                ? 'text-white'
                                : 'text-white-50'
                    }`}
                    style={{
                        fontSize: '0.9rem',
                        transition: 'all 0.2s',
                        backgroundColor: currentView !== 'cloud' && hoveredTab === 'cloud' ? 'rgba(255, 255, 255, 0.05)' : 'transparent'
                    }}
                >
                    <i className="bi bi-cloud fs-5"></i>
                    <span className="d-none d-sm-inline">{t.wallet_types?.tab_cloud || "Cloud"}</span>
                </button>

                <button
                    onClick={() => setCurrentView('stake')}
                    onMouseEnter={() => setHoveredTab('stake')}
                    onMouseLeave={() => setHoveredTab(null)}
                    className={`btn flex-grow-1 rounded border-0 py-2 d-flex flex-column flex-sm-row justify-content-center align-items-center gap-1 ${
                        currentView === 'stake'
                            ? 'bg-dark text-success fw-bold shadow'
                            : hoveredTab === 'stake'
                                ? 'text-white'
                                : 'text-white-50'
                    }`}
                    style={{
                        fontSize: '0.9rem',
                        transition: 'all 0.2s',
                        backgroundColor: currentView !== 'stake' && hoveredTab === 'stake' ? 'rgba(255, 255, 255, 0.05)' : 'transparent'
                    }}
                    disabled={!walletAddress}
                >
                    <i className="bi bi-layers fs-5"></i>
                    <span className="d-none d-sm-inline">{t.actions?.stake || "Staking"}</span>
                </button>

                <button
                    onClick={() => setCurrentView('private')}
                    onMouseEnter={() => setHoveredTab('private')}
                    onMouseLeave={() => setHoveredTab(null)}
                    className={`btn flex-grow-1 rounded border-0 py-2 d-flex flex-column flex-sm-row justify-content-center align-items-center gap-1 ${
                        currentView === 'private'
                            ? 'bg-dark text-warning fw-bold shadow'
                            : hoveredTab === 'private'
                                ? 'text-white'
                                : 'text-white-50'
                    }`}
                    style={{
                        fontSize: '0.9rem',
                        transition: 'all 0.2s',
                        backgroundColor: currentView !== 'private' && hoveredTab === 'private' ? 'rgba(255, 255, 255, 0.05)' : 'transparent'
                    }}
                >
                    <i className="bi bi-shield-lock fs-5"></i>
                    <span className="d-none d-sm-inline">{t.wallet_types?.tab_private || "Private"}</span>
                </button>
            </div>


            {/* ========================================== */}
            {/* 1. CLOUD WALLET (CUSTODIAL) VIEW           */}
            {/* ========================================== */}
            {currentView === 'cloud' && (
                <div className="p-4 bg-dark rounded mb-4 border border-secondary text-start position-relative animate__animated animate__fadeIn">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                        <div>
                            <h5 className="text-white m-0 d-inline-block me-2">{t.wallet_types?.custodial_title || "Cloud Wallet"}</h5>
                            <i className="bi bi-info-circle text-white-50" title={t.wallet_types?.custodial_desc || "Managed by JOMO"} style={{cursor: 'help'}}></i>
                        </div>
                        <span className="badge bg-success-subtle text-success border border-success small" style={{fontSize: '0.65rem'}}>
                            {t.activeBadge || "ACTIVE"}
                        </span>
                    </div>

                    <div className="d-flex justify-content-between align-items-center mb-1">
                        <small className="text-white-50">{t.balance}</small>
                        <span className="badge bg-black border border-secondary text-white-50 d-flex align-items-center" style={{ fontSize: '0.7rem' }}>
                            <span className="spinner-grow spinner-grow-sm text-success me-1" style={{ width: '6px', height: '6px' }}></span>
                            {t.liveBadge || "Live"}
                        </span>
                    </div>

                    <div className="mb-4 text-center">
                        {loadingBalance && !balance ? (
                            <div className="spinner-border spinner-border-sm text-info mt-2" role="status"></div>
                        ) : (
                            <h2 className="text-white m-0 fw-bold">
                                {balance !== null ? parseFloat(balance).toFixed(UI_DISPLAY_DECIMALS) : (0).toFixed(UI_DISPLAY_DECIMALS)} <span className="text-info fs-4">NEAR</span>
                            </h2>
                        )}
                    </div>

                    <small className="text-white-50 d-block mb-2 text-center w-100">{t.yourWallet}</small>

                    {/* WALLET ADDRESS BLOCK */}
                    <div className="d-flex justify-content-between align-items-center bg-black p-2 rounded border border-dark mb-4 min-vh-10">
                        {loadingWallet ? (
                            <span className="spinner-border spinner-border-sm text-info mx-auto"></span>
                        ) : walletAddress ? (
                            <>
                                {/* Mobile view */}
                                <span className="text-info fw-bold font-monospace ps-2 d-md-none" style={{ fontSize: '0.85rem' }}>{formatAddressShort(walletAddress)}</span>
                                {/* PC view */}
                                <span className="text-info fw-bold font-monospace ps-2 d-none d-md-inline" style={{ fontSize: '0.85rem' }}>{formatAddressLong(walletAddress)}</span>
                                <button onClick={() => { navigator.clipboard.writeText(walletAddress); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className={`btn btn-sm ${copied ? 'btn-success' : 'btn-outline-secondary'}`}>
                                    {copied ? (t.copiedBtn || t.copied) : (t.copyBtn)}
                                </button>
                            </>
                        ) : (
                            <div className="d-flex flex-column align-items-center justify-content-center gap-2 py-2 mx-auto w-100">
                                <span className="text-warning small fw-bold">{t.walletError || "Wallet error"}</span>
                                <button className="btn btn-sm btn-outline-warning" onClick={handleRegenerateWallet} disabled={isGeneratingWallet} style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}>
                                    {isGeneratingWallet ? <><span className="spinner-border spinner-border-sm me-1"></span> Generating...</> : <><i className="bi bi-arrow-clockwise me-1"></i> Regenerate Wallet</>}
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="d-flex gap-2 mb-2">
                        <button onClick={() => { setShowDeposit(!showDeposit); setShowWithdraw(false); }} className={`btn flex-grow-1 fw-bold py-2 ${showDeposit ? 'btn-secondary' : 'btn-info'}`} style={{ fontSize: '0.9rem' }} disabled={!walletAddress}>
                            <i className="bi bi-qr-code me-2"></i>{t.depositBtn}
                        </button>
                        <button onClick={() => { setShowWithdraw(!showWithdraw); setShowDeposit(false); }} className={`btn flex-grow-1 fw-bold py-2 ${showWithdraw ? 'btn-secondary' : 'btn-warning'}`} style={{ fontSize: '0.9rem' }} disabled={!walletAddress}>
                            <i className="bi bi-send me-2"></i>{t.withdrawBtn}
                        </button>
                    </div>

                    {/* DEPOSIT SECTION */}
                    {showDeposit && walletAddress && (
                        <div className="mt-3 p-3 bg-black rounded border border-secondary animate__animated animate__fadeIn d-flex flex-column align-items-center">
                            <p className="text-white-50 small mb-3 text-center w-100">{t.scanToDeposit}</p>
                            <div className="bg-white p-2 d-inline-block rounded mb-2"><QRCode value={walletAddress} size={150} level="M" /></div>
                            <p className="text-warning small m-0 mt-2 text-center w-100 mx-auto" style={{ maxWidth: '250px' }}>⚠️ {t.nearAlert}</p>
                        </div>
                    )}

                    {/* WITHDRAW SECTION */}
                    {showWithdraw && walletAddress && (
                        <div className="mt-3 p-3 bg-black rounded border border-secondary animate__animated animate__fadeIn">
                            <h6 className="text-white mb-3 text-center">{t.withdrawTitle}</h6>
                            <div className="mb-3 text-start">
                                <label className="text-white-50 small mb-1">{t.withdrawAddress}</label>
                                <input type="text" className={`form-control bg-dark text-white font-monospace ${addressError ? 'border-danger' : 'border-secondary'}`} placeholder="example.near" value={withdrawAddress} onChange={(e) => { const val = e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ''); setWithdrawAddress(val); validateNearAddress(val); }} />
                                {addressError && <div className="text-danger small mt-1 animate__animated animate__fadeIn"><i className="bi bi-exclamation-circle me-1"></i> {addressError}</div>}
                            </div>
                            <div className="mb-3 text-start">
                                <label className="text-white-50 small mb-1">{t.withdrawAmount}</label>
                                <div className="input-group">
                                    <input type="text" inputMode="decimal" className={`form-control bg-dark text-white ${amountError ? 'border-danger' : 'border-secondary'}`} placeholder="0.0" value={withdrawAmount} onChange={handleAmountChange} />
                                    <button className="btn btn-outline-secondary" onClick={() => { const maxAmountNum = Math.max(0, parseFloat(balance || '0') - GAS_RESERVE); const valToSet = maxAmountNum > 0 ? safeTruncate(maxAmountNum, UI_DISPLAY_DECIMALS) : '0'; setWithdrawAmount(valToSet); validateAmount(valToSet); }}>{t.withdrawMax || t.maxBtn}</button>
                                </div>
                                {amountError && <div className="text-danger small mt-1 animate__animated animate__fadeIn"><i className="bi bi-exclamation-circle me-1"></i> {amountError}</div>}
                            </div>
                            {withdrawError && <div className="alert alert-danger py-2 small text-center">{withdrawError}</div>}
                            {withdrawSuccess && (
                                <div className="alert alert-success py-3 small text-center animate__animated animate__fadeIn">
                                    <div className="mb-2"> {t.withdrawSuccess}</div>
                                    {txHash && <a href={`https://nearblocks.io/txns/${txHash}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-success fw-bold text-decoration-none" style={{ fontSize: '0.75rem' }}><i className="bi bi-box-arrow-up-right me-1"></i>{t.viewExplorer}</a>}
                                </div>
                            )}
                            <button className="btn btn-warning w-100 fw-bold mt-2" disabled={loadingWithdraw || !withdrawAddress || !withdrawAmount || addressError !== null || amountError !== null} onClick={handleWithdraw}>
                                {loadingWithdraw ? <span className="spinner-border spinner-border-sm"></span> : (t.sendAssetsBtn)}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ========================================== */}
            {/* 2. STAKING VIEW                            */}
            {/* ========================================== */}
            {currentView === 'stake' && walletAddress && (
                <div className="p-4 bg-dark rounded mb-4 border border-secondary text-start position-relative animate__animated animate__fadeIn">


                    <StakingPanel
                        balance={balance}
                        walletAddress={walletAddress}
                        t={t}
                        onSuccess={() => {
                            if (walletAddress) fetchBalance(walletAddress, true);
                        }}
                    />
                </div>
            )}

            {/* ========================================== */}
            {/* 3. PRIVATE WALLET (NON-CUSTODIAL) VIEW     */}
            {/* ========================================== */}
            {currentView === 'private' && (
                <div className="p-4 bg-dark rounded mb-4 border border-secondary text-center position-relative opacity-50 animate__animated animate__fadeIn" style={{ filter: 'grayscale(0.6)' }}>
                    <div className="d-flex flex-column align-items-center mb-3 gap-2">
                        <span className="badge bg-warning text-dark small" style={{fontSize: '0.6rem'}}>
                            {t.wallet_types?.coming_soon || "IN DEVELOPMENT"}
                        </span>
                        <h5 className="text-white m-0">{t.wallet_types?.non_custodial_title || "Private Wallet (Non-Custodial)"}</h5>
                    </div>

                    <p className="small text-white-50 mb-3 mx-auto" style={{ maxWidth: '400px', lineHeight: '1.5' }}>
                        {t.wallet_types?.non_custodial_desc || "You have full control over your keys. Encrypted with your password. Note: JOMO cannot recover your funds if you lose your password."}
                    </p>

                    <div className="p-2 mx-auto rounded border border-danger-subtle bg-danger-subtle text-danger small d-inline-block" style={{fontSize: '0.75rem'}}>
                        <i className="bi bi-exclamation-triangle-fill me-2"></i>
                        <strong>{t.wallet_types?.security_note_title || "Security"}:</strong> {t.wallet_types?.security_note_desc || "Keep your Seed Phrase safe. Loss of both password AND Seed Phrase = loss of funds."}
                    </div>
                </div>
            )}

        </div>
    );
}