import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/utils/supabaseClient';
import { useLanguage } from '@/hooks/useLanguage';
import { TopNav } from '@/components/TopNav.tsx';
import { FooterWallet } from '@/components/FooterWallet';
import { WalletDashboard } from '@/components/WalletDashboard';
import {AccountHeader} from "@/components/AccountHeader.tsx";

export default function WalletPage() {
    const { lang, setLang, t } = useLanguage();
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                navigate('/auth');
            } else {
                setUser(session.user);
            }
            setIsLoading(false);
        };

        checkAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) {
                navigate('/auth');
            } else {
                setUser(session.user);
            }
        });

        return () => subscription.unsubscribe();
    }, [navigate]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/');
    };

    if (isLoading) {
        return (
            <div className="min-vh-100 d-flex justify-content-center align-items-center">
                <div className="spinner-border text-info" role="status"></div>
            </div>
        );
    }

    return (
        <div className="min-vh-100 text-white d-flex flex-column">
            <TopNav
                lang={lang}
                setLang={setLang}
                title={t('homePageTitle')}
                to="/"
                icon="bi-house"
            />

            <main className="flex-grow-1 container py-3 d-flex flex-column align-items-center">
                <div className="w-100" style={{ maxWidth: '650px' }}>

                    <AccountHeader
                        email={user.email}
                        onLogout={handleLogout}
                        t={t}
                    />

                    <WalletDashboard user={user} t={t} />
                </div>
            </main>

            <FooterWallet t={t} />
        </div>
    );
}