import React, { useEffect, useState, useRef } from 'react';
import api, { BASE_URL } from '../services/api';
import { Plus, Search, Edit2, Trash2, Camera, X, Maximize2, QrCode, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react';

const InventoryView = () => {
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [formData, setFormData] = useState({ name: '', barcode: '', totalQuantity: 0, image: null });
    const [previewImage, setPreviewImage] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const [confirmPopup, setConfirmPopup] = useState({ show: false, title: '', message: '', onConfirm: null, type: 'info' });
    const [alertPopup, setAlertPopup] = useState({ show: false, title: '', message: '', type: 'success' });

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const response = await api.get('/inventory/products');
            setProducts(response.data);
        } catch (err) {
            console.error('Error fetching products', err);
        }
    };

    const getFullImageUrl = (url) => {
        if (!url) return null;
        // If it's a full URL containing localhost, strip it to make it relative
        let cleanUrl = url;
        if (url.includes('localhost:8080')) {
            cleanUrl = url.split('localhost:8080')[1];
        }

        if (cleanUrl.startsWith('http')) return cleanUrl;
        return `${BASE_URL}${cleanUrl}`;
    };

    const showAlert = (title, message, type = 'success') => {
        setAlertPopup({ show: true, title, message, type });
        setTimeout(() => setAlertPopup(prev => ({ ...prev, show: false })), 3000);
    };

    const showConfirm = (title, message, onConfirm, type = 'info') => {
        setConfirmPopup({ show: true, title, message, onConfirm, type });
    };

    const handleOpenAdd = () => {
        setEditingProduct(null);
        setFormData({ name: '', barcode: '', totalQuantity: 0, image: null });
        setShowModal(true);
    };

    const handleOpenEdit = (product) => {
        setEditingProduct(product);
        setFormData({ name: product.name, barcode: product.barcode, totalQuantity: product.totalQuantity, image: null });
        setShowModal(true);
    };

    const handleDelete = (id) => {
        showConfirm(
            'Confirm Deletion',
            'Are you sure you want to PERMANENTLY delete this product? This action cannot be undone.',
            async () => {
                try {
                    await api.delete(`/inventory/products/${id}`);
                    showAlert('Deleted', 'Product removed from system');
                    fetchProducts();
                } catch (err) {
                    showAlert('Error', 'Cannot delete item currently in use', 'error');
                }
                setConfirmPopup(prev => ({ ...prev, show: false }));
            },
            'danger'
        );
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            let imageUrl = editingProduct ? editingProduct.imageUrl : null;
            if (formData.image) {
                const data = new FormData();
                data.append('file', formData.image);
                const uploadRes = await api.post('/files/upload', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                imageUrl = uploadRes.data.url;
            }

            const tQty = parseInt(formData.totalQuantity) || 0;
            const payload = {
                name: formData.name,
                barcode: formData.barcode,
                totalQuantity: tQty,
                availableQuantity: editingProduct ?
                    (editingProduct.availableQuantity + (tQty - editingProduct.totalQuantity)) :
                    tQty,
                imageUrl: imageUrl,
                status: 'ACTIVE'
            };

            if (editingProduct) {
                await api.put(`/inventory/products/${editingProduct.id}`, payload);
                showAlert('Updated', 'Inventory record saved');
            } else {
                await api.post('/inventory/products', payload);
                showAlert('Saved', 'New product registered');
            }

            setShowModal(false);
            fetchProducts();
        } catch (err) {
            showAlert('Error', 'Failed to save product details', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.barcode.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontWeight: '800', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <QrCode size={28} color="var(--accent)" /> Workshop Stock Register
                </h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn" style={{ width: 'auto', padding: '0.75rem 1.5rem', backgroundColor: '#6366f1', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => {
                        window.location.href = `${BASE_URL.endsWith('/api') ? BASE_URL.substring(0, BASE_URL.length - 4) : BASE_URL}/api/inventory/export`;
                    }}>
                        <FileSpreadsheet size={20} /> Extract as Excel
                    </button>

                    <button className="btn" style={{ width: 'auto', padding: '0.75rem 1.5rem', backgroundColor: '#8b5cf6', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={handleOpenAdd}>
                        <Plus size={20} /> Add a Product
                    </button>
                </div>
            </div>

            <div className="card" style={{ marginBottom: '2rem', borderLeft: '4px solid var(--accent)' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <Camera size={24} color="var(--accent)" />
                    <input
                        className="form-input"
                        placeholder="Scan QR Codes or manually enter Reference..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ fontSize: '1.2rem', padding: '1rem' }}
                        autoFocus
                    />
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-container">
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                        <thead style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid var(--border)' }}>
                            <tr style={{ textAlign: 'left' }}>
                                <th style={{ padding: '1.25rem' }}>Visual Ref</th>
                                <th style={{ padding: '1.25rem' }}>QR Data</th>
                                <th style={{ padding: '1.25rem' }}>Name of the Equipment</th>
                                <th style={{ padding: '1.25rem' }}>On Hand (Present Stock)</th>
                                <th style={{ padding: '1.25rem' }}>Total Stock</th>
                                <th style={{ padding: '1.25rem', textAlign: 'center' }}>Manage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.map(product => (
                                <tr key={product.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '1rem' }}>
                                        {product.imageUrl ? (
                                            <div
                                                style={{ position: 'relative', cursor: 'zoom-in', width: '60px' }}
                                                onClick={() => setPreviewImage(getFullImageUrl(product.imageUrl))}
                                            >
                                                <img src={getFullImageUrl(product.imageUrl)} style={{ width: '60px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ddd' }} alt="QR" />
                                                <Maximize2 size={12} style={{ position: 'absolute', bottom: 2, right: 2, color: 'white', background: 'rgba(0,0,0,0.5)', borderRadius: '2px' }} />
                                            </div>
                                        ) : (
                                            <div style={{ width: '60px', height: '40px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px' }}>
                                                <Camera size={18} color="#cbd5e1" />
                                            </div>
                                        )}
                                    </td>
                                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>{product.barcode}</td>
                                    <td style={{ padding: '1rem' }}>{product.name}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span className={`badge ${product.availableQuantity < 5 ? 'badge-danger' : 'badge-success'}`}>
                                            {product.availableQuantity} units
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>{product.totalQuantity} items</td>
                                    <td style={{ padding: '1rem' }}>
                                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                                            <button onClick={() => handleOpenEdit(product)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><Edit2 size={18} /></button>
                                            <button onClick={() => handleDelete(product.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)' }}><Trash2 size={18} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredProducts.length === 0 && (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                        No items found matching your search.
                    </div>
                )}
            </div>

            {/* PRODUCT MODAL */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                            <h3>{editingProduct ? 'Modify Record' : 'Scan New Product'}</h3>
                            <button onClick={() => setShowModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Name of the Equipment</label>
                                <input className="form-input" placeholder="Type or scan item name..." value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>QR Data (Generated from Upload or Scan)</label>
                                <input className="form-input" placeholder="Scan QR or type reference..." value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} required />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div className="form-group">
                                    <label>Total Stock</label>
                                    <input type="number" className="form-input" value={formData.totalQuantity} onFocus={e => e.target.select()} onChange={e => setFormData({ ...formData, totalQuantity: e.target.value === '' ? '' : parseInt(e.target.value) })} required />
                                </div>
                                <div className="form-group">
                                    <label>Visual Scan / Photo</label>
                                    <input type="file" className="form-input" onChange={e => setFormData({ ...formData, image: e.target.files[0] })} />
                                </div>
                            </div>
                            <button type="submit" className="btn" style={{ marginTop: '1.5rem' }} disabled={isSaving}>{isSaving ? 'Communicating with Server...' : 'Confirm Stock'}</button>
                        </form>
                    </div>
                </div>
            )}

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

            {/* PREVIEW MODAL */}
            {previewImage && (
                <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)' }} onClick={() => setPreviewImage(null)}>
                    <div style={{
                        background: 'white',
                        padding: '1rem',
                        borderRadius: '1.5rem',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        maxWidth: '90%',
                        maxHeight: '90%'
                    }} onClick={e => e.stopPropagation()}>
                        <img
                            src={previewImage}
                            style={{
                                display: 'block',
                                maxWidth: '100%',
                                maxHeight: '80vh',
                                borderRadius: '0.5rem',
                                objectFit: 'contain'
                            }}
                            alt="Full Size"
                        />
                        <button
                            onClick={() => setPreviewImage(null)}
                            style={{
                                position: 'absolute',
                                top: '-1rem',
                                right: '-1rem',
                                background: 'var(--danger)',
                                color: 'white',
                                border: 'none',
                                width: '36px',
                                height: '36px',
                                borderRadius: '50%',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                            }}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventoryView;
