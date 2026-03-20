import { Link } from 'react-router';
import NearLogo from '@/assets/near-logo.svg';
import styles from '@/styles/app.module.css';

export const Navigation = () => {
    return (
        <nav className="navbar navbar-expand-lg">
            <div className="container-fluid">
                <Link to="/">
                    <img
                        src={NearLogo}
                        alt="NEAR"
                        width={30}
                        height={24}
                        className={styles.logo}
                    />
                </Link>

                {/* For "Docs" or "FAQ" */}
                <div className="navbar-nav pt-1">
                </div>
            </div>
        </nav>
    );
};