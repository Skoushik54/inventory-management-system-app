import React, { useRef, useState, useEffect } from 'react';
import { Camera, X, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';

const CameraCaptureModal = ({ isOpen, onClose, onCapture, title = "Capture Photo" }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [stream, setStream] = useState(null);
    const [capturedImage, setCapturedImage] = useState(null);
    const [error, setError] = useState(null);
    const [devices, setDevices] = useState([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState('');
    const [isMirrored, setIsMirrored] = useState(true);
    const [isStarting, setIsStarting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            enumerateDevices().then(initId => {
                startCamera(initId || selectedDeviceId);
            });
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [isOpen]);

    const enumerateDevices = async () => {
        try {
            const allDevices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = allDevices.filter(device => device.kind === 'videoinput');
            setDevices(videoDevices);
            if (videoDevices.length > 0 && !selectedDeviceId) {
                const firstId = videoDevices[0].deviceId;
                setSelectedDeviceId(firstId);
                return firstId;
            }
            return selectedDeviceId;
        } catch (err) {
            console.error("Error enumerating devices:", err);
            return null;
        }
    };

    const startCamera = async (deviceId) => {
        if (isStarting) return;
        setIsStarting(true);
        setError(null);
        setCapturedImage(null);
        
        try {
            // First stop any existing stream
            if (stream) {
                if (videoRef.current) videoRef.current.srcObject = null;
                stream.getTracks().forEach(track => track.stop());
                setStream(null);
                // Tiny delay to let the camera hardware release
                await new Promise(r => setTimeout(r, 200));
            }

            const constraints = {
                video: deviceId ? { deviceId: { exact: deviceId } } : true
            };
            
            const newStream = await navigator.mediaDevices.getUserMedia(constraints);
            
            if (videoRef.current) {
                videoRef.current.srcObject = newStream;
            }
            setStream(newStream);
        } catch (err) {
            console.error("Camera error:", err);
            if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                setError("Camera is in use by another app (like OBS or Zoom). Close it and try again.");
            } else {
                setError("Could not access camera. Please ensure permissions are granted.");
            }
        } finally {
            setIsStarting(false);
        }
    };

    const stopCamera = () => {
        if (videoRef.current) videoRef.current.srcObject = null;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
    };

    const capturePhoto = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            
            if (isMirrored) {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
            }
            
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            setCapturedImage(dataUrl);
        }
    };

    const handleConfirm = () => {
        if (capturedImage) {
            // Convert dataURL to Blob/File
            fetch(capturedImage)
                .then(res => res.blob())
                .then(blob => {
                    const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
                    onCapture(file);
                    onClose();
                });
        }
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, backdropFilter: 'blur(10px)',
            animation: 'fadeIn 0.2s ease-out'
        }}>
            <div style={{
                background: 'white', borderRadius: '1.5rem',
                width: '95%', maxWidth: '700px', overflow: 'hidden',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                {/* Header */}
                <div style={{ 
                    padding: '1.5rem', 
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'linear-gradient(to right, #f8fafc, white)'
                }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#1e293b' }}>
                        <Camera color="var(--accent)" size={24} /> {title}
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '1.5rem', background: '#0f172a', position: 'relative', minHeight: '400px' }}>
                    {!capturedImage ? (
                        <>
                            <video 
                                ref={(el) => {
                                    videoRef.current = el;
                                    if (el && stream && !capturedImage) {
                                        el.srcObject = stream;
                                    }
                                }} 
                                autoPlay 
                                playsInline 
                                style={{ 
                                    width: '100%', borderRadius: '1rem', 
                                    backgroundColor: '#000', 
                                    transform: isMirrored ? 'scaleX(-1)' : 'none',
                                    transition: 'transform 0.3s ease'
                                }}
                            />
                            {error && (
                                <div style={{ 
                                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                    color: 'white', textAlign: 'center', padding: '1.5rem', background: 'rgba(239, 68, 68, 0.9)',
                                    borderRadius: '1rem', width: '80%'
                                }}>
                                    <AlertCircle style={{ marginBottom: '1rem' }} size={40} />
                                    <p>{error}</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{ position: 'relative' }}>
                            <img 
                                src={capturedImage} 
                                style={{ 
                                    width: '100%', borderRadius: '1rem', 
                                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)' 
                                }} 
                                alt="Captured" 
                            />
                            <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '0.4rem 0.8rem', borderRadius: '2rem', fontSize: '0.75rem' }}>
                                Preview Result
                            </div>
                        </div>
                    )}
                    
                    {isStarting && (
                        <div style={{ 
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            background: 'rgba(15, 23, 42, 0.7)', borderRadius: '1rem', color: 'white', gap: '1rem'
                        }}>
                            <RefreshCw size={32} className="rotate" />
                            <span>Initializing Camera...</span>
                        </div>
                    )}
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                </div>

                {/* Controls */}
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {devices.length > 0 && !capturedImage && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '200px' }}>
                                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap' }}>Camera:</label>
                                <select 
                                    value={selectedDeviceId} 
                                    onChange={(e) => {
                                        setSelectedDeviceId(e.target.value);
                                        startCamera(e.target.value);
                                    }}
                                    style={{ 
                                        padding: '0.4rem 0.6rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0',
                                        fontSize: '0.85rem', width: '100%', outline: 'none', background: 'white'
                                    }}
                                >
                                    {devices.map(device => (
                                        <option key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Camera ${devices.indexOf(device) + 1}`}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <button 
                                onClick={() => setIsMirrored(!isMirrored)}
                                style={{
                                    padding: '0.4rem 0.8rem', fontSize: '0.75rem', borderRadius: '0.5rem',
                                    border: '1px solid #e2e8f0', background: isMirrored ? '#f1f5f9' : 'white',
                                    display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer',
                                    color: isMirrored ? 'var(--accent)' : '#64748b', fontWeight: 600
                                }}
                            >
                                <RefreshCw size={14} /> {isMirrored ? "Mirrored" : "Original View"}
                            </button>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        {!capturedImage ? (
                            <button 
                                onClick={capturePhoto}
                                style={{ 
                                    padding: '0.75rem 2rem', background: 'var(--accent)', color: 'white', 
                                    border: 'none', borderRadius: '3rem', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600,
                                    boxShadow: '0 4px 6px -1px var(--accent-transparent)'
                                }}
                            >
                                <Camera size={20} /> Capture Photo
                            </button>
                        ) : (
                            <>
                                <button 
                                    onClick={() => setCapturedImage(null)}
                                    style={{ 
                                        padding: '0.75rem 1.5rem', background: '#64748b', color: 'white', 
                                        border: 'none', borderRadius: '3rem', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600
                                    }}
                                >
                                    <RefreshCw size={20} /> Retake
                                </button>
                                <button 
                                    onClick={handleConfirm}
                                    style={{ 
                                        padding: '0.75rem 2rem', background: 'var(--success)', color: 'white', 
                                        border: 'none', borderRadius: '3rem', cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600
                                    }}
                                >
                                    <CheckCircle2 size={20} /> Use This Photo
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CameraCaptureModal;
