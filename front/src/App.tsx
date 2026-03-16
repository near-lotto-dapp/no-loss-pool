import { BrowserRouter, Routes, Route } from "react-router";
import { Navigation } from "./components/navigation";
import { Analytics } from "@vercel/analytics/react";
import Home from "./pages/home.tsx";

function App() {
    return (
        <BrowserRouter>
            <Navigation />
            <Routes>
                <Route path="/" element={<Home />} />
            </Routes>
            <Analytics />
        </BrowserRouter>
    );
}

export default App;