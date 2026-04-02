import React from 'react';

interface TxSuccessAlertProps {
    hash: string | null;
    message: string;
    t: any;
    onClose: () => void;
}

export const TxSuccessAlert: React.FC<TxSuccessAlertProps> = ({ hash, message, t, onClose }) => {
    if (!hash) return null;

    return (
        <div className="mt-3 p-2 bg-black rounded border border-success animate__animated animate__bounceIn">
            <div className="d-flex justify-content-between align-items-center mb-2 px-1">
                <span className="text-success small fw-bold">
                    <i className="bi bi-check-circle-fill me-2"></i>
                    {message}
                </span>
                <button
                    type="button"
                    className="btn-close btn-close-white"
                    style={{ fontSize: '0.6rem' }}
                    onClick={onClose}
                ></button>
            </div>
            <a
                href={`https://nearblocks.io/txns/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-sm btn-outline-success w-100 fw-bold d-flex justify-content-center align-items-center gap-2"
            >
                {t('viewExplorer')} <i className="bi bi-box-arrow-up-right"></i>
            </a>
        </div>
    );
};