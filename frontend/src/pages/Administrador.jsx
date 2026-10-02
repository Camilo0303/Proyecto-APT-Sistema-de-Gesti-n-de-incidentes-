import { useEffect, useState } from 'react';
import {
  cerrarSesion,
  olvidarSesion,
} from '../data/sesion';
import CorreosAutorizados from './CorreosAutorizados';
import './Administrador.css';

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

  const resultado = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    throw new Error(
      resultado.mensaje || 'No se pudo completar la operación.'
    );
  }

  return resultado;
}

export default function Administrador() {
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
          setError(
            err.name === 'TimeoutError'
              ? 'La consulta tardó demasiado. Intenta actualizar.'
              : err.message || 'No se pudo conectar con el servidor.'
          );
        }
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargar();

    return () => {
      vigente = false;
    };
  }, [recarga]);

  async function cambiarEstado() {
    if (!seleccionado || ocupado) return;

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

      setMensaje(resultado.mensaje);
      setSeleccionado(null);
      setRecarga(valor => valor + 1);
    } catch (err) {
      setError(
        `${err.message || 'No se pudo confirmar el cambio.'} ` +
        'Si hubo un problema de conexión, actualiza la lista para comprobar el estado.'
      );
      setSeleccionado(null);
    } finally {
      setOcupado(false);
    }
  }

  async function salir() {
    if (ocupado) return;

    setOcupado(true);
    setError('');

    try {
      await cerrarSesion();
      window.location.replace('/login');
    } catch (err) {
      setError(err.message || 'No se pudo cerrar sesión.');
      setOcupado(false);
    }
  }

  const roles = [
    ...new Set(usuarios.map(usuario => usuario.rol)),
  ].sort();

  const texto = busqueda.trim().toLocaleLowerCase('es');

  const filtrados = usuarios.filter(usuario => {
    const coincideTexto = [
      usuario.nombre,
      usuario.apellido,
      usuario.correo,
    ]
      .join(' ')
      .toLocaleLowerCase('es')
      .includes(texto);

    const coincideRol = !rol || usuario.rol === rol;

    const coincideEstado =
      !estado ||
      (estado === 'activo' && usuario.activo) ||
      (estado === 'inactivo' && !usuario.activo);

    return coincideTexto && coincideRol && coincideEstado;
  });

  const activos = usuarios.filter(
    usuario => usuario.activo
  ).length;

  return (
    <main className="admin-panel" lang="es" translate="no">
      <div className="ad-contenido">
        <header className="ad-cabecera">
          <div>
            <span className="ad-marca">
              SIGI / ADMINISTRACIÓN
            </span>

            <h1>Gestión de usuarios y correos</h1>

            <p>
              Controla el acceso de las cuentas y autoriza nuevos registros.
            </p>
          </div>

          <button
            type="button"
            onClick={salir}
            disabled={ocupado}
          >
            {ocupado ? 'Espera…' : 'Cerrar sesión'}
          </button>
        </header>

        <section
          className="ad-resumen"
          aria-label="Resumen de usuarios"
        >
          <article>
            <span>Total de cuentas</span>
            <strong>
              {cargando || error ? '—' : usuarios.length}
            </strong>
          </article>

          <article>
            <span>Cuentas activas</span>
            <strong>
              {cargando || error ? '—' : activos}
            </strong>
          </article>

          <article>
            <span>Cuentas inactivas</span>
            <strong>
              {cargando || error
                ? '—'
                : usuarios.length - activos}
            </strong>
          </article>
        </section>

        {error && (
          <p className="ad-error" role="alert">{error}</p>
        )}

        {mensaje && (
          <p className="ad-exito" role="status">{mensaje}</p>
        )}

        <section
          className="ad-tarjeta"
          aria-labelledby="ad-listado"
        >
          <div className="ad-titulo">
            <div>
              <h2 id="ad-listado">Usuarios registrados</h2>
              <p>
                Desactivar una cuenta conserva sus reportes e historial.
              </p>
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
                onChange={event => setBusqueda(event.target.value)}
              />
            </label>

            <label>
              Rol
              <select
                value={rol}
                onChange={event => setRol(event.target.value)}
              >
                <option value="">Todos los roles</option>

                {roles.map(nombre => (
                  <option key={nombre} value={nombre}>
                    {nombre === 'Técnico'
                      ? 'Cetecom / Técnico'
                      : nombre}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Estado
              <select
                value={estado}
                onChange={event => setEstado(event.target.value)}
              >
                <option value="">Todos los estados</option>
                <option value="activo">Activos</option>
                <option value="inactivo">Inactivos</option>
              </select>
            </label>
          </div>

          {seleccionado && (
            <div
              className="ad-confirmacion"
              role="region"
              aria-label="Confirmar cambio"
            >
              <h3>
                {seleccionado.activo ? 'Desactivar' : 'Activar'} cuenta
              </h3>

              <p>
                {seleccionado.nombre} {seleccionado.apellido}
                {' · '}
                {seleccionado.correo}
              </p>

              <p>
                {seleccionado.activo
                  ? 'No podrá iniciar sesión. Las próximas solicitudes de su sesión actual también serán rechazadas.'
                  : 'Podrá iniciar sesión nuevamente con su contraseña actual.'}
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
            <p className="ad-vacio" role="status">
              Consultando usuarios…
            </p>
          ) : error && usuarios.length === 0 ? (
            <p className="ad-vacio">
              Actualiza la lista para volver a consultar.
            </p>
          ) : filtrados.length === 0 ? (
            <p className="ad-vacio">
              No hay usuarios que coincidan con los filtros.
            </p>
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
                  {filtrados.map(usuario => (
                    <tr key={usuario.id_usuario}>
                      <td>
                        <strong>
                          {usuario.nombre} {usuario.apellido}
                        </strong>
                        <small>
                          Usuario #{usuario.id_usuario}
                        </small>
                      </td>

                      <td>{usuario.correo}</td>

                      <td>
                        {usuario.rol === 'Técnico'
                          ? 'Cetecom / Técnico'
                          : usuario.rol}
                      </td>

                      <td>
                        <span
                          className={
                            usuario.activo
                              ? 'ad-activo'
                              : 'ad-inactivo'
                          }
                        >
                          {usuario.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>

                      <td>
                        {usuario.rol === 'Administrador' ? (
                          <small>Cuenta protegida</small>
                        ) : (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => {
                              setSeleccionado(usuario);
                              setMensaje('');
                              setError('');
                            }}
                          >
                            {usuario.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!cargando && (
            <p className="ad-total">
              {filtrados.length} de {usuarios.length} usuarios
            </p>
          )}
        </section>

        <CorreosAutorizados />
      </div>
    </main>
  );
}