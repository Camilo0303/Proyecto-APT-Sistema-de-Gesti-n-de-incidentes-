import {useState} from "react";
import "./Panico.css";


function Panico(){


const [enviado,setEnviado]=useState(false);



return(

<div className="panic-container">


{

!enviado ?


<>


<h1>
🚨 Emergencia
</h1>


<p>
Presiona solamente si necesitas asistencia inmediata
</p>



<button

className="panic-button"

onClick={()=>setEnviado(true)}

>

🚨 ACTIVAR ALERTA

</button>


</>


:


<>


<h1>
🚨 ALERTA ENVIADA
</h1>


<p>
La emergencia fue notificada correctamente.
</p>


<div className="alert-card">

📍 Ubicación detectada

<br/>

⏱ Registro realizado

<br/>

👥 Personal informado

</div>


</>


}


</div>

)

}


export default Panico;