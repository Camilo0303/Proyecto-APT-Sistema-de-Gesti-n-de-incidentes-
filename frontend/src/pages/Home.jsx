import { useNavigate } from "react-router-dom";
import "./Home.css";


function Home() {


  const navigate = useNavigate();



  return (


    <main className="home-container">



      <header className="header">


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



        <span className="status">
          Sistema activo
        </span>



      </header>





      <section className="welcome">


        <h2>
          Hola 👋
        </h2>


        <p>
          ¿Qué necesitas realizar?
        </p>



      </section>





      <section className="menu-grid">





        {/* ESCANEAR QR */}

        <div
          className="menu-card qr"
          onClick={() => navigate("/escanear")}
        >


          <div className="icon">
            📷
          </div>



          <div>

            <h3>
              Escanear QR
            </h3>


            <p>
              Identifica automáticamente la sala
            </p>


          </div>



        </div>






        {/* HISTORIAL */}


        <div
          className="menu-card history"
          onClick={() => alert("Módulo historial próximamente")}
        >


          <div className="icon">
            📋
          </div>



          <div>

            <h3>
              Historial
            </h3>


            <p>
              Revisa tus reportes enviados
            </p>


          </div>


        </div>








        {/* BOTON PANICO */}


        <div
          className="menu-card panic"
          onClick={() => alert("Alerta de emergencia activada")}
        >


          <div className="icon">
            🚨
          </div>



          <div>

            <h3>
              Botón de pánico
            </h3>


            <p>
              Generar alerta de emergencia
            </p>


          </div>



        </div>








        {/* LOGIN */}


        <div
          className="menu-card login"
          onClick={() => navigate("/login")}
        >


          <div className="icon">
            🔐
          </div>




          <div>

            <h3>
              Iniciar sesión
            </h3>


            <p>
              Acceso para profesores y encargados
            </p>


          </div>




        </div>





      </section>







      <footer>

        Sistema de Gestión de Incidencias · Proyecto APT

      </footer>




    </main>


  );


}



export default Home;