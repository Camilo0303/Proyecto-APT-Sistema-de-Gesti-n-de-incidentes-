import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { obtenerUsuario } from '../data/sesion';
import { api } from '../data/api';
import './Historial.css';

function Historial() {
  const navigate = useNavigate();
  const location = useLocation();
  const usuario = obtenerUsuario();

  const [incidencias, setIncidencias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!usuario) return;

    let activo = true;

    api('/incidencias/mias')
      .then(resultado => {
        if (activo) setIncidencias(resultado.incidencias);
      })
      .catch(err => {
        if (activo) setError(err.message);
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, [usuario]);

  if (!usuario) {
    return (
      <div className="historial-container">
        <h1>Mis reportes</h1>
        <p>Inicia sesión para consultar tus incidencias.</p>
        <button onClick={() => navigate('/login')}>
          Iniciar sesión
        </button>
      </div>
    );
  }

  return (
    <div className="historial-container">
      <h1>📋 Mis reportes</h1>
      <p>Tus últimas 100 incidencias registradas.</p>

      {location.state?.mensaje && (
        <p role="status" style={{ color: '#166534' }}>
          {location.state.mensaje}
        </p>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate('/reportar')}>
          Nueva incidencia
        </button>
        <button onClick={() => navigate('/')}>
          Volver al inicio
        </button>
      </div>

      {cargando ? (
        <p role="status">Cargando reportes...</p>
      ) : error ? (
        <div>
          <p role="alert" style={{ color: '#991b1b' }}>
            {error}
          </p>
          <button onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </div>
      ) : incidencias.length === 0 ? (
        <div className="empty-report">
          <h2>No tienes reportes registrados</h2>
          <p>Cuando generes una incidencia aparecerá aquí.</p>
        </div>
      ) : (
        incidencias.map(incidencia => (
          <article
            key={incidencia.id_incidencia}
            style={{
              background: 'white',
              color: '#0f172a',
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              padding: 20,
              marginBottom: 16,
              overflowWrap: 'anywhere',
            }}
          >
            <h2>
              INC-{String(incidencia.id_incidencia).padStart(4, '0')}
              {' — '}
              {incidencia.titulo}
            </h2>

            <p>
              <strong>Estado:</strong> {incidencia.estado}
              {' | '}
              <strong>Prioridad:</strong> {incidencia.prioridad}
            </p>

            <p><strong>Sala:</strong> {incidencia.sala}</p>
            <p>
              <strong>Equipo:</strong>{' '}
              {incidencia.equipo || 'Sin equipo asociado'}
            </p>
            <p>
              <strong>Categoría:</strong> {incidencia.categoria}
            </p>
            <p>
              <strong>Responsable:</strong> {incidencia.responsable}
            </p>
            <p><strong>Fecha:</strong> {incidencia.fecha}</p>

            {incidencia.descripcion && (
              <p style={{ whiteSpace: 'pre-wrap' }}>
                {incidencia.descripcion}
              </p>
            )}
          </article>
        ))
      )}
    </div>
  );
}

export default Historial;