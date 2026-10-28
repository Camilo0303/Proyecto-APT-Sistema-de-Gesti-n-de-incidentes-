import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../data/api';
import { obtenerUsuario } from '../data/sesion';
import useSonidoAlertas from '../hooks/useSonidoAlertas';
import './Enfermeria.css';

const numeroAlerta = id => `ALT-${String(id).padStart(4, '0')}`;

function TarjetaAlerta({ alerta, usuario, ocupado, cambiar }) {
  const pendiente = alerta.estado === 'Pendiente';
  const propia = Number(alerta.atendida_por) === Number(usuario?.id_usuario);
  return <article className={`enf-alerta ${pendiente ? 'enf-alerta-pendiente' : ''}`}>
    <div className="enf-alerta-cabecera">
      <span className="enf-ticket">{numeroAlerta(alerta.id_alerta)}</span>
      <span className={`enf-estado ${pendiente ? 'enf-estado-rojo' : 'enf-estado-azul'}`}>{pendiente ? 'Pendiente de atención' : 'En atención'}</span>
    </div>
    <h3>{alerta.tipo}</h3>
    <div className="enf-ubicacion">
      <span className="enf-etiqueta">UBICACIÓN DE LA EMERGENCIA</span>
      <strong>{alerta.codigo_sala || alerta.sala}</strong>
      {alerta.codigo_sala && alerta.sala !== alerta.codigo_sala && <p>{alerta.sala}</p>}
      <div className="enf-ubicacion-datos"><span>Edificio <b>{alerta.edificio}</b></span><span>Piso <b>{alerta.piso}</b></span></div>
    </div>
    <dl className="enf-datos"><div><dt>Reportada por</dt><dd>{alerta.profesor}</dd></div><div><dt>Fecha y hora</dt><dd>{alerta.fecha}</dd></div></dl>
    {alerta.descripcion && <p className="enf-descripcion">{alerta.descripcion}</p>}
    <footer className="enf-alerta-pie">
      <p>{pendiente ? 'Sin responsable asignado' : <>Atiende: <strong>{alerta.responsable || 'Sin información'}</strong></>}</p>
      {pendiente ? <button className="enf-boton enf-boton-rojo" disabled={ocupado} onClick={() => cambiar(alerta, 'En atención')}>Tomar atención</button>
        : propia ? <button className="enf-boton enf-boton-primario" disabled={ocupado} onClick={() => cambiar(alerta, 'Atendida')}>Marcar como atendida</button>
          : <span className="enf-nota">En atención por otra persona</span>}
    </footer>
  </article>;
}

export default function Enfermeria() {
  const [datos, setDatos] = useState(null);
  const [errorConsulta, setErrorConsulta] = useState('');
  const [errorAccion, setErrorAccion] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [recarga, setRecarga] = useState(0);
  const [hora, setHora] = useState('');
  const [parametros, setParametros] = useSearchParams();
  const solicitada = parametros.get('seccion');
  const vista = ['pendientes', 'atencion', 'historial'].includes(solicitada) ? solicitada : 'panel';
  const [busqueda, setBusqueda] = useState('');
  const [sinPulso, setSinPulso] = useState(false);
  const usuario = obtenerUsuario();
  const sonido = useSonidoAlertas(datos?.alertas);

  useEffect(() => {
    let vigente = true, consultando = false;
    async function cargar() {
      if (consultando) return;
      consultando = true;
      try {
        const r = await api('/emergencias');
        if (vigente) { setDatos(r); setErrorConsulta(''); setHora(new Date().toLocaleTimeString('es-CL')); }
      } catch (e) { if (vigente) setErrorConsulta(e.message); }
      finally { consultando = false; }
    }
    void cargar();
    const timer = setInterval(cargar, 5000);
    const foco = () => void cargar();
    window.addEventListener('focus', foco);
    return () => { vigente = false; clearInterval(timer); window.removeEventListener('focus', foco); };
  }, [recarga]);

  async function cambiar(alerta, estado) {
    if (ocupado) return;
    setOcupado(true); setErrorAccion('');
    try { await api(`/emergencias/${alerta.id_alerta}/estado`, { estado }); setRecarga(n => n + 1); }
    catch (e) { setErrorAccion(e.message); }
    finally { setOcupado(false); }
  }
  function ir(destino) { setParametros(destino === 'panel' ? {} : { seccion: destino }); setBusqueda(''); }
  const pendientes = datos?.alertas.filter(a => a.estado === 'Pendiente') || [];
  const enAtencion = datos?.alertas.filter(a => a.estado === 'En atención') || [];
  const texto = busqueda.trim().toLocaleLowerCase();
  const coincide = a => [numeroAlerta(a.id_alerta), a.tipo, a.sala, a.codigo_sala, a.edificio, a.piso, a.profesor, a.responsable].join(' ').toLocaleLowerCase().includes(texto);
  const pendientesVisibles = pendientes.filter(coincide);
  const atencionVisibles = enAtencion.filter(coincide);
  const atendidas = datos?.atendidas.filter(coincide) || [];
  const titulos = { panel: 'Alertas activas', pendientes: 'Pendientes de atención', atencion: 'En atención', historial: 'Alertas atendidas' };
  function grupo(titulo, lista, rojo) {
    return <section className="enf-grupo"><div className="enf-grupo-titulo"><h3>{titulo}</h3><span className={rojo ? 'enf-contador-rojo' : 'enf-contador'}>{lista.length}</span></div>
      {lista.length ? <div className="enf-alertas-grid">{lista.map(a => <TarjetaAlerta key={a.id_alerta} alerta={a} usuario={usuario} ocupado={ocupado} cambiar={cambiar} />)}</div>
        : <div className="enf-vacio"><strong>{texto ? 'No hay coincidencias' : rojo ? 'Sin alertas pendientes' : 'Sin alertas en atención'}</strong><p>{texto ? 'Prueba otra sala, profesor o número de alerta.' : 'Las nuevas alertas se mostrarán automáticamente en este panel.'}</p></div>}
    </section>;
  }

  return <div className={`enfermeria-dashboard${sinPulso ? ' enf-sin-pulso' : ''}`} lang="es">
    <main className="enf-main" id="enf-contenido">
      <section className="enf-bienvenida"><div><p className="enf-etiqueta">ATENCIÓN Y SEGUIMIENTO</p><h2>Hola, {usuario?.nombre}</h2><p>La ubicación y el estado de cada emergencia, en un solo lugar.</p></div><span className="enf-bienvenida-cruz" aria-hidden="true">+</span></section>
      <div className="enf-actualizacion"><span className={errorConsulta ? 'enf-conexion enf-conexion-error' : 'enf-conexion'}><i aria-hidden="true" />{errorConsulta ? 'Sin actualización' : hora ? 'Actualización automática cada 5 s' : 'Conectando con el servidor…'}</span><span>Última consulta: {hora || 'Pendiente'}</span><button className="enf-boton" onClick={() => setRecarga(n => n + 1)}>Actualizar alertas</button></div>
      <div className="enf-sonido"><button className="enf-boton" type="button" onClick={sonido.alternar} disabled={sonido.ocupado} aria-pressed={sonido.activo}>{sonido.ocupado ? 'Activando sonido…' : sonido.activo ? 'Silenciar avisos' : 'Activar avisos sonoros'}</button><p>{sonido.activo ? 'Sonido activado: un aviso por cada nueva alerta pendiente.' : 'Sonido desactivado. Actívalo para recibir avisos de nuevas alertas.'}<small>Al activar escucharás una prueba. Mantén el panel abierto y el volumen del dispositivo encendido.</small></p></div>
      {sonido.error && <p className="enf-error" role="alert">{sonido.error}</p>}
      {errorConsulta && <p role="alert" className="enf-error">No se pudo actualizar: {errorConsulta}. Los datos visibles pueden estar desactualizados.</p>}
      {errorAccion && <p role="alert" className="enf-error">{errorAccion}</p>}
      <section className="enf-resumen" aria-label="Resumen de alertas"><button className="enf-resumen-rojo" onClick={() => ir('pendientes')}><span>Pendientes</span><strong>{datos ? pendientes.length : '—'}</strong><small>Requieren atención</small></button><button onClick={() => ir('atencion')}><span>En atención</span><strong>{datos ? enAtencion.length : '—'}</strong><small>Con responsable asignado</small></button><button onClick={() => ir('historial')}><span>Atendidas recientes</span><strong>{datos ? datos.atendidas.length : '—'}</strong><small>Últimas 20 registradas</small></button></section>
      <div aria-live="polite">{pendientes.length > 0 && <section className="enf-aviso-urgente"><span className="enf-aviso-icono" aria-hidden="true">!</span><div><h2>{pendientes.length === 1 ? 'Hay una alerta urgente pendiente' : `Hay ${pendientes.length} alertas urgentes pendientes`}</h2><p>Revisa la sala y toma la atención para informar al profesor.</p></div><div className="enf-aviso-acciones"><button className="enf-boton" onClick={() => ir('pendientes')}>Ver pendientes</button><button className="enf-pulso-control" aria-pressed={sinPulso} onClick={() => setSinPulso(p => !p)}>{sinPulso ? 'Activar pulso' : 'Detener animación'}</button></div></section>}</div>
      <section className="enf-contenido"><div className="enf-seccion-cabecera"><div><h2>{titulos[vista]}</h2><p>{vista === 'historial' ? 'Las últimas 20 alertas finalizadas. No representa todo el historial.' : 'Las pendientes se muestran primero, desde la más antigua.'}</p></div><label className="enf-buscador">Buscar alerta<input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Sala, profesor o ALT-0001" type="search" /></label></div>
        {!datos ? <div className="enf-vacio" role="status">{errorConsulta ? 'No hay datos disponibles. Intenta actualizar.' : 'Cargando alertas…'}</div> : vista === 'historial' ? <div className="enf-historial">{atendidas.length ? atendidas.map(a => <article key={a.id_alerta}><div><span className="enf-ticket">{numeroAlerta(a.id_alerta)}</span><h3>{a.codigo_sala || a.sala}</h3><p>{a.tipo} · Edificio {a.edificio} · Piso {a.piso}</p></div><div><span className="enf-estado enf-estado-verde">Atendida</span><p>Reportada: {a.fecha}</p><p>Atendió: {a.responsable || 'Sin información'}</p></div></article>) : <div className="enf-vacio"><strong>{texto ? 'No hay coincidencias' : 'Todavía no hay alertas atendidas'}</strong></div>}</div>
          : <>{(vista === 'panel' || vista === 'pendientes') && grupo('Pendientes de atención', pendientesVisibles, true)}{(vista === 'panel' || vista === 'atencion') && grupo('En atención', atencionVisibles, false)}</>}
      </section>
      <footer className="enf-pie">Alertas internas del establecimiento. Mantén el panel abierto para recibir actualizaciones. No reemplaza los protocolos de emergencia.</footer>
    </main>
  </div>;
}


