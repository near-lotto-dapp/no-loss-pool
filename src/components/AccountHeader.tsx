import React from 'react';

interface AccountHeaderProps {
    email: string | undefined;
    onLogout: () => Promise<void> | void;
    t: (key: string) => string;
}

export const AccountHeader: React.FC<AccountHeaderProps> = ({ email, onLogout, t }) => {
    return (
        <div className="d-flex justify-content-between align-items-center w-100 mb-4 bg-dark p-3 rounded border border-secondary shadow-sm">
            <div className="text-start text-truncate me-3">
                <h5 className="text-white m-0 mb-1" style={{ fontSize: '1.05rem' }}>
                    {t('welcomeUser')}
                </h5>
                <div className="text-info small text-truncate d-flex align-items-center" style={{ fontSize: '0.85rem' }}>
                    <i className="bi bi-envelope-check me-2"></i>
                    {email}
                </div>
            </div>
            <button
                onClick={onLogout}
                className="btn btn-sm btn-outline-danger fw-bold d-flex align-items-center flex-shrink-0"
                title={t('logoutBtn')}
            >
                <i className="bi bi-box-arrow-right me-md-2"></i>
                <span className="d-none d-md-inline">{t('logoutBtn')}</span>
            </button>
        </div>
    );
};