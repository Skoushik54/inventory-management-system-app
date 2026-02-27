import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import InventoryView from './InventoryView';
import TransactionView from './TransactionView';
import StatsView from './StatsView';
import { CheckCircle2, AlertCircle } from 'lucide-react';

const DashboardPage = () => {
    const [alert, setAlert] = useState(null);

    useEffect(() => {
        const handleAlert = (e) => {
            setAlert(e.detail);
            setTimeout(() => setAlert(null), 3000);
        };
        window.addEventListener('app_alert', handleAlert);
        return () => window.removeEventListener('app_alert', handleAlert);
    }, []);

    return (
        <div className="dashboard-layout">
            <Sidebar />
            <main className="main-content">
                <Routes>
                    <Route path="/" element={<StatsView />} />
                    <Route path="/inventory" element={<InventoryView />} />
                    <Route path="/transactions" element={<TransactionView />} />
                </Routes>
            </main>

            {alert && (
                <div style={{
                    position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 3000,
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '1rem 1.5rem', background: 'white', borderRadius: '0.75rem',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                    borderLeft: `4px solid ${alert.type === 'error' ? 'var(--danger)' : 'var(--success)'}`,
                    animation: 'slideUp 0.3s ease-out'
                }}>
                    {alert.type === 'error' ? <AlertCircle color="var(--danger)" /> : <CheckCircle2 color="var(--success)" />}
                    <div>
                        <strong style={{ display: 'block', fontSize: '1rem' }}>{alert.title}</strong>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{alert.message}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DashboardPage;
