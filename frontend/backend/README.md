# Backend local SIGI

Desde esta carpeta: `npm.cmd start`. Configurar MySQL en `.env` (no subir este archivo a Git).
En otra terminal, desde `frontend`: `npm.cmd run dev`.
Después de modificar el backend, detener su instancia anterior con Ctrl+C y volver a iniciarlo.

## Autenticación

- POST /api/auth/registro: nombre, apellido, correo, password. Requiere un correo activo en correos_autorizados. El rol se obtiene exclusivamente de esa tabla.
- POST /api/auth/login: correo, password. Requiere usuario activo.
- GET /api/auth/me: consulta la sesión y vuelve a comprobar que el usuario esté activo.
- POST /api/auth/logout: elimina la sesión.
- Los POST requieren JSON y la cabecera X-SIGI-Request: 1.
- Contraseñas nuevas: scrypt con sal aleatoria. Las contraseñas en texto plano del SQL inicial se convierten después del primer login correcto. No se cambia su valor de acceso.
- Sesiones en memoria del servidor por 8 horas, con cookie HttpOnly y SameSite=Strict. Reiniciar el backend cierra todas las sesiones; el usuario debe volver a iniciar sesión.
- El dashboard requiere sesión y muestra el resumen general del establecimiento. No se han definido aún permisos diferenciados por rol para ese resumen.
- Este servidor se mantiene en localhost. Antes de desplegar se necesitan HTTPS y almacenamiento compartido/persistente de sesiones.
- Los formularios de incidencias y emergencias todavía no guardan en MySQL.

## Comprobar un registro en Workbench

```sql
SELECT id_usuario, nombre, apellido, correo, id_rol, activo,
       password LIKE 'scrypt$%' AS password_protegida
FROM usuarios
ORDER BY id_usuario DESC;
```

Para ver qué correos autorizados aún no tienen cuenta:

```sql
SELECT c.correo, r.nombre AS rol
FROM correos_autorizados c
JOIN roles r ON r.id_rol = c.id_rol
LEFT JOIN usuarios u ON u.correo = c.correo
WHERE c.activo = 1 AND u.id_usuario IS NULL;
```

## Verificaciones

`npm.cmd run check` valida sintaxis. `npm.cmd test` comprueba hashes sin tocar la BD.
Para integración real, en PowerShell:

```powershell
$env:RUN_DB_TESTS='1'
npm.cmd test
Remove-Item Env:RUN_DB_TESTS
```

La integración crea cuentas con nombres aleatorios @example.invalid y elimina únicamente sus registros al finalizar. Comprueba registro, autorización, duplicados, roles, hashes, cookies, logout, cuentas desactivadas y conversión de contraseñas antiguas.

Referencias: [Node crypto](https://nodejs.org/api/crypto.html) y [cookies Express](https://expressjs.com/en/5x/api.html#res.cookie).
