import { BrowserRouter, Routes, Route } from "react-router-dom";

import Home from "./pages/Home";
import Login from "./pages/Login";
import EscanearQR from "./pages/EscanearQR";
import Registro from "./pages/Registro";


function App(){


return (

<BrowserRouter>

<Routes>

<Route
path="/registro"
element={<Registro/>}
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