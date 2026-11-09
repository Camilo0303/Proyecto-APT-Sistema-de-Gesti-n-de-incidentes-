import { useEffect, useState } from 'react';
import { api } from '../data/api';

export default function TecnicosEnTurno() {
  const [tecnicos, setTecnicos] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let vigente = true, consultando = false;
    async function cargar() {
      if (consultando) return;
      consultando = true;
      try {
        const r = await api('/admin/tecnicos-en-turno');
        if (!Array.isArray(r.tecnicos)) throw new Error('No se pudo obtener la lista de turnos.');
        if (vigente) { setTecnicos(r.tecnicos); setError(''); }
      } catch (e) { if (vigente) setError(e.message); }
      finally { consultando = false; }
    }
    void cargar();
    const timer = setInterval(cargar, 15000);
    window.addEventListener('focus', cargar);
    return () => { vigente = false; clearInterval(timer); window.removeEventListener('focus', cargar); };
  }, [revision]);
  return <section className="ad-tarjeta" aria-labelledby="ad-turnos-titulo">
    <div className="ad-titulo"><div><h2 id="ad-turnos-titulo">Técnicos en turno</h2>
      <p>Cuentas habilitadas con un turno iniciado, sin finalizar y sin vencer.</p>
    </div><button type="button" onClick={() => setRevision(n => n + 1)}>Actualizar turnos</button></div>
    {error && <p className="ad-error" role="alert">{error} {tecnicos !== null && 'La lista visible puede estar desactualizada.'}</p>}
    {tecnicos === null ? <p className="ad-vacio" role="status">{error ? 'No hay información de turnos disponible. Pulsa Actualizar turnos para reintentar.' : 'Consultando técnicos…'}</p>
      : <><p className="ad-total" role="status">{error ? 'Último resultado: ' : ''}{tecnicos.length} {tecnicos.length === 1 ? 'técnico en turno' : 'técnicos en turno'}</p>
        {tecnicos.length === 0 ? <p className="ad-vacio">No hay técnicos en turno. Cada técnico debe pulsar Iniciar turno desde su panel.</p>
          : <div className="ad-tabla-contenedor"><table><thead><tr><th scope="col">Técnico</th><th scope="col">Correo</th><th scope="col">Estado</th><th scope="col">Inicio del turno</th><th scope="col">Vencimiento</th></tr></thead>
            <tbody>{tecnicos.map(t => <tr key={t.id_usuario}><td><strong>{t.nombre} {t.apellido}</strong><small>Usuario #{t.id_usuario}</small></td><td>{t.correo}</td><td><span className="ad-activo">{error ? 'Por verificar' : 'En turno'}</span></td><td>{t.inicio}</td><td>{t.vence}</td></tr>)}</tbody></table></div>}
      </>}
  </section>;
}
