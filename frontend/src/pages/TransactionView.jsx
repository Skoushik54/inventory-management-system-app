import React, { useState, useEffect, useRef, useMemo } from 'react';
 import api from '../services/api';
 import PasswordPromptModal from '../components/PasswordPromptModal';
 import CameraCaptureModal from '../components/CameraCaptureModal';
import {
    QrCode,
    Trash2,
    Printer,
    CheckCircle2,
    AlertCircle,
    User,
    Package,
    ClipboardList,
    PenTool,
    Save,
    Eraser,
    Wrench,
    Plus,
    RefreshCw,
    X,
    Download,
    RotateCcw,
    Eye,
    Search,
    Camera
} from 'lucide-react';
import html2pdf from 'html2pdf.js';

const TransactionView = () => {
    const [pending, setPending] = useState([]);
    const [history, setHistory] = useState([]);
    const [officerData, setOfficerData] = useState(() => {
        const saved = localStorage.getItem('trans_officer');
        return saved ? JSON.parse(saved) : { badgeNumber: '', name: '', unit: '', phone: '', others: '' };
    });
    const [issuerName, setIssuerName] = useState(() => localStorage.getItem('trans_issuer') || '');
    const [purpose, setPurpose] = useState(() => localStorage.getItem('trans_purpose') || '');
    const [newSpareInputs, setNewSpareInputs] = useState({});
    const [cart, setCart] = useState(() => {
        const savedCart = localStorage.getItem('trans_cart');
        return savedCart ? JSON.parse(savedCart) : [];
    });
    const [scanValue, setScanValue] = useState('');
    const [returnScanValue, setReturnScanValue] = useState('');
    const [returnCart, setReturnCart] = useState([]); // items scanned for return
    const scanInputRef = useRef(null);
    const returnScanInputRef = useRef(null);

    // Signature
    const signatureCanvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasSigned, setHasSigned] = useState(false);
    const [signatureDataUrl, setSignatureDataUrl] = useState(null);
    const [issuerSignatureDataUrl, setIssuerSignatureDataUrl] = useState(null);
    const [signatureStep, setSignatureStep] = useState('officer'); // 'officer' or 'issuer'
    const lastPos = useRef(null);

    // Modals
    const [confirmPopup, setConfirmPopup] = useState({ show: false, title: '', message: '', onConfirm: null });
    const [alertPopup, setAlertPopup] = useState({ show: false, title: '', message: '', type: 'success' });
    const [authPrompt, setAuthPrompt] = useState({ show: false, action: null });
    const [showSignModal, setShowSignModal] = useState(false);
    const [showPrintPreview, setShowPrintPreview] = useState(false);
    const [issuedSummary, setIssuedSummary] = useState([]);
    const [receiptSpareParts, setReceiptSpareParts] = useState('');
    const [receiptOfficer, setReceiptOfficer] = useState({ badgeNumber: '', name: '', unit: '' });
    const [receiptIssuer, setReceiptIssuer] = useState('');
    const [receiptPurpose, setReceiptPurpose] = useState('');
    const [receiptPersonPhotoUrl, setReceiptPersonPhotoUrl] = useState(null);

    // Return Window
    const [showReturnModal, setShowReturnModal] = useState(false);
    const [showReturnReceipt, setShowReturnReceipt] = useState(false);
    const [returnReceiptData, setReturnReceiptData] = useState(null);
    const [selectedBatch, setSelectedBatch] = useState(null);
    const [checkedItems, setCheckedItems] = useState({});
    const [spareReturnQtys, setSpareReturnQtys] = useState({}); // { txId: { spareName: returnedQty } }
    const [itemDamageState, setItemDamageState] = useState({}); // { txId: { isDamaged: bool, photoUrl: string } }
    const [isUploading, setIsUploading] = useState(false);
    const [signatureType, setSignatureType] = useState('issue'); // 'issue' or 'return'
    const [returnIssuerName, setReturnIssuerName] = useState('');
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [detailBatch, setDetailBatch] = useState(null);
    const [capturingForItemId, setCapturingForItemId] = useState(null);
    const [personPhoto, setPersonPhoto] = useState(null);
    const [returnPersonPhoto, setReturnPersonPhoto] = useState(null);
    const [isPersonCameraOpen, setIsPersonCameraOpen] = useState(false);
    const [isReturnPersonCameraOpen, setIsReturnPersonCameraOpen] = useState(false);

    const handleUploadDamagePhoto = async (itemId, file) => {
        if (!file) return;
        const formData = new FormData();
        formData.append('file', file);
        setIsUploading(true);
        try {
            const res = await api.post('/files/upload?type=damaged', formData);
            setItemDamageState({ ...itemDamageState, [itemId]: { ...(itemDamageState[itemId] || {}), photoUrl: res.data.url } });
            showAlert('Photo Uploaded', 'Damage evidence saved');
        } catch (err) {
            showAlert('Upload Failed', 'Could not save image', 'error');
        } finally {
            setIsUploading(false);
        }
    };

    useEffect(() => {
        fetchPending();
        fetchHistory();
        if (scanInputRef.current) scanInputRef.current.focus();
    }, []);


    // PRO FOCUS RESTORATION
    const restoreScannerFocus = () => {
        const modalOpen = showSignModal || showPrintPreview || showReturnModal || showReturnReceipt || confirmPopup.show || showDetailModal;
        if (modalOpen) return;
        
        if (window.electronAPI) window.electronAPI.forceFocus();
        
        if (scanInputRef.current) {
            scanInputRef.current.focus();
            const len = scanInputRef.current.value.length;
            scanInputRef.current.setSelectionRange(len, len);
        }
    };

    // UNIVERSAL INPUT REDIRECT
    useEffect(() => {
        const handleKeyDown = (e) => {
            const modalOpen = showSignModal || showPrintPreview || showReturnModal || showReturnReceipt || confirmPopup.show || showDetailModal;
            if (modalOpen) return;

            const active = document.activeElement;
            const isInput = active && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA' || active.isContentEditable);
            
            if (!isInput && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
                if (scanInputRef.current) scanInputRef.current.focus();
            }
        };

        const handleWindowFocus = () => setTimeout(restoreScannerFocus, 100);
        const handleGlobalClick = (e) => {
            const tag = e.target.tagName.toLowerCase();
            if (tag !== 'input' && tag !== 'select' && tag !== 'textarea' && !e.target.closest('button')) {
                restoreScannerFocus();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('focus', handleWindowFocus);
        document.addEventListener('mousedown', handleGlobalClick);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('focus', handleWindowFocus);
            document.removeEventListener('mousedown', handleGlobalClick);
        };
    }, [showSignModal, showPrintPreview, showReturnModal, showReturnReceipt, confirmPopup.show, showDetailModal]);

    // Refocus when modals close
    useEffect(() => {
        const modalOpen = showSignModal || showPrintPreview || showReturnModal || showReturnReceipt || confirmPopup.show || showDetailModal;
        if (!modalOpen) {
            setTimeout(restoreScannerFocus, 300);
        }
    }, [showSignModal, showPrintPreview, showReturnModal, showReturnReceipt, confirmPopup.show, showDetailModal]);



    useEffect(() => {
        const timer = setTimeout(() => {
            localStorage.setItem('trans_officer', JSON.stringify(officerData));
            localStorage.setItem('trans_issuer', issuerName);
            localStorage.setItem('trans_purpose', purpose);
            localStorage.setItem('trans_cart', JSON.stringify(cart));
        }, 500);
        return () => clearTimeout(timer);
    }, [officerData, issuerName, purpose, cart]);

    // â”€â”€ Signature Canvas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const initCanvas = () => {
        const canvas = signatureCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1e3a5f';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    };

    useEffect(() => {
        if (!showSignModal && !showPrintPreview && !showReturnModal && !showDetailModal) {
            // When modals close, force window focus once to fix Electron caret bug
            window.focus();
            if (scanInputRef.current) scanInputRef.current.focus();
        }
    }, [showSignModal, showPrintPreview, showReturnModal, showDetailModal]);

    const getPos = (e, canvas) => {
        const rect = canvas.getBoundingClientRect();
        if (e.touches) {
            return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
        }
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const startDraw = (e) => {
        e.preventDefault();
        const canvas = signatureCanvasRef.current;
        setIsDrawing(true);
        lastPos.current = getPos(e, canvas);
    };

    const draw = (e) => {
        e.preventDefault();
        if (!isDrawing) return;
        const canvas = signatureCanvasRef.current;
        const ctx = canvas.getContext('2d');
        const pos = getPos(e, canvas);
        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastPos.current = pos;
        setHasSigned(true);
    };

    const endDraw = () => setIsDrawing(false);

    const clearSignature = () => {
        initCanvas();
        setHasSigned(false);
        setSignatureDataUrl(null);
    };

    // â”€â”€ Auto-save receipt to GreyhoundsInventory/receipts/ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const autoSaveReceipt = async (type, officerSigUrl, issuerSigUrl) => {
        try {
            const date = new Date();
            const dd = String(date.getDate()).padStart(2, '0');
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const yyyy = date.getFullYear();
            const hh = String(date.getHours()).padStart(2, '0');
            const min = String(date.getMinutes()).padStart(2, '0');
            const typeLabel = type === 'return' ? 'Return_Receipt' : 'Issue_Slip';
            const officerLabel = type === 'return'
                ? (returnReceiptData?.officer?.badgeNumber || 'unknown')
                : (receiptOfficer?.badgeNumber || officerData?.badgeNumber || 'unknown');
            const filename = `${dd}-${mm}-${yyyy}_${hh}-${min}_${officerLabel}.pdf`;

            // Build the full standalone HTML for the receipt
            const receiptEl = document.getElementById(type === 'return' ? 'return-receipt-area' : 'receipt-print-area');
            const bodyHtml = receiptEl ? receiptEl.innerHTML : '<p>Receipt unavailable</p>';

            const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${typeLabel}</title>
  <style>
    /* Page settings â€” top margin leaves room for the repeating header on every page */
    @page {
      size: A4 portrait;
      margin: 40px;
    }

    body { font-family: serif; color: black; background: white; margin: 0; padding: 0 10px; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th, td { border: 1px solid black; padding: 8px; }
    th { background: #eee; }
    thead { display: table-header-group; }  /* repeat table header on each page */
    tfoot { display: table-footer-group; }
    h1, h2, p { margin: 0 0 6px 0; }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;

            if (window.electronAPI?.saveReceiptPdf) {
                // Background save without alerts (quieter performance)
                window.electronAPI.saveReceiptPdf(html, filename, type);
            }
        } catch (err) {
            console.warn('Auto-save receipt failed:', err);
        }
    };

    const confirmSignature = () => {
        if (!hasSigned) { showAlert('No Signature', 'Please sign before proceeding', 'error'); return; }
        const canvas = signatureCanvasRef.current;
        const dataUrl = canvas.toDataURL('image/png');

        if (signatureStep === 'officer') {
            setSignatureDataUrl(dataUrl);
            setSignatureStep('issuer');
            setHasSigned(false);
            initCanvas();
        } else {
            const issuerSig = dataUrl;
            setIssuerSignatureDataUrl(issuerSig);
            setSignatureStep('officer'); // reset for next time
            setShowSignModal(false);
            if (signatureType === 'return') {
                setShowReturnReceipt(true);
                // Auto-save return receipt after slight delay so DOM is rendered
                setTimeout(() => autoSaveReceipt('return', signatureDataUrl, issuerSig), 600);
            } else {
                setShowPrintPreview(true);
                // Auto-save issue slip after slight delay so DOM is rendered
                setTimeout(() => autoSaveReceipt('issue', signatureDataUrl, issuerSig), 600);
            }
        }
    };

    // â”€â”€ API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const fetchPending = async () => {
        try { setPending((await api.get('/transactions/pending')).data); }
        catch (err) { console.error(err); }
    };

    const fetchHistory = async () => {
        try { setHistory((await api.get('/transactions/all')).data); }
        catch (err) { console.error(err); }
    };

    const showAlert = (title, message, type = 'success') => {
        setAlertPopup({ show: true, title, message, type });
        setTimeout(() => setAlertPopup(prev => ({ ...prev, show: false })), 3000);
    };

    const memoizedActiveTransactions = useMemo(() => {
        // 1. Group ALL history records by batchId
        const grouped = (Array.isArray(history) ? history : []).reduce((acc, tx) => {
            if (!tx) return acc;
            const bid = tx.batchId || `single-${tx.id}`;
            if (!acc[bid]) acc[bid] = { ...tx, items: [] };
            acc[bid].items.push(tx);
            return acc;
        }, {});

        // 2. Determine visibility and Batch-level status
        return Object.values(grouped)
            .map(batch => {
                const pendingItems = batch.items.filter(it => it.status !== 'RETURNED');
                const allReturned = pendingItems.length === 0;
                const hasPartial = batch.items.some(it => it.missingSpares && it.missingSpares.toLowerCase() !== 'none');
                const anyReturned = batch.items.some(it => it.status === 'RETURNED');

                let batchStatusLabel = 'ISSUED';
                if (allReturned) batchStatusLabel = 'RETURNED';
                // No more 'PARTIAL' label, we track spares debt separately

                return { ...batch, pendingItems, allReturned, batchStatusLabel };
            })
            .sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt));
    }, [history]);

    const processSmartScan = async (val) => {
        if (!val) return;
        setScanValue(''); // Clear input immediately to prevent double-scan

        try {
            const response = await api.get(`/inventory/items/${encodeURIComponent(val)}`);
            const item = response.data;

            if (item.status === 'AVAILABLE') {
                if (returnCart.length > 0) {
                    showAlert('Clear Return Cart First', 'You have items queued for return. Clear return cart before issuing new items.', 'warning');
                } else {
                    setCart(prev => {
                        if (prev.find(it => it.barcode === val)) {
                            showAlert('Already in Cart', 'This item is already added', 'warning');
                            return prev;
                        }
                        showAlert('Added to Issue', `${item.product?.name || 'Item'} added to cart`);
                        return [...prev, { ...item, spareParts: [] }];
                    });
                }
            } else if (item.status === 'ISSUED' || item.status === 'PARTIALLY_RETURNED') {
                if (cart.length > 0) {
                    showAlert('Clear Issue Cart First', 'You have items in the issue cart. Clear it before returning items.', 'warning');
                } else {
                    let tx = pending.find(t => t.productItem?.barcode === val);
                    if (!tx) tx = history.find(h => h.productItem?.barcode === val && h.status !== 'RETURNED');

                    if (tx) {
                        setReturnCart(prev => {
                            if (prev.find(r => r.productItem?.barcode === val)) {
                                showAlert('Already in Return Cart', 'This item is already queued for return', 'warning');
                                return prev;
                            }
                            showAlert('Added to Return Cart', `${tx.productItem?.product?.name || 'Item'} queued for return`);
                            return [...prev, tx];
                        });
                    } else {
                        if (window.confirm(`ORPHAN ITEM: Item is marked as ${item.status} but no transaction record exists. Force-restore to AVAILABLE?`)) {
                            try {
                                await api.post(`/stats/restore/${item.id}`);
                                showAlert('Recovered', 'Item restored to AVAILABLE');
                            } catch (err) { showAlert('Error', 'Recovery failed', 'error'); }
                        }
                    }
                }
            } else {
                showAlert('Status: ' + item.status, `Item is currently ${item.status}`, 'info');
            }
        } catch (err) {
            showAlert('Not Found', 'Invalid Barcode or Item not registered', 'error');
        }
    };

    const handleSmartScan = (e) => {
        if (e.key !== 'Enter') return;
        if (e.preventDefault) e.preventDefault(); // Only call on real keyboard events
        const val = scanValue.trim();
        processSmartScan(val);
    };

    // Finalize Return from scan cart
    const handleFinalizeReturnCart = () => {
        if (returnCart.length === 0) return;
        const firstTx = returnCart[0];
        // Build a selectedBatch-compatible object from the return cart items
        const initialChecked = {};
        const initialSpareQtys = {};
        returnCart.forEach(it => {
            initialChecked[it.id] = true;
            const targetBarcode = it.productItem?.barcode;
            const targetName = it.productItem?.product?.name;
            const parts = (it.extraAccessories)?.split(' | ') || [];
            // Match by barcode first (new format), fallback to product name (old format)
            const itemSparesString = parts.find(p => p.trim().startsWith(`${targetBarcode}:`)) ||
                parts.find(p => p.trim().startsWith(`${targetName}:`));
            if (itemSparesString) {
                const content = itemSparesString.split(':').slice(1).join(':').trim();
                if (content.toLowerCase() !== 'none') {
                    content.split(',').forEach(s => {
                        const m = s.trim().match(/^(.+?)\s+x(\d+)$/i);
                        if (m) {
                            if (!initialSpareQtys[it.id]) initialSpareQtys[it.id] = {};
                            initialSpareQtys[it.id][m[1]] = parseInt(m[2]);
                        }
                    });
                }
            }
        });
        setSelectedBatch({
            items: returnCart,
            officer: firstTx.officer,
            issuerName: firstTx.issuerName,
            purpose: firstTx.purpose,
            issuedAt: firstTx.issuedAt,
            personPhotoUrl: firstTx.personPhotoUrl,
            extraAccessories: firstTx.extraAccessories
        });
        setCheckedItems(initialChecked);
        setSpareReturnQtys(initialSpareQtys);
        setItemDamageState({});
        setReturnIssuerName('');
        setReturnPersonPhoto(null);
        setShowReturnModal(true);
        setReturnCart([]); // clear the cart
    };

    const handleReturnScan = async (e) => {
        if (e.key !== 'Enter') return;
        const val = returnScanValue.trim();
        if (!val) return;

        try {
            const response = await api.get(`/inventory/items/${encodeURIComponent(val)}`);
            const item = response.data;

            if (item.status === 'ISSUED' || item.status === 'PARTIALLY_RETURNED') {
                let tx = pending.find(t => t.productItem?.barcode === val);
                if (!tx) tx = history.find(h => h.productItem?.barcode === val && h.status !== 'RETURNED');

                if (tx) {
                    const batchId = tx.batchId || `single-${tx.id}`;
                    const fullBatch = history.filter(h => h.batchId === batchId || (h.id === tx.id && !h.batchId));
                    setSelectedBatch({ items: fullBatch, officer: tx.officer, personPhotoUrl: tx.personPhotoUrl, extraAccessories: tx.batchId ? fullBatch[0].extraAccessories : tx.extraAccessories });
                    const initialChecked = {};
                    const initialSpareQtys = {};
                    fullBatch.forEach(it => {
                        initialChecked[it.id] = true;
                        const targetBarcode = it.productItem?.barcode;
                        const targetName = it.productItem?.product?.name;
                        const rawExtras = it.batchId ? fullBatch[0].extraAccessories : it.extraAccessories;
                        const parts = rawExtras?.split(' | ') || [];
                        // Match by barcode first (new format), fallback to product name (old format)
                        const itemSparesString = parts.find(p => p.trim().startsWith(`${targetBarcode}:`)) ||
                            parts.find(p => p.trim().startsWith(`${targetName}:`));
                        if (itemSparesString) {
                            const content = itemSparesString.split(':').slice(1).join(':').trim();
                            if (content.toLowerCase() !== 'none') {
                                content.split(',').forEach(s => {
                                    const m = s.trim().match(/^(\d+)x\s+(.+)$/i);
                                    if (m) {
                                        if (!initialSpareQtys[it.id]) initialSpareQtys[it.id] = {};
                                        initialSpareQtys[it.id][m[2]] = parseInt(m[1]);
                                    }
                                });
                            }
                        }
                    });
                    setCheckedItems(initialChecked);
                    setSpareReturnQtys(initialSpareQtys);
                    setReturnPersonPhoto(null);
                    setShowReturnModal(true);
                } else {
                    if (window.confirm(`ORPHAN ITEM: Item is marked as ${item.status} but no transaction record exists. Force-restore to AVAILABLE?`)) {
                        try {
                            await api.post(`/stats/restore/${item.id}`);
                            showAlert('Recovered', 'Item restored to AVAILABLE');
                        } catch (err) { showAlert('Error', 'Recovery failed', 'error'); }
                    }
                }
            } else {
                showAlert('Status: ' + item.status, `Item is currently ${item.status}`, 'info');
            }
            setReturnScanValue('');
        } catch (err) {
            showAlert('Not Found', 'Invalid Barcode', 'error');
            setReturnScanValue('');
        }
    };

    const handleIssueBatch = () => {
        if (!officerData.badgeNumber) return showAlert('Missing Data', 'Recipient ID No is required', 'error');
        if (cart.length === 0) return showAlert('Empty Cart', 'Please scan items first', 'error');

        setConfirmPopup({
            show: true,
            title: 'Confirm Issue',
            message: `Issue ${cart.length} item(s) to Recipient ID: ${officerData.badgeNumber}?`,
            onConfirm: async () => {
                try {
                    const payload = {
                        barcodes: cart.map(i => i.barcode),
                        badgeNumber: officerData.badgeNumber,
                        name: officerData.name,
                        department: officerData.unit, 
                        phone: officerData.phone,
                        others: officerData.others,
                        purpose,
                        issuerName,
                        extraAccessories: cart.map(i => {
                            const key = i.barcode; 
                            const spares = i.spareParts?.length ? i.spareParts.map(sp => `${sp.name} x${sp.qty}`).join(', ') : 'none';
                            return `${key}: ${spares}`;
                        }).join(' | ')
                    };
                    let uploadedPersonPhotoUrl = null;
                    if (personPhoto) {
                        const fd = new FormData();
                        fd.append('file', personPhoto);
                        const r = await api.post('/files/upload?type=person', fd);
                        uploadedPersonPhotoUrl = r.data.url;
                    }

                    await api.post('/transactions/issue', { ...payload, personPhotoUrl: uploadedPersonPhotoUrl });

                    // Clear storage to prevent persistence on next session
                    localStorage.removeItem('trans_officer');
                    localStorage.removeItem('trans_issuer');
                    localStorage.removeItem('trans_purpose');
                    localStorage.removeItem('trans_cart');

                    await fetchPending();
                    await fetchHistory();
                    setIssuedSummary([...cart]);
                    setReceiptOfficer({ ...officerData });
                    setReceiptIssuer(issuerName);
                    setReceiptPurpose(purpose);
                    setReceiptSpareParts(cart.map(i =>
                        i.spareParts?.length ? `${i.product?.name || i.barcode}: ${i.spareParts.map(sp => `${sp.name} x${sp.qty}`).join(', ')}` : ''
                    ).filter(Boolean).join(' | '));
                    setReceiptPersonPhotoUrl(uploadedPersonPhotoUrl);

                    setCart([]);
                    setOfficerData({ badgeNumber: '', name: '', unit: '', phone: '', others: '' });
                    setIssuerName('');
                    setPurpose('');
                    setNewSpareInputs({});
                    setPersonPhoto(null);
                    setConfirmPopup(prev => ({ ...prev, show: false }));

                    // Signature is Mandatory for Issue
                    setHasSigned(false);
                    setSignatureDataUrl(null);
                    setIssuerSignatureDataUrl(null);
                    setSignatureStep('officer');
                    setSignatureType('issue');
                    setShowSignModal(true);
                } catch (err) {
                    showAlert('Error', err.response?.data?.error || err.response?.data?.message || 'Transaction failed', 'error');
                    setConfirmPopup(prev => ({ ...prev, show: false }));
                }
            }
        });
    };

    const handleReturn = async (txId) => {
        try {
            await api.post(`/transactions/return/${txId}?quantity=1`);
            fetchPending(); fetchHistory();
            showAlert('Returned', 'Item registered back to inventory');
        } catch (err) {
            showAlert('Error', 'Failed to process return', 'error');
        }
    };

    const handleDeleteTransaction = (txId) => {
        setConfirmPopup({
            show: true,
            title: 'Delete Record?',
            message: 'Are you sure you want to permanently delete this transaction record?',
            onConfirm: async () => {
                try {
                    await api.delete(`/transactions/${txId}`);
                    fetchPending(); fetchHistory();
                    showAlert('Deleted', 'Transaction record removed');
                    setConfirmPopup(prev => ({ ...prev, show: false }));
                } catch (err) {
                    showAlert('Error', 'Failed to delete record', 'error');
                }
            }
        });
    };


    // â”€â”€ Print / Save â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const handlePrint = () => {
        const type = showReturnReceipt ? 'return' : 'issue';
        const areaId = type === 'return' ? 'return-receipt-area' : 'receipt-print-area';
        const area = document.getElementById(areaId);
        
        if (!area) {
            if (window.electronAPI?.printReceipt) {
                window.electronAPI.printReceipt();
            } else {
                window.print();
            }
            return;
        }

        const html = `
            <html>
                <head>
                    <title>${type === 'return' ? 'Return_Receipt' : 'Issue_Slip'}</title>
                    <style>
                        body { font-family: serif; padding: 20px; color: black; background: white; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                        th, td { border: 1px solid black; padding: 8px; font-size: 12px; }
                        th { background: #eee; }
                        h1, h2, h3 { margin: 5px 0; }
                        .no-print { display: none; }
                        img { max-width: 320px; height: auto; }
                        button { display: none; }
                    </style>
                </head>
                <body>
                    ${area.innerHTML}
                </body>
            </html>
        `;

        if (window.electronAPI?.printDocument) {
            window.electronAPI.printDocument(html, true);
        } else {
            window.print();
        }
    };

    const handleSaveToFolder = () => {
        const element = document.createElement('div');
        element.innerHTML = `
            <div style="font-family: serif; padding: 40px; color: black; background: white;">
                <style>
                    #receipt-print-area table { width: 100%; border-collapse: collapse; }
                    #receipt-print-area th, #receipt-print-area td { border: 1px solid black; padding: 8px; }
                    #receipt-print-area th { background: #eee; }
                    button { display: none; }
                </style>
                <div id="receipt-print-area">
                    ${document.getElementById('receipt-print-area').innerHTML}
                </div>
            </div>
        `;

        const date = new Date().toISOString().replace(/:/g, '-').split('.')[0];
        const filename = `Issue_Slip_${officerData.badgeNumber}_${date}.pdf`;

        html2pdf().from(element).set({
            margin: 0.5,
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        }).save().then(() => {
            showAlert('Saved', `Receipt saved as ${filename}`);
        }).catch(() => {
            showAlert('Error', 'Failed to save PDF', 'error');
        });
    };


    const handleFinalBatchReturn = async () => {
        if (!selectedBatch) return;
        const checkedCount = Object.values(checkedItems).filter(Boolean).length;

        if (checkedCount === 0) {
            return showAlert('No Selection', 'Please check at least one item to return', 'warning');
        }

        if (!returnIssuerName.trim()) {
            return showAlert('Missing Data', 'Receiving Authority name is required', 'warning');
        }

        // Validation: Damaged items MUST have photos
        for (const it of selectedBatch.items) {
            if (checkedItems[it.id]) {
                const damageInfo = itemDamageState[it.id] || { isDamaged: false, photoUrl: '' };
                if (damageInfo.isDamaged && !damageInfo.photoUrl) {
                    return showAlert('Photo Required', `Please upload a photo for the damaged item: ${it.productItem?.product?.name || it.productItem?.barcode}`, 'warning');
                }
            }
        }

        let uploadedReturnPersonPhotoUrl = null;
        if (returnPersonPhoto) {
            try {
                const fd = new FormData();
                fd.append('file', returnPersonPhoto);
                const r = await api.post('/files/upload?type=person', fd);
                uploadedReturnPersonPhotoUrl = r.data.url;
            } catch (err) {
                console.warn('Failed to upload return person photo:', err);
            }
        }

        try {
            const results = [];
            for (const it of selectedBatch.items) {
                if (checkedItems[it.id]) {
                    const targetBarcode = it.productItem?.barcode;
                    const targetName = it.productItem?.product?.name;
                    const rawExtras = it.batchId ? selectedBatch.items[0].extraAccessories : it.extraAccessories;
                    const parts = rawExtras?.split(' | ') || [];
                    // Barcode key first (new format), product name fallback (old data)
                    const itemSparesString = parts.find(p => p.trim().startsWith(`${targetBarcode}:`)) ||
                        parts.find(p => p.trim().startsWith(`${targetName}:`));

                    let missingArray = [];
                    if (itemSparesString) {
                        const content = itemSparesString.split(':').slice(1).join(':').trim();
                        if (content.toLowerCase() !== 'none') {
                            content.split(',').forEach(s => {
                                const m = s.trim().match(/^(.+?)\s+x(\d+)$/i);
                                if (m) {
                                    const issuedQty = parseInt(m[2]);
                                    const returnedQty = spareReturnQtys[it.id]?.[m[1]] || 0;
                                    if (returnedQty < issuedQty) {
                                        missingArray.push(`${m[1]}: missing ${issuedQty - returnedQty}`);
                                    }
                                }
                            });
                        }
                    }
                    const missingInfo = missingArray.join(', ');

                    const damageInfo = itemDamageState[it.id] || { isDamaged: false, photoUrl: '' };

                    await api.post(`/transactions/return-detailed/${it.id}`, {
                        isDamaged: damageInfo.isDamaged,
                        damagePhotoUrl: damageInfo.photoUrl,
                        missingSpares: missingInfo,
                        returnPersonPhotoUrl: uploadedReturnPersonPhotoUrl
                    });

                    results.push({
                        id: it.productItem?.barcode,
                        name: it.productItem?.product?.name,
                        isDamaged: damageInfo.isDamaged,
                        photoUrl: damageInfo.photoUrl,
                        missing: missingInfo
                    });
                }
            }

            setReturnReceiptData({
                officer: selectedBatch.officer,
                receivingAuthority: returnIssuerName,
                issuer: selectedBatch.issuerName || '-',
                purpose: selectedBatch.purpose || '-',
                issuedAt: selectedBatch.issuedAt ? new Date(selectedBatch.issuedAt).toLocaleString('en-GB') : '-',
                returnDate: new Date().toLocaleDateString('en-GB'),
                returnTime: new Date().toLocaleTimeString(),
                items: results,
                issuePersonPhotoUrl: selectedBatch?.personPhotoUrl,
                returnPersonPhotoUrl: uploadedReturnPersonPhotoUrl
            });

            fetchPending(); fetchHistory();
            showAlert('Return Processed', 'Items registered back to inventory');
            setShowReturnModal(false);

            // Direct flow: Show return receipt and auto-save PDF (No signature required)
            setSignatureDataUrl(null);
            setIssuerSignatureDataUrl(null);
            setShowReturnReceipt(true);
            setTimeout(() => autoSaveReceipt('return', null, null), 600);

            setSelectedBatch(null);
            setCheckedItems({});
            setSpareReturnQtys({});
            setItemDamageState({});
            setReturnIssuerName('');
            setReturnPersonPhoto(null);
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Return process failed';
            showAlert('Error', errorMsg, 'error');
        }
    };

    // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    return (
        <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h2 style={{ fontWeight: '800', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <ClipboardList size={28} color="var(--accent)" /> Issue / Return Ledger
                </h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    {returnCart.length > 0 ? (
                        <>
                            <button className="btn" style={{ width: 'auto', background: '#f1f5f9', color: '#475569' }} onClick={() => setReturnCart([])}>Clear Return</button>
                            <button className="btn" style={{ width: 'auto', backgroundColor: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={handleFinalizeReturnCart}>
                                <CheckCircle2 size={18} /> Finalize Return
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="btn" style={{ width: 'auto', background: '#f1f5f9', color: '#475569' }} onClick={() => setCart([])}>Clear Cart</button>
                            <button className="btn" style={{ width: 'auto', backgroundColor: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={handleIssueBatch}>
                                <CheckCircle2 size={18} /> Finalize Issue
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem', marginBottom: '3rem' }}>
                {/* LEFT: FORM */}
                <div className="card" style={{ borderLeft: '4px solid var(--accent)' }}>
                    <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <User color="var(--accent)" /> Officer &amp; Issuer Details
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div className="form-group">
                            <label>Officer ID No <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <input className="form-input" autoComplete="off" value={officerData.badgeNumber} onChange={e => setOfficerData({ ...officerData, badgeNumber: e.target.value })} placeholder="Badge No..." />
                        </div>
                        <div className="form-group">
                            <label>Officer Name</label>
                            <input className="form-input" autoComplete="off" value={officerData.name} onChange={e => setOfficerData({ ...officerData, name: e.target.value })} placeholder="Name..." />
                        </div>
                        <div className="form-group">
                            <label>Unit / Department <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <input className="form-input" autoComplete="off" value={officerData.unit} onChange={e => setOfficerData({ ...officerData, unit: e.target.value })} placeholder="Unit..." />
                        </div>
                        <div className="form-group">
                            <label>Issuer Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <input className="form-input" autoComplete="off" value={issuerName} onChange={e => setIssuerName(e.target.value)} placeholder="Issuing Officer Name..." />
                        </div>
                        <div className="form-group">
                            <label>Purpose <span style={{ color: 'var(--danger)' }}>*</span></label>
                            <input className="form-input" autoComplete="off" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="e.g. Training" />
                        </div>
                    </div>

                    <div style={{ marginTop: '0.8rem' }}>
                        <label style={{ fontWeight: '600', fontSize: '0.9rem', marginBottom: '0.4rem', display: 'block' }}>Person's Photo (Webcam)</label>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <button 
                                type="button" 
                                className="btn" 
                                style={{ width: 'auto', background: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
                                onClick={() => setIsPersonCameraOpen(true)}
                            >
                                <Camera size={16} /> Take Photo of Person
                            </button>
                            {personPhoto && (
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <img src={URL.createObjectURL(personPhoto)} style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover', border: '2px solid var(--accent)' }} alt="capture" />
                                    <button type="button" onClick={() => setPersonPhoto(null)} style={{ padding: '2px 8px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.65rem' }}>Remove</button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '0.75rem', border: '2px dashed var(--accent)', transition: 'all 0.3s' }}>
                        <label style={{ fontWeight: '700', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <QrCode size={20} color="var(--accent)" /> Smart Scanner (Auto Issue/Return)
                        </label>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <input
                                ref={scanInputRef}
                                className="form-input"
                                style={{ flex: 1, fontSize: '1.25rem', padding: '1rem', background: 'white', border: '2px solid var(--accent)' }}
                                placeholder="Scan QR to Issue or Return..."
                                value={scanValue}
                                onChange={e => setScanValue(e.target.value)}
                                onKeyDown={handleSmartScan}
                            />
                            <button 
                                className="btn" 
                                style={{ width: 'auto', padding: '1rem 1.5rem', backgroundColor: 'var(--accent)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                                onClick={() => processSmartScan(scanValue.trim())}
                            >
                                <Search size={22} /> Issue / Return
                            </button>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                            Scanning <strong>AVAILABLE</strong> items adds to issue cart. Scanning <strong>ISSUED</strong> items adds to return cart â€” click <em>Finalize Return</em> when ready.
                        </p>
                    </div>

                </div>

                {/* RIGHT: SMART CART â€” Issue or Return mode */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', borderLeft: returnCart.length > 0 ? '4px solid var(--danger)' : undefined }}>
                    <h3 style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {returnCart.length > 0 ? <><RotateCcw color="var(--danger)" size={20} /><span style={{ color: 'var(--danger)' }}>Return Cart</span></> : <><Package color="var(--accent)" size={20} />Cart</>}
                        </span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--text-muted)' }}>{returnCart.length > 0 ? returnCart.length : cart.length} items</span>
                    </h3>

                    {/* Scrollable list â€” each card expands freely */}
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {returnCart.length > 0 ? (
                            returnCart.map((tx, idx) => (
                                <div key={idx} style={{ background: '#fff1f2', border: '1px solid #fda4af', borderRadius: '8px', padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: '600', fontSize: '0.82rem' }}>{tx.productItem?.product?.name}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{tx.productItem?.barcode}</div>
                                        <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Officer: {tx.officer?.name} ({tx.officer?.badgeNumber})</div>
                                    </div>
                                    <button onClick={() => setReturnCart(returnCart.filter((_, i) => i !== idx))} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}><Trash2 size={14} /></button>
                                </div>
                            ))
                        ) : cart.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>No items scanned yet</div>
                        ) : (
                            cart.map((item, idx) => {
                                const ns = newSpareInputs[idx] || { name: '', qty: '' };
                                const addSpare = () => {
                                    if (!ns.name || !ns.qty) return;
                                    const updated = cart.map((c, i) => i === idx ? { ...c, spareParts: [...(c.spareParts || []), { name: ns.name.trim(), qty: ns.qty }] } : c);
                                    setCart(updated);
                                    setNewSpareInputs({ ...newSpareInputs, [idx]: { name: '', qty: '' } });
                                };
                                return (
                                    <div key={idx} style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '0.5rem', overflow: 'hidden' }}>
                                        {/* Compact item row */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: '600', fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.product?.name}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{item.barcode}</div>
                                            </div>
                                            <button onClick={() => setCart(cart.filter((_, i) => i !== idx))} style={{ color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px', flexShrink: 0 }}>
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        {/* Spare parts inline */}
                                        <div style={{ padding: '0.3rem 0.6rem 0.5rem', borderTop: '1px solid #e2e8f0', background: 'white' }}>
                                            {(item.spareParts || []).length > 0 && (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.3rem' }}>
                                                    {(item.spareParts || []).map((sp, si) => (
                                                        <span key={si} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', background: '#dbeafe', color: '#1e40af', padding: '1px 6px', borderRadius: '999px', fontSize: '0.68rem' }}>
                                                            {sp.name} x{sp.qty}
                                                            <button onClick={() => {
                                                                const updated = cart.map((c, i) => i === idx ? { ...c, spareParts: c.spareParts.filter((_, j) => j !== si) } : c);
                                                                setCart(updated);
                                                            }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1e40af', padding: 0, fontSize: '0.9rem', lineHeight: 1 }}>x</button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                                                <input className="form-input" placeholder="Part" value={ns.name}
                                                    onChange={e => setNewSpareInputs({ ...newSpareInputs, [idx]: { ...ns, name: e.target.value } })}
                                                    onKeyDown={e => e.key === 'Enter' && addSpare()}
                                                    style={{ flex: 2, fontSize: '0.72rem', padding: '0.2rem 0.4rem', height: '26px' }} />
                                                <input className="form-input" placeholder="Qty" type="number" min="1" value={ns.qty}
                                                    onChange={e => setNewSpareInputs({ ...newSpareInputs, [idx]: { ...ns, qty: e.target.value } })}
                                                    onFocus={e => e.target.select()}
                                                    onKeyDown={e => e.key === 'Enter' && addSpare()}
                                                    style={{ flex: 1, fontSize: '0.72rem', padding: '0.2rem 0.4rem', height: '26px', minWidth: '45px' }} />
                                                <button onClick={addSpare} className="btn" style={{ width: 'auto', padding: '0.2rem 0.5rem', height: '26px', flexShrink: 0, fontSize: '0.75rem' }}>
                                                    <Plus size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>


            {/* UNIFIED TRANSACTION LEDGER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, padding: '0.5rem 0', borderBottom: '2px solid var(--accent)' }}>Transaction Ledger</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{history.filter(t => t.status !== 'RETURNED').length} pending items</span>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-container">
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', background: '#f8fafc', fontSize: '0.82rem' }}>
                                <th style={{ padding: '0.75rem 1rem' }}>Date & Time</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Item Issued</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Officer ID</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Issuer Name</th>
                                <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {memoizedActiveTransactions.length === 0 ? (
                                <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No active transactions</td></tr>
                            ) : (
                                memoizedActiveTransactions.map(batch => (
                                    <tr key={batch.id} 
                                        onClick={() => { setDetailBatch(batch); setShowDetailModal(true); }}
                                        style={{ borderBottom: '1px solid var(--border)', fontSize: '0.88rem', background: '#fffbeb', cursor: 'pointer', transition: 'background 0.2s' }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#fef3c7'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = '#fffbeb'}
                                    >
                                        <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                                            {new Date(batch.issuedAt).toLocaleDateString('en-GB')}<br />
                                            <small style={{ color: 'var(--text-muted)' }}>{new Date(batch.issuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                {batch.items.map(it => (
                                                    <div key={it.id} style={{
                                                        border: `1px solid ${it.status === 'RETURNED' ? '#cbd5e1' : '#e2e8f0'}`,
                                                        borderRadius: '4px', padding: '2px 6px',
                                                        background: it.status === 'RETURNED' ? '#f1f5f9' : 'white',
                                                        opacity: it.status === 'RETURNED' ? 0.6 : 1
                                                    }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <div style={{ fontWeight: 600, fontSize: '0.78rem' }}>{it.productItem?.product?.name || 'Unknown Item'}</div>
                                                            <small style={{
                                                                fontSize: '0.65rem', padding: '1px 4px', borderRadius: '4px',
                                                                background: it.status === 'RETURNED'
                                                                    ? (it.missingSpares && it.missingSpares.toLowerCase() !== 'none' ? '#f59e0b' : '#94a3b8')
                                                                    : 'var(--warning)',
                                                                color: 'white', whiteSpace: 'nowrap'
                                                            }}>
                                                                {it.status === 'RETURNED'
                                                                    ? (it.missingSpares && it.missingSpares.toLowerCase() !== 'none' ? 'SPARES DEBT' : 'IN')
                                                                    : 'OUT'}
                                                            </small>
                                                        </div>
                                                        <small style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{it.productItem?.barcode}</small>
                                                    </div>
                                                ))}
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <div style={{ fontWeight: 600 }}>{batch.officer?.badgeNumber}</div>
                                            <small style={{ color: 'var(--text-muted)' }}>{batch.officer?.name}</small>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                                            {batch.issuerName || '-'}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <span className={`badge badge-${batch.batchStatusLabel === 'RETURNED' ? 'success' : 'warning'}`}>
                                                {batch.batchStatusLabel}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                                <div style={{ display: 'flex', gap: '0.3rem' }}>
                                                    <button
                                                        className="btn"
                                                        title="View Details"
                                                        style={{ flex: 1, padding: '0.3rem', background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)', fontSize: '0.72rem' }}
                                                        onClick={() => { setDetailBatch(batch); setShowDetailModal(true); }}
                                                    >
                                                        <Eye size={12} />
                                                    </button>
                                                    <button
                                                        className="btn"
                                                        style={{ flex: 1, padding: '0.3rem', background: 'transparent', color: 'var(--danger)', border: '1px solid var(--danger)', fontSize: '0.72rem' }}
                                                        onClick={() => {
                                                            setAuthPrompt({
                                                                show: true,
                                                                action: () => {
                                                                    Promise.all(batch.items.map(it => api.delete(`/transactions/${it.id}`)))
                                                                        .then(() => { fetchPending(); fetchHistory(); });
                                                                }
                                                            });
                                                        }}
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* â”€â”€ CONFIRM MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {
                confirmPopup.show && (
                    <div className="modal-overlay">
                        <div className="card" style={{ maxWidth: '400px', textAlign: 'center' }}>
                            <AlertCircle size={48} color="var(--accent)" style={{ marginBottom: '1rem' }} />
                            <h3>{confirmPopup.title}</h3>
                            <p>{confirmPopup.message}</p>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                                <button className="btn" style={{ background: '#f1f5f9', color: '#475569' }} onClick={() => setConfirmPopup({ ...confirmPopup, show: false })}>Cancel</button>
                                <button className="btn" onClick={confirmPopup.onConfirm}>Confirm</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* â”€â”€ DIGITAL SIGNATURE MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {
                showSignModal && (
                    <div className="modal-overlay" style={{ background: 'rgba(15,23,42,0.92)' }}>
                        <div className="card" style={{ maxWidth: '900px', width: '100%' }}>
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <PenTool color="var(--accent)" /> {signatureStep === 'officer' ? (signatureType === 'return' ? 'Returning Officer Signature' : 'Recipient Signature') : (signatureType === 'return' ? 'Receiving Authority Signature' : 'Issuer Signature')}
                            </h3>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                                {signatureStep === 'officer' ? (
                                    signatureType === 'return' ? <>Returning Officer <strong>{returnReceiptData?.officer?.name}</strong> must sign below.</> : <>Recipient <strong>{receiptOfficer?.name}</strong> must sign below.</>
                                ) : (
                                    signatureType === 'return' ? <>Receiving Authority <strong>{returnReceiptData?.issuer}</strong> must sign below.</> : <>Issuing Officer <strong>{receiptIssuer}</strong> must sign below.</>
                                )}
                            </p>
                            <div style={{ position: 'relative', border: '2px solid var(--accent)', borderRadius: '0.5rem', background: '#fff', overflow: 'hidden' }}>
                                <p style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: '#e2e8f0', fontSize: '0.85rem', pointerEvents: 'none', margin: 0, whiteSpace: 'nowrap' }}>
                                    Sign here
                                </p>
                                <canvas
                                    ref={signatureCanvasRef}
                                    width={860} height={360}
                                    style={{ display: 'block', cursor: 'crosshair', touchAction: 'none', width: '100%' }}
                                    onMouseDown={startDraw}
                                    onMouseMove={draw}
                                    onMouseUp={endDraw}
                                    onMouseLeave={endDraw}
                                    onTouchStart={startDraw}
                                    onTouchMove={draw}
                                    onTouchEnd={endDraw}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                <button className="btn" style={{ flex: 1, background: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }} onClick={clearSignature}>
                                    <Eraser size={16} /> Clear
                                </button>
                                <button className="btn" style={{ flex: 2, backgroundColor: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }} onClick={confirmSignature}>
                                    <CheckCircle2 size={16} /> Next / Confirm
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* â”€â”€ PRINT PREVIEW MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {
                showPrintPreview && (
                    <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.9)' }}>
                        <div className="card" style={{ maxWidth: '850px', background: 'white', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>

                            {/* Receipt Content */}
                            <div id="receipt-print-area">
                                <div style={{ padding: '40px', color: 'black', fontFamily: 'serif' }}>
                                    <div style={{ textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '10px' }}>
                                        <h1 style={{ margin: 0 }}>GREYHOUNDS TELANGANA</h1>
                                        <p style={{ margin: 0 }}>WORKSHOP INVENTORY MANAGEMENT SYSTEM</p>
                                        <h2 style={{ margin: '10px 0' }}>EQUIPMENT ISSUE SLIP</h2>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(400px, 1fr) 250px', gap: '40px', margin: '35px 0' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>Officer:</span>
                                                <span style={{ borderBottom: '1px solid black', flex: 1, minWidth: '100px', paddingBottom: '2px', fontSize: '1.2rem' }}>{receiptOfficer.name}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>Purpose:</span>
                                                <span style={{ borderBottom: '1px solid black', flex: 1, minWidth: '100px', paddingBottom: '2px', fontSize: '1.2rem' }}>{receiptPurpose || '-'}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ fontSize: '1.2rem', fontWeight: 600 }}>Issuer:</span>
                                                <span style={{ borderBottom: '1px solid black', flex: 1, minWidth: '100px', paddingBottom: '2px', fontSize: '1.2rem' }}>{receiptIssuer}</span>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>Officer ID:</span>
                                                <span style={{ borderBottom: '1px solid black', flex: 1, minWidth: '100px', paddingBottom: '2px', fontSize: '1.1rem' }}>{receiptOfficer.badgeNumber}</span>
                                            </div>
                                            {/* Photo moved to center below details grid for visibility */}
                                        </div>
                                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '1rem' }}>
                                            <p style={{ margin: 0 }}><strong>DATE:</strong> {new Date().toLocaleDateString('en-GB')}</p>
                                            <p style={{ margin: 0 }}><strong>TIME:</strong> {new Date().toLocaleTimeString()}</p>
                                            <p style={{ margin: 0 }}><strong>UNIT:</strong> {receiptOfficer.unit || '-'}</p>
                                        </div>
                                    </div>

                                    {/* IDENTIFICATION PHOTO - CENTERED AND ENLARGED */}
                                    {receiptPersonPhotoUrl && (
                                        <div style={{ textAlign: 'center', marginBottom: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <div style={{ border: '2px solid black', padding: '5px', borderRadius: '12px', background: 'white', display: 'inline-block' }}>
                                                <img 
                                                    src={receiptPersonPhotoUrl.startsWith('http') ? receiptPersonPhotoUrl : `${api.defaults.baseURL}/files/${receiptPersonPhotoUrl.split('/').pop()}`} 
                                                    style={{ width: '320px', height: '320px', borderRadius: '8px', objectFit: 'cover' }} 
                                                    alt="Person" 
                                                />
                                            </div>
                                            <p style={{ margin: '8px 0 0 0', fontSize: '1.1rem', letterSpacing: '1px' }}><strong>IDENTIFICATION PHOTO</strong></p>
                                        </div>
                                    )}

                                    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
                                        <thead>
                                            <tr style={{ background: '#eee' }}>
                                                <th style={{ border: '1px solid black', padding: '8px', textAlign: 'left' }}>#</th>
                                                <th style={{ border: '1px solid black', padding: '8px', textAlign: 'left' }}>EQUIPMENT DESCRIPTION</th>
                                                <th style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>UNIT ID</th>
                                                <th style={{ border: '1px solid black', padding: '8px', textAlign: 'left' }}>SPARE PARTS / ACCESSORIES</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {issuedSummary.map((item, i) => (
                                                <tr key={i}>
                                                    <td style={{ border: '1px solid black', padding: '8px', width: '30px', textAlign: 'center' }}>{i + 1}</td>
                                                    <td style={{ border: '1px solid black', padding: '8px' }}>{item.product?.name || item.productName || '-'}</td>
                                                    <td style={{ border: '1px solid black', padding: '8px', textAlign: 'center' }}>{item.barcode}</td>
                                                    <td style={{ border: '1px solid black', padding: '8px', fontSize: '0.85rem' }}>
                                                        {(item.spareParts || []).length > 0
                                                            ? item.spareParts.map(sp => `${sp.name} x${sp.qty}`).join(', ')
                                                            : <span style={{ color: '#999' }}>N/A</span>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>



                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', marginTop: '60px', gap: '20px' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            {signatureDataUrl ? (
                                                <img src={signatureDataUrl} alt="Signature" style={{ height: '100px', display: 'block', margin: '0 auto 4px' }} />
                                            ) : (
                                                <div style={{ height: '100px', borderBottom: '1px dotted #ccc', width: '200px', margin: '0 auto 4px' }} />
                                            )}
                                            <div style={{ width: '180px', borderTop: '1px solid black', margin: 'auto', paddingTop: '4px', fontSize: '0.85rem' }}>Signature of Recipient</div>
                                            <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '4px' }}>{receiptOfficer.name} ({receiptOfficer.badgeNumber})</div>
                                        </div>
                                        <div style={{ textAlign: 'center' }}>
                                            {issuerSignatureDataUrl ? (
                                                <img src={issuerSignatureDataUrl} alt="Issuer Signature" style={{ height: '100px', display: 'block', margin: '0 auto 4px' }} />
                                            ) : (
                                                <div style={{ height: '100px', borderBottom: '1px dotted #ccc', width: '200px', margin: '0 auto 4px' }} />
                                            )}
                                            <div style={{ width: '180px', borderTop: '1px solid black', margin: 'auto', paddingTop: '4px', fontSize: '0.85rem' }}>Issuing Authority</div>
                                            <div style={{ fontSize: '0.8rem', color: '#555', marginTop: '4px' }}>{receiptIssuer}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                                <button className="btn" style={{ flex: 1, background: '#f1f5f9', color: '#475569' }} onClick={() => setShowPrintPreview(false)}>
                                    Close
                                </button>
                                <button className="btn" style={{ flex: 2, backgroundColor: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={handlePrint}>
                                    <Printer size={18} /> Print Slip
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* â”€â”€ RETURN VERIFICATION MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {
                showReturnModal && selectedBatch && (
                    <div className="modal-overlay" style={{ background: 'rgba(15,23,42,0.95)' }}>
                        <div className="card" style={{ maxWidth: '600px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <RefreshCw color="var(--success)" size={24} /> Return Verification
                                </h3>
                                <button onClick={() => setShowReturnModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                            </div>

                            <div style={{ padding: '1rem', background: '#f8fafc', borderRadius: '0.5rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--success)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{selectedBatch.officer?.name}</div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>ID: {selectedBatch.officer?.badgeNumber}</div>
                                </div>
                                {selectedBatch.personPhotoUrl && (
                                    <div style={{ textAlign: 'center' }}>
                                        <img 
                                            src={selectedBatch.personPhotoUrl.startsWith('http') ? selectedBatch.personPhotoUrl : `${api.defaults.baseURL}/files/${selectedBatch.personPhotoUrl.split('/').pop()}`} 
                                            style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', border: '2px solid var(--success)' }} 
                                            alt="Original Issue" 
                                        />
                                        <div style={{ fontSize: '0.65rem', fontWeight: 700, marginTop: '2px', color: 'var(--success)' }}>ISSUE PHOTO</div>
                                    </div>
                                )}
                            </div>

                            <div style={{ marginBottom: '1.5rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '0.5rem', border: '1px solid var(--success)' }}>
                                <label style={{ display: 'block', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem', color: 'var(--success)' }}>PHOTO DURING RETURN (OPTIONAL)</label>
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                    <button 
                                        className="btn" 
                                        style={{ width: 'auto', background: 'var(--success)', color: 'white', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', padding: '0.5rem 1rem' }}
                                        onClick={() => setIsReturnPersonCameraOpen(true)}
                                    >
                                        <Camera size={16} /> Capture Returnee Photo
                                    </button>
                                    {returnPersonPhoto && (
                                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <img src={URL.createObjectURL(returnPersonPhoto)} style={{ width: '60px', height: '60px', borderRadius: '8px', objectFit: 'cover', border: '2px solid var(--success)' }} alt="return capture" />
                                            <button type="button" onClick={() => setReturnPersonPhoto(null)} style={{ padding: '2px 8px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.65rem' }}>Remove</button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '1rem' }}>Please physically check each item and its spare parts before marking as returned:</p>

                            <div style={{ flex: 1, overflowY: 'auto', marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {selectedBatch.items.map(it => {
                                    // Each item has its OWN extraAccessories â€” read it directly
                                    const targetBarcode = it.productItem?.barcode;
                                    const targetName = it.productItem?.product?.name;
                                    // Use the item's own extras (new format), fall back to batch-level extras (old format)
                                    const rawExtras = it.extraAccessories || selectedBatch.extraAccessories || '';
                                    const parts = rawExtras.split(' | ');
                                    // Match barcode key first (new format), then product name (old data)
                                    const itemSparesString = parts.find(p => p.trim().startsWith(`${targetBarcode}:`)) ||
                                        parts.find(p => p.trim().startsWith(`${targetName}:`));

                                    let spares = [];
                                    if (itemSparesString) {
                                        const content = itemSparesString.split(':').slice(1).join(':').trim();
                                        if (content.toLowerCase() !== 'none') {
                                            spares = content.split(',').map(s => {
                                                const m = s.trim().match(/^(.+?)\s+x(\d+)$/i);
                                                return m ? { name: m[1], qty: parseInt(m[2]) } : null;
                                            }).filter(Boolean);
                                        }
                                    }

                                    return (
                                        <div key={it.id}
                                            style={{
                                                display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem',
                                                background: checkedItems[it.id] ? '#f0fdf4' : 'white',
                                                border: `1px solid ${checkedItems[it.id] ? 'var(--success)' : '#e2e8f0'}`,
                                                borderRadius: '0.75rem', transition: 'all 0.2s'
                                            }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }}
                                                onClick={() => setCheckedItems({ ...checkedItems, [it.id]: !checkedItems[it.id] })}>
                                                <div style={{
                                                    width: '24px', height: '24px', borderRadius: '6px', border: '2px solid var(--success)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    background: checkedItems[it.id] ? 'var(--success)' : 'transparent'
                                                }}>
                                                    {checkedItems[it.id] && <CheckCircle2 size={16} color="white" />}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 700 }}>{it.productItem?.product?.name}</div>
                                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Barcode: {it.productItem?.barcode}</div>
                                                </div>
                                            </div>

                                            {/* Damage Section */}
                                            <div style={{ marginLeft: '2.5rem', padding: '0.75rem', border: '1px solid #fee2e2', borderRadius: '0.5rem', background: (itemDamageState[it.id]?.isDamaged) ? '#fef2f2' : '#fcfcfc' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600, color: '#b91c1c', fontSize: '0.85rem' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={itemDamageState[it.id]?.isDamaged || false}
                                                        onChange={e => setItemDamageState({ ...itemDamageState, [it.id]: { ...(itemDamageState[it.id] || {}), isDamaged: e.target.checked } })}
                                                    />
                                                    Damaged Product?
                                                </label>
                                                {itemDamageState[it.id]?.isDamaged && (
                                                    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            <button 
                                                                type="button" 
                                                                className="btn" 
                                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', width: 'auto', background: '#f1f5f9', color: '#475569' }}
                                                                onClick={() => {
                                                                    const input = document.createElement('input');
                                                                    input.type = 'file';
                                                                    input.accept = 'image/*';
                                                                    input.onchange = async (e) => {
                                                                        const file = e.target.files[0];
                                                                        if (file) handleUploadDamagePhoto(it.id, file);
                                                                    };
                                                                    input.click();
                                                                }}
                                                            >
                                                                Upload File
                                                            </button>
                                                            <button 
                                                                type="button" 
                                                                className="btn" 
                                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem', width: 'auto', background: 'var(--accent)', color: 'white' }}
                                                                onClick={() => setCapturingForItemId(it.id)}
                                                            >
                                                                Open Camera
                                                            </button>
                                                        </div>
                                                        {itemDamageState[it.id]?.photoUrl && (
                                                            <img
                                                                src={itemDamageState[it.id].photoUrl.startsWith('http') ? itemDamageState[it.id].photoUrl : `${api.defaults.baseURL}/damaged/${itemDamageState[it.id].photoUrl.split('/').pop()}`}
                                                                alt="Damage Proof"
                                                                style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #fee2e2' }}
                                                            />
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {spares.length > 0 && (
                                                <div style={{ marginLeft: '2.5rem', padding: '0.6rem', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '0.5rem' }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#92400e', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Wrench size={12} /> VERIFY SPARE PARTS QUANTITY
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                        {spares.map((sp, idx) => (
                                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                                                                <span>{sp.name} <small style={{ color: '#b45309' }}>(Issued: {sp.qty})</small></span>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                    <small>Returned:</small>
                                                                    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #d1d5db', borderRadius: '4px', background: 'white', overflow: 'hidden' }}>
                                                                        <button
                                                                            type="button"
                                                                            style={{ padding: '0 8px', border: 'none', background: '#f9fafb', cursor: 'pointer' }}
                                                                            onClick={() => {
                                                                                const current = spareReturnQtys[it.id]?.[sp.name] || 0;
                                                                                if (current > 0) setSpareReturnQtys({ ...spareReturnQtys, [it.id]: { ...(spareReturnQtys[it.id] || {}), [sp.name]: current - 1 } });
                                                                            }}
                                                                        >-</button>
                                                                        <div style={{ width: '30px', textAlign: 'center', fontWeight: 'bold', fontSize: '0.8rem' }}>
                                                                            {spareReturnQtys[it.id]?.[sp.name] || 0}
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            style={{ padding: '0 8px', border: 'none', background: '#f9fafb', cursor: 'pointer' }}
                                                                            onClick={() => {
                                                                                const current = spareReturnQtys[it.id]?.[sp.name] || 0;
                                                                                if (current < sp.qty) setSpareReturnQtys({ ...spareReturnQtys, [it.id]: { ...(spareReturnQtys[it.id] || {}), [sp.name]: current + 1 } });
                                                                            }}
                                                                        >+</button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            <div className="form-group" style={{ marginBottom: '1.5rem', marginTop: '1rem' }}>
                                <label style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '0.5rem', display: 'block' }}>Receiving Authority (Issuer) Name*</label>
                                <input
                                    className="form-input"
                                    value={returnIssuerName}
                                    onChange={e => setReturnIssuerName(e.target.value)}
                                    placeholder="Enter Receiving Officer Name..."
                                    style={{ border: '2px solid var(--accent)', background: 'white' }}
                                    autoComplete="off"
                                />
                            </div>


                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button className="btn" style={{ flex: 1, background: '#f1f5f9', color: '#475569' }} onClick={() => setShowReturnModal(false)}>Cancel</button>
                                <button className="btn" style={{ flex: 2, background: 'var(--success)', opacity: isUploading ? 0.5 : 1 }} disabled={isUploading} onClick={handleFinalBatchReturn}>
                                    {isUploading ? 'Uploading...' : 'Confirm Receipt of Checked Items'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

             {/* â”€â”€ CAMERA MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
             <CameraCaptureModal 
                 isOpen={isPersonCameraOpen} 
                 onClose={() => setIsPersonCameraOpen(false)} 
                 onCapture={(file) => setPersonPhoto(file)}
                 title="Capture Person Photo (Issue)"
             />

             <CameraCaptureModal 
                 isOpen={isReturnPersonCameraOpen} 
                 onClose={() => setIsReturnPersonCameraOpen(false)} 
                 onCapture={(file) => setReturnPersonPhoto(file)}
                 title="Capture Person Photo (Return)"
             />


             {/* â”€â”€ CAMERA MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
             <CameraCaptureModal 
                 isOpen={capturingForItemId !== null} 
                 onClose={() => setCapturingForItemId(null)} 
                 onCapture={(file) => handleUploadDamagePhoto(capturingForItemId, file)}
                 title="Capture Damage Evidence"
             />

            {/* â”€â”€ ALERT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {
                alertPopup.show && (
                    <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999, display: 'flex', gap: '1rem', alignItems: 'center', background: 'white', padding: '1rem 1.5rem', borderRadius: '0.75rem', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', borderLeft: `4px solid ${alertPopup.type === 'error' ? 'var(--danger)' : alertPopup.type === 'warning' ? 'var(--warning)' : 'var(--success)'}` }}>
                        <div>
                            <strong style={{ display: 'block' }}>{alertPopup.title}</strong>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{alertPopup.message}</span>
                        </div>
                    </div>
                )
            }
            {/* â”€â”€ RETURN RECEIPT / LETTER MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {
                showReturnReceipt && returnReceiptData && (
                    <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.95)' }}>
                        <div className="card" style={{ maxWidth: '800px', width: '90%', background: 'white', padding: '2.5rem', maxHeight: '90vh', overflowY: 'auto', borderRadius: '0' }}>
                            <div id="return-receipt-area" style={{ color: 'black', fontFamily: 'serif' }}>
                                <div style={{ textAlign: 'center', borderBottom: '2px solid black', paddingBottom: '10px', marginBottom: '30px' }}>
                                    <h1 style={{ margin: 0 }}>GREYHOUNDS TELANGANA</h1>
                                    <p style={{ margin: 0 }}>EQUIPMENT RETURN RECEIPT</p>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem', fontSize: '0.92rem' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        <p style={{ margin: 0 }}><strong>OFFICER NAME:</strong> {returnReceiptData.officer?.name}</p>
                                        <p style={{ margin: 0 }}><strong>OFFICER ID No:</strong> {returnReceiptData.officer?.badgeNumber}</p>
                                        {returnReceiptData.officer?.department && <p style={{ margin: 0 }}><strong>UNIT / DEPT:</strong> {returnReceiptData.officer.department}</p>}
                                        {returnReceiptData.purpose && returnReceiptData.purpose !== '-' && <p style={{ margin: 0 }}><strong>PURPOSE:</strong> {returnReceiptData.purpose}</p>}
                                        {returnReceiptData.issuer && returnReceiptData.issuer !== '-' && <p style={{ margin: 0 }}><strong>ORIGINALLY ISSUED BY:</strong> {returnReceiptData.issuer}</p>}
                                        {returnReceiptData.issuedAt && returnReceiptData.issuedAt !== '-' && <p style={{ margin: 0 }}><strong>DATE OF ISSUE:</strong> {returnReceiptData.issuedAt}</p>}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'right' }}>
                                        <p style={{ margin: 0 }}><strong>RETURN DATE:</strong> {returnReceiptData.returnDate}</p>
                                        <p style={{ margin: 0 }}><strong>RETURN TIME:</strong> {returnReceiptData.returnTime}</p>
                                        <p style={{ margin: 0, marginTop: '12px' }}>
                                            <strong>RECEIVING AUTHORITY:</strong> {returnReceiptData.receivingAuthority}
                                        </p>
                                    </div>
                                </div>

                                {/* IDENTIFICATION PHOTO - CENTERED AND ENLARGED */}
                                {returnReceiptData.issuePersonPhotoUrl && (
                                    <div style={{ textAlign: 'center', marginBottom: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ border: '2px solid black', padding: '5px', borderRadius: '12px', background: 'white', display: 'inline-block' }}>
                                            <img 
                                                src={returnReceiptData.issuePersonPhotoUrl.startsWith('http') ? returnReceiptData.issuePersonPhotoUrl : `${api.defaults.baseURL}/files/${returnReceiptData.issuePersonPhotoUrl.split('/').pop()}`} 
                                                style={{ width: '320px', height: '320px', borderRadius: '8px', objectFit: 'cover' }} 
                                                alt="Original Issue" 
                                            />
                                        </div>
                                        <p style={{ margin: '8px 0 0 0', fontSize: '1.1rem', letterSpacing: '1px' }}><strong>PHOTO DURING ISSUE</strong></p>
                                    </div>
                                )}

                                {returnReceiptData.returnPersonPhotoUrl && (
                                    <div style={{ textAlign: 'center', marginBottom: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <div style={{ border: '2px solid black', padding: '5px', borderRadius: '12px', background: 'white', display: 'inline-block' }}>
                                            <img 
                                                src={returnReceiptData.returnPersonPhotoUrl.startsWith('http') ? returnReceiptData.returnPersonPhotoUrl : `${api.defaults.baseURL}/files/${returnReceiptData.returnPersonPhotoUrl.split('/').pop()}`} 
                                                style={{ width: '320px', height: '320px', borderRadius: '8px', objectFit: 'cover' }} 
                                                alt="Return Capture" 
                                            />
                                        </div>
                                        <p style={{ margin: '8px 0 0 0', fontSize: '1.1rem', letterSpacing: '1px' }}><strong>PHOTO DURING RETURN</strong></p>
                                    </div>
                                )}

                                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                                    <thead>
                                        <tr style={{ background: '#f5f5f5' }}>
                                            <th style={{ border: '1px solid black', padding: '8px' }}>Equipment</th>
                                            <th style={{ border: '1px solid black', padding: '8px' }}>Status</th>
                                            <th style={{ border: '1px solid black', padding: '8px' }}>Missing Spares</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {returnReceiptData.items.map((it, idx) => (
                                            <tr key={idx}>
                                                <td style={{ border: '1px solid black', padding: '8px' }}>
                                                    <strong>{it.name}</strong><br />
                                                    <small>ID: {it.id}</small>
                                                </td>
                                                <td style={{ border: '1px solid black', padding: '8px', color: it.isDamaged ? 'red' : 'green' }}>
                                                    {it.isDamaged ? 'DAMAGED' : 'GOOD CONDITION'}
                                                </td>
                                                <td style={{ border: '1px solid black', padding: '8px' }}>
                                                    {it.missing && it.missing.trim() !== '' ? it.missing : 'N/A'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {/* Damage Photos Section */}
                                {returnReceiptData.items.some(it => it.photoUrl) && (
                                    <div style={{ marginTop: '20px' }}>
                                        <h3 style={{ borderBottom: '1px solid #ccc' }}>DAMAGE EVIDENCE</h3>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '10px' }}>
                                            {returnReceiptData.items.filter(it => it.photoUrl).map((it, idx) => (
                                                <div key={idx} style={{ textAlign: 'center' }}>
                                                    <img
                                                        src={it.photoUrl.startsWith('http') ? it.photoUrl : `${api.defaults.baseURL}/damaged/${it.photoUrl.split('/').pop()}`}
                                                        alt="Damage"
                                                        style={{ width: '280px', height: '210px', objectFit: 'cover', border: '1px solid black', borderRadius: '4px' }}
                                                    />
                                                    <p style={{ fontSize: '0.85rem', marginTop: '5px' }}><strong>DAMAGED:</strong> {it.name}<br/><small>{it.id}</small></p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Signature section removed as requested */}
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '30px' }}>
                                <button className="btn" style={{ flex: 1, background: '#64748b' }} onClick={() => setShowReturnReceipt(false)}>Close</button>
                                <button className="btn" style={{ flex: 1, background: 'var(--accent)' }} onClick={() => {
                                    handlePrint();
                                }}>Print Slip</button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* â”€â”€ TRANSACTION DETAILS MODAL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
            {
                showDetailModal && detailBatch && (
                    <div className="modal-overlay" style={{ background: 'rgba(15, 23, 42, 0.95)' }}>
                        <div className="card" style={{ maxWidth: '700px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
                                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <Eye color="var(--accent)" size={24} /> Transaction Details
                                </h3>
                                <button onClick={() => setShowDetailModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem' }}>
                                <div>
                                    <h4 style={{ color: 'var(--accent)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Officer Information</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{detailBatch.officer?.name}</div>
                                        <div style={{ color: 'var(--text-muted)' }}>Badge No: <strong>{detailBatch.officer?.badgeNumber}</strong></div>
                                        <div style={{ color: 'var(--text-muted)' }}>Unit/Dept: {detailBatch.officer?.unit || '-'}</div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <h4 style={{ color: 'var(--accent)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Transaction Meta</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div>Date: <strong>{new Date(detailBatch.issuedAt).toLocaleDateString('en-GB')}</strong></div>
                                        <div>Time: <strong>{new Date(detailBatch.issuedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></div>
                                        <div>Issuer: <strong>{detailBatch.issuerName || '-'}</strong></div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '2rem' }}>
                                <div style={{ background: '#f8fafc', padding: '1.25rem', borderRadius: '0.75rem' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>PURPOSE OF ISSUE</div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--primary)' }}>{detailBatch.items[0]?.purpose || 'Routine Duty'}</div>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem' }}>
                                    {detailBatch.items[0]?.personPhotoUrl && (
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>ISSUE PHOTO</div>
                                            <img 
                                                src={detailBatch.items[0].personPhotoUrl.startsWith('http') ? detailBatch.items[0].personPhotoUrl : `${api.defaults.baseURL}/files/${detailBatch.items[0].personPhotoUrl.split('/').pop()}`} 
                                                style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} 
                                                alt="Issue" 
                                            />
                                        </div>
                                    )}
                                    {detailBatch.items[0]?.returnPersonPhotoUrl && (
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>RETURN PHOTO</div>
                                            <img 
                                                src={detailBatch.items[0].returnPersonPhotoUrl.startsWith('http') ? detailBatch.items[0].returnPersonPhotoUrl : `${api.defaults.baseURL}/files/${detailBatch.items[0].returnPersonPhotoUrl.split('/').pop()}`} 
                                                style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', border: '1px solid #e2e8f0' }} 
                                                alt="Return" 
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <h4 style={{ color: 'var(--accent)', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>Issued Equipment</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {detailBatch.items.map((it, idx) => {
                                    // Extract spares for this specific item
                                    const targetBarcode = it.productItem?.barcode;
                                    const rawExtras = detailBatch.extraAccessories || '';
                                    const parts = rawExtras.split(' | ');
                                    const itemSparesString = parts.find(p => p.trim().startsWith(`${targetBarcode}:`));
                                    
                                    let sparesList = [];
                                    if (itemSparesString) {
                                        const content = itemSparesString.split(':').slice(1).join(':').trim();
                                        if (content.toLowerCase() !== 'none') {
                                            sparesList = content.split(',').map(s => s.trim()).filter(Boolean);
                                        }
                                    }

                                    return (
                                        <div key={idx} style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '0.75rem', padding: '1rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: '#92400e' }}>{it.productItem?.product?.name || 'Unknown Item'}</div>
                                                    <div style={{ fontSize: '0.85rem', color: '#b45309' }}>Barcode: {it.productItem?.barcode}</div>
                                                </div>
                                                <span className={`badge badge-${it.status === 'RETURNED' ? 'success' : 'warning'}`}>
                                                    {it.status}
                                                </span>
                                            </div>
                                            
                                            {sparesList.length > 0 && (
                                                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed #fcd34d' }}>
                                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#92400e', marginBottom: '0.3rem' }}>Spare Parts / Accessories:</div>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                                        {sparesList.map((s, si) => (
                                                            <span key={si} style={{ background: '#fef3c7', border: '1px solid #fcd34d', padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem' }}>{s}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {it.status === 'RETURNED' && (
                                                <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#059669', background: '#ecfdf5', padding: '0.4rem 0.75rem', borderRadius: '4px' }}>
                                                    Returned on {new Date(it.returnedAt).toLocaleDateString('en-GB')} at {new Date(it.returnedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    {it.missingSpares && it.missingSpares.toLowerCase() !== 'none' && (
                                                        <div style={{ color: '#b91c1c', fontWeight: 700, marginTop: '2px' }}>⚠️ Missing: {it.missingSpares}</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div style={{ marginTop: '2.5rem' }}>
                                <button className="btn" style={{ width: '100%', background: 'var(--primary)' }} onClick={() => setShowDetailModal(false)}>Close Overview</button>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* PASSWORD VERIFICATION MODAL */}
            <PasswordPromptModal
                isOpen={authPrompt.show}
                onClose={() => setAuthPrompt({ show: false, action: null })}
                onConfirm={() => {
                    if (authPrompt.action) authPrompt.action();
                    setAuthPrompt({ show: false, action: null });
                }}
                title="Verify Action"
                message="Please enter the admin password to delete this record."
            />

        </div >
    );
};

export default TransactionView;

