import { useState } from 'react';
import { supabase } from '@/utils/supabaseClient';
import styles from '@/styles/app.module.css';

interface AuthFormProps {
    t: any;
    onSuccess?: (user: any) => void;
}

export const AuthForm = ({ t, onSuccess }: AuthFormProps) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError(null); setSuccessMsg(null);

        if (!isLogin) {
            const hasLetter = /[a-zA-Z]/.test(password);
            const hasNumber = /[0-9]/.test(password);
            const hasSpecial = /[\W_]/.test(password);

            if (password.length < 8) {
                setError(t.passLength);
                setLoading(false); return;
            }
            if (!hasLetter || !hasNumber) {
                setError(t.passAlphanumeric);
                setLoading(false); return;
            }
            if (!hasSpecial) {
                setError(t.passSpecial);
                setLoading(false); return;
            }
        }

        try {
            let authError;
            let userData;

            if (isLogin) {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                authError = error; userData = data;
            } else {
                const { data, error } = await supabase.auth.signUp({ email, password });
                authError = error; userData = data;

                if (data?.user && !error) {
                    setSuccessMsg(t.generatingWallet);
                    try {
                        await fetch('/api/auth/setup-wallet', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ user_id: data.user.id, email: data.user.email })
                        });
                    } catch (apiError) { console.error("Wallet generation failed:", apiError); }
                }
            }

            if (authError) throw authError;

            setSuccessMsg(isLogin ? (t.loginSuccess) : (t.registerSuccess));
            if (onSuccess && userData?.user) {
                setTimeout(() => onSuccess(userData.user), 1000);
            }
        } catch (err: any) {
            console.error("Auth error:", err);
            setError(err.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.center} style={{ minHeight: 'auto', padding: '2rem 0' }}>
            <div className={`${styles.card} ${styles.stakingCard}`}>
                <h3 className="text-center text-white mb-4">
                    {isLogin ? (t.loginTitle) : (t.createAccount)}
                </h3>

                <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
                    <div className="form-group">
                        <label className="text-white-50 mb-2">{t.emailLabel}</label>
                        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={`form-control form-control-lg bg-dark text-white border-secondary ${styles.customInput}`} placeholder="your@email.com" />
                    </div>

                    <div className="form-group">
                        <label className="text-white-50 mb-2">{t.passwordLabel}</label>
                        <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={`form-control form-control-lg bg-dark text-white border-secondary ${styles.customInput}`} placeholder={isLogin ? (t.passwordPlaceholder) : (t.newPasswordPlaceholder)} />
                    </div>

                    {error && <div className="alert alert-danger py-2 mt-2">{error}</div>}
                    {successMsg && <div className="alert alert-success py-2 mt-2">{successMsg}</div>}

                    <button type="submit" disabled={loading || !email || password.length < 8} className={`btn btn-lg w-100 fw-bold text-white mt-3 ${styles.gradientPrimary}`}>
                        {loading ? <span className="spinner-border spinner-border-sm me-2"></span> : (isLogin ? (t.loginBtn) : (t.registerBtn))}
                    </button>
                </form>

                <div className="text-center mt-4">
                    <span className="text-white-50 me-2">{isLogin ? (t.noAccount) : (t.haveAccount)}</span>
                    <button type="button" onClick={() => { setIsLogin(!isLogin); setError(null); setSuccessMsg(null); setPassword(''); }} className="btn btn-link text-info p-0 text-decoration-none fw-bold">
                        {isLogin ? (t.registerBtn) : (t.loginBtn)}
                    </button>
                </div>
            </div>
        </div>
    );
};