import React, { useEffect, useRef, useState, useCallback } from 'react';
import { T } from '../../utils/helpers';
import { Icon } from './UI';

/**
 * QRScanner
 * Props:
 *   onScan(decodedText)  – called once per unique scan
 *   onError(err)         – called on camera/permission error
 *   active               – boolean; starts/stops scanner
 *   label                – optional helper text shown under frame
 */
export default function QRScanner({ onScan, onError, active = true, label }) {
  const containerRef = useRef(null);
  const scannerRef = useRef(null);
  const lastScan = useRef('');
  const [status, setStatus] = useState('idle'); // idle | loading | running | error
  const [errorMsg, setErrorMsg] = useState('');
  const [torchOn, setTorchOn] = useState(false);

  const stop = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (_) {}
      scannerRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    if (!containerRef.current) return;
    setStatus('loading');
    lastScan.current = '';

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const id = 'qr-scanner-' + Date.now();
      containerRef.current.id = id;

      const scanner = new Html5Qrcode(id, { verbose: false });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 }, aspectRatio: 1.0 },
        (text) => {
          if (text === lastScan.current) return; // debounce identical scans
          lastScan.current = text;
          onScan(text);
        },
        () => {} // ignore per-frame decode errors
      );

      setStatus('running');
    } catch (err) {
      const msg = err?.message || String(err);
      const friendly =
        msg.includes('Permission') || msg.includes('permission')
          ? 'Camera permission denied. Please allow camera access and try again.'
          : msg.includes('NotFound') || msg.includes('device')
          ? 'No camera found on this device.'
          : 'Could not start camera: ' + msg;
      setErrorMsg(friendly);
      setStatus('error');
      onError?.(friendly);
    }
  }, [onScan, onError]);

  useEffect(() => {
    if (active) {
      start();
    } else {
      stop();
      setStatus('idle');
    }
    return () => { stop(); };
  }, [active, start, stop]);

  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    try {
      const newState = !torchOn;
      await scannerRef.current.applyVideoConstraints({ advanced: [{ torch: newState }] });
      setTorchOn(newState);
    } catch (_) {}
  };

  return (
    <div style={{ position: 'relative', width: '100%', maxWidth: 340, margin: '0 auto' }}>
      {/* Scanner frame */}
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '1',
        background: T.bg0, borderRadius: 12, overflow: 'hidden',
        border: `2px solid ${status === 'running' ? T.accent : T.border}`,
        boxShadow: status === 'running' ? `0 0 24px ${T.accent}33` : 'none',
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}>
        {/* Corner brackets */}
        {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(corner => {
          const [v, h] = corner.split('-');
          return (
            <div key={corner} style={{
              position: 'absolute',
              [v]: 12, [h]: 12,
              width: 28, height: 28,
              borderTop: v === 'top' ? `3px solid ${T.accent}` : 'none',
              borderBottom: v === 'bottom' ? `3px solid ${T.accent}` : 'none',
              borderLeft: h === 'left' ? `3px solid ${T.accent}` : 'none',
              borderRight: h === 'right' ? `3px solid ${T.accent}` : 'none',
              borderRadius: corner === 'top-left' ? '4px 0 0 0' : corner === 'top-right' ? '0 4px 0 0' : corner === 'bottom-left' ? '0 0 0 4px' : '0 0 4px 0',
              zIndex: 10, pointerEvents: 'none',
            }} />
          );
        })}

        {/* Scan line animation */}
        {status === 'running' && (
          <div style={{
            position: 'absolute', left: '10%', right: '10%', height: 2,
            background: `linear-gradient(90deg, transparent, ${T.accent}, transparent)`,
            zIndex: 10, pointerEvents: 'none',
            animation: 'scanLine 2s ease-in-out infinite',
          }} />
        )}

        {/* html5-qrcode mounts here */}
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

        {/* Loading overlay */}
        {status === 'loading' && (
          <div style={{
            position: 'absolute', inset: 0, background: T.bg0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
          }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${T.border}`, borderTop: `2px solid ${T.accent}`, animation: 'spin 0.7s linear infinite' }} />
            <span style={{ fontFamily: T.mono, fontSize: 11, color: T.muted, letterSpacing: '0.12em' }}>STARTING CAMERA...</span>
          </div>
        )}

        {/* Error overlay */}
        {status === 'error' && (
          <div style={{
            position: 'absolute', inset: 0, background: T.bg0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, textAlign: 'center',
          }}>
            <Icon name="warning" size={36} color={T.red} />
            <div style={{ color: T.red, fontSize: 13, lineHeight: 1.6 }}>{errorMsg}</div>
            <button onClick={start} style={{
              background: T.accent, color: '#fff', border: 'none', padding: '8px 20px', borderRadius: 4,
              fontFamily: T.display, fontWeight: 700, fontSize: 12, letterSpacing: '0.06em', cursor: 'pointer',
            }}>RETRY</button>
          </div>
        )}

        {/* Idle overlay */}
        {status === 'idle' && (
          <div style={{
            position: 'absolute', inset: 0, background: T.bg0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
            <Icon name="qr" size={48} color={T.muted} />
            <span style={{ fontFamily: T.mono, fontSize: 10, color: T.muted, letterSpacing: '0.14em' }}>SCANNER PAUSED</span>
          </div>
        )}
      </div>

      {/* Torch button */}
      {status === 'running' && (
        <button onClick={toggleTorch} style={{
          position: 'absolute', bottom: 14, right: 14, zIndex: 20,
          background: torchOn ? T.amber : `${T.bg1}cc`,
          border: `1px solid ${torchOn ? T.amber : T.border}`,
          color: torchOn ? '#000' : T.sub,
          width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', backdropFilter: 'blur(4px)',
        }} title="Toggle torch">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/>
          </svg>
        </button>
      )}

      {/* Label */}
      {label && status === 'running' && (
        <p style={{ textAlign: 'center', color: T.sub, fontSize: 12, marginTop: 10, fontFamily: T.mono, letterSpacing: '0.08em' }}>
          {label}
        </p>
      )}

      <style>{`
        @keyframes scanLine {
          0%   { top: 15%; }
          50%  { top: 80%; }
          100% { top: 15%; }
        }
        /* Hide html5-qrcode's own UI chrome */
        #${containerRef.current?.id} img,
        #${containerRef.current?.id} select,
        #${containerRef.current?.id} button { display: none !important; }
        #${containerRef.current?.id} video { width: 100% !important; height: 100% !important; object-fit: cover; }
      `}</style>
    </div>
  );
}
