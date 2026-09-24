import './Home.css';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  obtenerUsuario,
  cerrarSesion,
  olvidarSesion,
} from '../data/sesion';

const tarjetas = [
  ['total', 'Total incidencias', '📋', 'blue'],
  ['pendientes', 'Pendientes', '⏳', 'yellow'],
  ['asignadas', 'Asignadas', '👤', 'blue'],
  ['en_proceso', 'En proceso', '⚙️', 'purple'],
  ['resueltas', 'Resueltas', '✅', 'green'],
  ['cerradas', 'Cerradas', '📁', 'green'],
];

function Home() {
  const navigate = useNavigate();

  const [usuario, setUsuario] = useState(() => obtenerUsuario());
  const [menu, setMenu] = useState(false);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    if (!usuario) return;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let activo = true;

    async function cargarDashboard() {
      setCargando(true);
      setError('');

      try {
        const respuesta = await fetch('/api/dashboard', {
          credentials: 'same-origin',
          signal: controller.signal,
          cache: 'no-store',
        });

        if (respuesta.status === 401) {
          if (activo) {
            olvidarSesion();
            setUsuario(null);
            setDatos(null);
            setMenu(false);
          }

          return;
        }

        if (!respuesta.ok) {
          throw new Error('No se pudo consultar el dashboard.');
        }

        const resultado = await respuesta.json();

        if (activo) {
          setDatos(resultado);
        }
      } catch (err) {
        if (activo) {
          setError(
            err.name === 'AbortError'
              ? 'El servidor tardó demasiado. Intenta actualizar los datos.'
              : 'No se pudieron obtener los datos. Revisa que el backend y MySQL estén encendidos.'
          );
        }
      } finally {
        clearTimeout(timeout);

        if (activo) {
          setCargando(false);
        }
      }
    }

    cargarDashboard();

    return () => {
      activo = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [recarga, usuario]);

  function irAReportar() {
    navigate(usuario ? '/reportar' : '/login');
  }

  async function salir() {
    if (cerrando) return;

    setCerrando(true);
    setError('');

    try {
      await cerrarSesion();

      // Recarga el inicio después de cerrar la sesión.
      window.location.replace('/');
    } catch (err) {
      setError(
        err.message || 'No se pudo cerrar sesión. Intenta nuevamente.'
      );
      setCerrando(false);
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">🏫</div>

          <div>
            <h2>SIGI</h2>
            <p>Gestión incidencias</p>
          </div>
        </div>

        <nav>
          <button
            className="active"
            onClick={() => navigate('/')}
          >
            🏠 Dashboard
          </button>

          <button onClick={() => navigate('/escanear')}>
            📷 Escanear QR
          </button>

          <button onClick={irAReportar}>
            ➕ Reportar incidencia
          </button>

          <button
            onClick={() =>
              navigate(usuario ? '/historial' : '/login')
            }
          >
            📋 Mis reportes
          </button>

          <button
            onClick={() =>
              navigate(usuario ? '/panico' : '/login')
            }
          >
            🚨 Botón de pánico
          </button>
        </nav>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <h1>Sistema de Gestión de Incidencias</h1>
            <p>Control de infraestructura y equipamiento</p>
          </div>

          <div className="profile">
            {usuario ? (
              <>
                <button
                  onClick={() => setMenu(!menu)}
                  aria-expanded={menu}
                  disabled={cerrando}
                >
                  👤 {usuario.nombre} ▼
                </button>

                {menu && (
                  <div className="dropdown">
                    <p>
                      <strong>Rol:</strong>
                      <br />
                      {usuario.rol}
                    </p>

                    <button
                      onClick={salir}
                      disabled={cerrando}
                    >
                      {cerrando
                        ? 'Cerrando sesión...'
                        : 'Cerrar sesión'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <button
                className="login-button"
                onClick={() => navigate('/login')}
              >
                🔐 Iniciar sesión
              </button>
            )}
          </div>
        </header>

        <section className="welcome-card">
          <div>
            <h2>
              {usuario
                ? `Bienvenido, ${usuario.nombre} 👋`
                : 'Bienvenido al sistema 👋'}
            </h2>

            <p>
              Reporta problemas del establecimiento de forma
              rápida y segura.
            </p>
          </div>

          <button onClick={irAReportar}>
            + Nueva incidencia
          </button>
        </section>

        {error && (
          <div className="dashboard-error" role="alert">
            {error}
          </div>
        )}

        {!usuario ? (
          <section className="panel dashboard-panel">
            <div className="empty-box">
              <span>🏫</span>

              <h2>Sistema de Gestión de Incidencias</h2>

              <p>
                Inicia sesión para consultar tus reportes
                y registrar nuevas incidencias.
              </p>

              <button
                className="dashboard-refresh"
                onClick={() => navigate('/login')}
              >
                Iniciar sesión
              </button>

              <p>¿Todavía no tienes una cuenta?</p>

              <button
                className="dashboard-refresh"
                onClick={() => navigate('/registro')}
              >
                Registrarse
              </button>
            </div>
          </section>
        ) : (
          <>
            <div className="dashboard-toolbar">
              <p>Resumen general del establecimiento</p>

              <button
                className="dashboard-refresh"
                disabled={cargando || cerrando}
                onClick={() =>
                  setRecarga(valor => valor + 1)
                }
              >
                {cargando
                  ? 'Cargando...'
                  : 'Actualizar datos'}
              </button>
            </div>

            {cargando ? (
              <p role="status">
                Consultando incidencias...
              </p>
            ) : (
              !error &&
              datos && (
                <>
                  <section className="stats">
                    {tarjetas.map(
                      ([campo, texto, icono, color]) => (
                        <div
                          className={`stat ${color}`}
                          key={campo}
                        >
                          <span>{icono}</span>
                          <h2>{datos.resumen[campo]}</h2>
                          <p>{texto}</p>
                        </div>
                      )
                    )}
                  </section>

                  <section className="panel dashboard-panel">
                    <h2>Últimos reportes</h2>

                    {datos.ultimosReportes.length === 0 ? (
                      <div className="empty-box">
                        <span>📂</span>
                        <h3>
                          No existen incidencias registradas
                        </h3>
                        <p>
                          Los reportes aparecerán cuando
                          sean creados.
                        </p>
                      </div>
                    ) : (
                      <div className="dashboard-table-wrapper">
                        <table className="dashboard-table">
                          <thead>
                            <tr>
                              {[
                                'Código',
                                'Título',
                                'Sala',
                                'Categoría',
                                'Prioridad',
                                'Estado',
                                'Responsable',
                                'Fecha',
                              ].map(titulo => (
                                <th
                                  scope="col"
                                  key={titulo}
                                >
                                  {titulo}
                                </th>
                              ))}
                            </tr>
                          </thead>

                          <tbody>
                            {datos.ultimosReportes.map(
                              reporte => (
                                <tr
                                  key={reporte.id_incidencia}
                                >
                                  <td>
                                    INC-
                                    {String(
                                      reporte.id_incidencia
                                    ).padStart(4, '0')}
                                  </td>
                                  <td>{reporte.titulo}</td>
                                  <td>{reporte.sala}</td>
                                  <td>{reporte.categoria}</td>
                                  <td>{reporte.prioridad}</td>
                                  <td>{reporte.estado}</td>
                                  <td>{reporte.responsable}</td>
                                  <td>{reporte.fecha}</td>
                                </tr>
                              )
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                </>
              )
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default Home;