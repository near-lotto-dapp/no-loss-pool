import { useState } from "react";

export const FooterWallet = ({ t }: { t: any }) => {
    const [showTerms, setShowTerms] = useState(false);

    const wf = t.wallet_footer || {};

    return (
        <>
            <footer className="container mt-5 mb-4 text-center animate__animated animate__fadeIn">
                <div className="py-4 border-top" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>

                    {/* Utility Links */}
                    <div className="mb-4 d-flex justify-content-center gap-3 flex-wrap" style={{ fontSize: '0.85rem' }}>
                        <a href="https://nearblocks.io/address/proxy.jomo-vault.near" target="_blank" rel="noreferrer" className="text-info text-decoration-none">
                            <i className="bi bi-code-square me-1"></i> {wf.smartContract || "Vault Contract"}
                        </a>
                        <span className="text-white-50 opacity-25">|</span>
                        <a
                            href="#"
                            onClick={(e) => { e.preventDefault(); setShowTerms(true); }}
                            className="text-info text-decoration-none fw-bold"
                        >
                            <i className="bi bi-shield-check me-1"></i> {wf.termsTitle || "Terms of Service"}
                        </a>
                    </div>

                    {/* Disclaimer */}
                    <p className="px-3 mx-auto text-white-50" style={{ fontSize: '0.75rem', maxWidth: '700px', lineHeight: '1.6' }}>
                        {wf.shortDisclaimer || t.shortDisclaimer}
                    </p>

                    {/* Copyright */}
                    <p className="mt-4 mb-0" style={{ fontSize: '0.75rem', color: '#ffffff', opacity: 0.3 }}>
                        {wf.copyright || t.footerText}
                    </p>
                </div>
            </footer>

            {/* Terms & Conditions Modal */}
            {showTerms && (
                <div className="modal d-block" style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)', zIndex: 1050 }} tabIndex={-1} onClick={() => setShowTerms(false)}>
                    <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-content shadow-lg" style={{ backgroundColor: '#0a192f', border: '1px solid rgba(84, 214, 255, 0.2)', color: '#fff', borderRadius: '16px' }}>

                            <div className="modal-header border-bottom" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                                <h5 className="modal-title fw-bold text-info">
                                    <i className="bi bi-file-earmark-text me-2"></i>
                                    {wf.termsTitle || t.termsTitle}
                                </h5>
                                <button type="button" className="btn-close btn-close-white" onClick={() => setShowTerms(false)}></button>
                            </div>

                            <div className="modal-body text-start p-4">
                                <p style={{ fontSize: '0.85rem', color: '#cbd5e1', whiteSpace: 'pre-wrap', lineHeight: '1.7' }}>
                                    {wf.fullTerms || t.fullTerms}
                                </p>
                            </div>

                            <div className="modal-footer border-0 p-4 pt-0">
                                <button type="button" className="btn btn-info w-100 fw-bold py-2 rounded-3" onClick={() => setShowTerms(false)}>
                                    {t.confirmBtn}
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </>
    );
};