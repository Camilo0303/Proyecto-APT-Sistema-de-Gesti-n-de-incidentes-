import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { api } from '../data/api';
import './EscanearQR.css';
export default function EscanearQR() {
  const navigate = useNavigate();
  const [parametros] = useSearchParams();
  const emergencia = parametros.get('destino') === 'emergencia';
  const [error, setError] = useState('');
  const [validando, setValidando] = useState(false);
  useEffect(() => {
    let vigente = true, ocupado = false, ultimo = '', momento = 0;
    let limpieza;
    const scanner = new Html5QrcodeScanner('reader', {
      fps: 10, qrbox: { width: 220, height: 220 },
      videoConstraints: { facingMode: 'environment' }, rememberLastUsedCamera: false,
    }, false);
    const limpiar = () => limpieza ||= scanner.clear().catch(() => {});
    scanner.render(async codigo => {
      if (!vigente || ocupado || (codigo === ultimo && Date.now() - momento < 4000)) return;
      ultimo = codigo; momento = Date.now(); ocupado = true;
      setError(''); setValidando(true);
      try {
        const { sala } = await api(`/incidencias/sala-qr?codigo=${encodeURIComponent(codigo)}`);
        if (!vigente) return;
        await limpiar();
        if (vigente) navigate(emergencia
          ? `/panico?qr=${encodeURIComponent(codigo)}`
          : `/reportar?sala=${sala.id_sala}`);
      } catch (err) { if (vigente) setError(err.message); }
      finally { ocupado = false; if (vigente) setValidando(false); }
    }, () => {});
    return () => { vigente = false; void limpiar(); };
  }, [navigate, emergencia]);
  return <main className="qr-page"><section className="qr-header">
    <h1>Escanear código QR</h1>
    <p>Apunta al código de la sala. {emergencia ? 'Se abrirá el botón de alerta con esta ubicación.' : 'El reporte se abrirá con su ubicación seleccionada.'}</p>
  </section><section className="qr-container">
    <p>Permite el acceso a la cámara. También puedes cargar una imagen del QR.</p>
    {!window.isSecureContext && <p role="alert">La cámara requiere HTTPS o localhost. Usa la carga de imagen en esta conexión.</p>}
    <div className="scanner-box"><div id="reader" /></div>
    {validando && <p role="status">Comprobando la sala...</p>}
    {error && <p role="alert">{error} Puedes escanear otro código.</p>}
    <p>Si rechazaste el permiso o no hay cámara, revisa los permisos del navegador o carga una imagen.</p>
    <button type="button" onClick={() => navigate('/profesor')}>Volver al inicio</button>
  </section></main>;
}

