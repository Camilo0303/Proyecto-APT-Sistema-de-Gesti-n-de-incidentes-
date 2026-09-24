export async function api(ruta, datos) {
  let respuesta;

  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: datos === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers:
        datos === undefined
          ? {}
          : {
              'Content-Type': 'application/json',
              'X-SIGI-Request': '1',
            },
      body:
        datos === undefined
          ? undefined
          : JSON.stringify(datos),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error(
      'No se pudo contactar al servidor. Revisa la conexión antes de volver a intentar.'
    );
  }

  const resultado = await respuesta.json().catch(() => ({}));

  if (!respuesta.ok) {
    throw new Error(
      resultado.mensaje ||
        'No se pudo completar la operación.'
    );
  }

  return resultado;
}