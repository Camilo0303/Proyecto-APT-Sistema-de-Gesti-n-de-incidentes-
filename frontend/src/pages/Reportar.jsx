import {useState} from "react";
import {useNavigate} from "react-router-dom";
import {obtenerUsuario} from "../data/sesion";

import "./Reportar.css";


function Reportar(){


const navigate = useNavigate();

const usuario = obtenerUsuario();



const [form,setForm]=useState({

categoria:"",
prioridad:"",
titulo:"",
descripcion:""

});



if(!usuario){

return(

<div className="login-required">


<h1>
🔐 Inicio requerido
</h1>


<p>
Debes iniciar sesión antes de registrar una incidencia.
</p>



<button

onClick={()=>navigate("/login")}

>

Iniciar sesión

</button>


</div>

)

}





function cambiar(e){

setForm({

...form,

[e.target.name]:e.target.value

});

}




function enviar(){


console.log({

usuario:usuario.nombre,

...form

});


alert(
"Incidencia enviada correctamente"
);


}





return(


<div className="report-container">


<div className="form-card">



<h1>
➕ Reportar incidencia
</h1>



<p>
Usuario:
{usuario.nombre}
</p>




<label>
Categoría
</label>


<select

name="categoria"

onChange={cambiar}

>


<option>
Seleccione categoría
</option>


<option>
Tecnología
</option>


<option>
Infraestructura
</option>


<option>
Aseo
</option>


<option>
Equipamiento
</option>


</select>





<label>
Prioridad
</label>



<select

name="prioridad"

onChange={cambiar}

>


<option>
Seleccione prioridad
</option>


<option>
Baja
</option>


<option>
Media
</option>


<option>
Alta
</option>


<option>
Crítica
</option>


</select>






<label>
Título
</label>


<input

name="titulo"

placeholder="Ej: Computador no enciende"

onChange={cambiar}

/>






<label>
Descripción
</label>


<textarea

name="descripcion"

placeholder="Describe el problema"

onChange={cambiar}

/>





<label>
Fotografía

</label>


<input

type="file"

/>






<button

onClick={enviar}

>

Enviar incidencia

</button>



</div>


</div>


)


}


export default Reportar;