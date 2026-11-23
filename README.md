# SIGI

Sistema web para registrar incidencias por sala, organizar su atención técnica, gestionar emergencias de Enfermería y consultar indicadores administrativos.

## Inicio local

Iniciar MySQL y configurar `frontend/backend/.env`. `DB_NAME` identifica la base que utiliza la aplicación. El archivo `.env.example` sirve de referencia.

Desde la raíz del proyecto, iniciar el backend.

```cmd
cd frontend\backend
npm.cmd start
```

En otra terminal desde la raíz, iniciar la interfaz.

```cmd
cd frontend
npm.cmd run dev
```

Abrir la dirección que muestre Vite, normalmente `http://127.0.0.1:5173`. Reiniciar el backend después de cambiar sus archivos. Sus sesiones están en memoria y se inicia sesión nuevamente después del reinicio.

## Mapa para ubicar el código

| Archivo dentro de frontend | Responsabilidad |
| --- | --- |
| `src/main.jsx` | Monta React. |
| `src/App.jsx` | Rutas y acceso a las vistas. |
| `src/components/MarcoAplicacion.jsx` | Cabecera, menú y cierre de sesión compartidos. |
| `src/components/navegacion.js` | Enlaces del menú por rol. |
| `src/data/api.js` | Solicitudes HTTP y errores de la API. |
| `src/data/sesion.js` | Login, registro, restauración y cierre de sesión. |
| `src/pages/Reportar.jsx` | Formulario de incidencias. |
| `src/pages/EscanearQR.jsx` | Cámara, lectura de QR y selección manual de sala. |
| `src/pages/Cetecom.jsx` | Bandeja y acciones del técnico. |
| `src/pages/Panico.jsx` | Envío de emergencias por sala. |
| `src/pages/Enfermeria.jsx` | Consulta y atención de emergencias. |
| `src/pages/Administrador.jsx` | Secciones administrativas. |
| `src/hooks/useSonidoAlertas.js` | Alarma para nuevas alertas pendientes. |
| `src/utils/mantenerPulsado.js` | Confirmación sostenida de cinco segundos. |
| `backend/server.cjs` | Express, conexión MySQL y registro de rutas. |
| `backend/auth.cjs` | Autenticación, sesiones y registro autorizado. |
| `backend/passwords.cjs` | Hashes scrypt y comprobación de contraseñas. |
| `backend/permisos.cjs` | Permisos por rol en el servidor. |
| `backend/incidencias.cjs` | Registro y consulta de reportes propios. |
| `backend/asignacion.cjs` | Selección por carga y reparto de pendientes. |
| `backend/turnos.cjs` | Disponibilidad y reparto al iniciar turno. |
| `backend/cetecom.cjs` | Atención, resolución y anulación de incidencias. |
| `backend/emergencias.cjs` | Creación y atención de alertas. |
| `backend/administracion.cjs` | Usuarios, turnos, salas QR e historial general. |
| `backend/correos.cjs` | Correos autorizados para registro. |
| `backend/filtros-incidencias.cjs` | Validación y construcción de filtros. |
| `backend/dashboard.cjs` | Indicadores y exportación CSV. |

La carpeta `database` reúne migraciones y notas de operación. Los `.jsx` construyen pantallas, los `.css` definen estilos, los `.cjs` implementan el servidor, los `.md` contienen documentación y los `.sql` contienen cambios de base de datos. Los archivos `.test.cjs` y `.test.mjs` comprueban el comportamiento.

## Recorridos para mostrar durante la defensa

### Registrar y asignar una incidencia

`Reportar.jsx` envía el formulario mediante `api.js`. `server.cjs` aplica sesión y permisos y dirige la solicitud a `incidencias.cjs`. Ese módulo valida e inserta el reporte. `asignacion.cjs` selecciona un técnico con turno vigente y menor carga y registra la asignación dentro de la misma transacción.

En `asignacion.cjs`, reconocer la condición de turno y el orden de selección.

```sql
t.fecha_fin IS NULL AND t.vence>NOW()
ORDER BY abiertas,ultima_asignacion,u.id_usuario LIMIT 1
```

### Iniciar un turno y repartir pendientes

`TurnoTecnico.jsx` envía `en_turno: true`. `turnos.cjs` registra o recupera el turno y llama a `asignarPendientes`. Esa función procesa reportes pendientes sin responsable, desde el más antiguo, y recalcula la carga para cada asignación. El historial identifica al técnico que inició la operación.

### Enviar y atender una emergencia

`EscanearQR.jsx` identifica la sala y `Panico.jsx` prepara la alerta. `BotonMantener.jsx` usa `crearPulsacion` para confirmar el envío. `emergencias.cjs` valida la sala, el tipo y los permisos. `Enfermeria.jsx` consulta las alertas y registra la atención. `useSonidoAlertas.js` reproduce la alarma cuando detecta una nueva pendiente y el audio está habilitado.

## Preguntas sobre cambios y sus efectos

| Cambio o pregunta | Efecto y archivo para explicarlo |
| --- | --- |
| Detener MySQL | La API pierde acceso a los registros y la interfaz muestra un error. Conexión en `server.cjs` y respuestas en `api.js`. |
| Cambiar el puerto del backend | Hay que ajustar el proxy `/api` de `vite.config.js` durante el desarrollo. |
| Ocultar un enlace del menú | Cambia la navegación visible. Los permisos de las operaciones se comprueban en el backend. Mostrar `navegacion.js` y `permisos.cjs`. |
| Quitar un control `permitirRoles` | Se elimina una comprobación de perfil de la ruta. Mostrar también los demás controles aplicados en `server.cjs`. |
| Crear un reporte sin técnicos en turno | Queda pendiente y sin responsable. Iniciar un turno activa el reparto. Mostrar `asignacion.cjs` y `turnos.cjs`. |
| Quitar `abiertas` del orden de selección | La elección deja de priorizar la menor carga. Mostrar el `ORDER BY` de `asignarResponsable`. |
| Omitir `asignarPendientes` al iniciar turno | Los reportes anteriores siguen esperando. Los nuevos aún usan la asignación al crearse. |
| Fallar al insertar el historial | La transacción revierte los cambios relacionados. Mostrar `commit`, `rollback` y el bloque de error. |
| Quitar los bloqueos | Solicitudes simultáneas podrían competir por el mismo reporte o decidir con una carga desactualizada. Mostrar `FOR UPDATE`. |
| Eliminar una clave foránea | MySQL deja de comprobar esa referencia. La validación restante depende de los otros controles. Mostrar la definición de la tabla. |
| Borrar o anular una incidencia | La anulación conserva el reporte y su historial con el estado Anulada. Mostrar la acción `anular` en `cetecom.cjs`. |
| Cambiar `duracion = 5000` | Cambia el tiempo de pulsación de la interfaz. Mostrar `mantenerPulsado.js`. |
| Comprobar si alguien escaneó físicamente un QR | El servidor valida el código recibido. Ese código por sí solo no acredita una lectura por cámara ni la presencia física. Mostrar `Panico.jsx` y `emergencias.cjs`. |
| Desactivar el sonido | La alerta permanece guardada y visible. El hook deja de reproducir tonos. Mostrar `useSonidoAlertas.js`. |
| Actualizar Power BI | El flujo actual requiere exportar y cargar un nuevo CSV. Mostrar `dashboard.cjs` y `database/POWER_BI.md`. |

Los casos de prueba permiten demostrar efectos y errores con ejemplos reproducibles. En cada explicación seguir el recorrido entre pantalla, solicitud HTTP, regla del servidor y resultado en MySQL.

## Verificación

Desde `frontend`, ejecutar `npm.cmd run lint` y `npm.cmd run build`.

Desde `frontend/backend`, ejecutar las pruebas locales.

```cmd
node --test *.test.cjs
```

Desde `frontend`, comprobar el botón sostenido.

```cmd
node --test src/utils/mantenerPulsado.test.mjs
```

Los detalles de las pruebas de integración opcionales están en `frontend/backend/README.md`.
