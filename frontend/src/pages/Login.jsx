import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { iniciarSesion } from '../data/sesion';
import './Login.css';

function Login() {
  const navigate = useNavigate();
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function ingresar(event) {
    event.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError('');
    try {
      await iniciarSesion({ correo, password });
      setPassword('');
      navigate('/', { replace: true });
    } catch (err) { setError(err.message); }
    finally { setEnviando(false); }
  }

  return <div className="login-page"><div className="login-card">
    <div className="login-logo">🏫</div>
    <h1>Sistema de Incidencias</h1>
    <p>Acceso personal autorizado</p>
    <form onSubmit={ingresar}>
      <label htmlFor="correo">Correo institucional</label>
      <input id="correo" type="email" autoComplete="username" required maxLength={150} value={correo} onChange={e => setCorreo(e.target.value)} />
      <label htmlFor="password">Contraseña</label>
      <input id="password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={e => setPassword(e.target.value)} />
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button disabled={enviando} type="submit">{enviando ? 'Ingresando...' : 'Ingresar'}</button>
    </form>
    <p>¿No tienes cuenta?</p>
    <button disabled={enviando} onClick={() => navigate('/registro')}>Crear cuenta</button>
  </div></div>;
}
export default Login;
