import { useEffect, useState } from 'react';
import { api } from '../data/api';
import FiltrosIncidencias from '../components/FiltrosIncidencias';
import './DashboardAdministracion.css';

const numero = valor => Number(valor).toLocaleString('es-CL');
function Barras({ titulo, filas }) {
  const maximo = Math.max(1, ...filas.map(f => Number(f.total)));
  return <section className="dash-tarjeta"><h2>{titulo}</h2>{!filas.length ? <p>Sin registros para estos filtros.</p> :
    <ul className="dash-barras">{filas.map((f, i) => <li key={i}>
      <div><span>{f.nombre}</span><strong>{numero(f.total)}</strong></div>
      <div className="dash-pista" aria-hidden="true"><span style={{ width: `${Number(f.total) / maximo * 100}%` }} /></div>
    </li>)}</ul>}</section>;
}
function Tendencia({ filas }) {
  const maximo = Math.max(1, ...filas.map(f => Number(f.total)));
  const fechas = filas.map(f => Date.parse(`${f.mes}-01T00:00:00Z`));
  const rango = (fechas.at(-1) - fechas[0]) || 1;
  const puntos = filas.map((f, i) => `${30 + (fechas[i] - fechas[0]) / rango * 640},${160 - Number(f.total) / maximo * 130}`);
  return <section className="dash-tarjeta"><h2>Incidencias por mes</h2>
    <p>Según la fecha de creación. La tabla muestra los meses con registros.</p>
    {!filas.length ? <p>Sin registros para estos filtros.</p> : <>
      <svg className="dash-linea" viewBox="0 0 700 190" role="img" aria-label="Tendencia mensual; valores en la tabla inferior">
        <line x1="30" y1="160" x2="670" y2="160" stroke="#cbd5e1" />
        <polyline points={puntos.join(' ')} fill="none" stroke="#2563eb" strokeWidth="3" />
        {puntos.map((p, i) => <circle key={i} cx={p.split(',')[0]} cy={p.split(',')[1]} r="5" fill="#2563eb" />)}
        <text x="30" y="185">{filas[0].mes}</text><text x="670" y="185" textAnchor="end">{filas.at(-1).mes}</text>
        <text x="4" y="30">{maximo}</text><text x="8" y="160">0</text>
      </svg>
      <div className="dash-tabla dash-meses"><table><thead><tr><th>Mes</th><th>Incidencias</th></tr></thead>
        <tbody>{filas.map(f => <tr key={f.mes}><td>{f.mes}</td><td>{numero(f.total)}</td></tr>)}</tbody></table></div>
    </>}
  </section>;
}

export default function DashboardAdministracion() {
  const [filtros, setFiltros] = useState({});
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [recarga, setRecarga] = useState(0);
  const consulta = new URLSearchParams(filtros).toString();
  useEffect(() => {
    let vigente = true;
    api(`/admin/dashboard?${consulta}`).then(r => {
      if (vigente) { setDatos(r); setError(''); setCargando(false); }
    }).catch(e => { if (vigente) { setError(e.message); setDatos(null); setCargando(false); } });
    return () => { vigente = false; };
  }, [consulta, recarga]);
  const resumen = datos?.resumen;
  return <div className="dash-admin">
    <FiltrosIncidencias incluirOrden={false} valor={filtros} aplicar={f => { setCargando(true); setError(''); setFiltros(f); setRecarga(n => n + 1); }} />
    <div className="dash-herramientas"><p>Incidencias técnicas de todos los usuarios. Todos los indicadores respetan los filtros aplicados.</p>
      <button type="button" disabled={cargando} onClick={() => { setCargando(true); setRecarga(n => n + 1); }}>Actualizar datos</button>
      {!cargando && datos && <a className="dash-exportar" href={`/api/admin/dashboard/exportar?${consulta}`}>Descargar CSV para Power BI</a>}
    </div>
    {error && <p role="alert" className="ad-error">{error}</p>}
    {cargando ? <p role="status">Consultando estadísticas…</p> : datos && <>
      <p className="dash-fecha">Actualizado: {new Date(datos.actualizado).toLocaleString('es-CL')}</p>
      <section className="dash-resumen" aria-label="Indicadores de incidencias">
        {[['Total', resumen.total], ['Pendientes', resumen.pendientes], ['Asignadas', resumen.asignadas],
          ['En proceso', resumen.en_proceso], ['Resueltas', resumen.resueltas], ['Cerradas', resumen.cerradas],
          ['Anuladas', resumen.anuladas]].map(([nombre, valor]) => <article key={nombre}><span>{nombre}</span><strong>{numero(valor)}</strong></article>)}
        <article><span>Tiempo promedio de resolución</span><strong>{resumen.horas_resolucion === null ? 'Sin datos' : `${numero(resumen.horas_resolucion)} h`}</strong>
          <small>{numero(resumen.muestra_resolucion)} incidencias con fechas válidas</small></article>
      </section>
      {Number(resumen.total) === 0 && <p role="status">No hay incidencias que coincidan con los filtros.</p>}
      <Tendencia filas={datos.meses} />
      <div className="dash-columnas"><Barras titulo="10 salas con más incidencias" filas={datos.salas} /><Barras titulo="Incidencias por categoría" filas={datos.categorias} /></div>
      <section className="dash-tarjeta"><h2>Distribución por responsable</h2><p>Asignación actual de las incidencias. Finalizadas: resueltas o cerradas.</p>
        {!datos.tecnicos.length ? <p>Sin registros.</p> : <div className="dash-tabla"><table><thead><tr><th>Responsable</th><th>Total</th><th>Abiertas</th><th>Finalizadas</th></tr></thead>
          <tbody>{datos.tecnicos.map((t, i) => <tr key={i}><td>{t.nombre}</td><td>{numero(t.total)}</td><td>{numero(t.abiertas)}</td><td>{numero(t.finalizadas)}</td></tr>)}</tbody></table></div>}
      </section>
      <Barras titulo="10 profesores con más reportes" filas={datos.profesores} />
      <section className="dash-tarjeta"><h2>Últimas 10 incidencias del período filtrado</h2>
        {!datos.recientes.length ? <p>Sin registros.</p> : <div className="dash-tabla"><table><thead><tr><th>Código</th><th>Título</th><th>Fecha</th><th>Sala</th><th>Categoría</th><th>Estado</th></tr></thead>
          <tbody>{datos.recientes.map(i => <tr key={i.id_incidencia}><td>INC-{String(i.id_incidencia).padStart(4,'0')}</td><td>{i.titulo}</td><td>{i.fecha}</td><td>{i.sala}</td><td>{i.categoria}</td><td>{i.estado}</td></tr>)}</tbody></table></div>}
      </section>
      <section className="dash-tarjeta"><h2>Cómo interpretar los datos</h2>
        <p>El tiempo promedio usa incidencias actualmente resueltas o cerradas, cuya fecha de cierre sea igual o posterior a la creación. Si falta la fecha de cierre, no se incluye en el promedio.</p>
        <p>La cantidad de reportes refleja uso de la aplicación. No mide el desempeño de profesores ni considera cuántas horas se ocupa cada sala. Las emergencias de Enfermería se registran por separado.</p>
        <p>El CSV contiene todas las incidencias que coinciden con los filtros, con identificadores, ubicación y fechas para relacionar y analizar los datos en Power BI.</p>
      </section>
    </>}
  </div>;
}
