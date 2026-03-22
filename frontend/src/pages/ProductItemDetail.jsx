import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
    ArrowLeft,
    Trash2,
    Plus,
    Package,
    PenTool,
    QrCode,
    Printer,
    Copy,
    Check,
    FileSpreadsheet,
    FolderOpen,
    RefreshCw,
    ExternalLink,
    Clock,
    X,
    AlertCircle,
    CheckCircle2,
    Image as ImageIcon
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import PasswordPromptModal from '../components/PasswordPromptModal';

const ProductItemDetail = () => {
    const { productId } = useParams();
    const navigate = useNavigate();
    const [product, setProduct] = useState(null);
    const [loading, setLoading] = useState(true);
    const [newItemBarcode, setNewItemBarcode] = useState('');
    const [newSerialNumber, setNewSerialNumber] = useState('');
    const [unitSearch, setUnitSearch] = useState('');
    const [editingItem, setEditingItem] = useState(null);
    const [editItemData, setEditItemData] = useState({ barcode: '', serialNumber: '' });
    const [newSparePartName, setNewSparePartName] = useState('');
    const [alert, setAlert] = useState(null);
    const [confirmPopup, setConfirmPopup] = useState({ show: false, title: '', message: '', onConfirm: null, type: 'info' });
    const [qrModal, setQrModal] = useState({ show: false, items: [] });
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [focusTrigger, setFocusTrigger] = useState(0);
    const [isAddingProduct, setIsAddingProduct] = useState(false);
    const unitInputRef = useRef(null);

    // PRO FOCUS RESTORATION: Forces the window and caret to redraw properly
    const restoreInputFocus = () => {
        // Don't interrupt if we are in another valid input or if a modal is blocking us
        const active = document.activeElement;
        const isOtherInput = active && active !== unitInputRef.current && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA');
        if (isOtherInput || confirmPopup.show || qrModal.show || editingItem) return;
        
        if (window.electronAPI) window.electronAPI.forceFocus();
        
        if (unitInputRef.current) {
            unitInputRef.current.focus();
            const len = unitInputRef.current.value.length;
            unitInputRef.current.setSelectionRange(len, len);
        }
    };

    // UNIVERSAL INPUT REDIRECT: Redirects typing to the main box if focus is lost
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (confirmPopup.show || qrModal.show || editingItem || loading) return;

            const active = document.activeElement;
            const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
            
            // If user is NOT in any input and starts typing (alphanumeric), push them to the Unit ID box
            if (!isInput && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                if (unitInputRef.current) {
                    unitInputRef.current.focus();
                    // Let the character fall through into the box naturally
                }
            }
        };

        const handleWindowFocus = () => setTimeout(restoreInputFocus, 100);
        const handleGlobalClick = (e) => {
            const tag = e.target.tagName.toLowerCase();
            if (tag !== 'input' && tag !== 'select' && tag !== 'textarea' && !e.target.closest('button')) {
                restoreInputFocus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('focus', handleWindowFocus);
        document.addEventListener('mousedown', handleGlobalClick);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('focus', handleWindowFocus);
            document.removeEventListener('mousedown', handleGlobalClick);
        };
    }, [confirmPopup.show, qrModal.show, editingItem, loading]);

    useEffect(() => {
        if (focusTrigger > 0) {
            const timer = setTimeout(restoreInputFocus, 150);
            return () => clearTimeout(timer);
        }
    }, [focusTrigger]);

    useEffect(() => {
        fetchProductDetails(true);
    }, [productId]);

    const fetchProductDetails = async (isInitial = false) => {
        if (isInitial) setLoading(true);
        try {
            const response = await api.get(`/inventory/products/id/${productId}`);
            if (response.data) {
                setProduct(response.data);
            }
            setLoading(false);
        } catch (err) {
            console.error('Error fetching details:', err);
            const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message;
            showAlert('Error', `Failed to load product details: ${errorMsg}`, 'error');
            setLoading(false);
        }
    };

    const showAlert = (title, message, type = 'success') => {
        setAlert({ title, message, type });
        setTimeout(() => setAlert(null), 3000);
    };

    const showConfirm = (title, message, onConfirm, type = 'info') => {
        setConfirmPopup({ show: true, title, message, onConfirm, type });
    };

    const handleAddItem = async () => {
        if (isAddingProduct) return;

        const rawBC = (newItemBarcode || '').trim();
        const sn = (newSerialNumber || '').trim();

        if (!rawBC && !sn && !product.barcode) {
             showAlert('Error', 'Cannot generate ID: Product barcode missing', 'error');
             return;
        }

        setIsAddingProduct(true);
        // Clear immediately to prevent double-fires
        setNewItemBarcode('');
        setNewSerialNumber('');

        try {
            let finalBarcode = rawBC;
            
            if (!finalBarcode && sn) {
                finalBarcode = `${product.barcode}-${sn}`;
            } else if (!finalBarcode) {
                const count = (product.items?.length || 0) + 1;
                finalBarcode = `${product.barcode}-${String(count).padStart(3, '0')}`;
            }

            const items = [{
                barcode: finalBarcode,
                serialNumber: sn
            }];

            await api.post(`/inventory/products/${productId}/items`, items);
            fetchProductDetails();
            showAlert('Success', `Unit added successfully`);
        } catch (err) {
            console.error('Add unit error:', err);
            const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Unknown error';
            showAlert('Error', `Failed to add units: ${msg}`, 'error');
            // Restore barcode on failure so user can see it/fix it
            setNewItemBarcode(rawBC);
            setNewSerialNumber(sn);
        } finally {
            setIsAddingProduct(false);
        }
    };

    const handleDeleteItem = (itemId) => {
        showConfirm(
            'Confirm Deletion',
            'Remove this unique unit from stock records?',
            async () => {
                try {
                    await api.delete(`/inventory/items/${itemId}`);
                    setSelectedItems(prev => {
                        const next = new Set(prev);
                        next.delete(itemId);
                        return next;
                    });
                    fetchProductDetails();
                    showAlert('Deleted', 'Item removed from stock');
                } catch (err) {
                    showAlert('Error', 'Failed to delete item', 'error');
                }
                setConfirmPopup(prev => ({ ...prev, show: false }));
            },
            'danger'
        );
    };

    const handleToggleSelect = (itemId) => {
        setSelectedItems(prev => {
            const next = new Set(prev);
            if (next.has(itemId)) next.delete(itemId);
            else next.add(itemId);
            return next;
        });
    };

    const handleSelectAll = () => {
        if (selectedItems.size === product.items.length) {
            setSelectedItems(new Set());
        } else {
            setSelectedItems(new Set(product.items.map(i => i.id)));
        }
    };

    const handleDeleteBulk = () => {
        if (selectedItems.size === 0) return;
        showConfirm(
            'Delete Selected',
            `Are you sure you want to delete ${selectedItems.size} units permanently?`,
            async () => {
                try {
                    await api.post('/inventory/items/bulk-delete', { ids: Array.from(selectedItems) });
                    setSelectedItems(new Set());
                    fetchProductDetails();
                    showAlert('Deleted', `Successfully deleted ${selectedItems.size} units`);
                } catch (err) {
                    showAlert('Error', 'Failed to delete units', 'error');
                }
                setConfirmPopup(prev => ({ ...prev, show: false }));
            },
            'danger'
        );
    };

    const handleCopyToClipboard = (text) => {
        if (!text) return;
        
        const performCopy = (val) => {
            const textArea = document.createElement("textarea");
            textArea.value = val;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                showAlert('Copied', 'ID copied to clipboard');
            } catch (err) {
                console.error('Fallback copy failed', err);
            }
            document.body.removeChild(textArea);
        };

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text)
                .then(() => showAlert('Copied', 'ID copied to clipboard'))
                .catch(() => performCopy(text));
        } else {
            performCopy(text);
        }
    };

    const handleStartEditItem = (item) => {
        setEditingItem(item.id);
        setEditItemData({ barcode: item.barcode, serialNumber: item.serialNumber || '' });
    };

    const handleSaveItemEdit = async (itemId) => {
        try {
            await api.put(`/inventory/items/${itemId}`, editItemData);
            setEditingItem(null);
            fetchProductDetails();
            showAlert('Updated', 'Unit details updated successfully');
        } catch (err) {
            showAlert('Error', 'Failed to update unit', 'error');
        }
    };

    const handleAddSpare = async () => {
        if (!newSparePartName.trim()) return;
        try {
            await api.post(`/inventory/products/${productId}/spare-parts`, { name: newSparePartName.trim() });
            setNewSparePartName('');
            fetchProductDetails();
            showAlert('Success', 'Spare part added');
        } catch (err) {
            console.error('Add spare error:', err);
            const msg = err.response?.data?.error || err.response?.data?.message || err.message || 'Unknown error';
            showAlert('Error', `Failed to add spare part: ${msg}`, 'error');
        }
    };

    const handleDeleteSpare = (spareId) => {
        showConfirm(
            'Remove Spare Part',
            'Are you sure you want to remove this spare part reference?',
            async () => {
                try {
                    await api.delete(`/inventory/spare-parts/${spareId}`);
                    showAlert('Removed', 'Spare part deleted');
                } catch (err) {
                    showAlert('Error', 'Failed to remove spare part', 'error');
                }
                setConfirmPopup(prev => ({ ...prev, show: false }));
            },
            'danger'
        );
    };

    const handleImageUpdate = async (file) => {
        if (!file) return;
        const formData = new FormData();
        formData.append('image', file);
        try {
            await api.post(`/inventory/products/${productId}/image`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            fetchProductDetails();
            showAlert('Success', 'Product image updated');
        } catch (err) {
            showAlert('Error', 'Failed to upload image', 'error');
        }
    };

    const handleRemoveImage = async () => {
        showConfirm(
            'Remove Image',
            'Delete the visual reference image for this product?',
            async () => {
                try {
                    await api.delete(`/inventory/products/${productId}/image`);
                    fetchProductDetails();
                    showAlert('Removed', 'Image removed');
                } catch (err) {
                    showAlert('Error', 'Failed to remove image', 'error');
                }
                setConfirmPopup(prev => ({ ...prev, show: false }));
            },
            'danger'
        );
    };

    const handlePrintQRs = () => {
        const qrContent = document.getElementById('qr-print-area').innerHTML;
        const html = `
            <html>
                <head>
                    <title>Print QR Codes</title>
                    <style>
                        body { font-family: sans-serif; padding: 10px; }
                        .qr-grid { 
                            display: grid; 
                            grid-template-columns: repeat(4, 1fr); 
                            gap: 15px; 
                            width: 100%;
                        }
                        .qr-item { 
                            display: flex; 
                            flex-direction: column; 
                            align-items: center; 
                            text-align: center; 
                            padding: 10px; 
                            border: 1px solid #eee; 
                            border-radius: 8px;
                            page-break-inside: avoid;
                        }
                        .qr-label { margin-top: 8px; font-weight: bold; font-size: 12px; color: #1e3a5f; }
                        .qr-name { font-size: 9px; color: #64748b; margin-top: 2px; }
                        @media print {
                            body { padding: 0; }
                            .qr-grid { grid-template-columns: repeat(4, 1fr); }
                        }
                    </style>
                </head>
                <body>
                    <div class="qr-grid">
                        ${qrContent}
                    </div>
                </body>
            </html>
        `;

        if (window.electronAPI?.printDocument) {
            window.electronAPI.printDocument(html, true);
        } else {
            const printWindow = window.open('', '_blank');
            printWindow.document.write(html);
            printWindow.document.write('<script>window.onload = () => { window.print(); window.close(); };</script>');
            printWindow.document.close();
        }
    };

    if (loading && !product) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Details...</div>;
    if (!product) return null;

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <style>{`
                .qr-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                    gap: 20px;
                }
            `}</style>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <button
                    onClick={() => navigate('/dashboard/inventory')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                >
                    <ArrowLeft size={24} />
                </button>
                <div>
                    <h2 style={{ fontWeight: '800', color: 'var(--primary)', margin: 0 }}>
                        {product.name}
                    </h2>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Product QR Data: <strong style={{ color: 'var(--accent)' }}>{product.barcode}</strong>
                    </p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '2rem' }}>
                {/* ITEMS SECTION */}
                <div className="card" style={{ padding: '0' }}>
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <QrCode size={20} color="var(--accent)" /> Individual Units (QR/Serial)
                            </h3>
                            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                {selectedItems.size > 0 && (
                                    <button
                                        className="btn btn-danger"
                                        onClick={handleDeleteBulk}
                                        style={{ width: 'auto', padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                    >
                                        <Trash2 size={16} /> Delete ({selectedItems.size})
                                    </button>
                                )}
                                <input
                                    className="form-input"
                                    placeholder="🔍 Search units..."
                                    value={unitSearch}
                                    onChange={e => setUnitSearch(e.target.value)}
                                    style={{ width: '160px', height: '32px', fontSize: '0.8rem' }}
                                />
                                <button
                                    className="btn"
                                    onClick={() => setQrModal({ show: true, items: product.items })}
                                    style={{ width: 'auto', padding: '0.4rem 0.8rem', background: '#3b82f6', color: 'white', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', border: 'none' }}
                                >
                                    <Printer size={16} /> Print All
                                </button>
                                {selectedItems.size > 0 && (
                                    <button
                                        className="btn"
                                        onClick={() => {
                                            const itemsToPrint = product.items.filter(it => selectedItems.has(it.id));
                                            setQrModal({ show: true, items: itemsToPrint });
                                        }}
                                        style={{ width: 'auto', padding: '0.4rem 0.8rem', background: '#10b981', color: 'white', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', border: 'none' }}
                                    >
                                        <Printer size={16} /> Print Selected ({selectedItems.size})
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                        {/* REDESIGNED SYNC TOOLBAR */}
                        <div style={{ 
                            background: 'var(--bg-secondary)', 
                            padding: '0.75rem 1.25rem', 
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1.5rem',
                            position: 'relative',
                            overflow: 'hidden'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '8px', borderRadius: '10px' }}>
                                    <FileSpreadsheet size={20} color="#3b82f6" />
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--primary)' }}>Unit Data Sync</div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        {product.excelPath ? (
                                            <>
                                                <span style={{ display: 'inline-block', width: '6px', height: '6px', background: '#10b981', borderRadius: '50%' }}></span>
                                                Linked: <strong style={{ color: 'var(--primary)' }}>{product.excelPath.split('\\').pop()}</strong>
                                            </>
                                        ) : (
                                            <>
                                                <span style={{ display: 'inline-block', width: '6px', height: '6px', background: '#94a3b8', borderRadius: '50%' }}></span>
                                                No Excel file linked
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {product.excelPath ? (
                                    <>
                                        <button 
                                            className="btn" 
                                            style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: '600', backgroundColor: '#3b82f6', border: 'none', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)' }} 
                                            onClick={async () => {
                                                try {
                                                    await fetchProductDetails();
                                                    setFocusTrigger(prev => prev + 1);
                                                } catch (err) { showAlert('Sync Failed', (err.response?.data?.error || err.message), 'error'); }
                                            }}
                                        >
                                            <RefreshCw size={16} /> Sync Units
                                        </button>

                                        <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 0.5rem' }}></div>

                                        <button 
                                            title="Open Excel" 
                                            style={{ background: 'white', border: '1px solid #e2e8f0', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', transition: 'all 0.2s' }} 
                                            onClick={() => api.get(`/inventory/products/${productId}/open-excel`)}
                                        >
                                            <ExternalLink size={18} />
                                        </button>

                                        <button 
                                            title="Choose Path" 
                                            style={{ background: 'white', border: '1px solid #e2e8f0', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', transition: 'all 0.2s' }} 
                                            onClick={async () => {
                                                if (window.electronAPI) {
                                                    const path = await window.electronAPI.pickExcelFile();
                                                    if (path) {
                                                        await api.post(`/inventory/products/${productId}/set-excel-path`, { path });
                                                        await fetchProductDetails();
                                                        setFocusTrigger(prev => prev + 1);
                                                    }
                                                }
                                            }}
                                        >
                                            <FolderOpen size={18} />
                                        </button>

                                        <button 
                                            title="Unlink File" 
                                            style={{ background: 'white', border: '1px solid #fee2e2', cursor: 'pointer', padding: '0.5rem', borderRadius: '8px', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', transition: 'all 0.2s' }} 
                                            onClick={() => {
                                                showConfirm(
                                                    'Unlink Excel',
                                                    'Remove the Excel link for this product?',
                                                    async () => {
                                                        try {
                                                            await api.post(`/inventory/products/${productId}/set-excel-path`, { path: null });
                                                            await fetchProductDetails();
                                                            showAlert('Unlinked', 'Excel link removed');
                                                            setFocusTrigger(prev => prev + 1);
                                                        } catch(e) { showAlert('Error', 'Failed to unlink', 'error'); }
                                                        setConfirmPopup(prev => ({ ...prev, show: false }));
                                                    }
                                                );
                                            }}
                                        >
                                            <X size={18} />
                                        </button>
                                    </>
                                ) : (
                                    <button 
                                        className="btn" 
                                        style={{ padding: '0.6rem 1.5rem', fontSize: '0.85rem', fontWeight: '600', backgroundColor: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px' }} 
                                        onClick={async () => {
                                            if (window.electronAPI) {
                                                const path = await window.electronAPI.pickExcelFile();
                                                if (path) {
                                                    try {
                                                        await api.post(`/inventory/products/${productId}/set-excel-path`, { path });
                                                        fetchProductDetails();
                                                        showAlert('Linked', 'Excel file linked successfully');
                                                        window.focus();
                                                    } catch(e) { showAlert('Error', 'Failed to link file', 'error'); }
                                                }
                                            }
                                        }}
                                    >
                                        <FolderOpen size={18} /> Link Excel Sheet
                                    </button>
                                )}
                            </div>
                        </div>

                        <div style={{ padding: '1.5rem' }}>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <input
                                    ref={unitInputRef}
                                    className="form-input"
                                    placeholder="Unit ID (e.g. VEST-001)"
                                    value={newItemBarcode}
                                    onChange={e => setNewItemBarcode(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddItem()}
                                    style={{ 
                                        flex: 1, 
                                        backgroundColor: 'var(--bg-card)', 
                                        border: '2px solid var(--border)',
                                        transition: 'all 0.2s'
                                    }}
                                    autoFocus
                                />
                                <button className="btn" style={{ width: 'auto', padding: '0.5rem 1rem' }} onClick={handleAddItem} disabled={isAddingProduct}>
                                    <Plus size={18} /> {isAddingProduct ? '...' : 'Add Unit'}
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="table-container" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead style={{ background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1 }}>
                                <tr style={{ textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    <th style={{ padding: '1rem', width: '40px' }}>
                                        <input
                                            type="checkbox"
                                            checked={product.items?.length > 0 && selectedItems.size === product.items.length}
                                            onChange={handleSelectAll}
                                            style={{ cursor: 'pointer' }}
                                        />
                                    </th>
                                    <th style={{ padding: '1rem', width: '50px' }}>S.No</th>
                                    <th style={{ padding: '1rem' }}>QR ID</th>
                                    <th style={{ padding: '1rem' }}>Status</th>
                                    <th style={{ padding: '1rem', textAlign: 'center' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {product.items && product.items.length > 0 ? (
                                    product.items
                                        .filter(item =>
                                            item.barcode?.toLowerCase().includes(unitSearch.toLowerCase()) ||
                                            item.serialNumber?.toLowerCase().includes(unitSearch.toLowerCase())
                                        )
                                        .map((item, rowIdx) => (
                                            <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', background: selectedItems.has(item.id) ? '#f0f9ff' : 'transparent' }}>
                                                <td style={{ padding: '1rem' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedItems.has(item.id)}
                                                        onChange={() => handleToggleSelect(item.id)}
                                                        style={{ cursor: 'pointer' }}
                                                    />
                                                </td>
                                                <td style={{ padding: '1rem', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>
                                                    {rowIdx + 1}
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    {editingItem === item.id ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                            <input 
                                                                className="form-input"
                                                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.85rem', height: '28px', border: '2px solid var(--accent)' }}
                                                                value={editItemData.barcode}
                                                                onChange={e => setEditItemData({ ...editItemData, barcode: e.target.value })}
                                                                placeholder="QR ID"
                                                                autoFocus
                                                            />
                                                            <input 
                                                                className="form-input"
                                                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', height: '24px' }}
                                                                value={editItemData.serialNumber}
                                                                onChange={e => setEditItemData({ ...editItemData, serialNumber: e.target.value })}
                                                                placeholder="Serial No (Optional)"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div
                                                                style={{ fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                                onClick={() => handleCopyToClipboard(item.barcode)}
                                                                title="Click to copy ID"
                                                            >
                                                                {item.barcode}
                                                                <Copy size={12} color="var(--text-muted)" />
                                                            </div>
                                                            {item.serialNumber && (
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 'bold', marginTop: '0.1rem' }}>
                                                                    S/N: {item.serialNumber}
                                                                </div>
                                                            )}
                                                            <div style={{ fontSize: '0.75rem', marginTop: '0.2rem', color: 'var(--text-muted)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                                {(item.lastOfficerName && item.status !== 'AVAILABLE') && <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Clock size={12} /> {item.lastOfficerName}</span>}
                                                            </div>
                                                        </>
                                                    )}
                                                </td>
                                                <td style={{ padding: '1rem' }}>
                                                    <span className={`badge badge-${item.status === 'AVAILABLE' ? 'success' : 'warning'}`}>
                                                        {item.status === 'PARTIALLY_RETURNED' ? 'ISSUED (STUCK)' : item.status}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '1rem', textAlign: 'center' }}>
                                                    {editingItem === item.id ? (
                                                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
                                                            <button
                                                                onClick={() => handleSaveItemEdit(item.id)}
                                                                style={{ border: 'none', background: 'var(--success)', color: 'white', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                                                            >
                                                                Save
                                                            </button>
                                                            <button
                                                                onClick={() => setEditingItem(null)}
                                                                style={{ border: 'none', background: 'var(--text-muted)', color: 'white', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem' }}
                                                            >
                                                                Cancel
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                                                            <button
                                                                onClick={() => setQrModal({ show: true, items: [item] })}
                                                                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary)' }}
                                                                title="Print QR"
                                                            >
                                                                <Printer size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleStartEditItem(item)}
                                                                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--accent)' }}
                                                                title="Edit ID/Serial"
                                                            >
                                                                <PenTool size={16} />
                                                            </button>
                                                            <button
                                                                id={`delete-item-${item.id}`}
                                                                onClick={() => handleDeleteItem(item.id)}
                                                                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)' }}
                                                                title="Delete Unit"
                                                            >
                                                                <Trash2 size={16} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                ) : (
                                    <tr>
                                        <td colSpan="6" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            No individual units registered.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* SIDEBAR: Summary */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                    <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
                        <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Package size={18} color="var(--accent)" /> Stock Summary
                        </h4>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem', padding: '0.5rem 0' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Present Stock:</span>
                            <span style={{ fontWeight: 'bold', color: 'var(--success)', fontSize: '1.1rem' }}>{product.availableQuantity} Units</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderTop: '1px solid var(--border)', marginBottom: '1rem' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Total Registered:</span>
                            <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{product.totalQuantity} Units</span>
                        </div>
                    </div>

                    <div className="card" style={{ borderLeft: '4px solid #8b5cf6' }}>
                        <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <ImageIcon size={18} color="#8b5cf6" /> Visual Reference
                        </h4>
                        <div 
                            style={{ 
                                position: 'relative', 
                                width: '100%', 
                                paddingTop: '100%', 
                                background: '#f1f5f9', 
                                borderRadius: '12px', 
                                overflow: 'hidden',
                                cursor: 'pointer',
                                border: '2px dashed #cbd5e1',
                                transition: 'all 0.2s'
                            }}
                            onClick={() => document.getElementById('product-image-upload').click()}
                            onMouseOver={e => e.currentTarget.style.borderColor = '#8b5cf6'}
                            onMouseOut={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                        >
                            {product.imagePath ? (
                                <img 
                                    src={api.defaults.baseURL + '/uploads/' + product.imagePath.split('/').pop().split('\\').pop()} 
                                    alt={product.name} 
                                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            ) : (
                                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifySelf: 'center', justifyContent: 'center', color: '#64748b' }}>
                                    <Plus size={32} />
                                    <span style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Upload Reference</span>
                                </div>
                            )}
                            <input 
                                id="product-image-upload" 
                                type="file" 
                                hidden 
                                accept="image/*" 
                                onChange={e => handleImageUpdate(e.target.files[0])} 
                            />
                        </div>
                        {product.imagePath && (
                            <button 
                                className="btn" 
                                style={{ marginTop: '1rem', background: '#fee2e2', color: '#ef4444', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                                onClick={handleRemoveImage}
                            >
                                <Trash2 size={16} /> Remove Image
                            </button>
                        )}
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.75rem', fontStyle: 'italic', textAlign: 'center' }}>
                            Click the image to upload a new visual reference.
                        </p>
                    </div>
                </div>
            </div>

            {/* CONFIRMATION POPUP */}
            {confirmPopup.show && confirmPopup.type !== 'danger' && (
                <div className="modal-overlay">
                    <div className="confirm-modal">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', color: 'var(--accent)' }}>
                            <AlertCircle size={32} />
                            <h3 style={{ margin: 0 }}>{confirmPopup.title}</h3>
                        </div>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>{confirmPopup.message}</p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button className="btn" style={{ background: '#f1f5f9', color: '#475569' }} onClick={() => setConfirmPopup(prev => ({ ...prev, show: false }))}>Cancel</button>
                            <button id="confirm-action-btn" className="btn" style={{ background: 'var(--accent)' }} onClick={confirmPopup.onConfirm}>Confirm Activity</button>
                        </div>
                    </div>
                </div>
            )}

            {/* PASSWORD VERIFICATION MODAL for DANGER actions */}
            <PasswordPromptModal
                isOpen={confirmPopup.show && confirmPopup.type === 'danger'}
                onClose={() => setConfirmPopup(prev => ({ ...prev, show: false }))}
                onConfirm={confirmPopup.onConfirm}
                title={confirmPopup.title}
                message={confirmPopup.message}
            />

            {/* ALERT BOX */}
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

            {/* QR MODAL */}
            {qrModal.show && (
                <div className="modal-overlay" style={{ background: 'rgba(15,23,42,0.95)' }}>
                    <div className="card" style={{ maxWidth: '600px', width: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Printer size={20} color="var(--accent)" /> Print Unit QR Codes
                            </h3>
                            <button onClick={() => setQrModal({ show: false, items: [] })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <div id="qr-print-area" style={{ flex: 1, overflowY: 'auto', padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem' }}>
                            <div className="qr-grid">
                                {qrModal.items.map(item => (
                                    <div key={item.id} className="qr-item" style={{ background: 'white', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <QRCodeSVG
                                            value={item.barcode}
                                            size={100}
                                            level="H"
                                            includeMargin={true}
                                        />
                                        <div className="qr-label" style={{ marginTop: '8px', fontWeight: 'bold', fontSize: '12px', color: '#1e3a5f' }}>{item.barcode}</div>
                                        <div className="qr-name" style={{ fontSize: '9px', color: '#64748b', textAlign: 'center' }}>{product.name}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
                            <button className="btn" style={{ background: '#f1f5f9', color: '#475569' }} onClick={() => setQrModal({ show: false, items: [] })}>Close</button>
                            <button className="btn" style={{ background: 'var(--primary)', flex: 1 }} onClick={handlePrintQRs}>
                                Confirm & Print {qrModal.items.length} QR(s)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProductItemDetail;
