import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { api } from '../data/api';

function normalizar(valor) {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export default function SalasQR() {
  const [salas, setSalas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [edificio, setEdificio] = useState('');
  const [piso, setPiso] = useState('');
  const [id, setId] = useState('');
  const [qr, setQr] = useState(null);
  const [errorQR, setErrorQR] = useState(null);
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(true);
  const [recarga, setRecarga] = useState(0);
  const detalle = useRef(null);

  const sala = salas.find(s => String(s.id_sala) === id);

  useEffect(() => {
    let vigente = true;

    async function cargar() {
      setCargando(true);
      setError('');

      try {
        const datos = await api('/admin/salas-qr');

        if (!Array.isArray(datos.salas)) {
          throw new Error('La respuesta de salas no es válida.');
        }

        if (vigente) setSalas(datos.salas);
      } catch (err) {
        if (vigente) {
          setSalas([]);
          setError(err.message || 'No se pudieron cargar las salas.');
        }
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargar();
    return () => { vigente = false; };
  }, [recarga]);

  useEffect(() => {
    let vigente = true;
    if (!sala?.codigo_qr) return;

    const clave = `${sala.id_sala}:${sala.codigo_qr}`;

    QRCode.toDataURL(sala.codigo_qr, {
      width: 600,
      margin: 4,
      errorCorrectionLevel: 'M',
    }).then(url => {
      if (vigente) setQr({ clave, url });
    }).catch(() => {
      if (vigente) {
        setErrorQR({
          clave,
          mensaje: 'No se pudo generar el QR. Cierra el detalle y reintenta.',
        });
      }
    });

    return () => { vigente = false; };
  }, [sala]);

  useEffect(() => {
    if (id) {
      detalle.current?.focus({ preventScroll: true });
      detalle.current?.scrollIntoView({ block: 'start' });
    }
  }, [id]);

  const edificios = [...new Set(salas.map(s => String(s.edificio ?? '')))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));

  const pisos = [...new Set(
    salas
      .filter(s => !edificio || String(s.edificio) === edificio)
      .map(s => String(s.piso ?? ''))
  )].filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));

  // "Sala 302" busca 302 aunque el nombre sea un laboratorio.
  const palabras = normalizar(busqueda)
    .split(/\s+/)
    .filter(p => p && !['sala', 'salas'].includes(p));

  const filtradas = salas.filter(s => {
    const texto = normalizar(`${s.nombre} ${s.codigo_sala}`);
    return palabras.every(p => texto.includes(p)) &&
      (!edificio || String(s.edificio) === edificio) &&
      (!piso || String(s.piso) === piso);
  }).sort((a, b) =>
    String(a.codigo_sala || a.nombre).localeCompare(
      String(b.codigo_sala || b.nombre),
      'es',
      { numeric: true }
    )
  );

  function limpiar() {
    setBusqueda('');
    setEdificio('');
    setPiso('');
    setId('');
  }

  function seleccionar(s) {
    setQr(null);
    setErrorQR(null);
    setId(String(s.id_sala));
  }

  const clave = sala ? `${sala.id_sala}:${sala.codigo_qr}` : '';
  const imagen = qr?.clave === clave ? qr.url : '';
  const falloQR = errorQR?.clave === clave ? errorQR.mensaje : '';

  return (
    <section className="ad-tarjeta ad-qr" aria-labelledby="ad-qr-titulo">
      <div className="ad-titulo">
        <div>
          <h2 id="ad-qr-titulo">Encuentra una sala</h2>
          <p>Busca por nombre o código y descarga su QR.</p>
        </div>
        <button
          type="button"
          disabled={cargando}
          onClick={() => {
            setId('');
            setRecarga(n => n + 1);
          }}
        >
          {cargando ? 'Cargando…' : 'Actualizar salas'}
        </button>
      </div>

      <div className="ad-filtros">
        <label>
          Buscar sala
          <span className="ad-buscador">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 5 5" />
            </svg>
            <input
              type="search"
              placeholder="Ej.: sala 302, PM-Z101, salud…"
              value={busqueda}
              onChange={e => {
                setBusqueda(e.target.value);
                setId('');
              }}
            />
          </span>
        </label>

        <label>
          Edificio
          <select
            value={edificio}
            onChange={e => {
              setEdificio(e.target.value);
              setPiso('');
              setId('');
            }}
          >
            <option value="">Todos los edificios</option>
            {edificios.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </label>

        <label>
          Piso
          <select
            value={piso}
            onChange={e => {
              setPiso(e.target.value);
              setId('');
            }}
          >
            <option value="">Todos los pisos</option>
            {pisos.map(p => (
              <option key={p} value={p}>Piso {p}</option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <p className="ad-error" role="alert">{error}</p>
      )}

      {cargando ? (
        <p className="ad-vacio" role="status">Consultando salas…</p>
      ) : !error && (
        <>
          <div className="ad-qr-resultados">
            <p role="status" aria-live="polite">
              <strong>{filtradas.length}</strong> de {salas.length} salas
            </p>
            {(busqueda || edificio || piso) && (
              <button type="button" onClick={limpiar}>Limpiar filtros</button>
            )}
          </div>

          {sala && (
            <div
              className="ad-qr-detalle"
              ref={detalle}
              tabIndex={-1}
              role="region"
              aria-label={`QR de ${sala.nombre}`}
            >
              <div className="ad-qr-informacion">
                <span className="ad-qr-etiqueta">SALA SELECCIONADA</span>
                <h3>{sala.nombre}</h3>
                <p>Edificio {sala.edificio} · Piso {sala.piso}</p>
                <p>Código: {sala.codigo_sala || 'Sin código de sala'}</p>

                {imagen && (
                  <a
                    className="ad-qr-descargar"
                    href={imagen}
                    download={`QR-${sala.codigo_sala || sala.id_sala}.png`}
                  >
                    Descargar QR en PNG
                  </a>
                )}

                <button type="button" onClick={() => setId('')}>
                  Cerrar detalle
                </button>
              </div>

              <div className="ad-qr-imagen">
                {!sala.codigo_qr ? (
                  <p role="alert">Esta sala no tiene QR asignado.</p>
                ) : falloQR ? (
                  <p role="alert">{falloQR}</p>
                ) : imagen ? (
                  <img
                    src={imagen}
                    alt={`Código QR de ${sala.nombre}`}
                    width="260"
                    height="260"
                  />
                ) : (
                  <p role="status">Generando QR…</p>
                )}
              </div>
            </div>
          )}

          {filtradas.length === 0 ? (
            <div className="ad-vacio">
              <h3>No encontramos esa sala</h3>
              <p>Prueba otro número, nombre o limpia los filtros.</p>
            </div>
          ) : (
            <ul className="ad-qr-lista">
              {filtradas.map(s => (
                <li key={s.id_sala}>
                  <article className="ad-qr-sala">
                    <div className="ad-qr-sala-cabecera">
                      <span className="ad-qr-simbolo" aria-hidden="true">▦</span>
                      <span className="ad-qr-codigo">
                        {s.codigo_sala || `Sala ${s.id_sala}`}
                      </span>
                    </div>
                    <h3>{s.nombre}</h3>
                    <p>Edificio {s.edificio} · Piso {s.piso}</p>
                    <button
                      type="button"
                      onClick={() => seleccionar(s)}
                      aria-label={`Ver código QR de ${s.nombre}`}
                      aria-pressed={String(s.id_sala) === id}
                    >
                      {String(s.id_sala) === id ? 'QR seleccionado' : 'Ver código QR'}
                      <span aria-hidden="true"> →</span>
                    </button>
                  </article>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}