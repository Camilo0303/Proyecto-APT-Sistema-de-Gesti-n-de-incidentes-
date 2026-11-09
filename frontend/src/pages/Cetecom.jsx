import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { obtenerUsuario } from '../data/sesion';
import { api } from '../data/api';
import FiltrosIncidencias from '../components/FiltrosIncidencias';
import './Cetecom.css';

const filtrosIniciales = {
  desde: '', hasta: '', sala: '', categoria: '',
  buscar: '',
  prioridad: '',
  estado: 'activas',
  orden: 'prioridad',
  pagina: 1,
};

const estados = [
  'Pendiente',
  'Asignada',
  'En proceso',
  'Resuelta',
  'Cerrada',
  'Anulada',
];

const acciones = {
  atender: {
    titulo: 'Atender incidencia',
    boton: 'Confirmar atención',
    texto: 'Quedarás como responsable y la incidencia pasará a En atención.',
  },
  resolver: {
    titulo: 'Resolver incidencia',
    boton: 'Confirmar resolución',
    texto: 'Describe qué se hizo para solucionar el problema.',
  },
  anular: {
    titulo: 'Anular incidencia',
    boton: 'Confirmar anulación',
    texto: 'Indica por qué se anula. El reporte conservará su historial.',
  },
};

function codigo(id) {
  return `INC-${String(id).padStart(4, '0')}`;
}

function nombreEstado(estado) {
  return estado === 'En proceso' ? 'En atención' : estado;
}

function clasePrioridad(prioridad) {
  return {
    Crítica: 'critica',
    Alta: 'alta',
    Media: 'media',
    Baja: 'baja',
  }[prioridad] || 'neutra';
}

function claseEstado(estado) {
  return {
    Pendiente: 'pendiente',
    Asignada: 'asignada',
    'En proceso': 'atencion',
    Resuelta: 'resuelta',
    Cerrada: 'cerrada',
    Anulada: 'anulada',
  }[estado] || 'neutra';
}

const seccionesTecnico = [
  { id: 'activas', titulo: 'Incidencias activas', estado: 'activas', texto: 'Revisa los reportes pendientes, asignados y en atención.', icono: '☷' },
  { id: 'pendientes', titulo: 'Pendientes', estado: 'Pendiente', texto: 'Consulta los problemas que aún esperan atención.', icono: '!' },
  { id: 'atencion', titulo: 'En atención', estado: 'En proceso', texto: 'Revisa las incidencias que se están atendiendo.', icono: '+' },
  { id: 'historial', titulo: 'Historial de incidencias', estado: 'todas', texto: 'Consulta todos los estados, incluidos los resueltos y cerrados.', icono: '≡' },
];

export default function Cetecom() {
  const [parametros] = useSearchParams();
  const usuario = obtenerUsuario();
  const seccion = seccionesTecnico.find(s => s.id === parametros.get('seccion'));
  const especial = parametros.get('seccion');
  if (seccion || ['buscar','resumen'].includes(especial)) return <PanelCetecom key={seccion?.id || especial} seccion={seccion ? 'inicio' : especial} estadoInicial={seccion?.estado} tituloSeccion={seccion?.titulo || (especial === 'buscar' ? 'Filtrar incidencias' : 'Resumen de reportes')} />;
  return <main className="ct-page" lang="es"><div className="ct-content">
    <header className="ct-header"><div><span className="ct-eyebrow">CETECOM / TÉCNICO</span>
      <h1>Hola, {usuario?.nombre || 'técnico'}</h1><p>Organiza la atención de los problemas reportados en la institución.</p></div></header>
    <section className="ct-menu-inicio" aria-labelledby="ct-menu-titulo"><h2 id="ct-menu-titulo">Tu espacio de trabajo</h2>
      <nav className="ct-accesos" aria-label="Accesos del técnico">{[...seccionesTecnico, {id:'buscar',titulo:'Filtrar incidencias',texto:'Busca por fecha, sala y categoría.',icono:'⌕'}, {id:'resumen',titulo:'Resumen de reportes',texto:'Consulta los totales por período.',icono:'▥'}].map(s => <Link key={s.id} to={`/cetecom?seccion=${s.id}`}>
        <span className="ct-acceso-icono" aria-hidden="true">{s.icono}</span><div><strong>{s.titulo}</strong><p>{s.texto}</p></div><span aria-hidden="true">→</span>
      </Link>)}</nav>
    </section>
  </div></main>;
}

function PanelCetecom({ seccion, estadoInicial, tituloSeccion }) {
  const usuario = obtenerUsuario();

  const iniciales = { ...filtrosIniciales, estado: estadoInicial || (seccion === 'inicio' ? 'activas' : 'todas') };
  const [filtros, setFiltros] = useState(iniciales);
  const [periodo, setPeriodo] = useState('todos');
  const encabezado = useRef(null);
  useEffect(() => {
    encabezado.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, []);

  function elegirPeriodo(valor) {
    setPeriodo(valor);
    if (valor === 'personalizado') return;
    const hoy = new Date();
    const fecha = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const inicio = valor === 'hoy' ? hoy : valor === 'mes' ? new Date(hoy.getFullYear(), hoy.getMonth(), 1) : new Date(hoy.getFullYear(), 0, 1);
    setCargando(true);
    setFiltros(actual => ({ ...actual, pagina: 1, desde: valor === 'todos' ? '' : fecha(inicio), hasta: valor === 'todos' ? '' : fecha(hoy) }));
  }
  const [textoBusqueda, setTextoBusqueda] = useState('');
  const [prioridades, setPrioridades] = useState([]);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [revision, setRevision] = useState(0);

  const [seleccion, setSeleccion] = useState(null);
  const [comentario, setComentario] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [errorAccion, setErrorAccion] = useState('');

  const dialogo = useRef(null);
  const envioEnCurso = useRef(false);

  useEffect(() => {
    let activo = true;

    async function cargar() {
      setCargando(true);
      setError('');

      const parametros = new URLSearchParams({
        desde: filtros.desde, hasta: filtros.hasta, sala: filtros.sala, categoria: filtros.categoria,
        buscar: filtros.buscar,
        prioridad: filtros.prioridad,
        estado: filtros.estado,
        orden: filtros.orden,
        pagina: String(filtros.pagina),
      });

      try {
        const [listado, catalogos] = await Promise.all([
          api(`/cetecom/incidencias?${parametros}`),
          api('/cetecom/catalogos'),
        ]);

        if (
          !Array.isArray(listado.incidencias) ||
          !Array.isArray(catalogos.prioridades) ||
          !listado.resumen
        ) {
          throw new Error('El servidor devolvió una respuesta incompleta.');
        }

        if (activo) {
          setDatos(listado);
          setPrioridades(catalogos.prioridades);
        }
      } catch (err) {
        if (activo) {
          setError(err.message || 'No se pudo cargar el panel.');
        }
      } finally {
        if (activo) setCargando(false);
      }
    }

    cargar();

    return () => {
      activo = false;
    };
  }, [filtros, revision]);

  useEffect(() => {
    if (seleccion && dialogo.current && !dialogo.current.open) {
      dialogo.current.showModal();
    }
  }, [seleccion]);

  function cambiarFiltro(nombre, valor) {
    setCargando(true);
    setFiltros(actual => ({
      ...actual,
      [nombre]: valor,
      pagina: 1,
    }));
  }

  function buscar(event) {
    event.preventDefault();
    cambiarFiltro('buscar', textoBusqueda.trim());
  }

  function limpiarFiltros() {
    setTextoBusqueda('');
    setCargando(true);
    setFiltros({ ...iniciales });
    setPeriodo('todos');
  }

  function actualizar() {
    setCargando(true);
    setRevision(valor => valor + 1);
  }

  function cambiarPagina(pagina) {
    setCargando(true);
    setFiltros(actual => ({ ...actual, pagina }));
  }

  function abrirAccion(item, accion) {
    setComentario('');
    setErrorAccion('');
    setSeleccion({ item, accion });
  }

  function cerrarDialogo() {
    if (envioEnCurso.current) return;

    dialogo.current?.close();
    setSeleccion(null);
    setErrorAccion('');
  }

  async function confirmarAccion(event) {
    event.preventDefault();

    if (!seleccion || envioEnCurso.current) return;

    const texto = comentario.trim();

    if (seleccion.accion !== 'atender' && texto.length < 5) {
      setErrorAccion('Escribe un comentario de al menos 5 caracteres.');
      return;
    }

    envioEnCurso.current = true;
    setGuardando(true);
    setErrorAccion('');
    setAviso('');

    try {
      const resultado = await api(
        `/cetecom/incidencias/${seleccion.item.id_incidencia}/accion`,
        {
          accion: seleccion.accion,
          comentario: texto,
        }
      );

      dialogo.current?.close();
      setSeleccion(null);
      setAviso(resultado.mensaje || 'Incidencia actualizada.');
      actualizar();
    } catch (err) {
      setErrorAccion(
        `${err.message || 'No se pudo confirmar la operación.'} ` +
        'Cierra esta ventana y actualiza el listado antes de volver a intentar.'
      );
    } finally {
      envioEnCurso.current = false;
      setGuardando(false);
    }
  }

  const resumen = datos?.resumen || {};

  const tarjetas = [
    ['Total de reportes', resumen.total, 'total'],
    ['Pendientes', resumen.pendientes, 'pendiente'],
    ['En atención', resumen.en_atencion, 'atencion'],
    ['Resueltas o cerradas', resumen.finalizadas, 'resuelta'],
    ['Anuladas', resumen.anuladas, 'anulada'],
  ];

  const desde = datos?.total
    ? (datos.pagina - 1) * datos.porPagina + 1
    : 0;

  const hasta = datos
    ? Math.min(datos.pagina * datos.porPagina, datos.total)
    : 0;

  return (
    <main className="ct-page" lang="es" translate="no">
      <div className="ct-content">
        <div className="ct-view-heading">
          <Link className="ct-volver-menu" to="/cetecom">← Volver a mi panel</Link>
          <h1 ref={encabezado} tabIndex={-1}>{tituloSeccion}</h1>
          <p>{seccion === 'resumen' ? 'Totales por fecha de creación. Incluye todos los estados.' : seccion === 'buscar' ? 'Consulta reportes por fecha, sala y categoría.' : 'Busca incidencias, selecciona su prioridad y gestiona su atención.'}</p>
        </div>
        {seccion === 'resumen' && <section className="ct-summary-filters" aria-label="Período del resumen">
          <div className="ct-periods">
            {[['hoy', 'Hoy'], ['mes', 'Este mes'], ['anio', 'Este año'], ['todos', 'Todo el historial'], ['personalizado', 'Rango personalizado']].map(([valor, titulo]) => <button key={valor} type="button" className={`ct-btn ${periodo === valor ? 'ct-primary' : ''}`} aria-pressed={periodo === valor} onClick={() => elegirPeriodo(valor)}>{titulo}</button>)}
          </div>
          <FiltrosIncidencias key={`${filtros.desde}-${filtros.hasta}-${filtros.sala}-${filtros.categoria}`} valor={filtros} incluirEstado={false} incluirOrden={false} aplicar={f => { setPeriodo('personalizado'); setCargando(true); setFiltros(actual => ({ ...actual, ...f, pagina: 1 })); }} />
          <p className="ct-range" role="status">{filtros.desde || filtros.hasta ? `Período aplicado: ${filtros.desde || 'inicio del historial'} → ${filtros.hasta || 'sin fecha final'}. Ambos días incluidos.` : 'Período aplicado: todo el historial.'}</p>
          <button type="button" className="ct-btn" disabled={cargando} onClick={actualizar}>Actualizar resumen</button>
        </section>}

        {aviso && (
          <div className="ct-notice" role="status">
            <span>{aviso}</span>
            <button
              type="button"
              className="ct-btn ct-small"
              onClick={() => setAviso('')}
              aria-label="Cerrar aviso"
            >
              Cerrar
            </button>
          </div>
        )}

        {seccion === 'resumen' && <section className="ct-stats" aria-label="Resumen del período" aria-busy={cargando}>
          {tarjetas.map(([titulo, cantidad, color]) => (
            <article className={`ct-stat ct-stat-${color}`} key={titulo}>
              <span>{titulo}</span>
              <strong>{cargando || error ? '—' : cantidad ?? 0}</strong>
              <small>Según el período y los filtros aplicados</small>
            </article>
          ))}
        </section>}
        {seccion === 'resumen' && error && <p className="ct-error-text" role="alert">{error}</p>}

        {seccion !== 'resumen' && <section className="ct-panel" aria-labelledby="ct-title">
          <div className="ct-panel-heading">
            <div>
              <span className="ct-section-label">BANDEJA DE TRABAJO</span>
              <h2 id="ct-title">{tituloSeccion}</h2>
              <p>
                {seccion === 'inicio' ? 'Busca por texto, prioridad o estado sin salir del listado.' : 'Los resultados corresponden a los filtros aplicados.'}
              </p>
            </div>

            <button
              type="button"
              className="ct-btn"
              onClick={actualizar}
              disabled={cargando}
            >
              {cargando ? 'Actualizando…' : 'Actualizar'}
            </button>
          </div>

          {seccion === 'buscar' && <>
          <FiltrosIncidencias key={`${filtros.desde}-${filtros.hasta}-${filtros.sala}-${filtros.categoria}`} valor={filtros} incluirEstado={false} incluirOrden={false} aplicar={f => { setCargando(true); setFiltros(actual => ({ ...actual, ...f, pagina: 1 })); }} />
          </>}
          {seccion === 'inicio' && <form className="ct-filters" onSubmit={buscar}>
            <label className="ct-search">
              Buscar incidencia
              <span className="ct-search-control">
                <input
                  type="search"
                  value={textoBusqueda}
                  onChange={event => setTextoBusqueda(event.target.value)}
                  maxLength={150}
                  placeholder="Código, problema, sala o responsable"
                />
                <button type="submit" className="ct-btn ct-primary">
                  Buscar
                </button>
              </span>
            </label>

            <label>
              Prioridad
              <select
                value={filtros.prioridad}
                onChange={event =>
                  cambiarFiltro('prioridad', event.target.value)
                }
              >
                <option value="">Todas las prioridades</option>
                {prioridades.map(item => (
                  <option key={item.id_prioridad} value={item.id_prioridad}>
                    {item.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Estado
              <select
                value={filtros.estado}
                onChange={event =>
                  cambiarFiltro('estado', event.target.value)
                }
              >
                <option value="activas">Activas</option>
                <option value="todas">Todos los estados</option>
                {estados.map(item => (
                  <option key={item} value={item}>
                    {nombreEstado(item)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Ordenar por
              <select
                value={filtros.orden}
                onChange={event =>
                  cambiarFiltro('orden', event.target.value)
                }
              >
                <option value="prioridad">Mayor prioridad primero</option>
                <option value="antiguas">Más antiguas primero</option>
                <option value="recientes">Más recientes primero</option>
              </select>
            </label>

            <div className="ct-filter-footer">
              <p>
                {filtros.estado === 'activas'
                  ? 'Activas: pendientes, asignadas y en atención.'
                  : 'Los resultados corresponden a los filtros seleccionados.'}
              </p>

              <button
                type="button"
                className="ct-btn ct-small"
                onClick={limpiarFiltros}
              >
                Restablecer filtros
              </button>
            </div>
          </form>}
          {!cargando && !error && datos && <p className="ct-result-count" role="status"><strong>{datos.total}</strong> coincidencias con los filtros aplicados</p>}
          <div aria-busy={cargando}>
            {cargando ? (
              <div className="ct-empty" role="status">
                <span className="ct-loader" aria-hidden="true" />
                <h3>Cargando incidencias</h3>
                <p>Estamos consultando los registros.</p>
              </div>
            ) : error ? (
              <div className="ct-empty">
                <h3>No pudimos cargar el panel</h3>
                <p className="ct-error-text" role="alert">{error}</p>
                <button
                  type="button"
                  className="ct-btn ct-primary"
                  onClick={actualizar}
                >
                  Reintentar
                </button>
              </div>
            ) : datos?.incidencias.length === 0 ? (
              <div className="ct-empty">
                <span className="ct-empty-icon" aria-hidden="true">✓</span>
                <h3>No hay incidencias para estos filtros</h3>
                <p>
                  Puedes consultar otros estados o restablecer los filtros.
                </p>
                <button
                  type="button"
                  className="ct-btn"
                  onClick={limpiarFiltros}
                >
                  Restablecer filtros
                </button>
              </div>
            ) : (
              <div className="ct-table-wrap">
                <table className="ct-table">
                  <thead>
                    <tr>
                      <th scope="col">Incidencia</th>
                      <th scope="col">Ubicación</th>
                      <th scope="col">Prioridad</th>
                      <th scope="col">Atención</th>
                      <th scope="col">Acciones</th>
                    </tr>
                  </thead>

                  <tbody>
                    {datos?.incidencias.map(item => {
                      const esMia =
                        Number(item.id_responsable) ===
                        Number(usuario?.id_usuario);

                      const disponible =
                        item.id_responsable == null || esMia;

                      const activa = [
                        'Pendiente',
                        'Asignada',
                        'En proceso',
                      ].includes(item.estado);

                      const puedeAtender =
                        disponible &&
                        ['Pendiente', 'Asignada'].includes(item.estado);

                      const puedeResolver =
                        esMia && item.estado === 'En proceso';

                      return (
                        <tr key={item.id_incidencia}>
                          <td className="ct-incident">
                            <span className="ct-code">
                              {codigo(item.id_incidencia)}
                            </span>

                            <h3>{item.titulo}</h3>
                            <p className="ct-date">{item.fecha}</p>

                            <details>
                              <summary>Ver descripción</summary>
                              <p className="ct-description">
                                {item.descripcion?.trim() ||
                                  'Sin descripción adicional.'}
                              </p>
                            </details>
                          </td>

                          <td data-label="Ubicación">
                            <strong>{item.sala || 'Sin sala'}</strong>
                            <span className="ct-secondary">
                              {item.categoria}
                            </span>
                          </td>

                          <td data-label="Prioridad">
                            <span
                              className={`ct-badge ct-${clasePrioridad(
                                item.prioridad
                              )}`}
                            >
                              {item.prioridad}
                            </span>
                          </td>

                          <td data-label="Atención">
                            <span
                              className={`ct-badge ct-${claseEstado(
                                item.estado
                              )}`}
                            >
                              {nombreEstado(item.estado)}
                            </span>

                            <span className="ct-secondary">
                              {esMia ? 'Asignada a ti' : item.responsable}
                            </span>
                          </td>

                          <td data-label="Acciones">
                            <div className="ct-row-actions">
                              {puedeAtender && (
                                <button
                                  type="button"
                                  className="ct-btn ct-primary"
                                  onClick={() => abrirAccion(item, 'atender')}
                                  aria-label={`Atender ${codigo(item.id_incidencia)}`}
                                >
                                  Atender
                                </button>
                              )}

                              {puedeResolver && (
                                <button
                                  type="button"
                                  className="ct-btn ct-success"
                                  onClick={() => abrirAccion(item, 'resolver')}
                                  aria-label={`Resolver ${codigo(item.id_incidencia)}`}
                                >
                                  Resolver
                                </button>
                              )}

                              {activa && disponible && (
                                <button
                                  type="button"
                                  className="ct-btn ct-danger-outline"
                                  onClick={() => abrirAccion(item, 'anular')}
                                  aria-label={`Anular ${codigo(item.id_incidencia)}`}
                                >
                                  Anular
                                </button>
                              )}

                              {!activa && (
                                <span className="ct-secondary">
                                  Reporte finalizado
                                </span>
                              )}

                              {activa && !disponible && (
                                <span className="ct-secondary">
                                  A cargo de otro técnico
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!cargando && !error && datos && (
            <nav className="ct-pagination" aria-label="Páginas de incidencias">
              <p role="status">
                <strong>{datos.total}</strong> coincidencias
                <span>Mostrando {desde}–{hasta}</span>
              </p>

              <div className="ct-page-controls">
                <button
                  type="button"
                  className="ct-btn"
                  disabled={datos.pagina <= 1}
                  onClick={() => cambiarPagina(datos.pagina - 1)}
                >
                  Anterior
                </button>

                <span>Página {datos.pagina} de {datos.paginas}</span>

                <button
                  type="button"
                  className="ct-btn"
                  disabled={datos.pagina >= datos.paginas}
                  onClick={() => cambiarPagina(datos.pagina + 1)}
                >
                  Siguiente
                </button>
              </div>
            </nav>
          )}
        </section>}

        <footer className="ct-footer">
          SIGI · Cada cambio de estado conserva su registro en el historial.
        </footer>
      </div>

      <dialog
        ref={dialogo}
        className="ct-dialog"
        aria-labelledby="ct-dialog-title"
        aria-describedby="ct-dialog-description"
        onCancel={event => {
          event.preventDefault();
          cerrarDialogo();
        }}
      >
        {seleccion && (
          <form onSubmit={confirmarAccion}>
            <span className="ct-code">
              {codigo(seleccion.item.id_incidencia)}
            </span>

            <h2 id="ct-dialog-title">
              {acciones[seleccion.accion].titulo}
            </h2>

            <p className="ct-dialog-incident">
              {seleccion.item.titulo}
            </p>

            <p id="ct-dialog-description">
              {acciones[seleccion.accion].texto}
            </p>

            {seleccion.accion !== 'atender' && (
              <label className="ct-comment-label">
                {seleccion.accion === 'resolver'
                  ? 'Solución realizada'
                  : 'Motivo de anulación'}

                <textarea
                  value={comentario}
                  onChange={event => setComentario(event.target.value)}
                  required
                  minLength={5}
                  maxLength={255}
                  rows={4}
                  disabled={guardando}
                  placeholder={
                    seleccion.accion === 'resolver'
                      ? 'Describe cómo se solucionó el problema…'
                      : 'Ejemplo: reporte duplicado o enviado por error…'
                  }
                />

                <small>{comentario.length}/255 caracteres</small>
              </label>
            )}

            {errorAccion && (
              <p className="ct-dialog-error" role="alert">
                {errorAccion}
              </p>
            )}

            <div className="ct-dialog-actions">
              <button
                type="button"
                className="ct-btn"
                onClick={cerrarDialogo}
                disabled={guardando}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className={`ct-btn ${
                  seleccion.accion === 'anular'
                    ? 'ct-danger'
                    : 'ct-primary'
                }`}
                disabled={guardando || Boolean(errorAccion)}
              >
                {guardando
                  ? 'Guardando…'
                  : acciones[seleccion.accion].boton}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </main>
  );
}
