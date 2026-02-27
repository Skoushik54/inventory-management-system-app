import React, { useEffect, useState, useRef } from 'react';
import api from '../services/api';
import { QrCode, Trash2, Printer, Plus, CheckCircle2, AlertCircle, X, Search } from 'lucide-react';

const TransactionView = () => {
    const [pending, setPending] = useState([]);
    // Load from localStorage or default to empty
    const [officerData, setOfficerData] = useState(() => {
        const saved = localStorage.getItem('trans_officer');
        return saved ? JSON.parse(saved) : { badgeNumber: '', name: '', department: '', phone: '', others: '' };
    });
    const [purpose, setPurpose] = useState(() => localStorage.getItem('trans_purpose') || '');
    const [cart, setCart] = useState(() => {
        const savedCart = localStorage.getItem('trans_cart');
        return savedCart ? JSON.parse(savedCart) : [];
    });
    const [scanValue, setScanValue] = useState('');
    const [scannedProduct, setScannedProduct] = useState(null);
    const [itemQuantity, setItemQuantity] = useState(1);
    const scanInputRef = useRef(null);

    // Custom Popup State
    const [confirmPopup, setConfirmPopup] = useState({ show: false, title: '', message: '', onConfirm: null, type: 'info' });
    const [alertPopup, setAlertPopup] = useState({ show: false, title: '', message: '', type: 'success' });
    const [showPrintPreview, setShowPrintPreview] = useState(false);
    const [issuedSummary, setIssuedSummary] = useState([]);

    useEffect(() => {
        fetchPending();
        if (scanInputRef.current) scanInputRef.current.focus();
    }, []);

    // Save to localStorage whenever data changes
    useEffect(() => {
        localStorage.setItem('trans_officer', JSON.stringify(officerData));
    }, [officerData]);

    useEffect(() => {
        localStorage.setItem('trans_purpose', purpose);
    }, [purpose]);

    useEffect(() => {
        localStorage.setItem('trans_cart', JSON.stringify(cart));
    }, [cart]);

    const fetchPending = async () => {
        try {
            const response = await api.get('/transactions/pending');
            setPending(response.data);
        } catch (err) {
            console.error('Error fetching pending transactions', err);
        }
    };

    const showAlert = (title, message, type = 'success') => {
        setAlertPopup({ show: true, title, message, type });
        setTimeout(() => setAlertPopup(prev => ({ ...prev, show: false })), 3000);
    };

    const showConfirm = (title, message, onConfirm, type = 'info') => {
        setConfirmPopup({ show: true, title, message, onConfirm, type });
    };

    const handleSearchItem = async () => {
        const val = scanValue.trim();
        if (!val) return;
        try {
            const response = await api.get(`/inventory/products`);
            const products = response.data;
            const product = products.find(p => p.barcode === val);

            if (!product) {
                showAlert('Not Found', `QR / Reference "${val}" is not registered`, 'error');
                setScanValue('');
                setScannedProduct(null);
                return;
            }

            setScannedProduct(product);
            setItemQuantity(1);
        } catch (err) {
            showAlert('Error', 'Failed to contact inventory server', 'error');
        }
    };

    const handleScan = (e) => {
        if (e.key === 'Enter') {
            handleSearchItem();
        }
    };

    // New logic for instant QR scan (no search button needed)
    useEffect(() => {
        if (scanValue.length > 3) {
            const timer = setTimeout(() => {
                handleSearchItem();
            }, 600); // Small delay to catch full QR read
            return () => clearTimeout(timer);
        }
    }, [scanValue]);

    const addToCart = () => {
        if (!scannedProduct) return;
        const qty = parseInt(itemQuantity) || 0;
        if (qty <= 0) return showAlert('Invalid Qty', 'Quantity must be 1 or more', 'error');

        const existingItem = cart.find(item => item.id === scannedProduct.id);
        const currentCartQty = existingItem ? existingItem.quantity : 0;

        if (currentCartQty + qty > scannedProduct.availableQuantity) {
            return showAlert('Insufficient Stock', `Cannot add. Only ${scannedProduct.availableQuantity} units of ${scannedProduct.name} available.`, 'error');
        }

        setCart(prevCart => {
            const existing = prevCart.find(item => item.id === scannedProduct.id);
            if (existing) {
                return prevCart.map(item => item.id === scannedProduct.id ? { ...item, quantity: item.quantity + qty } : item);
            } else {
                return [...prevCart, { ...scannedProduct, quantity: qty }];
            }
        });

        showAlert('Added', `${scannedProduct.name} added to cart`);
        setScannedProduct(null);
        setScanValue('');
        setItemQuantity(1);
        if (scanInputRef.current) scanInputRef.current.focus();
    };

    const handleIssueAll = async () => {
        if (!officerData.badgeNumber) return showAlert('Missing Data', 'Officer ID No is required', 'error');
        if (cart.length === 0) return showAlert('Empty Cart', 'Please scan items first', 'error');

        showConfirm(
            'Confirm Issue',
            `Issue ${cart.length} items to Officer ID: ${officerData.badgeNumber}?`,
            async () => {
                try {
                    for (const item of cart) {
                        await api.post('/transactions/issue', {
                            barcode: item.barcode,
                            badgeNumber: officerData.badgeNumber,
                            name: officerData.name,
                            department: officerData.department,
                            phone: officerData.phone,
                            others: officerData.others,
                            quantity: item.quantity,
                            purpose: purpose
                        });
                    }
                    // Capture snapshot for preview before clearing cart
                    setIssuedSummary([...cart]);
                    setShowPrintPreview(true);
                    setCart([]);
                    setConfirmPopup(prev => ({ ...prev, show: false }));
                } catch (err) {
                    showAlert('Denied', err.response?.data?.message || 'Stock allocation failed', 'error');
                    setConfirmPopup(prev => ({ ...prev, show: false }));
                }
            }
        );
    };
    const handleClearHistory = async () => {
        showConfirm(
            'Clear Entire History',
            'Are you sure? This will PERMANENTLY delete all transaction logs from the system ledger. Inventory stock will not be affected.',
            async () => {
                try {
                    await api.delete('/transactions/clear-all');
                    fetchPending();
                    showAlert('Success', 'Transaction history has been cleared permanently.');
                    setConfirmPopup(prev => ({ ...prev, show: false }));
                } catch (err) {
                    showAlert('Error', 'Failed to clear history', 'error');
                    setConfirmPopup(prev => ({ ...prev, show: false }));
                }
            },
            'danger'
        );
    };


    const handlePrint = () => {
        const previewElement = document.getElementById('receipt-visual-container');
        if (!previewElement) return;

        const printContent = previewElement.innerHTML;
        const originalContent = document.body.innerHTML;

        // Temporarily swap body content with the receipt design
        document.body.innerHTML = printContent;
        window.print();

        // Restore the app UI
        document.body.innerHTML = originalContent;

        // Delay reload to let UI recover
        setTimeout(() => {
            closeAfterPrint();
            window.location.reload();
        }, 500);
    };

    const closeAfterPrint = () => {
        setShowPrintPreview(false);
        setOfficerData({ badgeNumber: '', name: '', department: '', phone: '', others: '' });
        setPurpose('');
        localStorage.removeItem('trans_officer');
        localStorage.removeItem('trans_purpose');
        fetchPending();
    }

    const [returnQty, setReturnQty] = useState(1);
    const [returningTransaction, setReturningTransaction] = useState(null);

    const handleReturn = (t) => {
        setReturningTransaction(t);
        setReturnQty(t.quantity - (t.returnedQuantity || 0));
    };

    const confirmReturn = async () => {
        if (!returningTransaction) return;
        const qty = parseInt(returnQty) || 0;
        if (qty <= 0) return showAlert('Invalid Qty', 'Return quantity must be 1 or more', 'error');

        try {
            await api.post(`/transactions/return/${returningTransaction.id}?quantity=${qty}`);
            fetchPending();
            showAlert('Returned', `Registered return of ${qty} units`);
            setReturningTransaction(null);
        } catch (err) {
            showAlert('Error', err.response?.data?.message || 'Failed to process return', 'error');
        }
    };

    const updateOfficerField = (field, value) => {
        setOfficerData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontWeight: '800', color: 'var(--primary)' }}>In / Out Transaction Register</h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn" style={{ width: 'auto', background: '#f1f5f9', color: '#475569' }} onClick={() => setCart([])}>Clear Cart</button>
                    <button className="btn" style={{ width: 'auto', backgroundColor: 'var(--success)' }} onClick={handleIssueAll}>
                        <Printer size={18} style={{ marginRight: '0.5rem' }} /> Finalize & Print
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem' }}>
                <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
                    <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <QrCode color="var(--accent)" /> Officer Details & Scanning
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>ID No*</label>
                                <input
                                    className="form-input"
                                    value={officerData.badgeNumber}
                                    onChange={e => updateOfficerField('badgeNumber', e.target.value)}
                                    placeholder="Enter ID No..."
                                />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Unit / Department*</label>
                                <input
                                    className="form-input"
                                    value={officerData.department}
                                    onChange={e => updateOfficerField('department', e.target.value)}
                                    placeholder="Enter Unit..."
                                />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Name*</label>
                                <input
                                    className="form-input"
                                    value={officerData.name}
                                    onChange={e => updateOfficerField('name', e.target.value)}
                                    placeholder="Enter Name..."
                                />
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Phone No</label>
                                <input
                                    className="form-input"
                                    value={officerData.phone}
                                    onChange={e => updateOfficerField('phone', e.target.value)}
                                    placeholder="Enter Phone No..."
                                />
                            </div>
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                            <label>Others</label>
                            <input
                                className="form-input"
                                value={officerData.others}
                                onChange={e => updateOfficerField('others', e.target.value)}
                                placeholder="Any other details..."
                            />
                        </div>

                        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                            <label style={{ fontWeight: '600', marginBottom: '0.5rem', display: 'block' }}>QR Scan / Manual Entry</label>
                            <input
                                ref={scanInputRef}
                                className="form-input"
                                placeholder="Scan QR code here..."
                                value={scanValue}
                                onChange={e => setScanValue(e.target.value)}
                                onKeyDown={handleScan}
                                style={{ fontSize: '1.1rem' }}
                            />
                        </div>

                        {scannedProduct && (
                            <div style={{
                                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                                border: '1px solid var(--accent)',
                                borderRadius: '0.5rem',
                                padding: '1rem',
                                animation: 'fadeIn 0.3s ease-in'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div>
                                        <h4 style={{ margin: 0, color: 'var(--primary)' }}>{scannedProduct.name}</h4>
                                        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Available: {scannedProduct.availableQuantity} units</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setScannedProduct(null);
                                            setScanValue('');
                                        }}
                                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)' }}
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                                    <div className="form-group" style={{ margin: 0, flex: 0.4 }}>
                                        <label>Quantity</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            value={itemQuantity}
                                            onFocus={e => e.target.select()}
                                            onChange={e => setItemQuantity(e.target.value === '' ? '' : parseInt(e.target.value))}
                                            min="1"
                                            max={scannedProduct.availableQuantity}
                                        />
                                    </div>
                                    <button
                                        className="btn"
                                        style={{
                                            flex: 0.6,
                                            background: 'var(--success)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem',
                                            height: '42px'
                                        }}
                                        onClick={addToCart}
                                    >
                                        <Plus size={18} /> Add to Cart
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="form-group" style={{ margin: 0 }}>
                            <label>Issue Purpose</label>
                            <input className="form-input" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="e.g. Training, Duty" />
                        </div>
                    </div>
                </div>

                <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Selected Items (Cart)</h3>
                    <div style={{ flex: 1, minHeight: '120px', overflowY: 'auto', background: '#f8fafc', borderRadius: '0.5rem', padding: '0.5rem' }}>
                        {cart.length === 0 && (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
                                No items scanned yet.
                            </div>
                        )}
                        {cart.map(item => (
                            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'white', marginBottom: '0.5rem', borderRadius: '0.25rem', border: '1px solid var(--border)' }}>
                                <div>
                                    <div style={{ fontWeight: '600' }}>{item.name}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>QR: {item.barcode}</div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <span style={{ fontWeight: 'bold', color: 'var(--accent)' }}>x{item.quantity}</span>
                                    <button onClick={() => setCart(cart.filter(c => c.id !== item.id))} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="card" style={{ marginTop: '2rem', padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0 }}>Active Issue Ledger</h3>
                    <span className="badge badge-warning">{pending.length} Outstanding Items</span>
                </div>
                <div className="table-container">
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
                        <thead style={{ background: '#f1f5f9' }}>
                            <tr style={{ textAlign: 'left' }}>
                                <th style={{ padding: '1rem' }}>Recipient ID No</th>
                                <th style={{ padding: '1rem' }}>Name of Equipment</th>
                                <th style={{ padding: '1rem' }}>Handed Over Qty</th>
                                <th style={{ padding: '1rem' }}>Usage Purpose</th>
                                <th style={{ padding: '1rem' }}>Issue Date</th>
                                <th style={{ padding: '1rem', textAlign: 'center' }}>Ledger Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pending.map(t => (
                                <tr key={t.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>ID: {t.officer.badgeNumber}</td>
                                    <td style={{ padding: '1rem' }}>{t.product.name}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{t.returnedQuantity || 0}</span> / {t.quantity}
                                        {t.status === 'PARTIALLY_RETURNED' && <span className="badge badge-info" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>Partial</span>}
                                    </td>
                                    <td style={{ padding: '1rem' }}>{t.purpose || '-'}</td>
                                    <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{new Date(t.issuedAt).toLocaleString()}</td>
                                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                                        <button onClick={() => handleReturn(t)} className="btn" style={{ width: 'auto', padding: '0.4rem 1rem', fontSize: '0.85rem', background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
                                            Partial/Full Return
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* CUSTOM CONFIRM POPUP */}
            {confirmPopup.show && (
                <div className="modal-overlay">
                    <div className="confirm-modal">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', color: confirmPopup.type === 'danger' ? 'var(--danger)' : 'var(--accent)' }}>
                            <AlertCircle size={32} />
                            <h3 style={{ margin: 0 }}>{confirmPopup.title}</h3>
                        </div>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>{confirmPopup.message}</p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn" style={{ background: '#f1f5f9', color: '#475569' }} onClick={() => setConfirmPopup(prev => ({ ...prev, show: false }))}>Cancel</button>
                            <button className="btn" style={{ background: confirmPopup.type === 'danger' ? 'var(--danger)' : 'var(--accent)' }} onClick={confirmPopup.onConfirm}>Confirm Activity</button>
                        </div>
                    </div>
                </div>
            )}

            {/* CUSTOM ALERT POPUP */}
            {alertPopup.show && (
                <div style={{
                    position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 3000,
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '1rem 1.5rem', background: 'white', borderRadius: '0.75rem',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                    borderLeft: `4px solid ${alertPopup.type === 'error' ? 'var(--danger)' : 'var(--success)'}`,
                    animation: 'slideUp 0.3s ease-out'
                }}>
                    {alertPopup.type === 'error' ? <AlertCircle color="var(--danger)" /> : <CheckCircle2 color="var(--success)" />}
                    <div>
                        <strong style={{ display: 'block', fontSize: '1rem' }}>{alertPopup.title}</strong>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{alertPopup.message}</span>
                    </div>
                </div>
            )}

            {/* PARTIAL RETURN MODAL */}
            {returningTransaction && (
                <div className="modal-overlay" style={{ zIndex: 3001 }}>
                    <div className="card" style={{ width: '400px', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0 }}>Process Return</h3>
                            <button onClick={() => setReturningTransaction(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X /></button>
                        </div>
                        <p style={{ marginBottom: '1rem' }}>
                            Item: <strong>{returningTransaction.product.name}</strong><br />
                            Total Issued: {returningTransaction.quantity}<br />
                            Already Returned: {returningTransaction.returnedQuantity || 0}
                        </p>
                        <div className="form-group">
                            <label>Return Quantity</label>
                            <input
                                type="number"
                                className="form-input"
                                value={returnQty}
                                onFocus={e => e.target.select()}
                                onChange={e => {
                                    const val = e.target.value;
                                    const maxVal = returningTransaction.quantity - (returningTransaction.returnedQuantity || 0);
                                    setReturnQty(val === '' ? '' : Math.min(parseInt(val), maxVal));
                                }}
                                min="1"
                                max={returningTransaction.quantity - (returningTransaction.returnedQuantity || 0)}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                            <button className="btn" style={{ background: '#f1f5f9', color: '#475569' }} onClick={() => setReturningTransaction(null)}>Cancel</button>
                            <button className="btn" onClick={confirmReturn}>Confirm Return</button>
                        </div>
                    </div>
                </div>
            )}
            {/* NEW PRINT PREVIEW MODAL */}
            {showPrintPreview && (
                <div className="modal-overlay" style={{ zIndex: 4000 }}>
                    <div className="card" style={{ maxWidth: '850px', width: '95%', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid var(--border)', paddingBottom: '1rem' }}>
                            <h3 style={{ margin: 0 }}>Verify Issue Slip (Print Preview)</h3>
                            <button onClick={() => setShowPrintPreview(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={24} /></button>
                        </div>

                        {/* THE ACTUAL RECEIPT VISUAL */}
                        <div id="receipt-visual-container" style={{
                            background: 'white',
                            padding: '30px',
                            color: 'black',
                            border: '1px solid #ccc',
                            fontFamily: 'serif',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                        }}>
                            <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #333', paddingBottom: '10px' }}>
                                <h1 style={{ margin: 0, textTransform: 'uppercase', fontSize: '24px' }}>Greyhounds Telangana</h1>
                                <p style={{ margin: '5px 0', fontSize: '18px' }}>Workshop Inventory Management System</p>
                                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>ISSUE REGISTER SLIP</h2>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px', fontSize: '16px' }}>
                                <div>
                                    <p><strong>Officer ID:</strong> {officerData.badgeNumber}</p>
                                    <p><strong>Name:</strong> {officerData.name || 'N/A'}</p>
                                    <p><strong>Unit:</strong> {officerData.department || 'N/A'}</p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
                                    <p><strong>Time:</strong> {new Date().toLocaleTimeString()}</p>
                                    <p><strong>Purpose:</strong> {purpose || 'General Duty'}</p>
                                </div>
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '40px', fontSize: '16px' }}>
                                <thead>
                                    <tr style={{ background: '#f1f1f1' }}>
                                        <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'left' }}>Item Description</th>
                                        <th style={{ border: '1px solid #333', padding: '10px', textAlign: 'center', width: '100px' }}>Qty</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {issuedSummary.map((item, i) => (
                                        <tr key={i}>
                                            <td style={{ border: '1px solid #333', padding: '10px' }}>{item.name}</td>
                                            <td style={{ border: '1px solid #333', padding: '10px', textAlign: 'center' }}>{item.quantity}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginTop: '60px', textAlign: 'center' }}>
                                <div>
                                    <div style={{ width: '150px', borderTop: '1px solid #333', margin: 'auto' }}>Signature of Officer</div>
                                </div>
                                <div>
                                    <div style={{ width: '150px', borderTop: '1px solid #333', margin: 'auto' }}>Issuing Authority</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                            <button className="btn" style={{ flex: 1, background: '#f1f5f9', color: '#475569' }} onClick={closeAfterPrint}>Done / Close</button>
                            <button className="btn" style={{ flex: 1, background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={handlePrint}>
                                <Printer size={20} /> Everything OK, Print Slip
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TransactionView;
