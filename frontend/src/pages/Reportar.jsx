import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { obtenerUsuario } from '../data/sesion';
import { api } from '../data/api';
import './Reportar.css';

function Reportar() {
  const navigate = useNavigate();
  const usuario = obtenerUsuario();

  const [catalogos, setCatalogos] = useState(null);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const [form, setForm] = useState({
    titulo: '',
    descripcion: '',
    id_sala: '',
    id_equipo: '',
    id_categoria: '',
    id_prioridad: '',
  });

  useEffect(() => {
    if (!usuario) return;

    let activo = true;

    api('/incidencias/catalogos')
      .then(resultado => {
        if (activo) setCatalogos(resultado);
      })
      .catch(err => {
        if (activo) setError(err.message);
      });

    return () => {
      activo = false;
    };
  }, [usuario]);

  function cambiar(event) {
    const { name, value } = event.target;

    setForm(anterior => ({
      ...anterior,
      [name]: value,
      ...(name === 'id_sala' ? { id_equipo: '' } : {}),
    }));
  }

  async function enviar(event) {
    event.preventDefault();

    if (enviando) return;

    setError('');
    setEnviando(true);

    try {
      const resultado = await api('/incidencias', {
        titulo: form.titulo,
        descripcion: form.descripcion,
        id_sala: Number(form.id_sala),
        id_equipo: form.id_equipo
          ? Number(form.id_equipo)
          : null,
        id_categoria: Number(form.id_categoria),
        id_prioridad: Number(form.id_prioridad),
      });

      navigate('/historial', {
        replace: true,
        state: {
          mensaje:
            `Incidencia INC-${String(
              resultado.id_incidencia
            ).padStart(4, '0')} registrada correctamente.`,
        },
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  if (!usuario) {
    return (
      <div className="login-required">
        <h1>Inicio de sesión requerido</h1>
        <p>Inicia sesión para registrar una incidencia.</p>
        <button onClick={() => navigate('/login')}>
          Iniciar sesión
        </button>
      </div>
    );
  }

  const equiposDisponibles =
    catalogos?.equipos.filter(
      equipo =>
        Number(equipo.id_sala) === Number(form.id_sala)
    ) || [];

  return (
    <div className="report-container">
      <div className="form-card">
        <h1>➕ Reportar incidencia</h1>

        <p>
          Usuario: {usuario.nombre} {usuario.apellido}
        </p>

        {error && (
          <p role="alert" style={{ color: '#991b1b' }}>
            {error}
          </p>
        )}

        {!catalogos ? (
          error ? (
            <button onClick={() => window.location.reload()}>
              Reintentar carga
            </button>
          ) : (
            <p role="status">Cargando opciones...</p>
          )
        ) : (
          <form onSubmit={enviar}>
            <label htmlFor="titulo">Título</label>
            <input
              id="titulo"
              name="titulo"
              value={form.titulo}
              onChange={cambiar}
              required
              maxLength={150}
              placeholder="Ej: Computador no enciende"
            />

            <label htmlFor="id_sala">Sala</label>
            <select
              id="id_sala"
              name="id_sala"
              value={form.id_sala}
              onChange={cambiar}
              required
            >
              <option value="">Selecciona una sala</option>
              {catalogos.salas.map(sala => (
                <option key={sala.id_sala} value={sala.id_sala}>
                  {sala.nombre}
                </option>
              ))}
            </select>

            <label htmlFor="id_equipo">
              Equipo — opcional
            </label>
            <select
              id="id_equipo"
              name="id_equipo"
              value={form.id_equipo}
              onChange={cambiar}
              disabled={!form.id_sala}
            >
              <option value="">Sin equipo asociado</option>
              {equiposDisponibles.map(equipo => (
                <option
                  key={equipo.id_equipo}
                  value={equipo.id_equipo}
                >
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

            <label htmlFor="descripcion">
              Descripción — opcional
            </label>
            <textarea
              id="descripcion"
              name="descripcion"
              value={form.descripcion}
              onChange={cambiar}
              maxLength={2000}
              placeholder="Describe el problema"
            />

            <button type="submit" disabled={enviando}>
              {enviando ? 'Guardando...' : 'Enviar incidencia'}
            </button>
          </form>
        )}

        <button
          type="button"
          disabled={enviando}
          onClick={() => navigate('/')}
        >
          Volver al inicio
        </button>
      </div>
    </div>
  );
}

export default Reportar;