import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { UserPlus, Edit2, Trash2, Image as ImageIcon } from 'lucide-react';

const OfficerView = () => {
    const [officers, setOfficers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingOfficer, setEditingOfficer] = useState(null);
    const [formData, setFormData] = useState({ name: '', badgeNumber: '', department: '', phone: '', image: null });

    useEffect(() => {
        fetchOfficers();
    }, []);

    const fetchOfficers = async () => {
        const response = await api.get('/officers');
        setOfficers(response.data);
    };

    const handleOpenAdd = () => {
        setEditingOfficer(null);
        setFormData({ name: '', badgeNumber: '', department: '', phone: '', image: null });
        setShowModal(true);
    };

    const handleOpenEdit = (officer) => {
        setEditingOfficer(officer);
        setFormData({
            name: officer.name,
            badgeNumber: officer.badgeNumber,
            department: officer.department,
            phone: officer.phone,
            image: null
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this officer record?')) {
            try {
                await api.delete(`/officers/${id}`);
                fetchOfficers();
            } catch (err) {
                alert('Error deleting officer');
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            let idCardUrl = editingOfficer ? editingOfficer.idCardUrl : null;
            if (formData.image) {
                const data = new FormData();
                data.append('file', formData.image);
                const uploadRes = await api.post('/files/upload', data, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                idCardUrl = uploadRes.data.url;
            }

            const payload = {
                name: formData.name,
                badgeNumber: formData.badgeNumber,
                department: formData.department,
                phone: formData.phone,
                idCardUrl: idCardUrl
            };

            if (editingOfficer) {
                await api.put(`/officers/${editingOfficer.id}`, payload);
            } else {
                await api.post('/officers', payload);
            }

            setShowModal(false);
            fetchOfficers();
        } catch (err) {
            alert('Error saving officer data');
        }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2>Officer Personnel Registry</h2>
                <button className="btn" style={{ width: 'auto' }} onClick={handleOpenAdd}>
                    <UserPlus size={20} style={{ marginRight: '0.5rem' }} /> Register Officer
                </button>
            </div>

            <div className="card">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '1rem' }}>ID Card</th>
                            <th style={{ padding: '1rem' }}>Badge #</th>
                            <th style={{ padding: '1rem' }}>Full Name</th>
                            <th style={{ padding: '1rem' }}>Department</th>
                            <th style={{ padding: '1rem' }}>Phone</th>
                            <th style={{ padding: '1rem' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {officers.map(officer => (
                            <tr key={officer.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '1rem' }}>
                                    {officer.idCardUrl ? (
                                        <a href={officer.idCardUrl} target="_blank" rel="noreferrer">
                                            <img src={officer.idCardUrl} alt="ID" style={{ width: '40px', height: '25px', objectFit: 'cover', borderRadius: '2px', border: '1px solid #ddd' }} />
                                        </a>
                                    ) : <ImageIcon size={20} color="#ccc" />}
                                </td>
                                <td style={{ padding: '1rem' }}>{officer.badgeNumber}</td>
                                <td style={{ padding: '1rem' }}>{officer.name}</td>
                                <td style={{ padding: '1rem' }}>{officer.department}</td>
                                <td style={{ padding: '1rem' }}>{officer.phone}</td>
                                <td style={{ padding: '1rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button onClick={() => handleOpenEdit(officer)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                            <Edit2 size={18} />
                                        </button>
                                        <button onClick={() => handleDelete(officer.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)' }}>
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px' }}>
                        <h3>{editingOfficer ? 'Update Officer Record' : 'Register New Officer'}</h3>
                        <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem' }}>
                            <div className="form-group">
                                <label>Full Name</label>
                                <input className="form-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>Badge Number / ID Reference</label>
                                <input className="form-input" value={formData.badgeNumber} onChange={e => setFormData({ ...formData, badgeNumber: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>Department / Unit</label>
                                <input className="form-input" value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>Phone Contact</label>
                                <input className="form-input" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>ID Card / Barcode Image</label>
                                <input type="file" className="form-input" onChange={e => setFormData({ ...formData, image: e.target.files[0] })} />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" className="btn" style={{ backgroundColor: 'var(--text-muted)' }} onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn">{editingOfficer ? 'Update Record' : 'Register Officer'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OfficerView;
