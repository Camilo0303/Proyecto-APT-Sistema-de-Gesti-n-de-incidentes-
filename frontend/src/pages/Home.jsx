import "./Home.css";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { obtenerUsuario, cerrarSesion } from "../data/sesion";


function Home(){


const navigate = useNavigate();

const usuario = obtenerUsuario();

const [menu,setMenu] = useState(false);



function irAReportar(){

if(usuario){

navigate("/reportar");

}
else{

navigate("/login");

}

}



return(


<div className="layout">


<aside className="sidebar">


<div className="brand">

<div className="brand-logo">
🏫
</div>


<div>

<h2>
SIGI
</h2>

<p>
Gestión incidencias
</p>


</div>

</div>



<nav>


<button className="active">

🏠 Dashboard

</button>


<button onClick={()=>navigate("/escanear")}>

📷 Escanear QR

</button>



<button onClick={irAReportar}>

➕ Reportar incidencia

</button>



<button onClick={()=>navigate("/historial")}>

📋 Mis reportes

</button>



<button onClick={()=>navigate("/panico")}>

🚨 Botón de pánico

</button>



</nav>


</aside>







<main className="content">



<header className="topbar">


<div>

<h1>
Sistema de Gestión de Incidencias
</h1>


<p>
Control de infraestructura y equipamiento
</p>

</div>






<div className="profile">



{
usuario ?


<>


<button onClick={()=>setMenu(!menu)}>

👤 {usuario.nombre} ▼

</button>



{

menu &&

<div className="dropdown">


<p>
<strong>
Rol:
</strong>

<br/>

{usuario.rol}

</p>


<p>
<strong>
Área:
</strong>

<br/>

{usuario.area}

</p>



<button

onClick={()=>{

cerrarSesion();

navigate("/");

}}

>

Cerrar sesión

</button>



</div>

}


</>




:


<button

className="login-button"

onClick={()=>navigate("/login")}

>

🔐 Iniciar sesión

</button>


}




</div>



</header>







<section className="welcome-card">


<div>

<h2>
Bienvenido al sistema 👋
</h2>


<p>
Reporta problemas del establecimiento de forma rápida y segura.
</p>


</div>




<button onClick={irAReportar}>

+ Nueva incidencia

</button>



</section>







<section className="stats">


<div className="stat blue">

<span>
📋
</span>

<h2>
0
</h2>

<p>
Total incidencias
</p>

</div>




<div className="stat yellow">

<span>
⏳
</span>

<h2>
0
</h2>

<p>
Pendientes
</p>

</div>





<div className="stat purple">

<span>
⚙️
</span>

<h2>
0
</h2>

<p>
En proceso
</p>

</div>





<div className="stat green">

<span>
✅
</span>

<h2>
0
</h2>

<p>
Resueltas
</p>

</div>


</section>






<section className="panel">


<h2>
Últimos reportes
</h2>


<div className="empty-box">


📂


<h3>
No existen incidencias registradas
</h3>


<p>
Los reportes aparecerán cuando sean creados.
</p>



</div>


</section>




</main>


</div>


)


}


export default Home;