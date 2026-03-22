import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Analytics } from "@vercel/analytics/react";
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/auth';
import NoLossPoolPage from './pages/NoLossPoolPage';

export default function App() {
    return (
        <>
            <Router>
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/no-loss-pool" element={<NoLossPoolPage />} />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="*" element={<LandingPage />} />
                </Routes>
                <Analytics />
            </Router>
        </>
    );
}