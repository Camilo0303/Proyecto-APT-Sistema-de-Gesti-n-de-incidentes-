# Emergencias internas

El profesor abre Emergencia, escanea el QR de una sala activa, selecciona el tipo y confirma. No se envía nada al escanear: solo al confirmar. La API valida nuevamente el código contra MySQL y toma el usuario de la sesión.

Enfermería consulta cada cinco segundos todas las alertas Pendiente y En atención; las pendientes aparecen en rojo. Se actualiza también al volver a enfocar la ventana. No hay notificaciones del sistema operativo ni entrega garantizada con el navegador cerrado o suspendido. Los errores de conexión se muestran sin ocultar que la información puede estar desactualizada.

Enfermería toma una alerta y luego la marca Atendida. Solo la persona que la tomó puede finalizarla. Los cambios se registran transaccionalmente en historial_alertas; la creación la registra el trigger trg_crear_historial_alerta ya existente. No se contactan servicios de emergencia externos.

Requisitos: tablas alertas, historial_alertas, tipos_emergencia, estados_alerta del modelo V02/V04; trigger de creación; estados Pendiente, En atención y Atendida. Aplicar 20261019_emergencias.sql sobre la base seleccionada si falta el rol Enfermería. No usar la maestra completa para este ajuste.

El administrador debe autorizar un correo con rol Enfermería; luego la persona se registra. No se crean cuentas ni claves predeterminadas. Reiniciar el backend tras actualizar su código. Para probar roles distintos a la vez usar sesiones de navegador separadas (normal e incógnito), pues comparten la misma cookie en pestañas normales.

Prueba: descargar QR desde Administración, entrar como profesor y confirmar una emergencia de prueba; comprobar el aviso rojo desde Enfermería, tomar atención y marcar Atendida; el profesor puede consultar el estado en su confirmación. No hacer estas pruebas mientras se usa el sistema para emergencias reales. Probar también un QR inexistente, permiso de cámara denegado y pérdida de conexión. Cámara requiere HTTPS o localhost; acceder por IP HTTP desde un teléfono no permite asumir disponibilidad de cámara.

Reintentar el envío de una alerta del mismo profesor, sala y tipo devuelve la alerta activa existente para evitar duplicados. Esto agrupa esas alertas mientras estén pendientes o en atención; otro profesor puede generar su propia alerta en la misma sala. El panel muestra las últimas 20 atendidas y todas las activas.
