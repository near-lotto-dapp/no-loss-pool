import React from 'react';

interface TxErrorAlertProps {
    error: string | null;
    onClose: () => void;
}

export const TxErrorAlert: React.FC<TxErrorAlertProps> = ({ error, onClose }) => {
    if (!error) return null;

    return (
        <div className="mt-3 p-2 bg-black rounded border border-danger animate__animated animate__shakeX">
            <div className="d-flex justify-content-between align-items-center px-1">
                <div className="text-danger small d-flex align-items-center text-start" style={{ lineHeight: '1.3' }}>
                    <i className="bi bi-exclamation-octagon fs-5 me-2 flex-shrink-0"></i>
                    <span>{error}</span>
                </div>
                <button
                    type="button"
                    className="btn-close btn-close-white ms-2 flex-shrink-0"
                    style={{ fontSize: '0.6rem' }}
                    onClick={onClose}
                ></button>
            </div>
        </div>
    );
};