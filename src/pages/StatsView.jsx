import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { BASE_URL } from '../services/api';
import { Package, RefreshCw, AlertTriangle, FileSpreadsheet, Clock, Trash2, AlertCircle } from 'lucide-react';

const StatsView = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalProducts: 0,
        availableStock: 0,
        pendingReturns: 0
    });
    const [history, setHistory] = useState([]);
    const [showConfirm, setShowConfirm] = useState(false);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const prodRes = await api.get('/inventory/products');
            const transRes = await api.get('/transactions/pending');
            const historyRes = await api.get('/transactions/all');

            const products = prodRes.data || [];
            const allTransactions = historyRes.data || [];

            setStats({
                totalProducts: products.length,
                availableStock: products.reduce((acc, curr) => acc + curr.availableQuantity, 0),
                pendingReturns: transRes.data.length
            });

            // Generate Event Timeline (separate Issue and Return events)
            let eventHistory = [];
            allTransactions.forEach(t => {
                // 1. Issue Event
                eventHistory.push({
                    ...t,
                    eventId: t.id + '_issue',
                    eventDate: t.issuedAt,
                    eventType: 'ISSUED',
                    eventQty: t.quantity
                });
                // 2. Return Event
                if (t.status === 'RETURNED' || t.status === 'PARTIALLY_RETURNED') {
                    if (t.returnedAt) {
                        eventHistory.push({
                            ...t,
                            eventId: t.id + '_return',
                            eventDate: t.returnedAt,
                            eventType: t.status,
                            eventQty: t.returnedQuantity
                        });
                    }
                }
            });

            // Get last 10 events
            const sortedHistory = eventHistory
                .sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate))
                .slice(0, 10);
            setHistory(sortedHistory);
        } catch (err) {
            console.error("Error fetching stats:", err);
        }
    };

    // Helper: ask user to pick Excel file, save path, return true on success
    const ensureExcelPath = async () => {
        if (!window.electronAPI) return true; // web mode — path managed server-side
        const filePath = await window.electronAPI.pickExcelFile();
        if (!filePath) return false;
        await api.post('/inventory/set-excel-path', { path: filePath });
        return true;
    };

    const handleOpenExcel = async () => {
        try {
            showAlert('Info', 'Opening Excel...', 'info');
            try {
                await api.get('/inventory/open-local');
                showAlert('Success', 'Excel opened successfully!');
            } catch (err) {
                // Path not set yet (first time) — ask user to pick
                if (err.response?.status === 404 && window.electronAPI) {
                    showAlert('Info', 'Please select your Excel inventory file...', 'info');
                    const ok = await ensureExcelPath();
                    if (!ok) { showAlert('Info', 'Cancelled.', 'info'); return; }
                    await api.get('/inventory/open-local');
                    showAlert('Success', 'Excel opened! Next time it will open directly.');
                } else {
                    throw err;
                }
            }
        } catch (err) {
            showAlert('Error', 'Could not open Excel: ' + (err.response?.data?.error || err.message), 'error');
        }
    };

    const handleLocalSync = async () => {
        try {
            showAlert('Info', 'Syncing from Excel...', 'info');
            try {
                await api.post('/inventory/sync');
                fetchStats();
                showAlert('Success', 'Successfully synced!');
            } catch (err) {
                // Path not set yet (first time) — ask user to pick
                if (err.response?.status === 400 && window.electronAPI) {
                    showAlert('Info', 'Please select your Excel inventory file...', 'info');
                    const ok = await ensureExcelPath();
                    if (!ok) { showAlert('Info', 'Cancelled.', 'info'); return; }
                    await api.post('/inventory/sync');
                    fetchStats();
                    showAlert('Success', 'Synced! Next time it will sync directly.');
                } else {
                    throw err;
                }
            }
        } catch (err) {
            showAlert('Error', 'Failed to sync: ' + (err.response?.data?.error || err.message), 'error');
        }
    };

    const handleDeleteTransaction = async (id) => {
        if (!window.confirm("Delete this single transaction record?")) return;
        try {
            await api.delete(`/transactions/${id}`);
            fetchStats();
            showAlert('Success', 'Record deleted');
        } catch (err) {
            showAlert('Error', 'Failed to delete: ' + (err.response?.data?.error || err.message), 'error');
        }
    };

    const handleClearHistory = async () => {
        try {
            await api.delete('/transactions/clear-all');
            fetchStats();
            showAlert('Success', 'Transaction history has been cleared permanently.');
            setShowConfirm(false);
        } catch (err) {
            showAlert('Error', 'Failed to clear history: ' + (err.response?.data?.error || err.message), 'error');
            setShowConfirm(false);
        }
    };

    return (
        <div className="dashboard-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ margin: 0 }}>Greyhounds Telangana Workshop Dashboard</h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn" style={{ width: 'auto', backgroundColor: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={handleLocalSync}>
                        <RefreshCw size={18} /> Sync Excel Changes
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '3rem' }}>
                <StatCard
                    icon={<FileSpreadsheet color="var(--accent)" />}
                    label="Open Excel Database"
                    value={stats.totalProducts + ' Products'}
                    onClick={handleOpenExcel}
                    style={{ cursor: 'pointer', border: '2px solid var(--accent)' }}
                />
                <StatCard
                    icon={<RefreshCw color="var(--success)" />}
                    label="Available Stock"
                    value={stats.availableStock}
                />
                <StatCard
                    icon={<AlertTriangle color="var(--danger)" />}
                    label="Pending Returns"
                    value={stats.pendingReturns}
                    onClick={() => navigate('/dashboard/transactions')}
                    style={{ cursor: 'pointer' }}
                />
            </div>

            <div className="card" style={{ padding: '0' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Clock size={20} color="var(--accent)" />
                        <h3 style={{ margin: 0 }}>Recent Activity History</h3>
                    </div>
                    <button
                        onClick={() => setShowConfirm(true)}
                        style={{
                            padding: '0.4rem 0.8rem',
                            background: 'none',
                            border: '1px solid var(--danger)',
                            color: 'var(--danger)',
                            borderRadius: '0.4rem',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.background = '#fef2f2'; }}
                        onMouseOut={(e) => { e.currentTarget.style.background = 'none'; }}
                    >
                        <Trash2 size={14} /> Clear All History
                    </button>
                </div>

                {/* CONFIRMATION MODAL */}
                {showConfirm && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', zIndex: 1000
                    }}>
                        <div className="card" style={{ maxWidth: '400px', width: '90%', textAlign: 'center', padding: '2rem' }}>
                            <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>
                                <AlertCircle size={48} />
                            </div>
                            <h3>Clear Entire History?</h3>
                            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
                                This will permanently delete all transaction logs. This action cannot be undone.
                                <strong> Your inventory stock counts will not be changed.</strong>
                            </p>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button className="btn" style={{ flex: 1, backgroundColor: '#64748b' }} onClick={() => setShowConfirm(false)}>
                                    Cancel
                                </button>
                                <button className="btn" style={{ flex: 1, backgroundColor: 'var(--danger)' }} onClick={handleClearHistory}>
                                    Yes, Clear All
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#f8fafc' }}>
                            <tr style={{ textAlign: 'left' }}>
                                <th style={{ padding: '1rem' }}>Officer</th>
                                <th style={{ padding: '1rem' }}>Activity</th>
                                <th style={{ padding: '1rem' }}>Name of Equipment</th>
                                <th style={{ padding: '1rem' }}>Date</th>
                                <th style={{ padding: '1rem' }}>Status</th>
                                <th style={{ padding: '1rem', textAlign: 'center' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No recent activity found.</td>
                                </tr>
                            ) : (
                                history.map(t => (
                                    <tr key={t.eventId} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ fontWeight: '600' }}>{t.officer.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {t.officer.badgeNumber}</div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            {t.eventType === 'ISSUED' ? 'Issued' : (t.eventType === 'PARTIALLY_RETURNED' ? 'Partially Returned' : 'Returned')}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            {t.product.name}
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                                                (x{t.eventQty})
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                                            {new Date(t.eventDate).toLocaleString()}
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <span className={`badge badge-${t.eventType === 'ISSUED' ? 'warning' : (t.eventType === 'PARTIALLY_RETURNED' ? 'info' : 'success')}`}>
                                                {t.eventType === 'PARTIALLY_RETURNED' ? 'PARTIAL' : t.eventType}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                                            <button
                                                onClick={() => handleDeleteTransaction(t.id)}
                                                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)' }}
                                                title="Delete record"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};

const StatCard = ({ icon, label, value, onClick, style }) => (
    <div className="card" style={{ flex: 1, display: 'flex', gap: '1rem', alignItems: 'center', ...style }} onClick={onClick}>
        <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: '#f1f5f9' }}>
            {icon}
        </div>
        <div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{label}</p>
            <p style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>{value}</p>
        </div>
    </div>
);

// Reuse alert from other pages
const showAlert = (title, message, type = 'success') => {
    const event = new CustomEvent('app_alert', { detail: { title, message, type } });
    window.dispatchEvent(event);
};

export default StatsView;
