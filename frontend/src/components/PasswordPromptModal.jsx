import React, { useState } from 'react';
import { KeyRound, X } from 'lucide-react';
import api from '../services/api';

const PasswordPromptModal = ({ isOpen, onClose, onConfirm, title, message }) => {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!password.trim()) {
            setError('Password is required');
            return;
        }

        try {
            setLoading(true);
            await api.post('/auth/verify-password', { password });
            setLoading(false);
            setPassword('');
            onConfirm();
        } catch (err) {
            setLoading(false);
            setError(err.response?.data?.error || 'Incorrect password');
        }
    };

    return (
        <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.85)', zIndex: 9999 }}>
            <div className="card" style={{ maxWidth: '400px', width: '90%', animation: 'slideUp 0.3s ease-out' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)' }}>
                        <KeyRound size={20} />
                        {title || 'Authentication Required'}
                    </h3>
                    <button onClick={() => { setPassword(''); setError(''); onClose(); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                        <X size={20} color="var(--text-muted)" />
                    </button>
                </div>

                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    {message || 'Please enter the admin password to verify this action.'}
                </p>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input
                        type="password"
                        className="form-input"
                        placeholder="Admin Password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                        autoFocus
                    />

                    {error && <div style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{error}</div>}

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="button" className="btn" style={{ flex: 1, background: '#f1f5f9', color: '#475569' }} onClick={() => { setPassword(''); setError(''); onClose(); }}>
                            Cancel
                        </button>
                        <button type="submit" className="btn" style={{ flex: 1, background: 'var(--danger)', opacity: loading ? 0.7 : 1 }} disabled={loading}>
                            {loading ? 'Verifying...' : 'Verify & Proceed'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PasswordPromptModal;
