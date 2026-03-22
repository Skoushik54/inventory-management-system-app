import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { UserPlus, Edit2, Trash2, Image as ImageIcon, Camera, X as XIcon, CheckCircle2 } from 'lucide-react';
import PasswordPromptModal from '../components/PasswordPromptModal';
import CameraCaptureModal from '../components/CameraCaptureModal';
const OfficerView = () => {
    const [officers, setOfficers] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editingOfficer, setEditingOfficer] = useState(null);
    const [formData, setFormData] = useState({ name: '', badgeNumber: '', department: '', phone: '', image: null });
    const [authPrompt, setAuthPrompt] = useState({ show: false, action: null });
    const [isCameraOpen, setIsCameraOpen] = useState(false);

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
        setAuthPrompt({
            show: true,
            action: async () => {
                try {
                    await api.delete(`/officers/${id}`);
                    fetchOfficers();
                } catch (err) {
                    alert('Error deleting officer');
                }
            }
        });
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
                                <label>Full Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <input className="form-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>Badge Number / ID Reference <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <input className="form-input" value={formData.badgeNumber} onChange={e => setFormData({ ...formData, badgeNumber: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>Department / Unit <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <input className="form-input" value={formData.department} onChange={e => setFormData({ ...formData, department: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>Phone Contact <span style={{ color: 'var(--danger)' }}>*</span></label>
                                <input className="form-input" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label>ID Card / Barcode Image</label>
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <input 
                                        type="file" 
                                        id="officer-img-upload" 
                                        style={{ display: 'none' }} 
                                        onChange={e => setFormData({ ...formData, image: e.target.files[0] })} 
                                    />
                                    <button 
                                        type="button" 
                                        className="btn" 
                                        style={{ background: '#f1f5f9', color: '#475569', padding: '0.5rem 1rem', width: 'auto', fontSize: '0.85rem' }}
                                        onClick={() => document.getElementById('officer-img-upload').click()}
                                    >
                                        Upload File
                                    </button>
                                    <button 
                                        type="button" 
                                        className="btn" 
                                        style={{ background: 'var(--accent)', color: 'white', padding: '0.5rem 1rem', width: 'auto', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                                        onClick={() => setIsCameraOpen(true)}
                                    >
                                        <Camera size={16} /> Take Photo
                                    </button>
                                </div>
                                {formData.image && (
                                    <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: '#f0fdf4', borderRadius: '0.5rem', border: '1px solid #bbf7d0' }}>
                                        <CheckCircle2 size={16} color="var(--success)" />
                                        <span style={{ fontSize: '0.85rem', color: '#166534' }}>Photo Ready: {formData.image.name || "Captured Image"}</span>
                                        <button type="button" onClick={() => setFormData({ ...formData, image: null })} style={{ border: 'none', background: 'none', cursor: 'pointer', marginLeft: 'auto' }}>
                                            <XIcon size={16} />
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                <button type="button" className="btn" style={{ backgroundColor: 'var(--text-muted)' }} onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn">{editingOfficer ? 'Update Record' : 'Register Officer'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <PasswordPromptModal
                isOpen={authPrompt.show}
                onClose={() => setAuthPrompt({ show: false, action: null })}
                onConfirm={() => {
                    if (authPrompt.action) authPrompt.action();
                    setAuthPrompt({ show: false, action: null });
                }}
                title="Verify Action"
                message="Please enter the admin password to delete this officer."
            />
            <CameraCaptureModal 
                isOpen={isCameraOpen} 
                onClose={() => setIsCameraOpen(false)} 
                onCapture={(file) => setFormData({ ...formData, image: file })}
                title="Capture Officer Photo"
            />
        </div>
    );
};

export default OfficerView;
