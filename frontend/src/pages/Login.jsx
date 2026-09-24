import {useState} from "react";
import {useNavigate} from "react-router-dom";

import {usuarios} from "../data/usuarios";
import {iniciarSesion} from "../data/sesion";

import "./Login.css";


function Login(){


const navigate = useNavigate();


const [correo,setCorreo]=useState("");

const [password,setPassword]=useState("");




function ingresar(){



const usuario = usuarios.find(

(u)=>

u.correo===correo &&
u.password===password

);



if(!usuario){


alert(
"Correo o contraseña incorrectos"
);


return;


}



iniciarSesion(usuario);


navigate("/");



}




return(


<div className="login-page">


<div className="login-card">



<div className="login-logo">

🏫

</div>




<h1>
Sistema de Incidencias
</h1>



<p>
Acceso personal autorizado
</p>




<input

placeholder="Correo institucional"

onChange={(e)=>setCorreo(e.target.value)}

/>




<input

type="password"

placeholder="Contraseña"

onChange={(e)=>setPassword(e.target.value)}

/>





<button

onClick={ingresar}

>

Ingresar

</button>




<p>
¿No tienes cuenta?
</p>



<button

onClick={()=>navigate("/registro")}

>

Crear registro

</button>




</div>


</div>


)


}


export default Login;