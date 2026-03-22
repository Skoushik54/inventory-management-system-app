import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Package, RefreshCw, FileSpreadsheet, LogOut, Settings } from 'lucide-react';

const Sidebar = () => {
    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('trans_officer');
        localStorage.removeItem('trans_issuer');
        localStorage.removeItem('trans_purpose');
        localStorage.removeItem('trans_cart');

        if (window.electronAPI && window.electronAPI.quitApp) {
            window.electronAPI.quitApp();
        } else {
            window.location.href = '/login';
        }
    };

    return (
        <div className="sidebar">
            <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Greyhounds</h2>
                <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Telangana</h3>
            </div>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <NavLink
                    to="/dashboard"
                    end
                    style={({ isActive }) => ({
                        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
                        borderRadius: '0.5rem', textDecoration: 'none', color: 'inherit',
                        backgroundColor: isActive ? 'var(--accent)' : 'transparent',
                        transition: 'background-color 0.2s'
                    })}
                >
                    <LayoutDashboard size={20} /> Dashboard
                </NavLink>
                <NavLink
                    to="/dashboard/inventory"
                    style={({ isActive }) => ({
                        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
                        borderRadius: '0.5rem', textDecoration: 'none', color: 'inherit',
                        backgroundColor: isActive ? 'var(--accent)' : 'transparent',
                        transition: 'background-color 0.2s'
                    })}
                >
                    <Package size={20} /> Inventory
                </NavLink>
                <NavLink
                    to="/dashboard/transactions"
                    style={({ isActive }) => ({
                        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
                        borderRadius: '0.5rem', textDecoration: 'none', color: 'inherit',
                        backgroundColor: isActive ? 'var(--accent)' : 'transparent',
                        transition: 'background-color 0.2s'
                    })}
                >
                    <RefreshCw size={20} /> In / Out Register
                </NavLink>
                <NavLink
                    to="/dashboard/admin"
                    style={({ isActive }) => ({
                        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
                        borderRadius: '0.5rem', textDecoration: 'none', color: 'inherit',
                        backgroundColor: isActive ? 'var(--accent)' : 'transparent',
                        transition: 'background-color 0.2s'
                    })}
                >
                    <Settings size={20} /> Settings
                </NavLink>
                <button
                    onClick={handleLogout}
                    style={{
                        marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem',
                        borderRadius: '0.5rem', border: 'none', background: 'transparent', color: '#f87171',
                        cursor: 'pointer', textAlign: 'left', fontWeight: '500'
                    }}
                >
                    <LogOut size={20} /> Logout
                </button>
            </nav>
        </div>
    );
};

export default Sidebar;
