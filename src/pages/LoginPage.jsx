import React, { useState } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Lock, User } from 'lucide-react';

const LoginPage = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('/auth/login', { username, password });
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('username', response.data.username);
            navigate('/dashboard');
        } catch (err) {
            setError('Invalid credentials or account locked');
        }
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2.5rem', width: '100%' }}>
                    <h1 style={{
                        fontSize: '1.5rem',
                        fontWeight: '900',
                        color: '#111827',
                        margin: 0,
                        whiteSpace: 'nowrap',
                        textAlign: 'center'
                    }}>
                        GREYHOUNDS TELANGANA
                    </h1>
                    <h2 style={{
                        fontSize: '1.1rem',
                        fontWeight: '700',
                        color: '#4b5563',
                        letterSpacing: '0.4em',
                        textTransform: 'uppercase',
                        margin: '0.25rem 0 0 0',
                        textAlign: 'center'
                    }}>
                        WORKSHOP
                    </h2>
                    <div style={{ height: '3px', backgroundColor: 'var(--accent)', width: '50px', margin: '1.5rem 0' }}></div>
                    <p style={{ color: '#9ca3af', fontSize: '0.75rem', fontStyle: 'italic', margin: 0 }}>OFFICIAL INVENTORY ACCESS</p>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            className="form-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            className="form-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    {error && <p style={{ color: 'var(--danger)', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</p>}
                    <button type="submit" className="btn">Sign In</button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
