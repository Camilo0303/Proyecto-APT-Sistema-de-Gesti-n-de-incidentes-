import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { obtenerUsuario } from '../data/sesion';
import { api } from '../data/api';
import './Reportar.css';

const ayudasPrioridad = {
  baja: 'Puedes continuar la clase con normalidad.',
  media: 'Puedes continuar, pero el problema dificulta algunas actividades.',
  alta: 'No puedes realizar la actividad principal de la clase.',
  critica:
    'La clase está completamente interrumpida y no tienes una alternativa para continuar.',
};

function obtenerAyudaPrioridad(prioridades, id) {
  const seleccionada = prioridades.find(
    prioridad => String(prioridad.id_prioridad) === String(id)
  );

  const clave = (seleccionada?.nombre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  return {
    tono: Object.hasOwn(ayudasPrioridad, clave) ? clave : 'neutral',
    texto:
      ayudasPrioridad[clave] ||
      'Selecciona según cómo afecta el problema a tu clase.',
  };
}

export default function Reportar() {
  const navigate = useNavigate();
  const [parametros] = useSearchParams();
  const salaQR = parametros.get('sala');
  const usuario = obtenerUsuario();
  const idUsuario = usuario?.id_usuario;

  const [catalogos, setCatalogos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [errorEnvio, setErrorEnvio] = useState('');
  const [avisoSala, setAvisoSala] = useState('');
  const [intento, setIntento] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const envioEnCurso = useRef(false);

  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    id_sala: '',
    id_equipo: '',
    id_categoria: '',
    id_prioridad: '',
  });

  useEffect(() => {
    if (!idUsuario) return;

    let vigente = true;

    async function cargar() {
      setCargando(true);
      setErrorCarga('');
      setAvisoSala('');

      try {
        const resultado = await api('/incidencias/catalogos');

        const valido = [
          resultado.salas,
          resultado.equipos,
          resultado.categorias,
          resultado.prioridades,
        ].every(Array.isArray);

        if (!valido) {
          throw new Error('No se pudieron obtener las opciones del formulario.');
        }

        if (!vigente) return;

        setCatalogos(resultado);

        if (salaQR) {
          const sala = resultado.salas.find(
            item => String(item.id_sala) === salaQR
          );

          setForm(anterior => ({
            ...anterior,
            id_sala: sala ? String(sala.id_sala) : '',
            id_equipo: '',
          }));

          if (!sala) {
            setAvisoSala(
              'La sala del QR ya no está disponible. Selecciona una sala activa.'
            );
          }
        }
      } catch (err) {
        if (vigente) {
          setErrorCarga(
            err.message || 'No se pudo cargar el formulario.'
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
  }, [idUsuario, salaQR, intento]);

  function cambiar(evento) {
    const { name, value } = evento.target;

    setForm(anterior => ({
      ...anterior,
      [name]: value,
      ...(name === 'id_sala' ? { id_equipo: '' } : {}),
    }));

    if (name === 'id_sala') setAvisoSala('');
  }

  async function enviar(evento) {
    evento.preventDefault();

    if (envioEnCurso.current || cargando || !catalogos) return;

    if (!form.titulo.trim()) {
      setErrorEnvio('Escribe un título que describa el problema.');
      return;
    }

    envioEnCurso.current = true;
    setEnviando(true);
    setErrorEnvio('');

    try {
      const resultado = await api('/incidencias', {
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim(),
        id_sala: Number(form.id_sala),
        id_equipo: form.id_equipo ? Number(form.id_equipo) : null,
        id_categoria: Number(form.id_categoria),
        id_prioridad: Number(form.id_prioridad),
      });

      navigate('/historial', {
        replace: true,
        state: {
          mensaje:
            `Incidencia INC-${String(resultado.id_incidencia)
              .padStart(4, '0')} registrada correctamente.`,
        },
      });
    } catch (err) {
      setErrorEnvio(
        err.message || 'No se pudo registrar la incidencia.'
      );
    } finally {
      envioEnCurso.current = false;
      setEnviando(false);
    }
  }

  if (!usuario) {
    return (
      <main className="report-container">
        <section className="form-card">
          <h1>Inicio de sesión requerido</h1>
          <p>Inicia sesión para registrar una incidencia.</p>

          <button
            type="button"
            onClick={() => navigate('/login')}
          >
            Iniciar sesión
          </button>
        </section>
      </main>
    );
  }

  const equiposDisponibles =
    catalogos?.equipos.filter(
      equipo => Number(equipo.id_sala) === Number(form.id_sala)
    ) || [];

  const ayudaPrioridad = obtenerAyudaPrioridad(
    catalogos?.prioridades || [],
    form.id_prioridad
  );

  return (
    <main className="report-container" lang="es">
      <section className="form-card" aria-labelledby="reportar-titulo">
        <header className="report-encabezado">
          <span className="report-etiqueta">SIGI · NUEVO REPORTE</span>

          <h1 id="reportar-titulo">Reportar incidencia</h1>

          <p>
            Describe el problema e indica dónde ocurre.
          </p>

          <p className="report-usuario">
            {usuario.nombre} {usuario.apellido}
          </p>
        </header>

        {cargando ? (
          <p className="report-cargando" role="status">
            Cargando opciones…
          </p>
        ) : errorCarga ? (
          <div>
            <p role="alert">{errorCarga}</p>

            <button
              type="button"
              onClick={() => setIntento(valor => valor + 1)}
            >
              Reintentar carga
            </button>
          </div>
        ) : catalogos && (
          <form onSubmit={enviar} aria-busy={enviando}>
            <label htmlFor="titulo">Título</label>
            <input
              id="titulo"
              name="titulo"
              value={form.titulo}
              onChange={cambiar}
              disabled={enviando}
              required
              maxLength={150}
              placeholder="Ej.: El proyector no muestra imagen"
            />

            <label htmlFor="id_sala">Sala</label>
            <select
              id="id_sala"
              name="id_sala"
              value={form.id_sala}
              onChange={cambiar}
              disabled={enviando}
              required
            >
              <option value="">Selecciona una sala</option>

              {catalogos.salas.map(sala => (
                <option key={sala.id_sala} value={sala.id_sala}>
                  {sala.nombre}
                </option>
              ))}
            </select>

            {avisoSala && <p role="alert">{avisoSala}</p>}

            <label htmlFor="id_equipo">
              Equipo <span className="report-opcional">— opcional</span>
            </label>

            <select
              id="id_equipo"
              name="id_equipo"
              value={form.id_equipo}
              onChange={cambiar}
              disabled={!form.id_sala || enviando}
            >
              <option value="">Sin equipo asociado</option>

              {equiposDisponibles.map(equipo => (
                <option key={equipo.id_equipo} value={equipo.id_equipo}>
                  {equipo.nombre}
                  {equipo.codigo_inventario
                    ? ` (${equipo.codigo_inventario})`
                    : ''}
                </option>
              ))}
            </select>

            <label htmlFor="id_categoria">Categoría</label>
            <select
              id="id_categoria"
              name="id_categoria"
              value={form.id_categoria}
              onChange={cambiar}
              disabled={enviando}
              required
            >
              <option value="">Selecciona una categoría</option>

              {catalogos.categorias.map(categoria => (
                <option
                  key={categoria.id_categoria}
                  value={categoria.id_categoria}
                >
                  {categoria.nombre}
                </option>
              ))}
            </select>

            <label htmlFor="id_prioridad">Prioridad</label>
            <select
              id="id_prioridad"
              name="id_prioridad"
              value={form.id_prioridad}
              onChange={cambiar}
              disabled={enviando}
              aria-describedby="ayuda-prioridad"
              required
            >
              <option value="">Selecciona una prioridad</option>

              {catalogos.prioridades.map(prioridad => (
                <option
                  key={prioridad.id_prioridad}
                  value={prioridad.id_prioridad}
                >
                  {prioridad.nombre}
                </option>
              ))}
            </select>

            <div
              id="ayuda-prioridad"
              className={
                `report-ayuda-prioridad ` +
                `report-prioridad-${ayudaPrioridad.tono}`
              }
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v6" />
                <path d="M12 7h.01" />
              </svg>

              <span>{ayudaPrioridad.texto}</span>
            </div>

            <label htmlFor="descripcion">
              Descripción{' '}
              <span className="report-opcional">— opcional</span>
            </label>

            <textarea
              id="descripcion"
              name="descripcion"
              value={form.descripcion}
              onChange={cambiar}
              disabled={enviando}
              rows={5}
              maxLength={2000}
              placeholder="Agrega detalles que ayuden a entender el problema."
            />

            {errorEnvio && <p role="alert">{errorEnvio}</p>}

            <button type="submit" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Enviar incidencia'}
            </button>
          </form>
        )}

        <button
          type="button"
          className="report-volver"
          disabled={enviando}
          onClick={() => navigate('/profesor')}
        >
          <span aria-hidden="true">←</span>
          Volver al inicio
        </button>
      </section>
    </main>
  );
}