import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { cerrarSesion, olvidarSesion } from '../data/sesion';
import CorreosAutorizados from './CorreosAutorizados';
import SalasQR from './SalasQR';
import HistorialAdministracion from './HistorialAdministracion';
import './Administrador.css';

const opciones = [
  {
    id: 'usuarios',
    icono: '◎',
    titulo: 'Usuarios registrados',
    descripcion: 'Consulta las cuentas y administra su acceso.',
    color: 'azul',
  },
  {
    id: 'correos',
    icono: '@',
    titulo: 'Correos autorizados',
    descripcion: 'Autoriza nuevos registros y define sus roles.',
    color: 'verde',
  },
  {
    id: 'historial',
    icono: '≡',
    titulo: 'Historial de incidencias',
    descripcion: 'Revisa los reportes y sus movimientos.',
    color: 'violeta',
  },
  {
    id: 'salas',
    icono: '▦',
    titulo: 'Salas y códigos QR',
    descripcion: 'Encuentra una sala y descarga su código QR.',
    color: 'ambar',
  },
];

async function consultar(ruta, opciones = {}) {
  const respuesta = await fetch(`/api/admin${ruta}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
    ...opciones,
  });

  if (respuesta.status === 401) {
    olvidarSesion();
    window.location.replace('/login');
    throw new Error('La sesión terminó.');
  }

  const datos = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    throw new Error(
      datos.mensaje || 'No se pudo completar la operación.'
    );
  }

  return datos;
}

function UsuariosAdministracion() {
  const [usuarios, setUsuarios] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [rol, setRol] = useState('');
  const [estado, setEstado] = useState('');
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [recarga, setRecarga] = useState(0);
  const [seleccionado, setSeleccionado] = useState(null);
  const enviando = useRef(false);
  const confirmacion = useRef(null);

  useEffect(() => {
    let vigente = true;

    async function cargar() {
      setCargando(true);
      setError('');

      try {
        const datos = await consultar('/usuarios');

        if (!Array.isArray(datos.usuarios)) {
          throw new Error('La respuesta del servidor no es válida.');
        }

        if (vigente) setUsuarios(datos.usuarios);
      } catch (err) {
        if (vigente) {
          setUsuarios([]);
          setError(err.message || 'No se pudieron cargar los usuarios.');
        }
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargar();
    return () => { vigente = false; };
  }, [recarga]);

  useEffect(() => {
    if (seleccionado) {
      confirmacion.current?.focus();
      confirmacion.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [seleccionado]);

  async function cambiarEstado() {
    if (!seleccionado || enviando.current) return;

    enviando.current = true;
    setOcupado(true);
    setError('');
    setMensaje('');

    try {
      const resultado = await consultar(
        `/usuarios/${seleccionado.id_usuario}/estado`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-SIGI-Request': '1',
          },
          body: JSON.stringify({
            activo: !seleccionado.activo,
          }),
        }
      );

      setMensaje(resultado.mensaje || 'Cuenta actualizada.');
      setSeleccionado(null);
      setRecarga(valor => valor + 1);
    } catch (err) {
      setError(
        `${err.message || 'No se pudo confirmar el cambio.'} ` +
        'Actualiza la lista para comprobar el estado antes de reintentar.'
      );
      setSeleccionado(null);
    } finally {
      enviando.current = false;
      setOcupado(false);
    }
  }

  const roles = [...new Set(usuarios.map(u => u.rol))].sort();
  const texto = busqueda.trim().toLocaleLowerCase('es');

  const filtrados = usuarios.filter(u => {
    const coincideTexto = `${u.nombre} ${u.apellido} ${u.correo}`
      .toLocaleLowerCase('es')
      .includes(texto);

    return coincideTexto &&
      (!rol || u.rol === rol) &&
      (
        !estado ||
        (estado === 'activo' && u.activo) ||
        (estado === 'inactivo' && !u.activo)
      );
  });

  const activos = usuarios.filter(u => u.activo).length;

  return (
    <>
      <section className="ad-resumen" aria-label="Resumen de usuarios">
        <article>
          <span>Total de cuentas</span>
          <strong>{cargando || error ? '—' : usuarios.length}</strong>
        </article>
        <article>
          <span>Cuentas activas</span>
          <strong>{cargando || error ? '—' : activos}</strong>
        </article>
        <article>
          <span>Cuentas inactivas</span>
          <strong>
            {cargando || error ? '—' : usuarios.length - activos}
          </strong>
        </article>
      </section>

      {error && <p className="ad-error" role="alert">{error}</p>}
      {mensaje && <p className="ad-exito" role="status">{mensaje}</p>}

      <section className="ad-tarjeta" aria-labelledby="ad-listado">
        <div className="ad-titulo">
          <div>
            <h2 id="ad-listado">Usuarios registrados</h2>
            <p>Desactivar una cuenta conserva sus reportes e historial.</p>
          </div>
          <button
            type="button"
            disabled={cargando || ocupado}
            onClick={() => {
              setSeleccionado(null);
              setMensaje('');
              setRecarga(valor => valor + 1);
            }}
          >
            {cargando ? 'Cargando…' : 'Actualizar usuarios'}
          </button>
        </div>

        <div className="ad-filtros">
          <label>
            Buscar usuario
            <input
              type="search"
              placeholder="Nombre o correo"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />
          </label>
          <label>
            Rol
            <select value={rol} onChange={e => setRol(e.target.value)}>
              <option value="">Todos los roles</option>
              {roles.map(nombre => (
                <option key={nombre} value={nombre}>
                  {nombre === 'Técnico' ? 'Cetecom / Técnico' : nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Estado
            <select
              value={estado}
              onChange={e => setEstado(e.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>
          </label>
        </div>

        {seleccionado && (
          <div
            ref={confirmacion}
            tabIndex={-1}
            className="ad-confirmacion"
            role="region"
            aria-label="Confirmar cambio de acceso"
          >
            <h3>
              {seleccionado.activo ? 'Desactivar' : 'Activar'} cuenta
            </h3>
            <p>
              {seleccionado.nombre} {seleccionado.apellido}
              {' · '}{seleccionado.correo}
            </p>
            <p>
              {seleccionado.activo
                ? 'Se bloqueará su acceso y se conservarán sus reportes.'
                : 'Podrá iniciar sesión con su contraseña actual.'}
            </p>
            <div className="ad-acciones">
              <button
                type="button"
                disabled={ocupado}
                onClick={cambiarEstado}
              >
                {ocupado ? 'Guardando…' : 'Confirmar cambio'}
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => setSeleccionado(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {cargando ? (
          <p className="ad-vacio" role="status">Consultando usuarios…</p>
        ) : error && usuarios.length === 0 ? (
          <p className="ad-vacio">Actualiza la lista para reintentar.</p>
        ) : filtrados.length === 0 ? (
          <p className="ad-vacio">No hay coincidencias con estos filtros.</p>
        ) : (
          <div className="ad-tabla-contenedor">
            <table>
              <thead>
                <tr>
                  <th scope="col">Usuario</th>
                  <th scope="col">Correo</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Estado</th>
                  <th scope="col">Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map(u => (
                  <tr key={u.id_usuario}>
                    <td>
                      <strong>{u.nombre} {u.apellido}</strong>
                      <small>Usuario #{u.id_usuario}</small>
                    </td>
                    <td>{u.correo}</td>
                    <td>
                      {u.rol === 'Técnico' ? 'Cetecom / Técnico' : u.rol}
                    </td>
                    <td>
                      <span className={u.activo ? 'ad-activo' : 'ad-inactivo'}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      {u.rol === 'Administrador' ? (
                        <small>Cuenta protegida</small>
                      ) : (
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => {
                            setSeleccionado(u);
                            setMensaje('');
                            setError('');
                          }}
                        >
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!cargando && !error && (
          <p className="ad-total">
            {filtrados.length} de {usuarios.length} usuarios
          </p>
        )}
      </section>
    </>
  );
}

export default function Administrador() {
  const [parametros] = useSearchParams();
  const opcion = opciones.find(o => o.id === parametros.get('seccion'));
  const seccion = opcion?.id || 'inicio';
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState('');
  const titulo = useRef(null);
  const salidaEnCurso = useRef(false);

  useEffect(() => {
    titulo.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [seccion]);

  async function salir() {
    if (salidaEnCurso.current) return;
    salidaEnCurso.current = true;
    setCerrando(true);
    setError('');

    try {
      await cerrarSesion();
      window.location.replace('/login');
    } catch (err) {
      setError(err.message || 'No se pudo cerrar sesión.');
      salidaEnCurso.current = false;
      setCerrando(false);
    }
  }

  return (
    <main className="admin-panel" lang="es" translate="no">
      <div className="ad-contenido">
        {opcion && (
          <Link className="ad-volver" to="/administrador">
            <span aria-hidden="true">←</span> Volver al menú
          </Link>
        )}

        <header className="ad-cabecera">
          <div>
            <span className="ad-marca">SIGI / ADMINISTRACIÓN</span>
            <h1 ref={titulo} tabIndex={-1}>
              {opcion?.titulo || 'Panel de administración'}
            </h1>
            <p>
              {opcion?.descripcion ||
                'Todo lo que necesitas administrar, organizado en un solo lugar.'}
            </p>
          </div>
          <span className="ad-cabecera-sello" aria-hidden="true">
            {opcion?.icono || 'S'}
          </span>
        </header>

        {seccion === 'inicio' ? (
          <>
            <div className="ad-menu-titulo">
              <h2>¿Qué quieres gestionar?</h2>
              <p>Selecciona una sección para comenzar.</p>
            </div>

            <nav className="ad-menu" aria-label="Menú de administración">
              {opciones.map(o => (
                <Link
                  key={o.id}
                  className={`ad-menu-opcion ad-tono-${o.color}`}
                  to={`/administrador?seccion=${o.id}`}
                >
                  <span className="ad-menu-icono" aria-hidden="true">
                    {o.icono}
                  </span>
                  <span className="ad-menu-texto">
                    <strong>{o.titulo}</strong>
                    <span>{o.descripcion}</span>
                  </span>
                  <span className="ad-menu-flecha" aria-hidden="true">→</span>
                </Link>
              ))}
            </nav>

            <footer className="ad-menu-pie">
              <div>
                <strong>Tu sesión de administrador</strong>
                <p>Cierra sesión cuando termines de trabajar.</p>
              </div>
              <button
                type="button"
                className="ad-salir"
                onClick={salir}
                disabled={cerrando}
              >
                {cerrando ? 'Cerrando sesión…' : 'Cerrar sesión'}
              </button>
            </footer>

            {error && <p className="ad-error" role="alert">{error}</p>}
          </>
        ) : (
          <div className="ad-seccion">
            {seccion === 'usuarios' && <UsuariosAdministracion />}
            {seccion === 'correos' && <CorreosAutorizados />}
            {seccion === 'historial' && <HistorialAdministracion />}
            {seccion === 'salas' && <SalasQR />}
          </div>
        )}
      </div>
    </main>
  );
}