import React, { useState } from 'react';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, User, Lock } from 'lucide-react';

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

    const [showPassword, setShowPassword] = useState(false);

    return (
        <div className="login-container">
            <div className="login-card">
                {/* Header with Logos */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '3rem',
                    marginBottom: '3.5rem',
                    width: '100%',
                    flexWrap: 'nowrap',
                    padding: '0 1rem'
                }}>
                    {/* Left Shield Logo */}
                    <div style={{ flexShrink: 0 }}>
                        <img
                            src="./shield_logo.jpg"
                            alt="Greyhounds Logo"
                            style={{
                                width: '200px',
                                height: 'auto',
                                objectFit: 'contain',
                                mixBlendMode: 'multiply',
                                filter: 'contrast(1.1) brightness(1.08)'
                            }}
                        />
                    </div>

                    {/* Center Text Section */}
                    <div style={{ textAlign: 'center', flex: 1, minWidth: 'fit-content' }}>
                        <h1 style={{
                            fontSize: '2.4rem',
                            fontWeight: '950',
                            letterSpacing: '0.04em',
                            color: '#0f172a',
                            margin: 0,
                            lineHeight: 1.1,
                            textShadow: '0 1px 2px rgba(0,0,0,0.05)',
                            whiteSpace: 'nowrap'
                        }}>
                            TELANGANA GREYHOUNDS
                        </h1>
                        <div style={{ height: '5px', background: 'var(--accent)', width: '100px', margin: '1rem auto', borderRadius: '4px' }}></div>
                        <h2 style={{
                            fontSize: '1.5rem',
                            fontWeight: '900',
                            letterSpacing: '0.6em',
                            color: '#64748b',
                            margin: 0,
                            textTransform: 'uppercase',
                            whiteSpace: 'nowrap'
                        }}>
                            WORK SHOP
                        </h2>
                    </div>

                    {/* Right Police Logo */}
                    <div style={{
                        flexShrink: 0,
                        width: '220px',
                        height: '220px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'white'
                    }}>
                        <img
                            src="./circular_logo.png"
                            alt="Police Logo"
                            style={{
                                width: '110%',
                                height: '110%',
                                objectFit: 'contain',
                                mixBlendMode: 'multiply'
                            }}
                        />
                    </div>
                </div>

                {/* Login Form */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <label style={{
                            fontSize: '0.8rem',
                            fontWeight: '800',
                            color: '#475569',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase'
                        }}>
                            Username
                        </label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                                <User size={20} />
                            </div>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Enter your badge or name"
                                style={{
                                    borderRadius: '1rem',
                                    padding: '1rem 1rem 1rem 3.25rem',
                                    border: '1.5px solid #e2e8f0',
                                    fontSize: '1rem',
                                    background: '#f8fafc',
                                    transition: 'all 0.2s',
                                    boxSizing: 'border-box'
                                }}
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        <label style={{
                            fontSize: '0.8rem',
                            fontWeight: '800',
                            color: '#475569',
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase'
                        }}>
                            Password
                        </label>
                        <div style={{ position: 'relative' }}>
                            <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                                <Lock size={20} />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                className="form-input"
                                placeholder="••••••••"
                                style={{
                                    borderRadius: '1rem',
                                    padding: '1rem 1rem 1rem 3.25rem',
                                    paddingRight: '3.5rem',
                                    border: '1.5px solid #e2e8f0',
                                    fontSize: '1rem',
                                    background: '#f8fafc',
                                    transition: 'all 0.2s',
                                    boxSizing: 'border-box'
                                }}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{
                                    position: 'absolute',
                                    right: '12px',
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#94a3b8',
                                    padding: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    borderRadius: '50%'
                                }}
                                onMouseEnter={(e) => e.target.style.color = 'var(--accent)'}
                                onMouseLeave={(e) => e.target.style.color = '#94a3b8'}
                            >
                                {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div style={{
                            padding: '1rem',
                            background: '#fff1f2',
                            border: '1px solid #ffe4e6',
                            borderRadius: '1rem',
                            color: '#e11d48',
                            fontSize: '0.9rem',
                            textAlign: 'center',
                            fontWeight: '600',
                            animation: 'shake 0.4s ease-in-out'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="btn"
                        style={{
                            marginTop: '0.75rem',
                            padding: '1.1rem',
                            borderRadius: '1.25rem',
                            fontSize: '1.1rem',
                            fontWeight: '800',
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            background: 'linear-gradient(135deg, var(--accent) 0%, #1d4ed8 100%)',
                            boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer'
                        }}
                    >
                        Secure Login
                    </button>
                </form>

                <div style={{ marginTop: '3.5rem', textAlign: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '1.5rem' }}>
                    <p style={{
                        margin: 0,
                        fontSize: '0.75rem',
                        color: '#94a3b8',
                        fontWeight: '700',
                        letterSpacing: '0.15em',
                        textTransform: 'uppercase'
                    }}>
                        Authorized Personnel Only
                    </p>
                </div>
            </div>

            {/* Background decorative elements */}
            <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: '40%', height: '40%', background: 'radial-gradient(circle, rgba(37, 99, 235, 0.03) 0%, transparent 70%)', zIndex: 1 }}></div>
            <div style={{ position: 'absolute', bottom: '-10%', left: '-5%', width: '40%', height: '40%', background: 'radial-gradient(circle, rgba(37, 99, 235, 0.03) 0%, transparent 70%)', zIndex: 1 }}></div>
        </div>
    );
};

export default LoginPage;
