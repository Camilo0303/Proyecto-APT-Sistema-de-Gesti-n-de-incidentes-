import './Home.css'

function Home() {

  return (
    <main className="home">

      <header className="top">

        <div className="logo">
          🏫
        </div>

        <div>
          <h1>
            Sistema de Incidencias
          </h1>

          <p>
            Gestión de infraestructura escolar
          </p>
        </div>

      </header>


      <section className="welcome">

        <h2>
          Hola 👋
        </h2>

        <p>
          ¿Qué necesitas realizar?
        </p>

      </section>


      <section className="menu">


        <button className="card qr">

          <span>
            📷
          </span>

          <div>
            <h3>
              Escanear QR
            </h3>

            <p>
              Identifica automáticamente la sala
            </p>
          </div>

        </button>



        <button className="card history">

          <span>
            📋
          </span>

          <div>
            <h3>
              Historial
            </h3>

            <p>
              Revisa tus reportes enviados
            </p>
          </div>

        </button>



        <button className="card panic">

          <span>
            🚨
          </span>

          <div>
            <h3>
              Botón de pánico
            </h3>

            <p>
              Generar alerta de emergencia
            </p>
          </div>

        </button>



        <button className="card login">

          <span>
            🔐
          </span>

          <div>
            <h3>
              Iniciar sesión
            </h3>

            <p>
              Acceso para profesores y encargados
            </p>
          </div>

        </button>


      </section>



      <footer>

        📍 Ubicación no detectada

      </footer>


    </main>
  )
}


export default Home