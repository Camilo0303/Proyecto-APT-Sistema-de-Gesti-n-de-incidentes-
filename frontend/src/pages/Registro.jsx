import {useState} from "react";
import {useNavigate} from "react-router-dom";

import "./Login.css";


function Registro(){


const navigate = useNavigate();



const [datos,setDatos]=useState({

nombre:"",
correo:"",
password:""

});




function cambiar(e){

setDatos({

...datos,

[e.target.name]:e.target.value

});

}




function registrar(){



if(!datos.correo.includes("@profesor")){


alert(
"Solo se permiten correos autorizados de profesores"
);


return;


}



localStorage.setItem(

"usuarioActivo",

JSON.stringify({

nombre:datos.nombre,

correo:datos.correo,

password:datos.password,

rol:"Profesor",

area:"Docencia"

})

);



alert(
"Registro realizado correctamente"
);



navigate("/");


}





return(


<div className="login-page">


<div className="login-card">


<div className="login-logo">
🏫
</div>



<h1>
Crear cuenta
</h1>


<p>
Registro profesor autorizado
</p>




<input

name="nombre"

placeholder="Nombre completo"

onChange={cambiar}

/>





<input

name="correo"

placeholder="correo@profesor.duoc.cl"

onChange={cambiar}

/>




<input

type="password"

name="password"

placeholder="Contraseña"

onChange={cambiar}

/>




<button

onClick={registrar}

>

Registrarse

</button>



<button

onClick={()=>navigate("/login")}

>

Volver

</button>



</div>


</div>


)


}


export default Registro;