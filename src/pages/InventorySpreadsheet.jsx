import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Save, ChevronLeft, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const InventorySpreadsheet = () => {
    const [products, setProducts] = useState([]);
    const [originalProducts, setOriginalProducts] = useState([]);
    const [searching, setSearching] = useState('');
    const [saving, setSaving] = useState(false);
    const [alert, setAlert] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const res = await api.get('/inventory/products');
            setProducts(res.data);
            setOriginalProducts(JSON.parse(JSON.stringify(res.data)));
        } catch (err) {
            console.error(err);
        }
    };

    const handleUpdate = (id, field, value) => {
        setProducts(products.map(p => {
            if (p.id === id) {
                let val = value;
                if (field === 'totalQuantity' || field === 'availableQuantity') {
                    val = parseInt(value) || 0;
                }
                return { ...p, [field]: val };
            }
            return p;
        }));
    };

    const handleSaveAll = async () => {
        setSaving(true);
        try {
            for (const p of products) {
                // Only update if changed
                const original = originalProducts.find(o => o.id === p.id);
                if (JSON.stringify(original) !== JSON.stringify(p)) {
                    await api.put(`/inventory/products/${p.id}`, p);
                }
            }
            setOriginalProducts(JSON.parse(JSON.stringify(products)));
            setAlert({ type: 'success', text: 'All changes saved successfully!' });
        } catch (err) {
            setAlert({ type: 'error', text: 'Error saving changes: ' + (err.response?.data?.message || err.message) });
        } finally {
            setSaving(false);
            setTimeout(() => setAlert(null), 3000);
        }
    };

    const filtered = products.filter(p => 
        p.name.toLowerCase().includes(searching.toLowerCase()) || 
        p.barcode.toLowerCase().includes(searching.toLowerCase())
    );

    return (
        <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.4s ease' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button onClick={() => navigate(-1)} style={{ border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--accent)', fontWeight: '600' }}>
                        <ChevronLeft /> Back to Dashboard
                    </button>
                    <h2 style={{ margin: 0, fontWeight: '800', color: 'var(--primary)' }}>GREYHOUNDS TELANGANA - LIVE INVENTORY SHEET</h2>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <input 
                            className="form-input" 
                            placeholder="Search records..." 
                            value={searching} 
                            onChange={e => setSearching(e.target.value)} 
                            style={{ width: '280px', paddingLeft: '2.5rem', borderRadius: '2rem', border: '2px solid var(--border)' }}
                        />
                        <Search size={18} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    </div>
                    <button 
                        className="btn" 
                        onClick={handleSaveAll} 
                        style={{ width: 'auto', backgroundColor: saving ? '#94a3b8' : 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 1.5rem' }}
                        disabled={saving}
                    >
                        <Save size={18} /> {saving ? 'Syncing...' : 'Save & Sync Updates'}
                    </button>
                </div>
            </div>

            <div style={{ 
                flex: 1, 
                overflow: 'auto', 
                backgroundColor: 'white', 
                border: '1px solid var(--border)', 
                borderRadius: '0.75rem', 
                boxShadow: 'var(--shadow-lg)' 
            }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#f8fafc', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', zIndex: 10 }}>
                        <tr style={{ textAlign: 'left' }}>
                            <th style={{ padding: '1rem', borderRight: '1px solid var(--border)', color: 'var(--primary)' }}>Product Description (Name)</th>
                            <th style={{ padding: '1rem', borderRight: '1px solid var(--border)', color: 'var(--primary)' }}>QR ID / Barcode</th>
                            <th style={{ padding: '1rem', borderRight: '1px solid var(--border)', color: 'var(--primary)', textAlign: 'center' }}>Total Stock</th>
                            <th style={{ padding: '1rem', borderRight: '1px solid var(--border)', color: 'var(--primary)', textAlign: 'center' }}>Available Stock</th>
                            <th style={{ padding: '1rem', color: 'var(--primary)', textAlign: 'center' }}>System Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((p, idx) => (
                            <tr key={p.id} style={{ 
                                borderBottom: '1px solid var(--border)', 
                                backgroundColor: idx % 2 === 0 ? 'white' : '#fcfdfe' 
                            }}>
                                <td style={{ padding: '0.2rem 0.5rem', borderRight: '1px solid var(--border)' }}>
                                    <input 
                                        style={{ width: '100%', border: 'none', padding: '0.6rem', outline: 'none', background: 'transparent', fontWeight: '600' }} 
                                        value={p.name} 
                                        onChange={e => handleUpdate(p.id, 'name', e.target.value)}
                                    />
                                </td>
                                <td style={{ padding: '0.2rem 0.5rem', borderRight: '1px solid var(--border)' }}>
                                    <input 
                                        style={{ width: '100%', border: 'none', padding: '0.6rem', outline: 'none', background: 'transparent', fontFamily: 'monospace' }} 
                                        value={p.barcode} 
                                        onChange={e => handleUpdate(p.id, 'barcode', e.target.value)}
                                    />
                                </td>
                                <td style={{ padding: '0.2rem 0.5rem', borderRight: '1px solid var(--border)', textAlign: 'center' }}>
                                    <input 
                                        type="number"
                                        style={{ width: '80px', border: 'none', padding: '0.6rem', outline: 'none', background: 'transparent', textAlign: 'center', color: 'var(--accent)', fontWeight: 'bold' }} 
                                        value={p.totalQuantity} 
                                        onChange={e => handleUpdate(p.id, 'totalQuantity', e.target.value)}
                                    />
                                </td>
                                <td style={{ padding: '0.2rem 0.5rem', borderRight: '1px solid var(--border)', textAlign: 'center' }}>
                                    <input 
                                        type="number"
                                        style={{ width: '80px', border: 'none', padding: '0.6rem', outline: 'none', background: 'transparent', textAlign: 'center', color: 'var(--success)', fontWeight: 'bold' }} 
                                        value={p.availableQuantity} 
                                        onChange={e => handleUpdate(p.id, 'availableQuantity', e.target.value)}
                                    />
                                </td>
                                <td style={{ padding: '0.2rem 0.5rem', textAlign: 'center' }}>
                                    <select 
                                        style={{ border: 'none', padding: '0.4rem', outline: 'none', background: 'transparent', fontWeight: '600', color: p.status === 'ACTIVE' ? 'var(--success)' : 'var(--danger)' }} 
                                        value={p.status} 
                                        onChange={e => handleUpdate(p.id, 'status', e.target.value)}
                                    >
                                        <option value="ACTIVE">ACTIVE</option>
                                        <option value="DISABLED">DISABLED</option>
                                    </select>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {alert && (
                <div style={{
                    position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 3000,
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '1rem 1.5rem', background: 'white', borderRadius: '0.75rem',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                    borderLeft: `5px solid ${alert.type === 'error' ? 'var(--danger)' : 'var(--success)'}`,
                    animation: 'slideUp 0.3s ease-out'
                }}>
                    {alert.type === 'error' ? <AlertCircle color="var(--danger)" /> : <CheckCircle2 color="var(--success)" />}
                    <div>
                        <strong style={{ display: 'block', fontSize: '1.1rem' }}>{alert.type === 'error' ? 'Sync Error' : 'Database Synced'}</strong>
                        <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{alert.text}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventorySpreadsheet;
