export function iniciarSesion(usuario){

    localStorage.setItem(
        "usuarioActivo",
        JSON.stringify(usuario)
    );

}


export function obtenerUsuario(){

    return JSON.parse(
        localStorage.getItem("usuarioActivo")
    );

}


export function cerrarSesion(){

    localStorage.removeItem(
        "usuarioActivo"
    );

}