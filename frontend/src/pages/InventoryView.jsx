import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { BASE_URL } from '../services/api';
import { Plus, Search, Edit2, Trash2, Camera, X, Maximize2, QrCode, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import PasswordPromptModal from '../components/PasswordPromptModal';
import CameraCaptureModal from '../components/CameraCaptureModal';

const InventoryView = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [formData, setFormData] = useState({ name: '', barcode: '', totalQuantity: 0, image: null });
    const [previewImage, setPreviewImage] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef(null);
    const [activeProductId, setActiveProductId] = useState(null);

    const [confirmPopup, setConfirmPopup] = useState({ show: false, title: '', message: '', onConfirm: null, type: 'info' });
    const [alertPopup, setAlertPopup] = useState({ show: false, title: '', message: '', type: 'success' });
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    const filteredProducts = (Array.isArray(products) ? products : []).filter(p =>
        p && (
            (p.name && p.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase()))
        )
    );

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
                    const msg = err.response?.data?.error || 'Cannot delete item currently in use';
                    showAlert('Error', msg, 'error');
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
            let finalBarcode = formData.barcode;
            
            // Ensure uniqueness in background if user didn't see the field
            if (!editingProduct && finalBarcode) {
                finalBarcode = `${finalBarcode}-${Date.now().toString().slice(-4)}`;
            }

            const payload = {
                name: formData.name,
                barcode: finalBarcode || formData.name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '-') + '-' + Date.now().toString().slice(-4),
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
            const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to save product details';
            showAlert('Error', errorMsg, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const triggerQuickUpload = (id) => {
        setActiveProductId(id);
        fileInputRef.current.click();
    };

    const handleQuickUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !activeProductId) return;

        try {
            const data = new FormData();
            data.append('file', file);
            const uploadRes = await api.post('/files/upload', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const imageUrl = uploadRes.data.url;

            const product = products.find(p => p.id === activeProductId);
            await api.put(`/inventory/products/${activeProductId}`, {
                ...product,
                imageUrl: imageUrl
            });

            showAlert('Updated', 'Product image updated');
            fetchProducts();
        } catch (err) {
            showAlert('Error', 'Failed to update image', 'error');
        } finally {
            setActiveProductId(null);
            e.target.value = '';
        }
    };

    const handleQuickRemove = async (product) => {
        try {
            await api.put(`/inventory/products/${product.id}`, {
                ...product,
                imageUrl: null
            });
            showAlert('Removed', 'Product image removed');
            fetchProducts();
        } catch (err) {
            showAlert('Error', 'Failed to remove image', 'error');
        }
    };

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
                    <Search size={24} color="var(--accent)" />
                    <input
                        className="form-input"
                        placeholder="Search equipment names..."
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
                                <th style={{ padding: '1.25rem', width: '50px' }}>S.No</th>
                                <th style={{ padding: '1.25rem' }}>Visual Ref</th>
                                <th style={{ padding: '1.25rem' }}>Equipment Name / QR ID</th>
                                <th style={{ padding: '1.25rem' }}>On Hand (Present Stock)</th>
                                <th style={{ padding: '1.25rem' }}>Total Stock</th>
                                <th style={{ padding: '1.25rem', textAlign: 'center' }}>Manage</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.map((product, index) => (
                                <tr key={product.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '1rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                                        {index + 1}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <div 
                                            style={{ position: 'relative', width: '60px', height: '40px', cursor: 'pointer' }}
                                            onClick={() => triggerQuickUpload(product.id)}
                                        >
                                            {product.imageUrl ? (
                                                <>
                                                    <img src={getFullImageUrl(product.imageUrl)} style={{ width: '60px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #ddd' }} alt="QR" />
                                                    <div 
                                                        onClick={(e) => { e.stopPropagation(); setPreviewImage(getFullImageUrl(product.imageUrl)); }}
                                                        style={{ position: 'absolute', bottom: 2, right: 2, color: 'white', background: 'rgba(0,0,0,0.5)', borderRadius: '2px', padding: '1px' }}
                                                    >
                                                        <Maximize2 size={10} />
                                                    </div>
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleQuickRemove(product); }}
                                                        style={{ position: 'absolute', top: -5, right: -5, background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}
                                                    >
                                                        <X size={10} />
                                                    </button>
                                                </>
                                            ) : (
                                                <div style={{ width: '60px', height: '40px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', border: '1px dashed #cbd5e1' }}>
                                                    <Camera size={18} color="#cbd5e1" />
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <button
                                            onClick={() => navigate(`/dashboard/inventory/${product.id}`)}
                                            style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer', textAlign: 'left', fontWeight: 'bold' }}
                                        >
                                            {product.name}
                                            <div style={{ fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--accent)' }}>
                                                QR ID: {product.barcode}
                                            </div>
                                        </button>
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <button
                                            onClick={() => navigate(`/dashboard/inventory/${product.id}`)}
                                            className={`badge ${product.availableQuantity < product.totalQuantity ? 'badge-danger' : 'badge-success'}`}
                                            style={{ border: 'none', cursor: 'pointer' }}
                                        >
                                            {product.availableQuantity} units
                                        </button>
                                    </td>
                                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>
                                        <button
                                            onClick={() => navigate(`/dashboard/inventory/${product.id}`)}
                                            style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', font: 'inherit', cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            {product.totalQuantity} items
                                        </button>
                                    </td>
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
                            <h3>{editingProduct ? 'Modify Record' : 'Add New Equipment Type'}</h3>
                            <button onClick={() => setShowModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Name of the Equipment <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <input 
                                    className="form-input" 
                                    placeholder="Type item name..." 
                                    value={formData.name} 
                                    onChange={e => {
                                        const newName = e.target.value;
                                        setFormData(prev => ({
                                            ...prev,
                                            name: newName,
                                            barcode: (!editingProduct && !prev.barcode) ? newName.trim().toUpperCase().replace(/[^A-Z0-9/]/g, '-') : prev.barcode
                                        }));
                                    }} 
                                    required 
                                />
                            </div>
                            <div className="form-group">
                                <label>Total In-Stock Quantity <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <input
                                    type="number"
                                    className="form-input"
                                    placeholder="Number of units to generate..."
                                    value={formData.totalQuantity}
                                    onFocus={e => e.target.select()}
                                    onChange={e => setFormData({ ...formData, totalQuantity: e.target.value === '' ? '' : parseInt(e.target.value) || 0 })}
                                    required
                                />
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Changing this will auto-generate new unique unit records.</p>
                            </div>
                            <div className="form-group">
                                <label>Visual Scan / Photo</label>
                                <div 
                                    style={{ 
                                        width: '100%', 
                                        height: '180px', 
                                        border: '2px dashed #cbd5e1', 
                                        borderRadius: '0.75rem', 
                                        display: 'flex', 
                                        flexDirection: 'column',
                                        alignItems: 'center', 
                                        justifyContent: 'center', 
                                        cursor: 'pointer',
                                        overflow: 'hidden',
                                        position: 'relative',
                                        background: '#f8fafc',
                                        transition: 'all 0.2s'
                                    }}
                                    onClick={() => document.getElementById('product-image-upload').click()}
                                    onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                                    onMouseOut={e => e.currentTarget.style.borderColor = '#cbd5e1'}
                                >
                                    {(formData.image || (editingProduct && editingProduct.imageUrl)) ? (
                                        <>
                                            <img 
                                                src={formData.image ? URL.createObjectURL(formData.image) : getFullImageUrl(editingProduct.imageUrl)} 
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                                alt="Preview" 
                                            />
                                            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'white', padding: '0.5rem', fontSize: '0.75rem', textAlign: 'center' }}>
                                                Click to Change Image
                                            </div>
                                            <button 
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (editingProduct) {
                                                        const updatedProduct = { ...editingProduct, imageUrl: null };
                                                        setEditingProduct(updatedProduct);
                                                    }
                                                    setFormData({ ...formData, image: null });
                                                }}
                                                style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                <X size={14} />
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <Camera size={40} color="#94a3b8" />
                                            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>Click to Upload Product Photo</p>
                                        </>
                                    )}
                                    <input 
                                        id="product-image-upload"
                                        type="file" 
                                        style={{ display: 'none' }}
                                        accept="image/*"
                                        onChange={e => setFormData({ ...formData, image: e.target.files[0] })} 
                                    />
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'center' }}>
                                        <button 
                                            type="button" 
                                            className="btn" 
                                            onClick={() => document.getElementById('product-image-upload').click()}
                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', width: 'auto', background: '#f1f5f9', color: '#475569' }}
                                        >
                                            Upload File
                                        </button>
                                        <button 
                                            type="button" 
                                            className="btn" 
                                            onClick={() => setIsCameraOpen(true)}
                                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', width: 'auto', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        >
                                            <Camera size={14} /> Open Camera
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <button type="submit" className="btn" style={{ marginTop: '1.5rem' }} disabled={isSaving}>{isSaving ? 'Communicating with Server...' : 'Confirm Registration'}</button>
                        </form>
                    </div>
                </div>
            )}

            {/* CUSTOM CONFIRM POPUP */}
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
                            <button className="btn" style={{ background: 'var(--accent)' }} onClick={confirmPopup.onConfirm}>Confirm Activity</button>
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

            <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept="image/*" 
                onChange={handleQuickUpload} 
            />
            {/* CAMERA MODAL */}
            <CameraCaptureModal 
                isOpen={isCameraOpen} 
                onClose={() => setIsCameraOpen(false)} 
                onCapture={(file) => setFormData({ ...formData, image: file })}
                title="Capture Product Photo"
            />
        </div>
    );
};

export default InventoryView;
