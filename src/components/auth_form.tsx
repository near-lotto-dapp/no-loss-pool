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
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMsg(null);

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
                // login
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                authError = error;
                userData = data;
            } else {
                // REGISTRATION WITH REDIRECT TO /AUTH
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/auth`,
                    }
                });

                if (error) {
                    if (error.message.toLowerCase().includes('already registered')) {
                        throw new Error(t.emailInUse);
                    }
                    authError = error;
                }
                else if (data?.user && data.user.identities && data.user.identities.length === 0) {
                    throw new Error(t.emailInUse);
                }
                else {
                    userData = data;

                    if (data?.user) {
                        setSuccessMsg(t.generatingWallet || "Generating wallet...");
                        try {
                            const { data: { session } } = await supabase.auth.getSession();

                            if (session?.access_token) {
                                const { error: invokeError } = await supabase.functions.invoke('create-near-wallet', {
                                    body: { email: data.user.email },
                                    headers: { Authorization: `Bearer ${session.access_token}` }
                                });

                                if (invokeError) throw invokeError;
                            } else {
                                console.warn("No active session yet (Email confirmation might be required). Wallet generation deferred.");
                            }

                        } catch (apiError) {
                            console.error("Secure wallet generation failed:", apiError);
                        }
                    }
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
                        <div className="position-relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                minLength={8}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className={`form-control form-control-lg bg-dark text-white border-secondary pe-5 ${styles.customInput}`}
                                placeholder={isLogin ? (t.passwordPlaceholder) : (t.newPasswordPlaceholder)}
                            />
                            <button
                                type="button"
                                className="btn btn-link position-absolute top-50 end-0 translate-middle-y text-white-50 text-decoration-none shadow-none"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{ zIndex: 10 }}
                            >
                                {showPassword ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
                                        <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                                        <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755l-.81.815zM8 5a3 3 0 0 1 2.93 2.23l-1.41-1.41A1.5 1.5 0 0 0 8 5.5v-.5zm-.5 6a3 3 0 0 1-2.93-2.23l1.41 1.41A1.5 1.5 0 0 0 8 10.5h-.5zm5.1-4.9-1.41 1.41A2.5 2.5 0 0 1 8 10.5V11a3 3 0 0 0 3-3h.5a2.5 2.5 0 0 1-1.4-2.1zM8 12.5a5.944 5.944 0 0 1-1.968-.332l-.77-.771C3.601 10.51 2 8 2 8s3-5.5 8-5.5l.432.144L10.5 4.5l-1.071 1.071A1.5 1.5 0 0 0 8 5v.5l-2.071 2.071a2.5 2.5 0 0 0 2.5 2.5h.5l1.071-1.071L12.071 11.5l1.429 1.429a13.134 13.134 0 0 1-1.428.914l-.81-.815c-.635-.635-1.13-1.275-1.465-1.755a10.512 10.512 0 0 1-.195-.288C8.94 11.28 8 13 8 13s3-5.5 8-5.5h-.5a7.028 7.028 0 0 0-2.79-.588l-.77-.771z"/>
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {error && <div className="alert alert-danger py-2 mt-2">{error}</div>}
                    {successMsg && <div className="alert alert-success py-2 mt-2">{successMsg}</div>}

                    <button type="submit" disabled={loading || !email || password.length < 8} className={`btn btn-lg w-100 fw-bold text-white mt-3 ${styles.gradientPrimary}`}>
                        {loading ? <span className="spinner-border spinner-border-sm me-2"></span> : (isLogin ? (t.loginBtn) : (t.registerBtn))}
                    </button>
                </form>

                <div className="text-center mt-4">
                    <span className="text-white-50 me-2">{isLogin ? (t.noAccount) : (t.haveAccount)}</span>
                    <button
                        type="button"
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError(null);
                            setSuccessMsg(null);
                            setPassword('');
                            setShowPassword(false);
                        }}
                        className="btn btn-link text-info p-0 text-decoration-none fw-bold"
                    >
                        {isLogin ? (t.registerBtn) : (t.loginBtn)}
                    </button>
                </div>
            </div>
        </div>
    );
};