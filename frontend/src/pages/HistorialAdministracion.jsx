import { useEffect, useState } from 'react';
import { api } from '../data/api';
import FiltrosIncidencias from '../components/FiltrosIncidencias';
import './HistorialAdministracion.css';

const ticket = id => `INC-${String(id).padStart(4, '0')}`;
const movimientos = { CREACION: 'Creación', ATENCION: 'Atención', ASIGNACION: 'Asignación', RESOLUCION: 'Resolución', ANULACION: 'Anulación', CAMBIO_ESTADO: 'Cambio de estado', CIERRE: 'Cierre' };

export default function HistorialAdministracion() {
  const [pagina, setPagina] = useState(1);
  const [filtros, setFiltros] = useState({});
  const [recarga, setRecarga] = useState(0);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [id, setId] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [errorDetalle, setErrorDetalle] = useState('');
  useEffect(() => {
    let vigente = true;
    api(`/admin/incidencias?${new URLSearchParams({ ...filtros, pagina })}`).then(r => {
      if (vigente) setDatos(r);
    }).catch(e => { if (vigente) setError(e.message); });
    return () => { vigente = false; };
  }, [pagina, recarga, filtros]);
  useEffect(() => {
    if (id === null) return;
    let vigente = true;
    api(`/admin/incidencias/${id}/historial`).then(r => {
      if (vigente) setDetalle(r);
    }).catch(e => { if (vigente) setErrorDetalle(e.message); });
    return () => { vigente = false; };
  }, [id, recarga]);
  function actualizar() {
    setDatos(null); setDetalle(null); setError(''); setErrorDetalle('');
    setRecarga(r => r + 1);
  }
  function cambiarPagina(p) {
    setPagina(p); setDatos(null); setError(''); setId(null); setDetalle(null); setErrorDetalle('');
  }
  return <section className="ad-historial" aria-labelledby="historial-admin-titulo">
    <div className="ad-historial-cabecera">
      <div><h2 id="historial-admin-titulo">Historial de todas las incidencias</h2>
        <p>Reportes de todos los usuarios, incluidos los resueltos, cerrados y anulados.</p></div>
      <button type="button" onClick={actualizar}>Actualizar incidencias</button>
    </div>
    <FiltrosIncidencias valor={filtros} aplicar={f => { setFiltros(f); cambiarPagina(1); }} />
    {error ? <p role="alert">{error}</p> : !datos ? <p role="status">Cargando incidencias...</p> : <>
      <p>{datos.total} incidencias · Página {datos.pagina} de {datos.paginas}</p>
      {datos.incidencias.length === 0 ? <p>No hay incidencias para los filtros seleccionados.</p> : <div className="ad-historial-tabla">
        <table><thead><tr><th>Incidencia</th><th>Sala</th><th>Reportada por</th><th>Estado / prioridad</th><th>Responsable</th><th>Fecha</th><th>Seguimiento</th></tr></thead>
          <tbody>{datos.incidencias.map(i => <tr key={i.id_incidencia}>
            <td><strong>{ticket(i.id_incidencia)}</strong><br />{i.titulo}</td>
            <td>{i.sala || 'Sin información'}</td><td>{i.creador || 'Sin información'}</td>
            <td>{i.estado || 'Sin información'}<br />{i.prioridad}</td><td>{i.responsable}</td><td>{i.fecha}</td>
            <td><button type="button" onClick={() => { setId(i.id_incidencia); setDetalle(null); setErrorDetalle(''); }} disabled={id === i.id_incidencia}>Ver historial</button></td>
          </tr>)}</tbody>
        </table>
      </div>}
      <div className="ad-historial-controles">
        <button type="button" disabled={datos.pagina <= 1} onClick={() => cambiarPagina(datos.pagina - 1)}>Anterior</button>
        <button type="button" disabled={datos.pagina >= datos.paginas} onClick={() => cambiarPagina(datos.pagina + 1)}>Siguiente</button>
      </div>
    </>}
    {id !== null && <section className="ad-historial-detalle" aria-live="polite">
      <div className="ad-historial-cabecera"><h3>Seguimiento de {ticket(id)}</h3>
        <button type="button" onClick={() => { setId(null); setDetalle(null); }}>Cerrar historial</button></div>
      {errorDetalle ? <p role="alert">{errorDetalle}</p> : !detalle ? <p role="status">Cargando movimientos...</p> : <>
        <h4>{detalle.incidencia.titulo}</h4><p>{detalle.incidencia.descripcion}</p>
        {detalle.historial.length === 0 ? <p>Esta incidencia no tiene movimientos registrados.</p> : <ol className="ad-historial-movimientos">
          {detalle.historial.map(h => <li key={h.id_historial}>
            <strong>{movimientos[h.tipo_movimiento] || h.tipo_movimiento}</strong>
            <p>{h.fecha} · {h.realizado_por || 'Usuario sin información'}</p>
            {(h.estado_anterior || h.estado_nuevo) && <p>Estado: {h.estado_anterior || 'Inicial'} → {h.estado_nuevo || 'Sin cambio'}</p>}
            {h.responsable_asignado && <p>Responsable: {h.responsable_asignado}</p>}
            {h.comentario && <p>{h.comentario}</p>}
          </li>)}
        </ol>}
      </>}
    </section>}
  </section>;
}
