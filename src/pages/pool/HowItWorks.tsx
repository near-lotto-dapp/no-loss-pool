import React from 'react';
import { useTranslation } from 'react-i18next';
import { APY_VALUE } from "@/utils/constants.ts";

const HowItWorks: React.FC = () => {
    const { t } = useTranslation();

    return (
        <section className="how-it-works mt-5 p-4 bg-white border shadow-sm" style={{ borderRadius: '15px' }}>
            {/* text-dark */}
            <h3 className="mb-4 text-center fw-bold text-dark">{t('howItWorksTitle')}</h3>

            <div className="row g-4 mb-4">
                <div className="col-md-4 text-center">
                    <div className="display-5 mb-2">📊</div>
                    <h5 className="fw-bold text-dark">{t('step1')}</h5>
                    <p className="text-muted small">{t('step1Desc')}</p>
                </div>
                <div className="col-md-4 text-center border-start border-end">
                    <div className="display-5 mb-2">🌊</div>
                    <h5 className="fw-bold text-dark">{t('step2')}</h5>
                    <p className="text-muted small">{t('step2Desc', { apy: APY_VALUE })}</p>
                </div>
                <div className="col-md-4 text-center">
                    <div className="display-5 mb-2">💎</div>
                    <h5 className="fw-bold text-dark">{t('step3')}</h5>
                    <p className="text-muted small">{t('step3Desc')}</p>
                </div>
            </div>

            <div className="p-3 bg-light rounded-3 border-start border-4 border-success">
                <div className="d-flex align-items-center mb-2">
                    <span className="fs-4 me-2">🧮</span>
                    <h6 className="fw-bold mb-0 text-dark">{t('exampleTitle')}</h6>
                </div>
                <p className="mb-0 text-dark" style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
                    {t('exampleText')}
                </p>
            </div>
        </section>
    );
};

export default HowItWorks;