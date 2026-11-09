import { useEffect, useRef, useState } from 'react';
import { api } from '../data/api';
import './TurnoTecnico.css';

export default function TurnoTecnico() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [revision, setRevision] = useState(0);
  const bloqueo = useRef(false);
  useEffect(() => {
    let vigente = true, consultando = false;
    async function consultar() {
      if (consultando || bloqueo.current) return;
      consultando = true;
      try { const r = await api('/turno'); if (vigente && !bloqueo.current) { setDatos(r); setError(''); } }
      catch (e) { if (vigente) { setDatos(null); setError(e.message); } }
      finally { consultando = false; }
    }
    void consultar();
    const timer = setInterval(consultar, 15000);
    window.addEventListener('focus', consultar);
    return () => { vigente = false; clearInterval(timer); window.removeEventListener('focus', consultar); };
  }, [revision]);
  async function cambiar() {
    if (bloqueo.current || !datos) return;
    bloqueo.current = true; setOcupado(true); setError('');
    try { await api('/turno', { en_turno: !datos.en_turno }); setDatos(null); }
    catch (e) { setDatos(null); setError(`${e.message} Actualiza para comprobar el estado del turno.`); }
    finally { bloqueo.current = false; setOcupado(false); setRevision(n => n + 1); }
  }
  return <section className={`sigi-turno ${datos?.en_turno ? 'sigi-turno-activo' : ''}`} aria-label="Mi turno técnico" aria-busy={ocupado}>
    <div><strong>{datos ? datos.en_turno ? 'En turno' : 'Fuera de turno' : 'Comprobando turno…'}</strong>
      <p>{datos?.en_turno ? `Turno iniciado: ${datos.turno.inicio}. Vence: ${datos.turno.vence}.` : 'Cuando comiences tu jornada, pulsa Iniciar turno. Puedes consultar el panel estando fuera de turno.'}</p>
      <small>Salir de turno conserva tu cuenta habilitada y las tareas asignadas. Cerrar sesión finaliza tu turno en todos tus dispositivos. Si cierras el navegador, vence como máximo a las 8 horas de iniciarlo.</small>
      {error && <p role="alert">{error}</p>}
    </div>
    {datos ? <button type="button" disabled={ocupado} onClick={cambiar}>{ocupado ? 'Guardando…' : datos.en_turno ? 'Finalizar turno' : 'Iniciar turno'}</button>
      : <button type="button" disabled={ocupado} onClick={() => setRevision(n => n + 1)}>Actualizar turno</button>}
  </section>;
}
