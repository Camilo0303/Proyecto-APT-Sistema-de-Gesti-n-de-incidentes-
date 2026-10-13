import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../data/api';

export default function SalasQR() {
  const [salas, setSalas] = useState([]);
  const [id, setId] = useState('');
  const [imagen, setImagen] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const sala = salas.find(s => String(s.id_sala) === id);
  useEffect(() => {
    let vigente = true;
    api('/admin/salas-qr').then(r => { if (vigente) setSalas(r.salas); })
      .catch(e => { if (vigente) setError(e.message); })
      .finally(() => { if (vigente) setCargando(false); });
    return () => { vigente = false; };
  }, []);
  useEffect(() => {
    let vigente = true;
    if (sala?.codigo_qr) {
      QRCode.toDataURL(sala.codigo_qr, { width: 600, margin: 4, errorCorrectionLevel: 'M' })
        .then(url => { if (vigente) setImagen(url); })
        .catch(() => { if (vigente) setError('No se pudo generar la imagen QR.'); });
    }
    return () => { vigente = false; };
  }, [sala]);
  return <section style={{ marginTop: 24, padding: 24 }}>
    <h2>Códigos QR de salas</h2>
    <p>Selecciona una sala activa para descargar su código.</p>
    {error && <p role="alert">{error}</p>}
    {cargando ? <p role="status">Cargando salas...</p> : <>
      <label htmlFor="sala-qr-admin">Sala</label>
      <select id="sala-qr-admin" value={id} onChange={e => { setId(e.target.value); setImagen(''); setError(''); }} style={{ width: '100%', padding: 12 }}>
        <option value="">Selecciona una sala</option>
        {salas.map(s => <option key={s.id_sala} value={s.id_sala}>{s.edificio} / Piso {s.piso} / {s.nombre}</option>)}
      </select>
      {sala && <div>
        <h3>{sala.nombre}</h3>
        <p>Edificio {sala.edificio} · Piso {sala.piso} · ID {sala.id_sala}</p>
        {!sala.codigo_qr && <p role="alert">Esta sala no tiene código QR asignado en la base de datos.</p>}
        {imagen && <>
          <img src={imagen} alt={`Código QR de ${sala.nombre}`} style={{ width: 260, maxWidth: '100%' }} />
          <p><a href={imagen} download={`QR-${sala.codigo_sala || sala.id_sala}.png`}>Descargar QR de esta sala</a></p>
        </>}
      </div>}
    </>}
  </section>;
}
