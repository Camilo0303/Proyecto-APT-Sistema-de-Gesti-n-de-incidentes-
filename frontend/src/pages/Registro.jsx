import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";


function Registro() {


  const navigate = useNavigate();


  const [usuario, setUsuario] = useState({

    nombre: "",
    correo: "",
    password: ""

  });




  // Detecta el rol según el correo

  const determinarRol = (correo) => {


    if (correo.includes("@profesor.")) {

      return "Profesor";

    }


    if (correo.includes("@cetec.com")) {

      return "CETECOM";

    }


    if (correo.includes("@enfermeria.")) {

      return "Enfermeria";

    }


    if (correo.includes("@mantencion.")) {

      return "Mantencion";

    }


    if (correo.includes("@admin.")) {

      return "Administrador";

    }


    return null;

  };





  const registrar = () => {


    const rol = determinarRol(usuario.correo);



    if (!rol) {


      alert(
        "Correo no autorizado para registrarse"
      );


      return;


    }




    const nuevoUsuario = {


      nombre: usuario.nombre,

      correo: usuario.correo,

      password: usuario.password,

      rol: rol


    };





    localStorage.setItem(

      "usuario",

      JSON.stringify(nuevoUsuario)

    );





    alert(

      "Registro exitoso como " + rol

    );





    navigate("/login");


  };






  return (


    <main className="login-page">



      <div className="login-card">



        <div className="login-icon">

          🏫

        </div>




        <h1>

          Crear cuenta

        </h1>



        <p>

          Registro de usuario autorizado

        </p>





        <label>

          Nombre completo

        </label>



        <input

          type="text"

          placeholder="Ej: Claudio González"

          onChange={(e)=>

            setUsuario({

              ...usuario,

              nombre:e.target.value

            })

          }

        />





        <label>

          Correo institucional

        </label>



        <input


          type="email"

          placeholder="correo@profesor.duoc.cl"

          onChange={(e)=>

            setUsuario({

              ...usuario,

              correo:e.target.value

            })

          }

        />



        <small>

          Solo usuarios autorizados pueden registrarse

        </small>







        <label>

          Contraseña

        </label>




        <input


          type="password"

          placeholder="********"

          onChange={(e)=>

            setUsuario({

              ...usuario,

              password:e.target.value

            })

          }

        />







        <button

          onClick={registrar}

        >

          Crear cuenta

        </button>






        <p

          style={{cursor:"pointer"}}

          onClick={()=>navigate("/login")}

        >

          ¿Ya tienes cuenta? Iniciar sesión

        </p>





      </div>



    </main>


  );


}



export default Registro;