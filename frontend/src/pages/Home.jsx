import './Home.css';
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  obtenerUsuario,
  cerrarSesion,
  olvidarSesion,
} from '../data/sesion';

const indicadores = [
  ['total', 'Total de reportes', 'azul'],
  ['pendientes', 'Pendientes', 'ambar'],
  ['asignadas', 'Asignadas', 'azul'],
  ['en_proceso', 'En proceso', 'violeta'],
  ['resueltas', 'Resueltas', 'verde'],
  ['cerradas', 'Cerradas', 'gris'],
];

function colorEstado(estado) {
  switch (estado) {
    case 'Pendiente':
      return 'ambar';
    case 'Asignada':
      return 'azul';
    case 'En proceso':
      return 'violeta';
    case 'Resuelta':
      return 'verde';
    default:
      return 'gris';
  }
}

export default function Home() {
  const [usuario, setUsuario] = useState(() => obtenerUsuario());
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState('');
  const [errorSesion, setErrorSesion] = useState('');
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    if (!usuario) return;

    let activo = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    async function cargar() {
      setCargando(true);
      setError('');
      setDatos(null);

      try {
        const respuesta = await fetch('/api/dashboard', {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: controller.signal,
        });

        if (respuesta.status === 401) {
          if (activo) {
            olvidarSesion();
            setUsuario(null);
          }
          return;
        }

        if (!respuesta.ok) {
          throw new Error('No se pudieron consultar las incidencias.');
        }

        const resultado = await respuesta.json();

        if (
          !resultado.resumen ||
          !Array.isArray(resultado.ultimosReportes)
        ) {
          throw new Error('La respuesta del servidor no es válida.');
        }

        if (activo) setDatos(resultado);
      } catch (err) {
        if (activo) {
          setError(
            err.name === 'AbortError'
              ? 'La consulta tardó demasiado. Presiona Actualizar para intentar nuevamente.'
              : 'No se pudieron cargar tus reportes. Comprueba que el backend y MySQL estén funcionando.'
          );
        }
      } finally {
        clearTimeout(timeout);
        if (activo) setCargando(false);
      }
    }

    cargar();

    return () => {
      activo = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [usuario, recarga]);

  async function salir() {
    if (cerrando) return;

    setCerrando(true);
    setErrorSesion('');

    try {
      await cerrarSesion();
      window.location.replace('/');
    } catch (err) {
      setErrorSesion(
        err.message || 'No se pudo cerrar sesión. Intenta nuevamente.'
      );
      setCerrando(false);
    }
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  const nombreCompleto = [usuario.nombre, usuario.apellido]
    .filter(Boolean)
    .join(' ');

  const inicial = (usuario.nombre || 'P').charAt(0).toUpperCase();

  return (
    <div className="profesor-dashboard" lang="es" translate="no">
      <a className="pd-saltar" href="#pd-contenido">
        Saltar al contenido
      </a>

      <aside className="pd-sidebar">
        <Link to="/profesor" className="pd-marca">
          <span className="pd-logo" aria-hidden="true">S</span>
          <span>
            <strong>SIGI</strong>
            <small>Gestión de incidencias</small>
          </span>
        </Link>

        <p className="pd-menu-titulo">ESPACIO DEL PROFESOR</p>

        <nav className="pd-nav" aria-label="Menú del profesor">
          <Link to="/profesor" className="pd-nav-activo" aria-current="page">
            <span aria-hidden="true">⌂</span>
            Mi panel
          </Link>

          <Link to="/reportar">
            <span aria-hidden="true">＋</span>
            Reportar incidencia
          </Link>

          <Link to="/escanear">
            <span aria-hidden="true">▦</span>
            Escanear QR
          </Link>

          <Link to="/historial">
            <span aria-hidden="true">☷</span>
            Mis reportes
          </Link>

          <Link to="/panico">
            <span aria-hidden="true">!</span>
            Emergencia
            <small>Demo</small>
          </Link>
        </nav>

        <div className="pd-sidebar-pie">
          <span className="pd-avatar" aria-hidden="true">{inicial}</span>
          <div>
            <strong>{nombreCompleto}</strong>
            <small>{usuario.rol || 'Profesor'}</small>
          </div>
        </div>
      </aside>

      <main className="pd-main" id="pd-contenido">
        <header className="pd-cabecera">
          <div>
            <p className="pd-etiqueta">MI ESPACIO</p>
            <h1>Panel del profesor</h1>
            <p>Reporta un problema y sigue su avance desde aquí.</p>
          </div>

          <button
            type="button"
            className="pd-boton pd-boton-secundario"
            onClick={salir}
            disabled={cerrando}
          >
            {cerrando ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </header>

        {errorSesion && (
          <div className="pd-error" role="alert">{errorSesion}</div>
        )}

        <section className="pd-bienvenida">
          <div>
            <span className="pd-bienvenida-etiqueta">JUNTOS CUIDAMOS EL ESTABLECIMIENTO</span>
            <h2>Hola, {usuario.nombre}</h2>
            <p>
              ¿Encontraste un problema en una sala o equipo?
              Registra una incidencia para que pueda ser atendida.
            </p>
          </div>

          <Link to="/reportar" className="pd-boton pd-boton-blanco">
            <span aria-hidden="true">＋</span>
            Nueva incidencia
          </Link>
        </section>

        <section className="pd-accesos" aria-label="Accesos rápidos">
          <Link to="/reportar" className="pd-acceso">
            <span className="pd-acceso-icono pd-azul" aria-hidden="true">＋</span>
            <div>
              <h2>Reportar un problema</h2>
              <p>Describe lo ocurrido e indica su ubicación.</p>
            </div>
            <span className="pd-flecha" aria-hidden="true">→</span>
          </Link>

          <Link to="/escanear" className="pd-acceso">
            <span className="pd-acceso-icono pd-violeta" aria-hidden="true">▦</span>
            <div>
              <h2>Escanear código QR</h2>
              <p>Abre la cámara para leer un código.</p>
            </div>
            <span className="pd-flecha" aria-hidden="true">→</span>
          </Link>

          <Link to="/historial" className="pd-acceso">
            <span className="pd-acceso-icono pd-verde" aria-hidden="true">☷</span>
            <div>
              <h2>Consultar mis reportes</h2>
              <p>Revisa el estado de tus incidencias.</p>
            </div>
            <span className="pd-flecha" aria-hidden="true">→</span>
          </Link>
        </section>

        <section className="pd-resumen" aria-labelledby="pd-resumen-titulo">
          <div className="pd-seccion-cabecera">
            <div>
              <h2 id="pd-resumen-titulo">Mis incidencias</h2>
              <p>Resumen de los reportes que has registrado.</p>
            </div>

            <button
              type="button"
              className="pd-boton pd-boton-secundario"
              disabled={cargando}
              onClick={() => setRecarga(valor => valor + 1)}
            >
              {cargando ? 'Cargando…' : 'Actualizar'}
            </button>
          </div>

          {error && (
            <div className="pd-error" role="alert">{error}</div>
          )}

          {cargando && (
            <p className="pd-cargando" role="status">
              Consultando tus incidencias…
            </p>
          )}

          <div className="pd-estadisticas" aria-busy={cargando}>
            {indicadores.map(([campo, texto, color]) => (
              <article className="pd-estadistica" key={campo}>
                <span className={`pd-punto pd-${color}`} aria-hidden="true" />
                <p>{texto}</p>
                <strong>
                  {datos ? datos.resumen[campo] ?? 0 : '—'}
                </strong>
              </article>
            ))}
          </div>
        </section>

        <section className="pd-reportes" aria-labelledby="pd-reportes-titulo">
          <div className="pd-seccion-cabecera pd-reportes-cabecera">
            <div>
              <h2 id="pd-reportes-titulo">Últimos reportes</h2>
              <p>Consulta el avance y el responsable de cada incidencia.</p>
            </div>
            <Link to="/historial" className="pd-enlace">Ver mis reportes →</Link>
          </div>

          {cargando ? (
            <div className="pd-vacio">Cargando reportes…</div>
          ) : !datos ? (
            <div className="pd-vacio">
              <h3>No pudimos consultar tus reportes</h3>
              <p>Presiona Actualizar para volver a intentarlo.</p>
            </div>
          ) : datos.ultimosReportes.length === 0 ? (
            <div className="pd-vacio">
              <span className="pd-vacio-icono" aria-hidden="true">☷</span>
              <h3>Todavía no tienes incidencias</h3>
              <p>Cuando registres un problema, podrás seguir su avance aquí.</p>
              <Link to="/reportar" className="pd-boton pd-boton-primario">
                Crear mi primer reporte
              </Link>
            </div>
          ) : (
            <div
              className="pd-tabla-contenedor"
              tabIndex={0}
              role="region"
              aria-label="Últimas incidencias; desplaza horizontalmente para ver todas las columnas"
            >
              <table className="pd-tabla">
                <thead>
                  <tr>
                    <th scope="col">Incidencia</th>
                    <th scope="col">Ubicación</th>
                    <th scope="col">Prioridad</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Responsable</th>
                    <th scope="col">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.ultimosReportes.map(reporte => (
                    <tr key={reporte.id_incidencia}>
                      <td>
                        <span className="pd-codigo">
                          INC-{String(reporte.id_incidencia).padStart(4, '0')}
                        </span>
                        <strong className="pd-titulo-reporte">{reporte.titulo}</strong>
                        <small className="pd-categoria">{reporte.categoria || 'Sin categoría'}</small>
                      </td>
                      <td>{reporte.sala || 'Sin ubicación'}</td>
                      <td>
                        <span
                          className={`pd-insignia ${
                            reporte.prioridad === 'Alta'
                              ? 'pd-rojo'
                              : reporte.prioridad === 'Media'
                                ? 'pd-ambar'
                                : 'pd-gris'
                          }`}
                        >
                          {reporte.prioridad || 'Sin prioridad'}
                        </span>
                      </td>
                      <td>
                        <span className={`pd-insignia pd-${colorEstado(reporte.estado)}`}>
                          {reporte.estado || 'Sin estado'}
                        </span>
                      </td>
                      <td>{reporte.responsable || 'Sin asignar'}</td>
                      <td className="pd-fecha">{reporte.fecha || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="pd-emergencia" aria-labelledby="pd-emergencia-titulo">
          <span className="pd-emergencia-icono" aria-hidden="true">!</span>
          <div>
            <h2 id="pd-emergencia-titulo">Botón de emergencia</h2>
            <p>
              En preparación: todavía no envía alertas a enfermería.
              Ante una emergencia real, utiliza el protocolo del establecimiento.
            </p>
          </div>
          <Link to="/panico" className="pd-boton pd-boton-emergencia">
            Ver demostración
          </Link>
        </section>

        <footer className="pd-pie">
          SIGI · Sistema de Gestión de Incidencias
        </footer>
      </main>
    </div>
  );
}