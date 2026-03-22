import React, { useState } from 'react';
import api from '../services/api';
import { Shield, Key, User, CheckCircle2, AlertCircle, Printer, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const AdminSettingsView = () => {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState(null);
    const [quickQrValue, setQuickQrValue] = useState('');

    const showAlert = (title, message, type = 'success') => {
        setAlert({ show: true, title, message, type });
        setTimeout(() => setAlert(null), 3000);
    };

    const handlePrintQuickQr = () => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Custom QR Code</title>
                    <style>
                        body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; }
                        .qr-label { margin-top: 20px; font-size: 24px; font-weight: bold; color: #1e3a5f; }
                        @media print { .no-print { display: none; } }
                    </style>
                </head>
                <body>
                    <div id="print-content" style="text-align: center;">
                        ${document.getElementById('quick-qr-preview').innerHTML}
                        <div class="qr-label">${quickQrValue}</div>
                    </div>
                    <script>window.onload = () => { window.print(); window.close(); };</script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleUpdate = async (e) => {
        e.preventDefault();

        if (!formData.username || !formData.password) {
            return showAlert('Required Fields', 'Please fill in all fields', 'error');
        }

        if (formData.password !== formData.confirmPassword) {
            return showAlert('Mismatch', 'Passwords do not match', 'error');
        }

        if (formData.password.length < 6) {
            return showAlert('Weak Password', 'Password must be at least 6 characters', 'error');
        }

        try {
            setLoading(true);
            await api.put('/auth/update', {
                username: formData.username,
                password: formData.password
            });

            showAlert('Success', 'Credentials updated! Redirecting to login...', 'success');

            // Wait a moment for them to see the success message, then log them out
            setTimeout(() => {
                localStorage.removeItem('token');
                window.location.href = '/login';
            }, 2000);

        } catch (err) {
            showAlert('Error', err.response?.data?.error || 'Failed to update credentials', 'error');
            setLoading(false);
        }
    };

    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out', maxWidth: '600px', margin: '0 auto', paddingTop: '2rem' }}>
            <h2 style={{ fontWeight: '800', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                <Shield size={28} color="var(--accent)" /> Admin Settings
            </h2>

            <div className="card" style={{ padding: '2.5rem', borderTop: '4px solid var(--accent)' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.95rem' }}>
                    Update the master administrator credentials for the Greyhounds Inventory System.
                    <strong> Note: Changing these will immediately log you out.</strong>
                </p>

                <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                            <User size={18} color="var(--accent)" /> New Admin Username
                        </label>
                        <input
                            type="text"
                            className="form-input"
                            autoComplete="off"
                            style={{ padding: '0.8rem', fontSize: '1rem', background: '#f8fafc' }}
                            placeholder="e.g. admin"
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                            <Key size={18} color="var(--accent)" /> New Password
                        </label>
                        <input
                            type="password"
                            className="form-input"
                            autoComplete="new-password"
                            style={{ padding: '0.8rem', fontSize: '1rem', background: '#f8fafc' }}
                            placeholder="••••••••"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                            <Key size={18} color="var(--accent)" /> Confirm New Password
                        </label>
                        <input
                            type="password"
                            className="form-input"
                            autoComplete="new-password"
                            style={{ padding: '0.8rem', fontSize: '1rem', background: '#f8fafc' }}
                            placeholder="••••••••"
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn"
                        disabled={loading}
                        style={{
                            marginTop: '1rem',
                            padding: '1rem',
                            fontSize: '1.1rem',
                            fontWeight: 'bold',
                            display: 'flex',
                            justifyContent: 'center',
                            opacity: loading ? 0.7 : 1
                        }}
                    >
                        {loading ? 'Updating Credentials...' : 'Update & Restart Session'}
                    </button>
                </form>
            </div>

            {/* Custom localized alert for Settings View */}
            {alert && (
                <div style={{
                    marginTop: '2rem',
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '1rem 1.5rem', background: 'white', borderRadius: '0.75rem',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
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
            {/* QUICK QR GENERATOR */}
            <h2 style={{ fontWeight: '800', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '4rem', marginBottom: '2rem' }}>
                <QrCode size={28} color="var(--accent)" /> Quick QR Utility
            </h2>
            <div className="card" style={{ padding: '2rem', borderTop: '4px solid var(--success)' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                    Generate custom QR codes for Officer IDs, Cabinets, or any custom label instantly.
                </p>
                <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label style={{ fontWeight: 600 }}>Enter Custom ID / Label</label>
                            <input
                                className="form-input"
                                placeholder="e.g. OFFICER-452"
                                value={quickQrValue}
                                onChange={(e) => setQuickQrValue(e.target.value)}
                                style={{ background: '#f8fafc', padding: '0.8rem' }}
                            />
                        </div>
                        {quickQrValue && (
                            <button
                                className="btn"
                                onClick={handlePrintQuickQr}
                                style={{ marginTop: '0.5rem', background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                            >
                                <Printer size={18} /> Print Custom QR Card
                            </button>
                        )}
                    </div>
                    {quickQrValue && (
                        <div id="quick-qr-preview" style={{ background: 'white', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <QRCodeSVG value={quickQrValue} size={150} level="H" includeMargin={true} />
                            <div style={{ marginTop: '0.5rem', fontWeight: 'bold', fontSize: '0.9rem', color: '#1e3a5f' }}>{quickQrValue}</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminSettingsView;
