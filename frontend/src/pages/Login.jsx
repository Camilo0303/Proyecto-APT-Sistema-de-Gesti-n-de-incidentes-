import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";


function Login(){

  const navigate = useNavigate();


  const [correo,setCorreo] = useState("");

  const [password,setPassword] = useState("");



  const iniciarSesion = () => {


    const usuarioGuardado = localStorage.getItem("usuario");


    if(!usuarioGuardado){

      alert("No existe ningún usuario registrado");

      return;

    }



    const usuario = JSON.parse(usuarioGuardado);



    if(
      usuario.correo === correo
    ){

      alert(
        "Bienvenido " + usuario.nombre +
        "\nRol: " + usuario.rol
      );


      localStorage.setItem(
        "sesion",
        JSON.stringify(usuario)
      );


      navigate("/");


    }else{


      alert(
        "Correo incorrecto"
      );


    }


  };




return(


<main className="login-page">


<div className="login-card">


<div className="login-icon">

🔐

</div>



<h1>

Iniciar sesión

</h1>


<p>

Acceso al Sistema de Incidencias

</p>




<label>

Correo institucional

</label>


<input

type="email"

placeholder="correo@colegio.cl"

value={correo}

onChange={
(e)=>setCorreo(e.target.value)
}

/>




<label>

Contraseña

</label>


<input

type="password"

placeholder="********"

value={password}

onChange={
(e)=>setPassword(e.target.value)
}

/>



<button
onClick={iniciarSesion}
>

Ingresar

</button>



<p
onClick={()=>navigate("/registro")}
style={{
cursor:"pointer"
}}
>

¿No tienes cuenta? Registrar

</p>



</div>


</main>


)


}


export default Login;