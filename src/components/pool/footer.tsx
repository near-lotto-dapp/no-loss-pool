import { useState } from "react";

export const Footer = ({ t }: { t: any }) => {
    const [showTerms, setShowTerms] = useState(false);

    return (
        <>
            <footer className="container mt-5 mb-4 text-center">
                <div className="py-3 border-top" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <div className="mb-3 d-flex justify-content-center gap-3 flex-wrap" style={{ fontSize: '0.85rem' }}>
                        <span className="text-white-50 opacity-25">|</span>
                        <a href="https://nearblocks.io/address/jomo-pool-v2.near" target="_blank" rel="noreferrer" className="text-white-50 text-decoration-none">
                            <i className="bi bi-code-slash me-1"></i> {t('smartContract')}
                        </a>
                        <span className="text-white-50 opacity-25">|</span>
                        <a href="https://github.com/near-lotto-dapp/no-loss-pool" target="_blank" rel="noreferrer" className="text-white-50 text-decoration-none">
                            <i className="bi bi-github me-1"></i> {t('githubRepo')}
                        </a>
                    </div>

                    <p className="footer-text m-0">
                        <i className="bi bi-shield-lock me-1 text-info"></i>
                        <a
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                setShowTerms(true);
                            }}
                            className="footer-link text-info text-decoration-none fw-bold"
                        >
                            {t('termsTitle')}
                        </a>
                    </p>

                    <p className="footer-text mt-3 px-3 mx-auto" style={{ fontSize: '0.75rem', maxWidth: '700px', color: '#cbd5e1', opacity: 0.6, lineHeight: '1.4' }}>
                        {t('shortDisclaimer')}
                    </p>

                    <p className="footer-text mt-4" style={{ fontSize: '0.7rem', color: '#ffffff', opacity: 0.3 }}>
                        {t('footerText')}
                    </p>
                </div>
            </footer>

            {/* Terms & Conditions Modal */}
            {showTerms && (
                <div
                    className="modal d-block"
                    style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(8px)', zIndex: 1050 }}
                    tabIndex={-1}
                    onClick={() => setShowTerms(false)}
                >
                    <div
                        className="modal-dialog modal-dialog-centered modal-dialog-scrollable"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            className="modal-content shadow-lg"
                            style={{
                                backgroundColor: '#0a192f',
                                border: '1px solid rgba(84, 214, 255, 0.2)',
                                color: '#fff',
                                borderRadius: '16px'
                            }}
                        >
                            <div className="modal-header border-bottom" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                                <h5 className="modal-title fw-bold text-info">
                                    <i className="bi bi-file-earmark-text me-2"></i>
                                    {t('termsTitle')}
                                </h5>
                                <button
                                    type="button"
                                    className="btn-close btn-close-white"
                                    onClick={() => setShowTerms(false)}
                                ></button>
                            </div>
                            <div className="modal-body text-start p-4">
                                <p style={{ fontSize: '0.9rem', color: '#cbd5e1', whiteSpace: 'pre-wrap', lineHeight: '1.7' }}>
                                    {t('fullTerms')}
                                </p>
                            </div>
                            <div className="modal-footer border-0 p-4 pt-0">
                                <button
                                    type="button"
                                    className="btn btn-info w-100 fw-bold py-2"
                                    style={{ borderRadius: '10px' }}
                                    onClick={() => setShowTerms(false)}
                                >
                                    {t('confirmBtn')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};