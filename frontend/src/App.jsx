import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import EscanearQR from "./pages/EscanearQR";
import Registro from "./pages/Registro";
import Reportar from "./pages/Reportar";
import Historial from "./pages/Historial";
import Panico from "./pages/Panico";


function App(){


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