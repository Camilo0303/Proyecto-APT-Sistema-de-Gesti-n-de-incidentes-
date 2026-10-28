import { useEffect, useRef, useState } from 'react';
import { obtenerUsuario } from '../data/sesion';
import { api } from '../data/api';
import './Cetecom.css';

const filtrosIniciales = {
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

export default function Cetecom() {
  const usuario = obtenerUsuario();

  const [filtros, setFiltros] = useState(filtrosIniciales);
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
    setFiltros({ ...filtrosIniciales });
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

        <section className="ct-stats" aria-label="Resumen general">
          {tarjetas.map(([titulo, cantidad, color]) => (
            <article className={`ct-stat ct-stat-${color}`} key={titulo}>
              <span>{titulo}</span>
              <strong>{cargando || error ? '—' : cantidad ?? 0}</strong>
              <small>Resumen general</small>
            </article>
          ))}
        </section>

        <section className="ct-panel" aria-labelledby="ct-title">
          <div className="ct-panel-heading">
            <div>
              <span className="ct-section-label">BANDEJA DE TRABAJO</span>
              <h2 id="ct-title">Incidencias</h2>
              <p>
                Filtra por prioridad o estado para encontrar lo que necesitas.
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

          <form className="ct-filters" onSubmit={buscar}>
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
          </form>

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
        </section>

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