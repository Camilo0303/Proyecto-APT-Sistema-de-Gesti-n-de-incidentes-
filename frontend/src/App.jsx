import { useEffect, useState } from 'react';

import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
} from 'react-router-dom';

import {
  restaurarSesion,
  obtenerUsuario,
  cerrarSesion,
} from './data/sesion';

import Home from './pages/Home';
import Login from './pages/Login';
import Registro from './pages/Registro';
import Reportar from './pages/Reportar';
import Historial from './pages/Historial';
import EscanearQR from './pages/EscanearQR';
import Panico from './pages/Panico';
import Cetecom from './pages/Cetecom';

import './pages/Login.css';

function destinoUsuario(usuario) {
  if (!usuario) return '/login';

  const destinos = {
    Profesor: '/profesor',
    Técnico: '/cetecom',
    Administrador: '/administrador',
    Enfermería: '/enfermeria',
  };

  return destinos[usuario.rol] || '/sin-acceso';
}

function BotonSalir() {
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState('');

  async function salir() {
    if (cerrando) return;

    setCerrando(true);
    setError('');

    try {
      await cerrarSesion();
      window.location.replace('/login');
    } catch (err) {
      setError(err.message);
      setCerrando(false);
    }
  }

  return (
    <div>
      {error && <p role="alert">{error}</p>}

      <button onClick={salir} disabled={cerrando}>
        {cerrando ? 'Cerrando sesión...' : 'Cerrar sesión'}
      </button>
    </div>
  );
}

// Comprueba en el servidor el rol antes de mostrar
// una ruta protegida, incluso al cambiar de página.
function RutaProtegida({ rol, children }) {
  const [estado, setEstado] = useState({
    cargando: true,
    error: '',
    usuario: null,
  });

  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;

    restaurarSesion()
      .then(usuario => {
        if (activo) {
          setEstado({
            cargando: false,
            error: '',
            usuario,
          });
        }
      })
      .catch(err => {
        if (activo) {
          setEstado({
            cargando: false,
            error: err.message,
            usuario: null,
          });
        }
      });

    return () => {
      activo = false;
    };
  }, [intento]);

  if (estado.cargando) {
    return (
      <div className="login-page">
        <div className="login-card">
          <p role="status">Comprobando acceso...</p>
        </div>
      </div>
    );
  }

  if (estado.error) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>No se pudo comprobar la sesión</h1>
          <p role="alert">{estado.error}</p>

          <button
            onClick={() => {
              setEstado({
                cargando: true,
                error: '',
                usuario: null,
              });
              setIntento(valor => valor + 1);
            }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!estado.usuario) {
    return <Navigate to="/login" replace />;
  }

  if (estado.usuario.rol !== rol) {
    return (
      <Navigate
        to={destinoUsuario(estado.usuario)}
        replace
      />
    );
  }

  return children;
}

function RutaPublica({ children }) {
  const usuario = obtenerUsuario();

  return usuario
    ? <Navigate to={destinoUsuario(usuario)} replace />
    : children;
}

// Pantallas de entrada de esta fase.
// Todavía no incluyen gestión administrativa ni alertas.
function PanelInicial({ titulo, descripcion }) {
  const usuario = obtenerUsuario();

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>{titulo}</h1>

        <p>
          Bienvenido, {usuario?.nombre} {usuario?.apellido}
        </p>

        <p>{descripcion}</p>

        <BotonSalir />
      </div>
    </div>
  );
}

function SinAcceso() {
  const usuario = obtenerUsuario();

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  if (destinoUsuario(usuario) !== '/sin-acceso') {
    return (
      <Navigate to={destinoUsuario(usuario)} replace />
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Acceso pendiente</h1>
        <p>
          Tu rol todavía no tiene un panel habilitado.
          Contacta al administrador.
        </p>
        <BotonSalir />
      </div>
    </div>
  );
}

function RutasAplicacion() {
  const location = useLocation();

  function proteger(rol, contenido) {
    return (
      <RutaProtegida key={location.pathname} rol={rol}>
        {contenido}
      </RutaProtegida>
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Navigate
            to={destinoUsuario(obtenerUsuario())}
            replace
          />
        }
      />

      <Route
        path="/login"
        element={
          <RutaPublica>
            <Login />
          </RutaPublica>
        }
      />

      <Route
        path="/registro"
        element={
          <RutaPublica>
            <Registro />
          </RutaPublica>
        }
      />

      <Route
        path="/profesor"
        element={proteger('Profesor', <Home />)}
      />

      <Route
        path="/reportar"
        element={proteger('Profesor', <Reportar />)}
      />

      <Route
        path="/historial"
        element={proteger('Profesor', <Historial />)}
      />

      <Route
        path="/escanear"
        element={proteger('Profesor', <EscanearQR />)}
      />

      <Route
        path="/panico"
        element={proteger(
          'Profesor',
          <div>
            <div
              role="status"
              style={{
                padding: 16,
                background: '#fff3cd',
                color: '#664d03',
              }}
            >
              El botón de emergencia todavía es una
              demostración: no envía alertas a Enfermería.
              Lo conectaremos en la fase de emergencias.
              {' '}
              <Link to="/profesor">Volver al inicio</Link>
            </div>
            <Panico />
          </div>
        )}
      />

      <Route
        path="/cetecom"
        element={proteger(
          'Técnico',
          <div>
            <header style={{ padding: '20px 30px' }}>
              <p>
                Sesión de {obtenerUsuario()?.nombre}
              </p>
              <BotonSalir />
              <p>
                Vista de demostración: los contadores y
                reportes todavía son datos de ejemplo.
              </p>
            </header>

            <Cetecom />
          </div>
        )}
      />

      <Route
        path="/administrador"
        element={proteger(
          'Administrador',
          <PanelInicial
            titulo="Administración"
            descripcion={
              'Acceso de administrador habilitado. ' +
              'La gestión de usuarios y correos se agregará en la siguiente fase.'
            }
          />
        )}
      />

      <Route
        path="/enfermeria"
        element={proteger(
          'Enfermería',
          <PanelInicial
            titulo="Enfermería"
            descripcion={
              'Acceso de Enfermería habilitado. ' +
              'La recepción de alertas todavía no está conectada.'
            }
          />
        )}
      />

      <Route path="/sin-acceso" element={<SinAcceso />} />

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />
    </Routes>
  );
}

function App() {
  const [listo, setListo] = useState(false);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let activo = true;

    restaurarSesion()
      .then(() => {
        if (activo) setListo(true);
      })
      .catch(err => {
        if (activo) setError(err.message);
      });

    return () => {
      activo = false;
    };
  }, [intento]);

  if (!listo) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>SIGI</h1>

          {error ? (
            <>
              <p role="alert">{error}</p>

              <button
                onClick={() => {
                  setError('');
                  setIntento(valor => valor + 1);
                }}
              >
                Reintentar
              </button>
            </>
          ) : (
            <p role="status">Comprobando sesión...</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <RutasAplicacion />
    </BrowserRouter>
  );
}

export default App;