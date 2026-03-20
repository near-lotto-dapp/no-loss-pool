import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import App from './App';
import { NearProvider } from 'near-connect-hooks';
import { NetworkId } from './config';

const rootElement = document.getElementById('root');

if (rootElement) {
    createRoot(rootElement).render(
        <StrictMode>
            <NearProvider config={{ network: NetworkId }}>
                <App />
            </NearProvider>
        </StrictMode>
    );
}