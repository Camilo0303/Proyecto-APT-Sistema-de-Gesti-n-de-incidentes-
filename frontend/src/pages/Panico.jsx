import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../data/api';
import './Emergencias.css';

export default function Panico() {
  const [parametros] = useSearchParams();
  const codigo = parametros.get('qr') || '';

  // Al escanear otra sala, reinicia el formulario y su confirmación.
  return <FormularioEmergencia key={codigo} codigo={codigo} />;
}

function FormularioEmergencia({ codigo }) {
  const [sala, setSala] = useState(null);
  const [tipos, setTipos] = useState([]);
  const [tipo, setTipo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [confirmado, setConfirmado] = useState(false);

  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [errorEnvio, setErrorEnvio] = useState('');
  const [intento, setIntento] = useState(0);

  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const envioEnCurso = useRef(false);

  const [seguimiento, setSeguimiento] = useState(null);
  const [errorEstado, setErrorEstado] = useState('');
  const [consultandoEstado, setConsultandoEstado] = useState(false);
  const [ultimaConsulta, setUltimaConsulta] = useState('');
  const [recargaEstado, setRecargaEstado] = useState(0);
  const resultadoRef = useRef(null);

  // Cargar los tipos de emergencia y validar la sala del QR.
  useEffect(() => {
    let vigente = true;

    async function cargar() {
      setCargando(true);
      setErrorCarga('');
      setSala(null);
      setTipos([]);

      try {
        const [catalogos, ubicacion] = await Promise.all([
          api('/emergencias/catalogos'),
          codigo
            ? api(
                `/incidencias/sala-qr?codigo=${encodeURIComponent(codigo)}`
              )
            : Promise.resolve(null),
        ]);

        if (!Array.isArray(catalogos.tipos)) {
          throw new Error('No se pudieron obtener los tipos de emergencia.');
        }

        if (codigo && !ubicacion?.sala) {
          throw new Error('No se pudo identificar la sala de este código QR.');
        }

        if (vigente) {
          setTipos(catalogos.tipos);
          setSala(ubicacion?.sala || null);
        }
      } catch (err) {
        if (vigente) {
          setErrorCarga(
            err.message || 'No se pudo cargar la información.'
          );
        }
      } finally {
        if (vigente) setCargando(false);
      }
    }

    void cargar();

    return () => {
      vigente = false;
    };
  }, [codigo, intento]);

  // Consultar el estado mientras esta pantalla permanece abierta.
  const idAlerta = resultado?.id_alerta;

  useEffect(() => {
    if (idAlerta == null) return;

    let vigente = true;
    let ocupado = false;

    async function consultarEstado() {
      if (ocupado) return;

      ocupado = true;
      setConsultandoEstado(true);

      try {
        const datos = await api('/emergencias/mias');

        if (!Array.isArray(datos.alertas)) {
          throw new Error('La respuesta del seguimiento no es válida.');
        }

        const alerta = datos.alertas.find(
          item => String(item.id_alerta) === String(idAlerta)
        );

        if (!alerta) {
          throw new Error(
            'Esta alerta no aparece en la consulta de reportes recientes.'
          );
        }

        if (vigente) {
          setSeguimiento(alerta);
          setErrorEstado('');
          setUltimaConsulta(
            new Date().toLocaleTimeString('es-CL', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })
          );
        }
      } catch (err) {
        if (vigente) {
          setErrorEstado(
            err.message || 'No se pudo consultar el estado.'
          );
        }
      } finally {
        ocupado = false;
        if (vigente) setConsultandoEstado(false);
      }
    }

    void consultarEstado();

    const temporizador = window.setInterval(consultarEstado, 5000);
    const alVolver = () => void consultarEstado();

    window.addEventListener('focus', alVolver);

    return () => {
      vigente = false;
      window.clearInterval(temporizador);
      window.removeEventListener('focus', alVolver);
    };
  }, [idAlerta, recargaEstado]);

  useEffect(() => {
    if (idAlerta != null) {
      resultadoRef.current?.focus({ preventScroll: true });
      resultadoRef.current?.scrollIntoView({ block: 'start' });
    }
  }, [idAlerta]);

  const tipoValido = tipos.some(
    item => String(item.id_tipo_emergencia) === tipo
  );

  const puedeEnviar = Boolean(
    sala &&
    tipoValido &&
    confirmado &&
    !cargando &&
    !errorCarga &&
    !enviando
  );

  async function enviar(evento) {
    evento.preventDefault();

    if (envioEnCurso.current || !puedeEnviar) return;

    envioEnCurso.current = true;
    setEnviando(true);
    setErrorEnvio('');

    try {
      const respuesta = await api('/emergencias', {
        codigo_qr: codigo,
        id_tipo_emergencia: Number(tipo),
        descripcion: descripcion.trim(),
      });

      if (respuesta?.id_alerta == null) {
        throw new Error(
          'El servidor no devolvió el identificador de la alerta.'
        );
      }

      setResultado(respuesta);
    } catch (err) {
      setErrorEnvio(
        `${err.message || 'No se pudo confirmar el envío.'} ` +
        'Si se interrumpió la conexión, la alerta podría haberse registrado.'
      );
    } finally {
      envioEnCurso.current = false;
      setEnviando(false);
    }
  }

  let ayudaEnvio = 'Todo listo. Presiona el botón para registrar la alerta.';

  if (cargando) {
    ayudaEnvio = 'Estamos comprobando la información de la sala.';
  } else if (errorCarga) {
    ayudaEnvio = 'Reintenta la consulta o escanea otro código QR.';
  } else if (!sala) {
    ayudaEnvio = 'Primero identifica la sala escaneando su QR.';
  } else if (!tipoValido) {
    ayudaEnvio = 'Selecciona el tipo de emergencia.';
  } else if (!confirmado) {
    ayudaEnvio = 'Marca la confirmación para habilitar el botón.';
  }

  if (enviando) {
    ayudaEnvio = 'Registrando la alerta. Espera la confirmación del sistema.';
  }

  return (
    <main className="emergencias" lang="es">
      <h1>Alerta de emergencia interna</h1>

      <p>
        Avisa a Enfermería indicando la ubicación y el tipo de emergencia.
        Esta herramienta no contacta servicios externos ni reemplaza los
        protocolos de emergencia de la institución.
      </p>

      {resultado ? (
        <section
          className="em-tarjeta"
          ref={resultadoRef}
          tabIndex={-1}
          aria-labelledby="em-resultado-titulo"
        >
          <h2 id="em-resultado-titulo">
            Alerta #{resultado.id_alerta} registrada
          </h2>

          <p role="status">
            {resultado.mensaje || 'La alerta quedó registrada en el sistema.'}
          </p>

          {sala && (
            <>
              <p><strong>{sala.nombre}</strong></p>
              <p>
                Edificio {sala.edificio} · Piso {sala.piso}
              </p>
            </>
          )}

          <div aria-live="polite" aria-atomic="true">
            <p>
              Estado:{' '}
              <strong>
                {seguimiento?.estado ||
                  (errorEstado ? 'Sin confirmar' : 'Consultando…')}
              </strong>
            </p>

            {seguimiento?.responsable && (
              <p>
                Atiende: <strong>{seguimiento.responsable}</strong>
              </p>
            )}
          </div>

          {errorEstado && (
            <p className="em-error" role="alert">
              {errorEstado} El estado mostrado puede estar desactualizado.
            </p>
          )}

          <p>
            El registro no confirma por sí solo que Enfermería haya visto
            la alerta.
          </p>

          <p>
            El estado se consulta cada 5 segundos mientras esta pantalla
            permanezca abierta.
          </p>

          {ultimaConsulta && (
            <p>Última consulta correcta: {ultimaConsulta}</p>
          )}

          <button
            type="button"
            disabled={consultandoEstado}
            onClick={() => setRecargaEstado(valor => valor + 1)}
          >
            {consultandoEstado ? 'Consultando…' : 'Actualizar estado'}
          </button>
        </section>
      ) : (
        <form onSubmit={enviar} aria-busy={enviando}>
          {!enviando && (
            <Link to="/escanear?destino=emergencia">
              {sala ? 'Escanear otra sala' : 'Identificar sala con QR'}
            </Link>
          )}

          {cargando && (
            <p role="status">Comprobando sala y tipos de emergencia…</p>
          )}

          {errorCarga && (
            <div>
              <p className="em-error" role="alert">{errorCarga}</p>

              <button
                type="button"
                disabled={cargando}
                onClick={() => setIntento(valor => valor + 1)}
              >
                Reintentar consulta
              </button>
            </div>
          )}

          {sala && (
            <section
              className="em-tarjeta"
              aria-labelledby="em-ubicacion-titulo"
            >
              <h2 id="em-ubicacion-titulo">{sala.nombre}</h2>
              <p>
                Edificio {sala.edificio} · Piso {sala.piso}
              </p>
              <p>
                Comprueba que esta sea la ubicación de la emergencia.
              </p>
            </section>
          )}

          {!cargando && !errorCarga && !sala && (
            <p>
              Escanea el código QR de la sala para identificar dónde
              necesitas atención.
            </p>
          )}

          <label htmlFor="em-tipo">
            Tipo de emergencia
            <select
              id="em-tipo"
              required
              value={tipo}
              disabled={cargando || Boolean(errorCarga) || enviando}
              onChange={evento => {
                setTipo(evento.target.value);
                setConfirmado(false);
              }}
            >
              <option value="">Selecciona el tipo</option>

              {tipos.map(item => (
                <option
                  key={item.id_tipo_emergencia}
                  value={String(item.id_tipo_emergencia)}
                >
                  {item.nombre}
                </option>
              ))}
            </select>
          </label>

          <label htmlFor="em-descripcion">
            Descripción opcional
            <textarea
              id="em-descripcion"
              rows={4}
              maxLength={255}
              placeholder="Describe brevemente lo ocurrido."
              value={descripcion}
              disabled={enviando}
              aria-describedby="em-limite-descripcion"
              onChange={evento => setDescripcion(evento.target.value)}
            />
          </label>

          <p id="em-limite-descripcion">
            {descripcion.length} de 255 caracteres.
          </p>

          <label htmlFor="em-confirmacion">
            <input
              id="em-confirmacion"
              type="checkbox"
              required
              checked={confirmado}
              disabled={!sala || !tipoValido || cargando || enviando}
              onChange={evento => setConfirmado(evento.target.checked)}
            />
            Confirmo una emergencia real en la sala indicada.
          </label>

          {errorEnvio && (
            <p className="em-error" role="alert">{errorEnvio}</p>
          )}

          <div className="em-envio">
            <p className="em-envio-titulo">Avisar a Enfermería</p>

            <p
              id="em-ayuda-envio"
              className="em-envio-ayuda"
              aria-live="polite"
            >
              {ayudaEnvio}
            </p>

            <button
              type="submit"
              className="em-urgente em-boton-panico"
              disabled={!puedeEnviar}
              aria-describedby="em-ayuda-envio"
              aria-busy={enviando}
            >
              <svg
                className="em-panico-icono"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 3 2.5 19h19L12 3Z" />
                <path d="M12 9v4" />
                <path d="M12 16h.01" />
              </svg>

              <span className="em-panico-texto">
                {enviando ? 'Enviando…' : 'Enviar alerta'}
              </span>

              <span className="em-panico-subtexto">
                {enviando ? 'Espera un momento' : 'a Enfermería'}
              </span>
            </button>

            <p className="em-envio-nota">
              La alerta incluye la sala seleccionada.
            </p>
          </div>
        </form>
      )}

      {!enviando && (
        <p>
          <Link to="/profesor">Volver al inicio</Link>
        </p>
      )}
    </main>
  );
}