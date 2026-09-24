import './Home.css';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { obtenerUsuario, cerrarSesion, olvidarSesion } from '../data/sesion';

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
  const [error, setError] = useState('');
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    if (!usuario) {
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let activo = true;
    async function cargarDashboard() {
      setCargando(true);
      setError('');
      try {
        const respuesta = await fetch('/api/dashboard', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (respuesta.status === 401) {
          if (activo) {
            olvidarSesion();
            setUsuario(null);
            navigate('/login');
          }
          return;
        }
        if (!respuesta.ok) throw new Error('Error al consultar el servidor');
        const resultado = await respuesta.json();
        if (activo) setDatos(resultado);
      } catch (err) {
        if (activo) setError(err.name === 'AbortError'
          ? 'El servidor tardó demasiado en responder. Intenta actualizar los datos.'
          : 'No se pudieron obtener los datos. Revisa que el backend y MySQL estén encendidos.');
      } finally {
        clearTimeout(timeout);
        if (activo) setCargando(false);
      }
    }
    cargarDashboard();
    return () => {
      activo = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [recarga, usuario, navigate]);

  function irAReportar() {
    navigate(usuario ? '/reportar' : '/login');
  }

  async function salir() {
    try {
      await cerrarSesion();
      setUsuario(null);
      setMenu(false);
      navigate('/login');
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">🏫</div>
          <div><h2>SIGI</h2><p>Gestión incidencias</p></div>
        </div>
        <nav>
          <button className="active" onClick={() => navigate('/')}>🏠 Dashboard</button>
          <button onClick={() => navigate('/escanear')}>📷 Escanear QR</button>
          <button onClick={irAReportar}>➕ Reportar incidencia</button>
          <button onClick={() => navigate('/historial')}>📋 Mis reportes</button>
          <button onClick={() => navigate('/panico')}>🚨 Botón de pánico</button>
        </nav>
      </aside>
      <main className="content">
        <header className="topbar">
          <div><h1>Sistema de Gestión de Incidencias</h1><p>Control de infraestructura y equipamiento</p></div>
          <div className="profile">
            {usuario ? <>
              <button onClick={() => setMenu(!menu)} aria-expanded={menu}>👤 {usuario.nombre} ▼</button>
              {menu && <div className="dropdown">
                <p><strong>Rol:</strong><br />{usuario.rol}</p>
                <button onClick={salir}>Cerrar sesión</button>
              </div>}
            </> : <button className="login-button" onClick={() => navigate('/login')}>🔐 Iniciar sesión</button>}
          </div>
        </header>
        <section className="welcome-card">
          <div><h2>Bienvenido al sistema 👋</h2><p>Reporta problemas del establecimiento de forma rápida y segura.</p></div>
          <button onClick={irAReportar}>+ Nueva incidencia</button>
        </section>
        <div className="dashboard-toolbar">
          <p>Resumen general del establecimiento</p>
          {usuario && <button className="dashboard-refresh" disabled={cargando} onClick={() => setRecarga(valor => valor + 1)}>
            {cargando ? 'Cargando...' : 'Actualizar datos'}
          </button>}
        </div>
        {error && <div className="dashboard-error" role="alert">{error}</div>}
        {!usuario && <p>Inicia sesión para consultar las incidencias del establecimiento.</p>}
        {usuario && (cargando ? <p role="status">Consultando incidencias...</p> : !error && datos && <>
          <section className="stats">
            {tarjetas.map(([campo, texto, icono, color]) => <div className={`stat ${color}`} key={campo}>
              <span>{icono}</span><h2>{datos.resumen[campo]}</h2><p>{texto}</p>
            </div>)}
          </section>
          <section className="panel dashboard-panel">
            <h2>Últimos reportes</h2>
            {datos.ultimosReportes.length === 0 ? <div className="empty-box">
              <span>📂</span><h3>No existen incidencias registradas</h3><p>Los reportes aparecerán cuando sean creados.</p>
            </div> : <div className="dashboard-table-wrapper">
              <table className="dashboard-table">
                <thead><tr>{['Código', 'Título', 'Sala', 'Categoría', 'Prioridad', 'Estado', 'Responsable', 'Fecha'].map(titulo => <th scope="col" key={titulo}>{titulo}</th>)}</tr></thead>
                <tbody>{datos.ultimosReportes.map(reporte => <tr key={reporte.id_incidencia}>
                  <td>INC-{String(reporte.id_incidencia).padStart(4, '0')}</td>
                  <td>{reporte.titulo}</td><td>{reporte.sala}</td><td>{reporte.categoria}</td>
                  <td>{reporte.prioridad}</td><td>{reporte.estado}</td><td>{reporte.responsable}</td><td>{reporte.fecha}</td>
                </tr>)}</tbody>
              </table>
            </div>}
          </section>
        </>)}
      </main>
    </div>
  );
}

export default Home;
