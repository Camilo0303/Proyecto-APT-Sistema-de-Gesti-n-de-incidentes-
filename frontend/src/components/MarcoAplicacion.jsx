import { useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cerrarSesion, obtenerUsuario } from '../data/sesion';
import { destinoActivo, navegacionRol } from './navegacion';
import './MarcoAplicacion.css';

export default function MarcoAplicacion({ children }) {
  const usuario = obtenerUsuario();
  const location = useLocation();
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState('');
  const [menu, setMenu] = useState(false);
  const bloqueo = useRef(false);
  const enlaces = navegacionRol(usuario?.rol);
  const activo = enlaces.find(e => destinoActivo(e.destino, location.pathname, location.search));
  const nombre = [usuario?.nombre, usuario?.apellido].filter(Boolean).join(' ');
  async function salir() {
    if (bloqueo.current) return;
    bloqueo.current = true; setCerrando(true); setError('');
    try { await cerrarSesion(); window.location.replace('/login'); }
    catch (e) { setError(e.message || 'No se pudo cerrar sesión. Intenta nuevamente.'); setCerrando(false); bloqueo.current = false; }
  }
  return <div className="sigi-marco" lang="es">
    <a className="sigi-saltar" href="#sigi-contenido">Saltar al contenido</a>
    <aside className="sigi-lateral">
      <Link className="sigi-marca" to={enlaces[0]?.destino || '/'} onClick={() => setMenu(false)}><span aria-hidden="true">S</span><div><strong>SIGI</strong><small>Gestión de incidencias</small></div></Link>
      <button className="sigi-menu-toggle" type="button" aria-expanded={menu} aria-controls="sigi-navegacion" onClick={() => setMenu(m => !m)}>{menu ? 'Cerrar menú' : 'Abrir menú'}</button>
      <p className="sigi-menu-etiqueta">ESPACIO DE {usuario?.rol?.toLocaleUpperCase('es-CL')}</p>
      <nav id="sigi-navegacion" className={menu ? 'sigi-nav sigi-nav-abierta' : 'sigi-nav'} aria-label={`Navegación de ${usuario?.rol}`}>
        {enlaces.map(e => <Link key={e.destino} to={e.destino} aria-current={destinoActivo(e.destino, location.pathname, location.search) ? 'page' : undefined} onClick={() => setMenu(false)}><span aria-hidden="true">{e.icono}</span>{e.nombre}</Link>)}
      </nav>
      <div className="sigi-lateral-pie">Sistema de gestión institucional</div>
    </aside>
    <div className="sigi-area">
      <header className="sigi-cabecera">
        <div className="sigi-titulo"><small>{usuario?.rol === 'Técnico' ? 'CETECOM / TÉCNICO' : usuario?.rol}</small><strong>{activo?.nombre || 'Mi espacio'}</strong></div>
        <div className="sigi-cuenta"><span className="sigi-avatar" aria-hidden="true">{usuario?.nombre?.charAt(0) || 'U'}</span><div><strong>{nombre}</strong><small>{usuario?.rol}</small></div></div>
        <button className="sigi-salir" type="button" disabled={cerrando} onClick={salir}>{cerrando ? 'Cerrando sesión…' : 'Cerrar sesión'}</button>
      </header>
      {error && <p className="sigi-error" role="alert">{error}</p>}
      <div id="sigi-contenido" className="sigi-contenido" tabIndex={-1}>{children}</div>
    </div>
  </div>;
}
