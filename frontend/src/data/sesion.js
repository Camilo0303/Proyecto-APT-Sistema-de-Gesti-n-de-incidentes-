let usuarioActual = null;
// Remove the old demo session, which could contain a plaintext password.
localStorage.removeItem('usuarioActivo');

export async function peticionAuth(ruta, datos) {
  let respuesta;
  try {
    respuesta = await fetch(`/api/auth/${ruta}`, {
      method: datos === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      headers: datos === undefined ? {} : { 'Content-Type': 'application/json', 'X-SIGI-Request': '1' },
      body: datos === undefined ? undefined : JSON.stringify(datos),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Revisa que el backend esté encendido.');
  }
  const resultado = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(resultado.mensaje || 'No se pudo completar la operación. Reinicia el backend e intenta de nuevo.');
    error.status = respuesta.status;
    throw error;
  }
  return resultado;
}

export async function restaurarSesion() {
  usuarioActual = null;
  try {
    const resultado = await peticionAuth('me');
    usuarioActual = resultado.usuario;
  } catch (error) {
    if (error.status !== 401) throw error;
  }
  return usuarioActual;
}

export async function iniciarSesion(datos) {
  const resultado = await peticionAuth('login', datos);
  usuarioActual = resultado.usuario;
  return usuarioActual;
}

export async function registrarUsuario(datos) {
  const resultado = await peticionAuth('registro', datos);
  usuarioActual = resultado.usuario;
  return usuarioActual;
}

export function obtenerUsuario() { return usuarioActual; }
export function olvidarSesion() { usuarioActual = null; }
export async function cerrarSesion() {
  await peticionAuth('logout', {});
  olvidarSesion();
}
