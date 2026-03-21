import { Link } from 'react-router';

export const Navigation = () => {
    return (
        <nav className="navbar navbar-dark pt-4 pb-2">
            <div className="container">
                <Link
                    to="/"
                    className="navbar-brand d-inline-flex align-items-center text-decoration-none"
                    style={{ transition: 'opacity 0.2s' }}
                    onMouseOver={(e) => (e.currentTarget.style.opacity = '0.8')}
                    onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
                >
                    <div
                        className="d-flex justify-content-center align-items-center bg-white rounded text-dark fw-bold me-2"
                        style={{
                            width: '36px',
                            height: '36px',
                            fontSize: '1.2rem',
                            flexShrink: 0
                        }}
                    >
                        +
                    </div>

                    <span className="text-white fw-bold fs-4 m-0">
                        JOMO <span className="text-info">Pool</span>
                    </span>
                </Link>
            </div>
        </nav>
    );
};