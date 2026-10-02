import { useEffect, useState } from 'react';
import { olvidarSesion } from '../data/sesion';

async function solicitar(ruta = '', method = 'GET', datos) {
  const respuesta = await fetch(`/api/admin/correos${ruta}`, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
    headers: datos === undefined
      ? {}
      : {
          'Content-Type': 'application/json',
          'X-SIGI-Request': '1',
        },
    body: datos === undefined
      ? undefined
      : JSON.stringify(datos),
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

function nombreRol(rol) {
  return rol === 'Técnico' ? 'Cetecom / Técnico' : rol;
}

export default function CorreosAutorizados() {
  const [roles, setRoles] = useState([]);
  const [correos, setCorreos] = useState([]);
  const [correo, setCorreo] = useState('');
  const [idRol, setIdRol] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;

    async function cargar() {
      setCargando(true);
      setError('');

      try {
        const datos = await solicitar();

        if (
          !Array.isArray(datos.roles) ||
          !Array.isArray(datos.correos)
        ) {
          throw new Error('La respuesta del servidor no es válida.');
        }

        if (vigente) {
          setRoles(datos.roles);
          setCorreos(datos.correos);
        }
      } catch (err) {
        if (vigente) {
          setRoles([]);
          setCorreos([]);
          setError(
            err.message || 'No se pudo consultar el servidor.'
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

  async function guardar(event) {
    event.preventDefault();

    if (guardando || cargando) return;

    const rolElegido = roles.find(
      rol => String(rol.id_rol) === idRol
    );

    if (!rolElegido) return;

    const correoLimpio = correo.trim().toLowerCase();

    const confirma = window.confirm(
      `¿Autorizar ${correoLimpio} con el rol ${nombreRol(rolElegido.nombre)}?`
    );

    if (!confirma) return;

    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      const resultado = await solicitar('', 'POST', {
        correo: correoLimpio,
        id_rol: Number(idRol),
      });

      setMensaje(resultado.mensaje);
      setCorreo('');
      setIdRol('');
      setRecarga(valor => valor + 1);
    } catch (err) {
      setError(
        `${err.message || 'No se pudo confirmar el cambio.'} ` +
        'Si se perdió la conexión, actualiza la lista antes de reintentar.'
      );
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarEstado(item) {
    if (guardando || cargando) return;

    const confirma = window.confirm(
      `${item.activo ? '¿Revocar' : '¿Activar'} la autorización de ${item.correo}?`
    );

    if (!confirma) return;

    setGuardando(true);
    setError('');
    setMensaje('');

    try {
      const resultado = await solicitar(
        `/${item.id_autorizacion}/estado`,
        'PATCH',
        { activo: !item.activo }
      );

      setMensaje(resultado.mensaje);
      setRecarga(valor => valor + 1);
    } catch (err) {
      setError(
        `${err.message || 'No se pudo confirmar el cambio.'} ` +
        'Actualiza la lista para comprobar el estado.'
      );
    } finally {
      setGuardando(false);
    }
  }

  const filtrados = correos.filter(item =>
    `${item.correo} ${nombreRol(item.rol)}`
      .toLocaleLowerCase('es')
      .includes(busqueda.trim().toLocaleLowerCase('es'))
  );

  return (
    <section
      className="ad-tarjeta"
      aria-labelledby="ad-correos-titulo"
      style={{ marginTop: 24 }}
    >
      <div className="ad-titulo">
        <div>
          <h2 id="ad-correos-titulo">Correos autorizados</h2>
          <p>
            Autoriza un correo y asigna el rol que tendrá al registrarse.
          </p>
        </div>

        <button
          type="button"
          disabled={cargando || guardando}
          onClick={() => {
            setMensaje('');
            setRecarga(valor => valor + 1);
          }}
        >
          {cargando ? 'Cargando…' : 'Actualizar correos'}
        </button>
      </div>

      <form onSubmit={guardar} className="ad-filtros">
        <label>
          Correo que deseas autorizar
          <input
            type="email"
            required
            maxLength={150}
            autoComplete="off"
            placeholder="nombre@colegio.cl"
            value={correo}
            disabled={guardando || cargando}
            onChange={event => setCorreo(event.target.value)}
          />
        </label>

        <label>
          Rol al registrarse
          <select
            required
            value={idRol}
            disabled={guardando || cargando}
            onChange={event => setIdRol(event.target.value)}
          >
            <option value="">Selecciona un rol</option>

            {roles.map(rol => (
              <option key={rol.id_rol} value={rol.id_rol}>
                {nombreRol(rol.nombre)}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={
            guardando ||
            cargando ||
            roles.length === 0
          }
          style={{ alignSelf: 'end', minHeight: 43 }}
        >
          {guardando ? 'Guardando…' : 'Guardar autorización'}
        </button>
      </form>

      <div style={{ padding: '0 24px 20px' }}>
        <p style={{ color: '#64758c', marginBottom: 16 }}>
          Si el correo ya está autorizado, guardarlo actualiza su rol
          y reactiva su autorización. Las cuentas ya registradas no
          se modifican desde esta sección.
        </p>

        {error && (
          <p className="ad-error" role="alert">{error}</p>
        )}

        {mensaje && (
          <p className="ad-exito" role="status">{mensaje}</p>
        )}

        <label>
          Buscar autorización
          <input
            type="search"
            placeholder="Correo o rol"
            value={busqueda}
            onChange={event => setBusqueda(event.target.value)}
          />
        </label>
      </div>

      {cargando ? (
        <p className="ad-vacio" role="status">
          Consultando autorizaciones…
        </p>
      ) : error && correos.length === 0 ? (
        <p className="ad-vacio">
          Actualiza los correos para comprobar la lista.
        </p>
      ) : filtrados.length === 0 ? (
        <p className="ad-vacio">
          No hay autorizaciones que coincidan.
        </p>
      ) : (
        <div className="ad-tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th scope="col">Correo</th>
                <th scope="col">Rol autorizado</th>
                <th scope="col">Situación</th>
                <th scope="col">Acción</th>
              </tr>
            </thead>

            <tbody>
              {filtrados.map(item => (
                <tr key={item.id_autorizacion}>
                  <td>{item.correo}</td>
                  <td>{nombreRol(item.rol)}</td>

                  <td>
                    {item.registrado ? (
                      <span className="ad-activo">
                        Cuenta creada
                      </span>
                    ) : (
                      <span
                        className={
                          item.activo ? 'ad-activo' : 'ad-inactivo'
                        }
                      >
                        {item.activo
                          ? 'Puede registrarse'
                          : 'Revocada'}
                      </span>
                    )}
                  </td>

                  <td>
                    {item.registrado ? (
                      <small>
                        Gestionar desde Usuarios registrados
                      </small>
                    ) : (
                      <button
                        type="button"
                        disabled={guardando || cargando}
                        onClick={() => cambiarEstado(item)}
                      >
                        {item.activo ? 'Revocar' : 'Activar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}