import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabaseClient';

interface StakingPanelProps {
    balance: string | null;
    t: any;
    onSuccess: () => void;
}

interface Validator {
    id: string;
    name: string;
    apy: string;
    fee: string;
    type: string;
    token: string;
}

export function StakingPanel({ balance, t, onSuccess }: StakingPanelProps) {
    const [validators, setValidators] = useState<Validator[]>([]);
    const [loadingValidators, setLoadingValidators] = useState(true);
    const [selectedId, setSelectedId] = useState('');
    const [stakeAmount, setStakeAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successTx, setSuccessTx] = useState<string | null>(null);

    useEffect(() => {
        const fetchValidators = async () => {
            try {
                const { data, error } = await supabase
                    .from('validators')
                    .select('*')
                    .eq('is_active', true)
                    .order('type', { ascending: false });

                if (error) throw error;
                if (data && data.length > 0) {
                    setValidators(data);
                    setSelectedId(data[0].id);
                }
            } catch (err) {
                console.error("Error fetching validators:", err);
            } finally {
                setLoadingValidators(false);
            }
        };
        fetchValidators();
    }, []);

    const selectedOption = validators.find(opt => opt.id === selectedId);

    const handleStake = async () => {
        setLoading(true);
        setError(null);
        setSuccessTx(null);

        try {
            const amountNum = parseFloat(stakeAmount);
            const balanceNum = parseFloat(balance || '0');

            if (isNaN(amountNum) || amountNum <= 0) throw new Error(t.invalidAmount);
            if (amountNum > balanceNum - 0.05) throw new Error(t.insufficientBalanceGas);

            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error("Session expired.");

            const { data, error: funcError } = await supabase.functions.invoke('stake-near', {
                body: {
                    validatorId: selectedId,
                    amount: stakeAmount,
                    isLiquid: selectedOption?.type === 'liquid'
                },
                headers: { Authorization: `Bearer ${session.access_token}` }
            });

            if (funcError) throw funcError;

            if (data?.hash) {
                setSuccessTx(data.hash);
                setStakeAmount('');
                setTimeout(onSuccess, 3000);
            }
        } catch (err: any) {
            setError(err.message || "Staking failed");
        } finally {
            setLoading(false);
        }
    };

    if (loadingValidators) return (
        <div className="mt-3 p-4 bg-black rounded border border-secondary text-center">
            <span className="spinner-border text-info spinner-border-sm"></span>
        </div>
    );

    return (
        <div className="mt-3 p-3 bg-black rounded border border-secondary animate__animated animate__fadeIn">
            <h6 className="text-white mb-3 text-center">
                <i className="bi bi-layers text-success me-2"></i> {t.stakeTitle}
            </h6>

            <div className="mb-3 text-start">
                <label className="text-white-50 small mb-1">{t.chooseValidator}</label>
                <select
                    className="form-select bg-dark text-white border-secondary mb-2"
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                >
                    {validators.map(v => (
                        <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                </select>
                {selectedOption && (
                    <div className="p-3 bg-dark bg-opacity-50 rounded border-0 mb-3 animate__animated animate__fadeIn"
                         style={{ borderLeft: '4px solid #198754' }}>
                        <div className="row g-0 align-items-center">
                            <div className="col-6 border-end border-secondary border-opacity-25 text-center">
                                <small className="text-white-50 d-block mb-1" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                    {t.apyLabelDirect}
                                </small>
                                <strong className="text-success fs-5">{selectedOption.apy}</strong>
                            </div>
                            <div className="col-6 text-center">
                                <small className="text-white-50 d-block mb-1" style={{ fontSize: '0.7rem', textTransform: 'uppercase' }}>
                                    {selectedOption.type === 'liquid' ? (t.tokenLabel) : (t.feeLabel)}
                                </small>
                                <strong className={selectedOption.type === 'liquid' ? "text-info fs-5" : "text-warning fs-5"}>
                                    {selectedOption.type === 'liquid' ? selectedOption.token : selectedOption.fee}
                                </strong>
                            </div>
                        </div>

                        {/* note for Linear */}
                        {selectedOption.type === 'liquid' && (
                            <div className="mt-2 text-center border-top border-secondary border-opacity-10 pt-2">
                                <small className="text-info" style={{ fontSize: '0.65rem' }}>
                                    <i className="bi bi-info-circle me-1"></i>
                                    {t.liquidHint}
                                </small>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="mb-3 text-start">
                <label className="text-white-50 small mb-1">{t.stakeAmount}</label>
                <div className="input-group">
                    <input
                        type="number"
                        className="form-control bg-dark border-secondary text-white"
                        placeholder="0.0"
                        value={stakeAmount}
                        onChange={(e) => setStakeAmount(e.target.value)}
                    />
                    <button className="btn btn-outline-secondary" onClick={() => setStakeAmount((Math.max(0, parseFloat(balance || '0') - 0.05)).toFixed(4))}>MAX</button>
                </div>
            </div>

            {error && <div className="alert alert-danger py-2 small text-center">{error}</div>}
            {successTx && <div className="alert alert-success py-2 small text-center">✅ {t.stakeSuccess}</div>}

            <button
                className="btn btn-success w-100 fw-bold mt-2"
                disabled={loading || !stakeAmount || !selectedId}
                onClick={handleStake}
            >
                {loading ? <span className="spinner-border spinner-border-sm"></span> : (t.confirmStakeBtn)}
            </button>
        </div>
    );
}