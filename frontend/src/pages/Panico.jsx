import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../data/api';
import BotonMantener from '../components/BotonMantener';
import './Emergencias.css';

export default function Panico() {
  const [params] = useSearchParams();
  const codigo = params.get('qr') || '';
  const [ubicacion, setUbicacion] = useState(null);
  const [tipos, setTipos] = useState([]);
  const [tipo, setTipo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [mias, setMias] = useState([]);
  const [errorEstado, setErrorEstado] = useState('');
  const bloqueo = useRef(false);
  const sala = ubicacion?.codigo === codigo ? ubicacion.sala : null;

  useEffect(() => {
    let vigente = true;
    if (!codigo) return () => { vigente = false; };
    Promise.all([
      api('/emergencias/catalogos'),
      api(`/incidencias/sala-qr?codigo=${encodeURIComponent(codigo)}`),
    ]).then(([catalogos, respuesta]) => {
      if (vigente) { setTipos(catalogos.tipos); setUbicacion({ codigo, sala: respuesta.sala }); }
    }).catch(e => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [codigo]);

  useEffect(() => {
    if (!resultado) return;
    let vigente = true, ocupado = false;
    async function consultar() {
      if (ocupado) return;
      ocupado = true;
      try { const r = await api('/emergencias/mias'); if (vigente) { setMias(r.alertas); setErrorEstado(''); } }
      catch (e) { if (vigente) setErrorEstado(e.message); }
      finally { ocupado = false; }
    }
    void consultar();
    const timer = setInterval(consultar, 5000);
    return () => { vigente = false; clearInterval(timer); };
  }, [resultado]);

  async function enviar() {
    if (bloqueo.current || !sala || !tipos.some(t => String(t.id_tipo_emergencia) === tipo)) return;
    bloqueo.current = true; setEnviando(true); setError('');
    try { setResultado(await api('/emergencias', { codigo_qr: codigo, id_tipo_emergencia: Number(tipo), descripcion: descripcion.trim() })); }
    catch (err) { setError(err.message); }
    finally { bloqueo.current = false; setEnviando(false); }
  }
  const seguimiento = mias.find(a => a.id_alerta === resultado?.id_alerta);
  return <main className="emergencias panico-rapido">
    <Link className="panico-volver" to="/profesor">← Volver al inicio</Link>
    <header className="panico-encabezado"><span className="panico-simbolo" aria-hidden="true">!</span><h1>Alerta a Enfermería</h1><p>Escanea la sala, elige lo ocurrido y envía la alerta.</p></header>
    {error && <p role="alert" className="em-error">{error}</p>}
    {resultado ? <section className="panico-resultado" role="status">
      <span className="panico-completado" aria-hidden="true">✓</span>
      <h2>Alerta #{resultado.id_alerta} registrada</h2><p>{resultado.mensaje}</p>
      <p>Estado: <strong>{seguimiento?.estado || 'Consultando…'}</strong></p>
      {seguimiento?.responsable && <p>Atiende: {seguimiento.responsable}</p>}
      {errorEstado && <p role="alert">No se pudo actualizar el estado: {errorEstado}</p>}
      <p className="panico-nota">El registro no confirma por sí solo que Enfermería la haya visto.</p>
    </section> : <>
      <ol className="panico-pasos" aria-label="Pasos para enviar una alerta"><li className={!sala ? 'panico-paso-activo' : ''}>1. Escanear sala</li><li className={sala ? 'panico-paso-activo' : ''}>2. Elegir y alertar</li></ol>
      {!sala ? <section className="panico-escanear">
        <h2>Primero identifica la sala</h2><p>El QR permite enviar la ubicación correcta a Enfermería.</p>
        {codigo && !error && <p role="status">Comprobando la sala…</p>}
        <Link className="panico-escanear-boton" to="/escanear?destino=emergencia">Escanear QR de la sala</Link>
        <p className="panico-nota">No se envía ninguna alerta al escanear.</p>
      </section> : <form onSubmit={e => e.preventDefault()}>
        <section className="panico-sala"><span>SALA IDENTIFICADA</span><h2>{sala.codigo_sala || sala.nombre}</h2><p>{sala.nombre}</p><strong>Edificio {sala.edificio} · Piso {sala.piso}</strong>{!enviando && <Link to="/escanear?destino=emergencia">Cambiar sala</Link>}</section>
        <label htmlFor="panico-tipo">¿Qué está ocurriendo?</label>
        <select id="panico-tipo" required value={tipo} onChange={e => setTipo(e.target.value)} disabled={enviando}>
          <option value="">Selecciona la emergencia</option>{tipos.map(t => <option key={t.id_tipo_emergencia} value={t.id_tipo_emergencia}>{t.nombre}</option>)}
        </select>
        <label htmlFor="panico-descripcion">Descripción de la emergencia <small>— opcional</small></label>
        <textarea id="panico-descripcion" maxLength={255} rows={3} value={descripcion} onChange={e => setDescripcion(e.target.value)} disabled={enviando} placeholder="Si puedes, añade información breve para Enfermería." aria-describedby="panico-descripcion-ayuda" />
        <p id="panico-descripcion-ayuda" className="panico-descripcion-ayuda">No necesitas completarla para enviar. {descripcion.length}/255 caracteres.</p>
        <BotonMantener key={`${codigo}-${tipo}`} deshabilitado={!tipo || enviando} enviando={enviando} activar={enviar} />
      </form>}
    </>}
    <footer className="panico-protocolo">Alerta interna. No contacta servicios externos. Sigue los protocolos de emergencia de la institución.</footer>
  </main>;
}
