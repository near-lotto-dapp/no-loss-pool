import { useState } from 'react';
import { supabase } from '@/utils/supabaseClient';
import styles from '@/styles/app.module.css';

interface RegistrationFormProps {
    t: any;
    onSuccess?: () => void;
}

export const RegistrationForm = ({ t, onSuccess }: RegistrationFormProps) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMsg(null);

        try {
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
            });

            if (signUpError) throw signUpError;

            setSuccessMsg(t.registerSuccess || 'Registration successful!');

            if (onSuccess) {
                setTimeout(onSuccess, 2000);
            }
        } catch (err: any) {
            console.error("Registration error:", err);
            setError(err.message || t.registerError || 'An error occurred during registration');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.center} style={{ minHeight: 'auto', padding: '2rem 0' }}>
            <div className={`${styles.card} ${styles.stakingCard}`}>
                <h3 className="text-center text-white mb-4">{t.createAccount}</h3>

                <form onSubmit={handleRegister} className="d-flex flex-column gap-3">
                    {/* Email Input */}
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

                    {/* Password Input */}
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

                    {/* Error or Success Messages */}
                    {error && (
                        <div className="alert alert-danger py-2 mt-2" style={{ fontSize: '0.9rem' }}>
                            {error}
                        </div>
                    )}
                    {successMsg && (
                        <div className="alert alert-success py-2 mt-2" style={{ fontSize: '0.9rem' }}>
                            {successMsg}
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading || !email || password.length < 6}
                        className={`btn btn-lg w-100 fw-bold text-white mt-3 ${styles.gradientPrimary}`}
                    >
                        {loading ? (
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        ) : (
                            t.registerBtn || "Register"
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};