import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    Box,
    Users,
    AlertTriangle,
    History,
    Search,
    Calendar,
    CheckCircle2,
    ArrowUpRight,
    Clock,
    Trash2,
    BarChart3,
    Package,
    RefreshCw,
    Layers,
    AlertCircle,
    FileSpreadsheet,
    FolderOpen,
    X,
    Download,
    Printer,
    Eye
} from 'lucide-react';
import api, { BASE_URL } from '../services/api';
import { useNavigate } from 'react-router-dom';
import PasswordPromptModal from '../components/PasswordPromptModal';

const StatsView = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalProducts: 0,
        availableStock: 0,
        issuedItems: 0,
        pendingReturns: 0,
        damagedItems: 0,
        missingSparesItems: 0
    });
    const [recentTransactions, setRecentTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showConfirm, setShowConfirm] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [authPrompt, setAuthPrompt] = useState({ show: false, action: null, title: '', message: '' });

    const [searchBarcode, setSearchBarcode] = useState('');
    const [searchResult, setSearchResult] = useState(null);
    const [isSearching, setIsSearching] = useState(false);
    const [showIssuedModal, setShowIssuedModal] = useState(false);
    const [showDamagedModal, setShowDamagedModal] = useState(false);
    const [showSparesModal, setShowSparesModal] = useState(false);
    const [issuedUnits, setIssuedUnits] = useState([]);
    const [damagedUnits, setDamagedUnits] = useState([]);
    const [sparesUnits, setSparesUnits] = useState([]);
    const [loadingIssued, setLoadingIssued] = useState(false);
    const [loadingDamaged, setLoadingDamaged] = useState(false);
    const [loadingSpares, setLoadingSpares] = useState(false);
    const [editingSpares, setEditingSpares] = useState(null); // txId being edited
    const [sparesEditItems, setSparesEditItems] = useState([]); // [{name, qty, returned}]
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [detailBatch, setDetailBatch] = useState(null);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            const [summaryRes, transRes] = await Promise.all([
                api.get('/stats/summary'),
                api.get('/transactions/all') // Still used for "Recent" list
            ]);

            const summary = summaryRes.data;
            const transactions = transRes.data;

            setStats({
                totalProducts: summary.totalProducts,
                availableStock: summary.availableStock,
                issuedItems: summary.issuedItems,
                pendingReturns: summary.pendingReturns,
                damagedItems: summary.damagedItems,
                missingSparesItems: summary.missingSparesItems
            });

            setRecentTransactions(transactions);
            setLoading(false);
        } catch (error) {
            console.error('Dashboard error:', error);
            setLoading(false);
        }
    };

    const handleSearchStatus = async (e) => {
        if (e.key !== 'Enter' || !searchBarcode.trim()) return;
        setIsSearching(true);
        try {
            const res = await api.get(`/inventory/items/${encodeURIComponent(searchBarcode.trim())}`);
            setSearchResult(res.data);
        } catch (err) {
            setSearchResult({ error: 'Item not found' });
        } finally {
            setIsSearching(false);
        }
    };

    const handleLocalSync = async () => {
        try {
            await api.post('/inventory/sync');
            fetchDashboardData();
            showAlert('Success', 'Inventory synced with Excel data source');
        } catch (err) {
            console.error('Sync error:', err);
            const msg = err.response?.data?.error || err.response?.data?.message || 'Excel file might be open or path is invalid.';
            showAlert('Error', msg, 'error');
        }
    };

    // handleOpenExcel is no longer directly used by a button, its logic is moved to the new "Open Excel" button
    // const handleOpenExcel = async () => {
    //     try {
    //         await api.get('/inventory/open-local');
    //     } catch (err) {
    //         showAlert('Error', 'Could not open Excel file.', 'error');
    //     }
    // };

    const handleClearHistory = async () => {
        try {
            await api.delete('/transactions/clear-all');
            setShowConfirm(false);
            fetchDashboardData();
            showAlert('Cleared', 'All history has been permanently removed');
        } catch (err) {
            showAlert('Error', 'Action failed', 'error');
        }
    };

    const handleDeleteBatch = async (batchId) => {
        setAuthPrompt({
            show: true,
            title: 'Delete Batch',
            message: 'Please enter admin password to delete this entire issue batch.',
            action: async () => {
                try {
                    await api.delete(`/transactions/batch/${batchId}`);
                    fetchDashboardData();
                    showAlert('Deleted', 'Batch records removed');
                } catch (err) {
                    showAlert('Error', 'Failed to delete batch', 'error');
                }
            }
        });
    };

    const handlePrintDamageReport = (item) => {
        const type = 'Damage_Report';
        const html = `
            <html>
                <head>
                    <title>${type}</title>
                    <style>
                        body { font-family: serif; padding: 40px; color: black; background: white; }
                        .header { textAlign: center; border-bottom: 2px solid black; padding-bottom: 15px; margin-bottom: 30px; }
                        h1 { margin: 0; font-size: 24px; }
                        .section { margin-bottom: 25px; }
                        .section-title { font-weight: bold; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px; text-transform: uppercase; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        th, td { border: 1px solid black; padding: 10px; font-size: 14px; text-align: left; }
                        th { background: #eee; }
                        .photo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
                        .photo-box { text-align: center; border: 1px solid #eee; padding: 10px; }
                        .photo-box img { max-width: 100%; height: 200px; object-fit: contain; border: 1px solid black; }
                        .footer { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 100px; }
                        .sig-line { border-top: 1px solid black; text-align: center; padding-top: 5px; }
                    </style>
                </head>
                <body>
                    <div class="header" style="text-align: center;">
                        <h1>GREYHOUNDS TELANGANA</h1>
                        <p>WORKSHOP INVENTORY MANAGEMENT SYSTEM</p>
                        <h2 style="margin: 10px 0;">EQUIPMENT DAMAGE REPORT</h2>
                    </div>

                    <div class="section">
                        <div class="section-title">Equipment Details</div>
                        <table>
                            <tr>
                                <th>Equipment Name</th>
                                <td>${item.product?.name || 'Unknown'}</td>
                                <th>Unit ID (QR)</th>
                                <td>${item.barcode}</td>
                            </tr>
                            <tr>
                                <th>Serial Number</th>
                                <td>${item.serialNumber || 'N/A'}</td>
                                <th>Reported Date</th>
                                <td>${item.damagedAt ? new Date(item.damagedAt).toLocaleString('en-GB') : 'N/A'}</td>
                            </tr>
                        </table>
                    </div>

                    <div class="section">
                        <div class="section-title">Officer Details</div>
                        <table>
                            <tr>
                                <th>Officer Name</th>
                                <td>${item.damagedBy?.name || 'Unknown'}</td>
                                <th>Badge Number</th>
                                <td>${item.damagedBy?.badgeNumber || 'N/A'}</td>
                            </tr>
                        </table>
                    </div>

                    <div class="section">
                        <div class="section-title">Visual Evidence</div>
                        <div class="photo-grid">
                            ${item.damagePhotoUrl ? `
                                <div class="photo-box">
                                    <p><strong>DAMAGE PROOF PHOTO</strong></p>
                                    <img src="${item.damagePhotoUrl.startsWith('http') ? item.damagePhotoUrl : `${BASE_URL.replace('/api','')}/damaged/${item.damagePhotoUrl.split('/').pop()}`}" />
                                </div>
                            ` : ''}
                            ${item.returnPersonPhotoUrl ? `
                                <div class="photo-box">
                                    <p><strong>REPORTING PERSON PHOTO</strong></p>
                                    <img src="${item.returnPersonPhotoUrl.startsWith('http') ? item.returnPersonPhotoUrl : `${BASE_URL.replace('/api','')}/files/${item.returnPersonPhotoUrl.split('/').pop()}`}" />
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="footer">
                        <div class="sig-line">
                            Reporting Officer Signature
                        </div>
                        <div class="sig-line">
                            Workshop In-Charge Signature
                        </div>
                    </div>
                </body>
            </html>
        `;

        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        setTimeout(() => {
            win.print();
            win.close();
        }, 500);
    };

    const handleResetAllStock = async () => {
        try {
            await api.post('/inventory/reset-all-stock');
            setShowResetConfirm(false);
            fetchDashboardData();
            showAlert('Stock Restored', 'All items are now marked as AVAILABLE and in stock');
        } catch (err) {
            showAlert('Error', 'Reset failed', 'error');
        }
    };

    const handleOpenIssuedModal = async () => {
        setShowIssuedModal(true);
        setLoadingIssued(true);
        try {
            const res = await api.get('/transactions/pending');
            setIssuedUnits(res.data);
        } catch (err) {
            console.error('Failed to fetch issued units', err);
        } finally {
            setLoadingIssued(false);
        }
    };

    const handleOpenDamagedModal = async () => {
        setShowDamagedModal(true);
        setLoadingDamaged(true);
        try {
            const res = await api.get('/stats/damaged');
            setDamagedUnits(res.data);
        } catch (err) {
            console.error('Failed to fetch damaged units', err);
        } finally {
            setLoadingDamaged(false);
        }
    };

    const handleOpenSparesModal = async () => {
        setShowSparesModal(true);
        setLoadingSpares(true);
        try {
            const res = await api.get('/stats/missing-spares');
            setSparesUnits(res.data);
        } catch (err) {
            console.error('Failed to fetch units with missing spares', err);
        } finally {
            setLoadingSpares(false);
        }
    };

    const handleClearSparesDebt = async (txId) => {
        if (!window.confirm("Clear this spare part debt? Use this only if the officer has returned all missing accessories.")) return;
        try {
            await api.post(`/stats/clear-spares/${txId}`);
            showAlert('Success', 'Spare parts debt record cleared');
            handleOpenSparesModal();
            fetchDashboardData();
        } catch (err) {
            showAlert('Error', 'Action failed', 'error');
        }
    };

    // Parse "name: missing N, name2: missing M" into [{name, qty}]
    const parseMissingSpares = (str) => {
        if (!str) return [];
        return str.split(',').map(s => s.trim()).filter(Boolean).map(s => {
            const m = s.match(/^(.+?):\s*missing\s*(\d+)/i);
            if (m) return { name: m[1].trim(), qty: parseInt(m[2]), returned: false };
            return null;
        }).filter(Boolean);
    };

    const handleUpdateSparesDebt = async (txId) => {
        try {
            // Rebuild string from items not yet returned
            const remaining = sparesEditItems.filter(it => !it.returned && it.qty > 0);
            const newStr = remaining.map(it => `${it.name}: missing ${it.qty}`).join(', ');
            await api.patch(`/stats/update-spares/${txId}`, { missingSpares: newStr || '' });
            showAlert('Updated', 'Missing spares updated successfully');
            setEditingSpares(null);
            handleOpenSparesModal();
            fetchDashboardData();
        } catch (err) {
            showAlert('Error', 'Update failed', 'error');
        }
    };

    const handleRestoreItem = async (itemId) => {
        if (!window.confirm("Mark this item as READY TO INVENTORY and available for issue?")) return;
        try {
            await api.post(`/stats/restore/${itemId}`);
            showAlert('Restored', 'Item is now AVAILABLE in inventory');
            handleOpenDamagedModal(); // Refresh list
            fetchDashboardData(); // Refresh counts
        } catch (err) {
            showAlert('Error', 'Restoration failed', 'error');
        }
    };


    const groupedTransactions = (Array.isArray(recentTransactions) ? recentTransactions : []).reduce((acc, tx) => {
        if (!tx) return acc;
        const batchId = tx.batchId || 'single-' + tx.id;
        if (!acc[batchId]) {
            acc[batchId] = {
                id: batchId,
                officer: tx.officer,
                issuedAt: tx.issuedAt,
                issuerName: tx.issuerName,
                extraAccessories: tx.extraAccessories,
                items: []
            };
        }
        acc[batchId].items.push(tx);
        return acc;
    }, {});

    const sortedBatches = Object.values(groupedTransactions).sort((a, b) =>
        new Date(b.issuedAt) - new Date(a.issuedAt)
    );

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Dashboard...</div>;

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontWeight: '800', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <LayoutDashboard size={28} color="var(--accent)" /> Dashboard Overview
                </h2>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <button className="btn" style={{ width: 'auto', backgroundColor: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem' }} onClick={handleLocalSync}>
                        <RefreshCw size={16} /> Sync Excel
                    </button>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        <Calendar size={16} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> {new Date().toLocaleDateString('en-GB')}
                    </div>
                </div>
            </div>

            {/* Actions Section */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <div className="card" style={{ borderLeft: '4px solid #10b981' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ background: '#dcfce7', padding: '10px', borderRadius: '12px' }}>
                            <FileSpreadsheet color="#059669" size={24} />
                        </div>
                        <h3 style={{ margin: 0 }}>Inventory Excel</h3>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                        Manage the master Excel inventory file. You can choose a new file or open the current one in Excel.
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: '#10b981' }} onClick={async () => {
                            if (window.electronAPI) {
                                const path = await window.electronAPI.pickExcelFile();
                                if (path) {
                                    try {
                                        await api.post('/inventory/set-excel-path', { path });
                                        showAlert('Success', 'Inventory file path updated');
                                    } catch (err) {
                                        showAlert('Error', 'Failed to update file path', 'error');
                                    }
                                }
                            } else {
                                showAlert('Feature Unavailable', 'Excel file picking is only available in Desktop mode', 'error');
                            }
                        }}>
                            <FolderOpen size={18} /> Choose File
                        </button>
                        <button className="btn" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: '#059669' }} onClick={async () => {
                            try {
                                const res = await api.get('/inventory/open-local');
                                showAlert('Success', res.data.message);
                            } catch (err) {
                                showAlert('Error', 'Excel file not configured or not found', 'error');
                            }
                        }}>
                            <FileSpreadsheet size={18} /> Open Excel
                        </button>
                    </div>
                    <button className="btn" style={{ width: '100%', marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', backgroundColor: '#ef4444' }} onClick={async () => {
                        if (window.confirm('Are you sure you want to unlink the current Excel file?')) {
                            try {
                                await api.post('/inventory/unlink-excel', {});
                                showAlert('Success', 'Excel file unlinked');
                            } catch (err) {
                                console.error('Unlink failed:', err);
                                showAlert('Error', 'Failed to unlink: ' + (err.response?.data?.error || 'Server error'), 'error');
                            }
                        }
                    }}>
                        <X size={18} /> Unlink Excel File
                    </button>
                </div>

                <div className="card" style={{ borderLeft: '4px solid #f59e0b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{ background: '#fef3c7', padding: '10px', borderRadius: '12px' }}>
                            <RefreshCw color="#d97706" size={24} />
                        </div>
                        <h3 style={{ margin: 0 }}>System Restore</h3>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                        Reset all items to available and clear transition logs. Only use this for full inventory reconciliation.
                    </p>
                    <button className="btn" style={{ backgroundColor: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={() => setShowResetConfirm(true)}>
                        <RefreshCw size={18} /> Reset All Stock
                    </button>
                </div>

            </div>

            {/* PRODUCT STATUS SEARCH */}
            <div className="card" style={{ marginBottom: '2rem', borderLeft: '4px solid #8b5cf6' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Search size={20} color="#8b5cf6" /> Search Product Status
                </h3>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <input
                        className="form-input"
                        placeholder="Scan or enter Product Item ID (Barcode)..."
                        value={searchBarcode}
                        onChange={(e) => setSearchBarcode(e.target.value)}
                        onKeyDown={handleSearchStatus}
                        style={{ flex: 1 }}
                    />
                    <button 
                        className="btn" 
                        style={{ width: 'auto', backgroundColor: '#8b5cf6', color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                        onClick={() => handleSearchStatus({ key: 'Enter' })}
                    >
                        <Search size={18} /> Search
                    </button>
                </div>
                {isSearching && <p style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>Searching...</p>}
                {searchResult && (
                    <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                        {searchResult.error ? (
                            <p style={{ color: 'var(--danger)', margin: 0 }}>{searchResult.error}</p>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Equipment</label>
                                    <p style={{ margin: 0, fontWeight: '600' }}>{searchResult.product?.name || searchResult.product_name || 'Unknown'}</p>
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status</label>
                                    <p style={{ margin: 0 }}>
                                        <span className={`badge badge-${searchResult.status === 'AVAILABLE' ? 'success' : 'warning'}`}>
                                            {searchResult.status === 'PARTIALLY_RETURNED' ? 'ISSUED (STUCK)' : searchResult.status}
                                        </span>
                                    </p>
                                </div>
                                {(searchResult.status !== 'AVAILABLE' || searchResult.lastOfficerName) && (
                                    <div>
                                        <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Issued To</label>
                                        <p style={{ margin: 0, fontWeight: '600', color: 'var(--accent)' }}>
                                            {searchResult.lastOfficerName || 'Unknown Officer'}
                                            {searchResult.lastOfficerBadgeNumber ? ` (${searchResult.lastOfficerBadgeNumber})` : ''}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
                <StatCard icon={<Box color="var(--accent)" />} label="Total Stock" value={stats.totalProducts + ' Types'} />
                <StatCard icon={<CheckCircle2 color="var(--success)" />} label="Available" value={stats.availableStock} />
                <StatCard
                    icon={<ArrowUpRight color="var(--danger)" />}
                    label="Issued Out"
                    value={stats.issuedItems}
                    onClick={handleOpenIssuedModal}
                    style={{ cursor: 'pointer', border: '1px solid transparent', transition: 'all 0.2s' }}
                />
                <StatCard
                    icon={<AlertTriangle color="var(--danger)" />}
                    label="Damaged"
                    value={stats.damagedItems}
                    onClick={handleOpenDamagedModal}
                    style={{ cursor: 'pointer', border: '1px solid #fee2e2', background: stats.damagedItems > 0 ? '#fff1f2' : 'white' }}
                />
                <StatCard
                    icon={<Layers color="var(--accent)" />}
                    label="Missing Spares"
                    value={stats.missingSparesItems}
                    onClick={handleOpenSparesModal}
                    style={{ cursor: 'pointer', border: '1px solid #e0e7ff', background: stats.missingSparesItems > 0 ? '#eef2ff' : 'white' }}
                />
            </div>

            <div className="card" style={{ padding: '0' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <History size={20} color="var(--accent)" /> Grouped Issue Ledger
                    </h3>
                    <button onClick={() => setShowConfirm(true)} style={{ background: 'none', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '0.4rem 0.8rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>
                        Clear History
                    </button>
                </div>

                <div className="table-container">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#f8fafc' }}>
                            <tr style={{ textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                <th style={{ padding: '1rem' }}>Date & Time</th>
                                <th style={{ padding: '1rem' }}>Item Issued</th>
                                <th style={{ padding: '1rem' }}>Officer ID</th>
                                <th style={{ padding: '1rem' }}>Issuer Name</th>
                                <th style={{ padding: '1rem' }}>Status</th>
                                <th style={{ padding: '1rem', textAlign: 'center' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedBatches.length === 0 ? (
                                <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No records found</td></tr>
                            ) : (
                                sortedBatches.slice(0, 15).map(batch => (
                                    <tr key={batch.id} 
                                        onClick={() => {
                                            setDetailBatch(batch);
                                            setShowDetailModal(true);
                                        }}
                                        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.2s' }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                                    >
                                        <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                                            {new Date(batch.issuedAt).toLocaleDateString('en-GB')}<br />
                                            <small>{new Date(batch.issuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                                {batch.items.map(i => (
                                                    <span key={i.id} style={{ background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>
                                                        {i.productItem?.product?.name || 'Unknown Item'}
                                                    </span>
                                                ))}
                                            </div>
                                            {batch.extraAccessories && <small style={{ color: 'var(--accent)' }}>+ {batch.extraAccessories}</small>}
                                        </td>
                                        <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                                            {batch.officer?.badgeNumber || '-'}
                                        </td>
                                        <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{batch.issuerName || '-'}</td>
                                        <td style={{ padding: '1rem' }}>
                                            <span className={`badge badge-${batch.items.every(i => i.status === 'RETURNED') ? 'success' : 'warning'}`}>
                                                {batch.items.every(i => i.status === 'RETURNED') ? 'RETURNED' : 'ISSUED'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                            <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                                <button
                                                    onClick={() => {
                                                        setDetailBatch(batch);
                                                        setShowDetailModal(true);
                                                    }}
                                                    style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', padding: '4px' }}
                                                    title="View Details"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteBatch(batch.id)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: '4px' }}
                                                    title="Delete Batch"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {showConfirm && (
                <PasswordPromptModal
                    isOpen={showConfirm}
                    onClose={() => setShowConfirm(false)}
                    title="Clear History?"
                    message="Please enter admin password to permanently delete all logs. Inventory stock counts will remain unchanged."
                    onConfirm={handleClearHistory}
                />
            )}

            <PasswordPromptModal
                isOpen={authPrompt.show}
                onClose={() => setAuthPrompt({ show: false, action: null })}
                onConfirm={() => {
                    if (authPrompt.action) authPrompt.action();
                    setAuthPrompt({ show: false, action: null });
                }}
                title={authPrompt.title || "Verify Action"}
                message={authPrompt.message || "Please enter the admin password."}
            />

            {showResetConfirm && (
                <div className="modal-overlay">
                    <div className="card" style={{ maxWidth: '400px', textAlign: 'center' }}>
                        <AlertCircle size={48} color="var(--success)" style={{ marginBottom: '1rem' }} />
                        <h3>Restore Full Stock?</h3>
                        <p>This will mark ALL {stats.totalProducts} equipment types as 100% available. All pending issue records will be cleared.</p>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                            <button className="btn" style={{ background: '#64748b' }} onClick={() => setShowResetConfirm(false)}>Cancel</button>
                            <button className="btn" style={{ background: 'var(--success)' }} onClick={() => setAuthPrompt({
                                show: true,
                                action: handleResetAllStock,
                                title: 'Authorize Full Reset',
                                message: 'This will reset ALL products to available stock. Please enter administrative password to continue.'
                            })}>Confirm Full Stock</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ISSUED UNITS MODAL */}
            {showIssuedModal && (
                <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.9)' }}>
                    <div className="card" style={{ maxWidth: '900px', width: '90%', background: 'white', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <ArrowUpRight size={24} color="var(--danger)" /> Currently Issued Units
                            </h3>
                            <button onClick={() => setShowIssuedModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                        </div>

                        {loadingIssued ? (
                            <div style={{ textAlign: 'center', padding: '3rem' }}>Loading issued units...</div>
                        ) : issuedUnits.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No units are currently issued out.</div>
                        ) : (
                            <div className="table-container">
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10 }}>
                                        <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                                            <th style={{ padding: '1rem' }}>Unit ID</th>
                                            <th style={{ padding: '1rem' }}>Equipment Name</th>
                                            <th style={{ padding: '1rem' }}>Issued To</th>
                                            <th style={{ padding: '1rem' }}>Unit / Dept</th>
                                            <th style={{ padding: '1rem' }}>Issue Date</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {issuedUnits.map((tx, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '1rem', fontWeight: 'bold', color: 'var(--accent)' }}>{tx.productItem?.barcode}</td>
                                                <td style={{ padding: '1rem' }}>{tx.productItem?.product?.name}</td>
                                                <td style={{ padding: '1rem' }}>
                                                    <div style={{ fontWeight: '600' }}>{tx.officer?.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {tx.officer?.badgeNumber}</div>
                                                </td>
                                                <td style={{ padding: '1rem' }}>{tx.officer?.department || '-'}</td>
                                                <td style={{ padding: '1rem', whiteSpace: 'nowrap' }}>
                                                    <div style={{ fontSize: '0.85rem' }}>{new Date(tx.issuedAt).toLocaleDateString('en-GB')}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(tx.issuedAt).toLocaleTimeString()}</div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div style={{ marginTop: '2rem', textAlign: 'right' }}>
                            <button className="btn" onClick={() => setShowIssuedModal(false)} style={{ background: '#f1f5f9', color: '#475569', width: 'auto' }}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DAMAGED UNITS MODAL */}
            {showDamagedModal && (
                <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.9)' }}>
                    <div className="card" style={{ maxWidth: '900px', width: '90%', background: 'white', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <AlertTriangle size={24} color="var(--danger)" /> Damaged / Broken Units
                            </h3>
                            <button onClick={() => setShowDamagedModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                        </div>

                        {loadingDamaged ? (
                            <div style={{ textAlign: 'center', padding: '3rem' }}>Loading damaged units...</div>
                        ) : damagedUnits.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Great! No units are currently marked as damaged.</div>
                        ) : (
                            <div className="table-container">
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10 }}>
                                        <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                                            <th style={{ padding: '1rem' }}>Unit ID</th>
                                            <th style={{ padding: '1rem' }}>Equipment</th>
                                            <th style={{ padding: '1rem' }}>Officer & Photo</th>
                                            <th style={{ padding: '1rem' }}>Damage Proof</th>
                                            <th style={{ padding: '1rem' }}>Reported At</th>
                                            <th style={{ padding: '1rem', textAlign: 'center' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {damagedUnits.map((item, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '1rem', fontWeight: 'bold' }}>{item.barcode}</td>
                                                <td style={{ padding: '1rem' }}>{item.product?.name}</td>
                                                <td style={{ padding: '1rem' }}>
                                                    {item.damagedBy ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                                                    {item.returnPersonPhotoUrl && (
                                                                        <img
                                                                            src={item.returnPersonPhotoUrl.startsWith('http') ? item.returnPersonPhotoUrl : `${api.defaults.baseURL}/files/${item.returnPersonPhotoUrl.split('/').pop()}`}
                                                                            alt="Person"
                                                                            style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '50%', border: '1px solid var(--border)' }}
                                                                        />
                                                                    )}
                                                            <div>
                                                                <div style={{ fontWeight: '600' }}>{item.damagedBy.name}</div>
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>ID: {item.damagedBy.badgeNumber}</div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Unknown</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    {item.damagePhotoUrl ? (
                                                        <img
                                                            src={item.damagePhotoUrl.startsWith('http') ? item.damagePhotoUrl : `${api.defaults.baseURL}/damaged/${item.damagePhotoUrl.split('/').pop()}`}
                                                            alt="Damage"
                                                            style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid var(--danger)', cursor: 'pointer' }}
                                                            onClick={() => window.open(item.damagePhotoUrl.startsWith('http') ? item.damagePhotoUrl : `${api.defaults.baseURL}/damaged/${item.damagePhotoUrl.split('/').pop()}`)}
                                                            title="Click to enlarge"
                                                        />
                                                    ) : (
                                                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No Photo</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '1rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                                                    {item.damagedAt ? (
                                                        <><div>{new Date(item.damagedAt).toLocaleDateString('en-GB')}</div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(item.damagedAt).toLocaleTimeString()}</div></>
                                                    ) : '-'}
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                    <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                                        <button
                                                            className="btn"
                                                            style={{ background: 'var(--accent)', padding: '0.4rem 0.8rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                            onClick={() => handlePrintDamageReport(item)}
                                                            title="Print Damage Report Invoice"
                                                        >
                                                            <Printer size={12} /> Invoice
                                                        </button>
                                                        <button
                                                            className="btn"
                                                            style={{ backgroundColor: 'var(--success)', padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                                                            onClick={() => handleRestoreItem(item.id)}
                                                        >
                                                            Ready to Inventory
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div style={{ marginTop: '2rem', textAlign: 'right' }}>
                            <button className="btn" onClick={() => setShowDamagedModal(false)} style={{ background: '#f1f5f9', color: '#475569', width: 'auto' }}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MISSING SPARES TRACKING MODAL */}
            {showSparesModal && (
                <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.9)' }}>
                    <div className="card" style={{ maxWidth: '950px', width: '90%', background: 'white', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Layers size={24} color="var(--accent)" /> Spare Parts Debt Tracking
                            </h3>
                            <button onClick={() => setShowSparesModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                        </div>

                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                            Tracking officers who returned equipment but failed to include all accessories/spare parts.
                            The items themselves have been restored to available inventory.
                        </p>

                        {loadingSpares ? (
                            <div style={{ textAlign: 'center', padding: '3rem' }}>Loading tracking data...</div>
                        ) : sparesUnits.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No pending spare part debts found.</div>
                        ) : (
                            <div className="table-container">
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', zIndex: 10 }}>
                                        <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                                            <th style={{ padding: '1rem' }}>Officer Details</th>
                                            <th style={{ padding: '1rem' }}>Equipment Returned</th>
                                            <th style={{ padding: '1rem' }}>Missing Accessories</th>
                                            <th style={{ padding: '1rem' }}>Return Date</th>
                                            <th style={{ padding: '1rem', textAlign: 'center' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sparesUnits.map((tx, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                                <td style={{ padding: '1rem' }}>
                                                    <div style={{ fontWeight: '600' }}>{tx.officer?.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {tx.officer?.badgeNumber}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tx.officer?.department}</div>
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <div style={{ fontWeight: '500' }}>{tx.productItem?.product?.name}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>ID: {tx.productItem?.barcode}</div>
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    {editingSpares === tx.id ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                            {sparesEditItems.map((item, idx) => (
                                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.6rem', background: item.returned ? '#f0fdf4' : '#fff1f2', borderRadius: '6px', border: `1px solid ${item.returned ? '#86efac' : '#fda4af'}` }}>
                                                                    {/* Checkbox = mark as returned */}
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={item.returned}
                                                                        onChange={e => {
                                                                            const updated = sparesEditItems.map((it, i) => i === idx ? { ...it, returned: e.target.checked } : it);
                                                                            setSparesEditItems(updated);
                                                                        }}
                                                                        style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                                                    />
                                                                    <span style={{ flex: 1, fontSize: '0.85rem', textDecoration: item.returned ? 'line-through' : 'none', color: item.returned ? '#16a34a' : 'var(--danger)', fontWeight: 500 }}>
                                                                        {item.name}
                                                                    </span>
                                                                    {/* +/- qty */}
                                                                    {!item.returned && (
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                            <button
                                                                                onClick={() => {
                                                                                    const updated = sparesEditItems.map((it, i) => i === idx ? { ...it, qty: Math.max(1, it.qty - 1) } : it);
                                                                                    setSparesEditItems(updated);
                                                                                }}
                                                                                style={{ width: '24px', height: '24px', border: '1px solid #fda4af', borderRadius: '4px', background: '#fff', cursor: 'pointer', fontWeight: 'bold', lineHeight: 1 }}
                                                                            >−</button>
                                                                            <span style={{ minWidth: '24px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>{item.qty}</span>
                                                                            <button
                                                                                onClick={() => {
                                                                                    const updated = sparesEditItems.map((it, i) => i === idx ? { ...it, qty: it.qty + 1 } : it);
                                                                                    setSparesEditItems(updated);
                                                                                }}
                                                                                style={{ width: '24px', height: '24px', border: '1px solid #fda4af', borderRadius: '4px', background: '#fff', cursor: 'pointer', fontWeight: 'bold', lineHeight: 1 }}
                                                                            >+</button>
                                                                        </div>
                                                                    )}
                                                                    {item.returned && <span style={{ fontSize: '0.75rem', color: '#16a34a' }}>✓ Returned</span>}
                                                                </div>
                                                            ))}
                                                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.3rem' }}>
                                                                <button className="btn" style={{ flex: 1, background: 'var(--success)', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => handleUpdateSparesDebt(tx.id)}>Save</button>
                                                                <button className="btn" style={{ flex: 1, background: '#f1f5f9', color: '#475569', padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={() => setEditingSpares(null)}>Cancel</button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                            <div style={{ color: 'var(--danger)', fontSize: '0.9rem', fontWeight: '500', padding: '0.5rem', background: '#fff1f2', borderRadius: '6px', border: '1px dashed #fda4af' }}>
                                                                {tx.missingSpares}
                                                            </div>
                                                            <button
                                                                style={{ background: 'none', border: '1px solid var(--accent)', borderRadius: '4px', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.72rem', padding: '3px 10px' }}
                                                                onClick={() => {
                                                                    setEditingSpares(tx.id);
                                                                    setSparesEditItems(parseMissingSpares(tx.missingSpares));
                                                                }}
                                                            >✏️ Edit / Update Returned Qty</button>
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '1rem', fontSize: '0.85rem' }}>
                                                    {new Date(tx.returnedAt).toLocaleDateString('en-GB')}<br />
                                                    <small>{new Date(tx.returnedAt).toLocaleTimeString()}</small>
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                    <button
                                                        className="btn"
                                                        style={{ backgroundColor: 'var(--success)', padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}
                                                        onClick={() => handleClearSparesDebt(tx.id)}
                                                    >
                                                        Clear Debt
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div style={{ marginTop: '2rem', textAlign: 'right' }}>
                            <button className="btn" onClick={() => setShowSparesModal(false)} style={{ background: '#f1f5f9', color: '#475569', width: 'auto' }}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TRANSACTION DETAILS MODAL */}
            {
                showDetailModal && detailBatch && (
                    <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.95)' }}>
                        <div className="card" style={{ maxWidth: '700px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
                                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Eye color="var(--accent)" size={24} /> Transaction Details
                                </h3>
                                <button onClick={() => setShowDetailModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                                <div>
                                    <h4 style={{ color: 'var(--accent)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Officer Information</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{detailBatch.officer?.name}</div>
                                        <div style={{ color: 'var(--text-muted)' }}>Badge No: <strong>{detailBatch.officer?.badgeNumber}</strong></div>
                                        <div style={{ color: 'var(--text-muted)' }}>Unit/Dept: {detailBatch.officer?.unit || '-'}</div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <h4 style={{ color: 'var(--accent)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Transaction Meta</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div>Date: <strong>{new Date(detailBatch.issuedAt).toLocaleDateString('en-GB')}</strong></div>
                                        <div>Time: <strong>{new Date(detailBatch.issuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></div>
                                        <div>Issuer: <strong>{detailBatch.issuerName || '-'}</strong></div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '2rem' }}>
                                <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '0.75rem' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>PURPOSE OF ISSUE</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--primary)' }}>{detailBatch.items[0]?.purpose || 'Routine Duty'}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    {detailBatch.items[0]?.personPhotoUrl && (
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>ISSUE PHOTO</div>
                                            <img 
                                                src={detailBatch.items[0].personPhotoUrl.startsWith('http') ? detailBatch.items[0].personPhotoUrl : `${api.defaults.baseURL}/files/${detailBatch.items[0].personPhotoUrl.split('/').pop()}`} 
                                                style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} 
                                                alt="Issue" 
                                            />
                                        </div>
                                    )}
                                    {detailBatch.items[0]?.returnPersonPhotoUrl && (
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>RETURN PHOTO</div>
                                            <img 
                                                src={detailBatch.items[0].returnPersonPhotoUrl.startsWith('http') ? detailBatch.items[0].returnPersonPhotoUrl : `${api.defaults.baseURL}/files/${detailBatch.items[0].returnPersonPhotoUrl.split('/').pop()}`} 
                                                style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} 
                                                alt="Return" 
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <h4 style={{ color: 'var(--accent)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Issued Equipment</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {detailBatch.items.map((it, idx) => {
                                    // Extract spares for this specific item
                                    const targetBarcode = it.productItem?.barcode;
                                    const rawExtras = detailBatch.extraAccessories || '';
                                    const parts = rawExtras.split(' | ');
                                    const itemSparesString = parts.find(p => p.trim().startsWith(`${targetBarcode}:`));
                                    
                                    let sparesList = [];
                                    if (itemSparesString) {
                                        const content = itemSparesString.split(':').slice(1).join(':').trim();
                                        if (content.toLowerCase() !== 'none') {
                                            sparesList = content.split(',').map(s => s.trim()).filter(Boolean);
                                        }
                                    }

                                    return (
                                        <div key={idx} style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '0.75rem', padding: '1rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#92400e' }}>{it.productItem?.product?.name || 'Unknown Item'}</div>
                                                    <div style={{ fontSize: '0.85rem', color: '#b45309' }}>Barcode: {it.productItem?.barcode}</div>
                                                </div>
                                                <span className={`badge badge-${it.status === 'RETURNED' ? 'success' : 'warning'}`}>
                                                    {it.status}
                                                </span>
                                            </div>
                                            
                                            {sparesList.length > 0 && (
                                                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed #fcd34d' }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#92400e', marginBottom: '0.3rem' }}>Spare Parts / Accessories:</div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                                        {sparesList.map((s, si) => (
                                                            <span key={si} style={{ background: '#fef3c7', border: '1px solid #fcd34d', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem' }}>{s}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {it.status === 'RETURNED' && (
                                                <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#059669', background: '#ecfdf5', padding: '0.4rem 0.75rem', borderRadius: '4px' }}>
                                                    Returned on {new Date(it.returnedAt).toLocaleDateString('en-GB')} at {new Date(it.returnedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    {it.missingSpares && it.missingSpares.toLowerCase() !== 'none' && (
                                                        <div style={{ color: '#b91c1c', fontWeight: 700, marginTop: '2px' }}>⚠️ Missing: {it.missingSpares}</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div style={{ marginTop: '2.5rem' }}>
                                <button className="btn" style={{ width: '100%', background: 'var(--primary)' }} onClick={() => setShowDetailModal(false)}>Close Overview</button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
};

const StatCard = ({ icon, label, value, onClick, style = {} }) => (
    <div
        className="card"
        onClick={onClick}
        style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'center',
            ...style,
            ...(onClick ? { cursor: 'pointer', transition: 'all 0.2s', border: '1px solid var(--border)' } : {})
        }}
        onMouseOver={(e) => onClick && (e.currentTarget.style.transform = 'translateY(-2px)')}
        onMouseOut={(e) => onClick && (e.currentTarget.style.transform = 'translateY(0)')}
    >
        <div style={{ padding: '0.75rem', background: '#f1f5f9', borderRadius: '0.5rem' }}>{icon}</div>
        <div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>{label}</p>
            <p style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>{value}</p>
        </div>
    </div>
);

const showAlert = (title, message, type = 'success') => {
    const event = new CustomEvent('app_alert', { detail: { title, message, type } });
    window.dispatchEvent(event);
};

export default StatsView;
