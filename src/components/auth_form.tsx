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
        setLoading(true);
        setError(null);
        setSuccessMsg(null);

        try {
            let authError;
            let userData;

            if (isLogin) {
                // LOG IN
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                authError = error;
                userData = data;
            } else {
                // SIGN UP
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                });
                authError = error;
                userData = data;

                // IF REGISTRATION IS SUCCESSFUL -> GENERATE NEAR WALLET
                if (data?.user && !error) {
                    // Show immediate feedback that wallet generation started
                    setSuccessMsg(t.generatingWallet || "Registration successful! Generating your NEAR wallet...");

                    try {
                        const response = await fetch('/api/auth/setup-wallet', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                user_id: data.user.id,
                                email: data.user.email
                            })
                        });

                        const walletData = await response.json();
                        if (!response.ok) {
                            console.error("Wallet generation API error:", walletData.error);
                            // We log it but do not throw, so the user can still log in later
                        } else {
                            console.log("Wallet successfully created!", walletData);
                        }
                    } catch (apiError) {
                        console.error("Failed to reach wallet setup API:", apiError);
                    }
                }
            }

            if (authError) throw authError;

            // Final success message if everything went well
            setSuccessMsg(isLogin ? (t.loginSuccess || 'Login successful!') : (t.registerSuccess || 'Registration successful!'));

            if (onSuccess && userData?.user) {
                setTimeout(() => onSuccess(userData.user), 1500);
            }
        } catch (err: any) {
            console.error("Auth error:", err);
            setError(err.message || (isLogin ? t.loginError : t.registerError) || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.center} style={{ minHeight: 'auto', padding: '2rem 0' }}>
            <div className={`${styles.card} ${styles.stakingCard}`}>
                {/* Dynamic Title */}
                <h3 className="text-center text-white mb-4">
                    {isLogin ? (t.loginTitle || "Log In") : (t.createAccount || "Create Account")}
                </h3>

                <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
                    <div className="form-group">
                        <label className="text-white-50 mb-2">{t.emailLabel || 'Email'}</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={`form-control form-control-lg bg-dark text-white border-secondary ${styles.customInput}`}
                            placeholder={t.emailPlaceholder || "your@email.com"}
                        />
                    </div>

                    <div className="form-group">
                        <label className="text-white-50 mb-2">{t.passwordLabel || 'Password'}</label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={`form-control form-control-lg bg-dark text-white border-secondary ${styles.customInput}`}
                            placeholder={t.passwordPlaceholder || "Minimum 6 characters"}
                        />
                    </div>

                    {error && <div className="alert alert-danger py-2 mt-2" style={{ fontSize: '0.9rem' }}>{error}</div>}
                    {successMsg && <div className="alert alert-success py-2 mt-2" style={{ fontSize: '0.9rem' }}>{successMsg}</div>}

                    {/* Dynamic Submit Button */}
                    <button
                        type="submit"
                        disabled={loading || !email || password.length < 6}
                        className={`btn btn-lg w-100 fw-bold text-white mt-3 ${styles.gradientPrimary}`}
                    >
                        {loading ? (
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        ) : (
                            isLogin ? (t.loginBtn || "Log In") : (t.registerBtn || "Register")
                        )}
                    </button>
                </form>

                {/* Mode Switcher (Login <-> Register) */}
                <div className="text-center mt-4">
                    <span className="text-white-50 me-2">
                        {isLogin ? (t.noAccount || "Don't have an account?") : (t.haveAccount || "Already have an account?")}
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError(null);
                            setSuccessMsg(null);
                        }}
                        className="btn btn-link text-info p-0 text-decoration-none fw-bold"
                    >
                        {isLogin ? (t.registerBtn || "Register") : (t.loginBtn || "Log In")}
                    </button>
                </div>
            </div>
        </div>
    );
};