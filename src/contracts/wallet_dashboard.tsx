import { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { supabase } from '@/utils/supabaseClient';

interface WalletDashboardProps {
    user: any;
    t: any;
    onLogout: () => void;
}

export function WalletDashboard({ user, t, onLogout }: WalletDashboardProps) {
    // wallet
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [loadingWallet, setLoadingWallet] = useState(false);
    const [balance, setBalance] = useState<string | null>(null);
    const [loadingBalance, setLoadingBalance] = useState(false);

    // UI
    const [showDeposit, setShowDeposit] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showWithdraw, setShowWithdraw] = useState(false);

    // wd
    const [withdrawAddress, setWithdrawAddress] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [loadingWithdraw, setLoadingWithdraw] = useState(false);
    const [withdrawError, setWithdrawError] = useState<string | null>(null);
    const [withdrawSuccess, setWithdrawSuccess] = useState(false);
    const [txHash, setTxHash] = useState<string | null>(null);

    const fetchBalance = async (accountId: string, isSilent = false) => {
        if (!isSilent) setLoadingBalance(true);
        try {
            const res = await fetch(import.meta.env.VITE_NEAR_URL, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ jsonrpc: "2.0", id: "dontcare", method: "query", params: { request_type: "view_account", finality: "optimistic", account_id: accountId } })
            });
            const data = await res.json();
            setBalance(data.result?.amount ? (Number(data.result.amount) / 1e24).toFixed(4) : "0.0000");
        } catch (err) {
            setBalance("0.00");
        } finally {
            if (!isSilent) setLoadingBalance(false);
        }
    };

    useEffect(() => {
        const fetchWalletAndBalance = async () => {
            if (!user) return;
            setLoadingWallet(true);
            try {
                const { data } = await supabase.from('profiles').select('near_account_id').eq('id', user.id).single();
                if (data) {
                    setWalletAddress(data.near_account_id);
                    await fetchBalance(data.near_account_id);
                }
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

    const handleWithdraw = async () => {
        setLoadingWithdraw(true);
        setWithdrawError(null);
        setWithdrawSuccess(false);
        setTxHash(null);

        try {
            const amountNum = parseFloat(withdrawAmount);
            const balanceNum = parseFloat(balance || '0');

            if (isNaN(amountNum) || amountNum <= 0) {
                throw new Error("Invalid amount");
            }
            if (amountNum > balanceNum) {
                throw new Error("Insufficient balance");
            }

            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.access_token) {
                throw new Error("Session expired. Please log in again.");
            }

            const { data, error } = await supabase.functions.invoke('withdraw-near', {
                body: {
                    recipientId: withdrawAddress,
                    amount: withdrawAmount
                },
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                }
            });

            if (error) throw error;

            if (data?.hash) {
                setTxHash(data.hash);
                setWithdrawSuccess(true);
                setWithdrawAmount('');
                setWithdrawAddress('');

                setTimeout(() => {
                    if (walletAddress) fetchBalance(walletAddress, true);
                }, 2000);
            }
        } catch (err: any) {
            setWithdrawError(err.message || "Withdrawal failed");
        } finally {
            setLoadingWithdraw(false);
        }
    };

    const formatAddress = (address: string) => {
        if (!address) return '';
        if (address.length <= 15) return address;
        return `${address.slice(0, 6)}...${address.slice(-6)}`;
    };

    return (
        <div className="p-4 bg-dark rounded mb-4 border border-secondary text-start position-relative w-100 animate__animated animate__fadeIn">
            <div className="d-flex justify-content-between align-items-center mb-1">
                <small className="text-white-50">{t.balance || "Balance:"}</small>
                <span className="badge bg-dark border border-secondary text-white-50 d-flex align-items-center" style={{ fontSize: '0.7rem' }}>
                    <span className="spinner-grow spinner-grow-sm text-success me-1" style={{ width: '6px', height: '6px' }}></span> Live
                </span>
            </div>

            <div className="mb-4 text-center">
                {loadingBalance && !balance ? (
                    <div className="spinner-border spinner-border-sm text-info mt-2" role="status"></div>
                ) : (
                    <h2 className="text-white m-0 fw-bold">
                        {balance !== null ? parseFloat(balance).toFixed(4) : "0.0000"} <span className="text-info fs-4">NEAR</span>
                    </h2>
                )}
            </div>

            <small className="text-white-50 d-block mb-2 text-center w-100">{t.yourWallet || "Your NEAR Wallet:"}</small>
            <div className="d-flex justify-content-between align-items-center bg-black p-2 rounded border border-dark mb-4">
                {loadingWallet ? (
                    <span className="spinner-border spinner-border-sm text-info mx-auto"></span>
                ) : walletAddress ? (
                    <>
                        <span className="text-info fw-bold font-monospace ps-2" style={{ fontSize: '0.85rem' }}>
                              {formatAddress(walletAddress)}
                        </span>
                        <button onClick={() => { navigator.clipboard.writeText(walletAddress); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className={`btn btn-sm ${copied ? 'btn-success' : 'btn-outline-secondary'}`}>
                            {copied ? (t.copied || "Copied!") : (t.copyBtn || "Copy")}
                        </button>
                    </>
                ) : (
                    <span className="text-warning small mx-auto">Wallet error</span>
                )}
            </div>

            <div className="d-flex gap-2 mb-3">
                <button
                    onClick={() => { setShowDeposit(!showDeposit); setShowWithdraw(false); }}
                    className={`btn flex-grow-1 fw-bold ${showDeposit ? 'btn-secondary' : 'btn-info'}`}
                >
                    <i className="bi bi-qr-code me-2"></i>{t.depositBtn || "Deposit"}
                </button>
                <button
                    onClick={() => { setShowWithdraw(!showWithdraw); setShowDeposit(false); }}
                    className={`btn flex-grow-1 fw-bold ${showWithdraw ? 'btn-secondary' : 'btn-warning'}`}
                >
                    <i className="bi bi-send me-2"></i>{t.withdrawBtn || "Withdraw"}
                </button>
            </div>

            {showDeposit && walletAddress && (
                <div className="mt-3 p-3 bg-black rounded border border-secondary animate__animated animate__fadeIn d-flex flex-column align-items-center">
                    <p className="text-white-50 small mb-3 text-center w-100">{t.scanToDeposit || "Scan to deposit NEAR"}</p>
                    <div className="bg-white p-2 d-inline-block rounded mb-2">
                        <QRCode value={walletAddress} size={150} level="M" />
                    </div>
                    <p className="text-warning small m-0 mt-2 text-center w-100 mx-auto" style={{ maxWidth: '250px' }}>
                        ⚠️ {t.nearAlert || "Send only NEAR Protocol tokens to this address."}
                    </p>
                </div>
            )}

            {showWithdraw && (
                <div className="mt-3 p-3 bg-black rounded border border-secondary animate__animated animate__fadeIn">
                    <h6 className="text-white mb-3 text-center">{t.withdrawTitle || "Send NEAR"}</h6>

                    <div className="mb-3">
                        <label className="text-white-50 small mb-1">{t.withdrawAddress || "Recipient NEAR Address"}</label>
                        <input
                            type="text"
                            className="form-control bg-dark border-secondary text-white font-monospace"
                            placeholder="example.near"
                            value={withdrawAddress}
                            onChange={(e) => setWithdrawAddress(e.target.value)}
                        />
                    </div>

                    <div className="mb-3">
                        <label className="text-white-50 small mb-1">{t.withdrawAmount || "Amount (NEAR)"}</label>
                        <div className="input-group">
                            <input
                                type="number"
                                className="form-control bg-dark border-secondary text-white"
                                placeholder="0.0"
                                value={withdrawAmount}
                                onChange={(e) => setWithdrawAmount(e.target.value)}
                            />
                            <button className="btn btn-outline-secondary" onClick={() => setWithdrawAmount(balance || '0')}>{t.withdrawMax || "MAX"}</button>
                        </div>
                    </div>

                    {withdrawError && <div className="alert alert-danger py-2 small text-center">{withdrawError}</div>}

                    {withdrawSuccess && (
                        <div className="alert alert-success py-3 small text-center animate__animated animate__fadeIn">
                            <div className="mb-2">🚀 {t.withdrawSuccess || "Transaction sent successfully!"}</div>
                            {txHash && (
                                <a
                                    href={`https://nearblocks.io/txns/${txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-sm btn-outline-success fw-bold text-decoration-none"
                                    style={{ fontSize: '0.75rem' }}
                                >
                                    <i className="bi bi-box-arrow-up-right me-1"></i>
                                    View in Explorer
                                </a>
                            )}
                        </div>
                    )}

                    <button
                        className="btn btn-warning w-100 fw-bold mt-2"
                        disabled={loadingWithdraw || !withdrawAddress || !withdrawAmount}
                        onClick={handleWithdraw}
                    >
                        {loadingWithdraw ? <span className="spinner-border spinner-border-sm"></span> : (t.sendAssetsBtn || "Send Assets")}
                    </button>
                </div>
            )}

            <button onClick={onLogout} className="btn btn-outline-danger w-100 fw-bold mt-3">
                <i className="bi bi-box-arrow-right me-2"></i> {t.logoutBtn || "Log Out"}
            </button>
        </div>
    );
}