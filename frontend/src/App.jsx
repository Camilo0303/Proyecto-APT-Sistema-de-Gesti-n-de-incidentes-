import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import { restaurarSesion } from "./data/sesion";

import Home from "./pages/Home";
import Login from "./pages/Login";
import EscanearQR from "./pages/EscanearQR";
import Registro from "./pages/Registro";
import Reportar from "./pages/Reportar";
import Historial from "./pages/Historial";
import Panico from "./pages/Panico";


function App(){
const [listo, setListo] = useState(false);
const [error, setError] = useState('');
const [intento, setIntento] = useState(0);
useEffect(() => {
  let activo = true;
  restaurarSesion().then(() => { if (activo) setListo(true); })
    .catch(err => { if (activo) setError(err.message); });
  return () => { activo = false; };
}, [intento]);
if (!listo) return <div className="login-page"><div className="login-card">
  <h1>SIGI</h1>
  {error ? <><p role="alert">{error}</p><button onClick={() => { setError(''); setIntento(valor => valor + 1); }}>Reintentar</button></>
    : <p role="status">Comprobando sesión...</p>}
</div></div>;


return (

<BrowserRouter>

<Routes>

<Route
path="/registro"
element={<Registro/>}
/>
<Route
path="/historial"
element={<Historial/>}
/>


<Route
path="/panico"
element={<Panico/>}
/>

<Route 
path="/reportar"
element={<Reportar/>}
/>

<Route 
path="/" 
element={<Home/>}
/>


<Route
path="/login"
element={<Login/>}
/>


<Route
path="/escanear"
element={<EscanearQR/>}
/>


</Routes>


</BrowserRouter>


)

}


export default App;
