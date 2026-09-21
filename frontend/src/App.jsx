import './App.css'

function App() {
  return (
    <main className="app">
      <header className="header">
        <div className="brand">
          <div className="brand-icon">!</div>

          <div>
            <h1>Sistema de Incidencias</h1>
            <p>Gestión de infraestructura y equipamiento</p>
          </div>
        </div>

        <span className="status">Sistema activo</span>
      </header>

      <section className="content">
        <div className="location-card">
          <div className="location-icon">📍</div>

          <div>
            <span className="label">UBICACIÓN IDENTIFICADA</span>
            <h2>Laboratorio 301</h2>
            <p>Sede Puerto Montt</p>
          </div>

          <div className="qr-ok">✓ QR verificado</div>
        </div>

        <div className="welcome">
          <span className="welcome-tag">REPORTE DE INCIDENCIAS</span>

          <h2>¿Qué necesitas hacer?</h2>

          <p>
            Selecciona una opción para informar un problema o generar
            una alerta de emergencia.
          </p>
        </div>

        <div className="actions">
          <button
            className="action-card report"
            onClick={() => alert('Aquí abriremos el formulario de incidencia')}
          >
            <div className="action-icon">🛠️</div>

            <div>
              <h3>Reportar una incidencia</h3>
              <p>
                Informa problemas de infraestructura, equipos o
                instalaciones.
              </p>
            </div>

            <span className="arrow">→</span>
          </button>

          <button
            className="action-card emergency"
            onClick={() => alert('Botón de pánico activado')}
          >
            <div className="action-icon">🚨</div>

            <div>
              <h3>Botón de pánico</h3>
              <p>
                Genera una alerta interna de alta prioridad ante una
                emergencia.
              </p>
            </div>

            <span className="arrow">→</span>
          </button>
        </div>

        <div className="info">
          <span>✓</span>

          <p>
            El código QR permitió identificar automáticamente esta ubicación.
            No necesitas seleccionar la sala manualmente.
          </p>
        </div>
      </section>

      <footer>
        Sistema de Gestión de Incidencias · Proyecto APT
      </footer>
    </main>
  )
}

export default App