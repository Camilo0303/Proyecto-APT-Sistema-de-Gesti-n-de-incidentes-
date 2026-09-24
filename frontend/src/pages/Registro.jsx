import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registrarUsuario } from '../data/sesion';
import './Login.css';

function Registro() {
  const navigate = useNavigate();
  const [datos, setDatos] = useState({ nombre: '', apellido: '', correo: '', password: '' });
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  function cambiar(event) { setDatos({ ...datos, [event.target.name]: event.target.value }); }
  async function registrar(event) {
    event.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError('');
    try {
      await registrarUsuario(datos);
      setDatos({ nombre: '', apellido: '', correo: '', password: '' });
      navigate('/', { replace: true });
    } catch (err) { setError(err.message); }
    finally { setEnviando(false); }
  }
  return <div className="login-page"><div className="login-card">
    <div className="login-logo">🏫</div>
    <h1>Crear cuenta</h1>
    <p>Usa un correo autorizado por el establecimiento.</p>
    <form onSubmit={registrar}>
      <label htmlFor="nombre">Nombre</label>
      <input id="nombre" name="nombre" autoComplete="given-name" required maxLength={100} value={datos.nombre} onChange={cambiar} />
      <label htmlFor="apellido">Apellido</label>
      <input id="apellido" name="apellido" autoComplete="family-name" required maxLength={100} value={datos.apellido} onChange={cambiar} />
      <label htmlFor="correo">Correo institucional</label>
      <input id="correo" name="correo" type="email" autoComplete="username" required maxLength={150} value={datos.correo} onChange={cambiar} />
      <label htmlFor="password">Contraseña</label>
      <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={16} aria-describedby="password-help" value={datos.password} onChange={cambiar} />
      <p id="password-help">Entre 8 y 16 caracteres.</p>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button disabled={enviando} type="submit">{enviando ? 'Registrando...' : 'Registrarse'}</button>
    </form>
    <button disabled={enviando} onClick={() => navigate('/login')}>Volver al inicio de sesión</button>
  </div></div>;
}
export default Registro;
