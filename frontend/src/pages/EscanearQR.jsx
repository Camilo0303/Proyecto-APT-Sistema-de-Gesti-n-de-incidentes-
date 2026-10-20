import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { api } from '../data/api';
import './EscanearQR.css';

export default function EscanearQR() {
  const navigate = useNavigate();
  const [parametros] = useSearchParams();
  const emergencia = parametros.get('destino') === 'emergencia';

  const [camaraActiva, setCamaraActiva] = useState(false);
  const [trabajando, setTrabajando] = useState(false);
  const [validando, setValidando] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState(
    'Activa la cámara o selecciona una imagen del código QR.'
  );

  const archivoRef = useRef(null);
  const lectorRef = useRef(null);
  const montado = useRef(false);
  const operacionEnCurso = useRef(false);
  const validacionEnCurso = useRef(false);
  const ultimoCodigo = useRef({ codigo: '', momento: 0 });

  // Serializa las operaciones de la cámara para evitar
  // iniciar y detener el lector al mismo tiempo.
  const cola = useRef(Promise.resolve());

  function ejecutarEnOrden(accion) {
    const siguiente = cola.current.then(accion);
    cola.current = siguiente.catch(() => {});
    return siguiente;
  }

  useEffect(() => {
    montado.current = true;

    return () => {
      montado.current = false;
      const lector = lectorRef.current;
      lectorRef.current = null;

      // Espera a que termine cualquier inicio o lectura pendiente.
      cola.current = cola.current
        .catch(() => {})
        .then(async () => {
          if (!lector) return;

          try {
            if (lector.isScanning) {
              await lector.stop();
            }
          } finally {
            try {
              lector.clear();
            } catch {
              // El elemento puede haberse desmontado.
            }
          }
        })
        .catch(() => {});
    };
  }, []);

  function obtenerLector() {
    if (!lectorRef.current) {
      lectorRef.current = new Html5Qrcode('reader', {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false,
      });
    }

    return lectorRef.current;
  }

  async function comprobarCodigo(codigo, desdeImagen = false) {
    if (!montado.current || validacionEnCurso.current) return;

    const ahora = Date.now();

    if (
      !desdeImagen &&
      ultimoCodigo.current.codigo === codigo &&
      ahora - ultimoCodigo.current.momento < 4000
    ) {
      return;
    }

    ultimoCodigo.current = { codigo, momento: ahora };
    validacionEnCurso.current = true;
    setValidando(true);
    setError('');
    setMensaje('Código detectado. Comprobando la sala…');

    try {
      const datos = await api(
        `/incidencias/sala-qr?codigo=${encodeURIComponent(codigo)}`
      );

      if (!datos.sala?.id_sala) {
        throw new Error('El código no identifica una sala válida.');
      }

      if (!montado.current) return;

      await ejecutarEnOrden(async () => {
        const lector = lectorRef.current;

        if (lector?.isScanning) {
          await lector.stop();
        }

        if (montado.current) setCamaraActiva(false);
      });

      if (!montado.current) return;

      navigate(
        emergencia
          ? `/panico?qr=${encodeURIComponent(codigo)}`
          : `/reportar?sala=${datos.sala.id_sala}`
      );
    } catch (err) {
      if (montado.current) {
        setError(
          err.message || 'No se pudo comprobar la sala. Intenta nuevamente.'
        );
        setMensaje('Puedes escanear otro código o cargar otra imagen.');
      }
    } finally {
      validacionEnCurso.current = false;
      if (montado.current) setValidando(false);
    }
  }

  function mensajeErrorCamara(err) {
    const detalle = `${err?.name || ''} ${err?.message || err || ''}`;

    if (/NotAllowed|PermissionDenied/i.test(detalle)) {
      return (
        'No se concedió acceso a la cámara. Revisa los permisos ' +
        'del navegador o carga una imagen del QR.'
      );
    }

    if (/NotFound|DevicesNotFound/i.test(detalle)) {
      return 'No encontramos una cámara disponible. Puedes cargar una imagen.';
    }

    if (/NotReadable|TrackStart/i.test(detalle)) {
      return (
        'No se pudo utilizar la cámara. Cierra otras aplicaciones ' +
        'que puedan estar usándola e inténtalo nuevamente.'
      );
    }

    return (
      'No se pudo activar la cámara. Revisa los permisos o utiliza ' +
      'la opción Cargar imagen QR.'
    );
  }

  async function activarCamara() {
    if (operacionEnCurso.current || validacionEnCurso.current) return;

    if (!window.isSecureContext) {
      setError(
        'La cámara necesita HTTPS o localhost. En esta conexión puedes cargar una imagen.'
      );
      return;
    }

    operacionEnCurso.current = true;
    setTrabajando(true);
    setError('');
    setMensaje('Solicitando acceso a la cámara…');

    try {
      const lector = obtenerLector();

      await ejecutarEnOrden(async () => {
        if (!montado.current || lector.isScanning) return;

        await lector.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: (ancho, alto) => {
              const lado = Math.floor(Math.min(ancho, alto, 300) * 0.75);
              return { width: lado, height: lado };
            },
          },
          codigo => {
            // Ignora lecturas hasta que termine el inicio de la cámara.
            if (!operacionEnCurso.current) {
              void comprobarCodigo(codigo);
            }
          },
          () => {
            // No encontrar un QR en un fotograma es normal.
          }
        );
      });

      if (montado.current) {
        setCamaraActiva(true);
        setMensaje('Coloca el código QR dentro del recuadro.');
      }
    } catch (err) {
      if (montado.current) {
        setError(mensajeErrorCamara(err));
        setCamaraActiva(false);
        setMensaje('También puedes identificar la sala desde una imagen.');
      }
    } finally {
      operacionEnCurso.current = false;
      if (montado.current) setTrabajando(false);
    }
  }

  async function detenerCamara() {
    if (operacionEnCurso.current || validacionEnCurso.current) return;

    operacionEnCurso.current = true;
    setTrabajando(true);
    setError('');

    try {
      await ejecutarEnOrden(async () => {
        const lector = lectorRef.current;

        if (lector?.isScanning) await lector.stop();
        lector?.clear();
      });

      if (montado.current) {
        setCamaraActiva(false);
        setMensaje('Cámara detenida. Puedes activarla nuevamente.');
      }
    } catch {
      if (montado.current) {
        setError('No se pudo detener la cámara. Vuelve al inicio para cerrarla.');
      }
    } finally {
      operacionEnCurso.current = false;
      if (montado.current) setTrabajando(false);
    }
  }

  async function cargarImagen(evento) {
    const archivo = evento.target.files?.[0];
    evento.target.value = '';

    if (!archivo || operacionEnCurso.current || validacionEnCurso.current) {
      return;
    }

    if (archivo.type && !archivo.type.startsWith('image/')) {
      setError('Selecciona una imagen del código QR.');
      return;
    }

    if (archivo.size > 15 * 1024 * 1024) {
      setError('La imagen debe pesar menos de 15 MB.');
      return;
    }

    operacionEnCurso.current = true;
    setTrabajando(true);
    setError('');
    setMensaje('Leyendo el código de la imagen…');

    let codigo;

    try {
      const lector = obtenerLector();

      codigo = await ejecutarEnOrden(async () => {
        if (!montado.current) return null;

        if (lector.isScanning) await lector.stop();

        if (montado.current) setCamaraActiva(false);
        lector.clear();

        return lector.scanFile(archivo, true);
      });
    } catch {
      if (montado.current) {
        setError(
          'No pudimos leer un QR en esta imagen. Usa una imagen nítida ' +
          'donde se vea el código completo.'
        );
        setMensaje('Selecciona otra imagen o utiliza la cámara.');
      }
    } finally {
      operacionEnCurso.current = false;
      if (montado.current) setTrabajando(false);
    }

    if (codigo && montado.current) {
      await comprobarCodigo(codigo, true);
    }
  }

  const bloqueado = trabajando || validando;

  return (
    <main className="qr-page" lang="es">
      <section className="qr-header">
        <h1>Escanear código QR</h1>
        <p>
          {emergencia
            ? 'Identifica la sala para preparar la alerta de emergencia. Escanear no envía la alerta.'
            : 'Identifica la sala y abre el formulario con su ubicación seleccionada.'}
        </p>
      </section>

      <section className="qr-container" aria-label="Lector de códigos QR">
        <p>Elige cómo quieres leer el código de la sala.</p>

        <div className="qr-controles">
          <button
            type="button"
            onClick={camaraActiva ? detenerCamara : activarCamara}
            disabled={bloqueado || !window.isSecureContext}
          >
            {trabajando
              ? 'Procesando…'
              : camaraActiva
                ? 'Detener cámara'
                : 'Activar cámara'}
          </button>

          <button
            type="button"
            className="qr-boton-imagen"
            disabled={bloqueado}
            onClick={() => archivoRef.current?.click()}
          >
            Cargar imagen QR
          </button>

          <input
            ref={archivoRef}
            type="file"
            accept="image/*"
            aria-label="Seleccionar imagen del código QR"
            onChange={cargarImagen}
            hidden
          />
        </div>

        {!window.isSecureContext && (
          <p role="alert">
            La cámara requiere HTTPS o localhost. Puedes utilizar
            «Cargar imagen QR» en esta conexión.
          </p>
        )}

        <div className="scanner-box">
          <div id="reader" />
        </div>

        <p role="status" aria-live="polite">
          {validando ? 'Comprobando la sala…' : mensaje}
        </p>

        {error && <p role="alert">{error}</p>}

        <p>
          Mantén el código completo dentro del recuadro y procura que haya
          buena iluminación. Si no tienes cámara, carga una imagen del QR.
        </p>

        <button
          type="button"
          onClick={() => navigate(emergencia ? '/panico' : '/profesor')}
        >
          {emergencia ? 'Volver a emergencia' : 'Volver al inicio'}
        </button>
      </section>
    </main>
  );
}