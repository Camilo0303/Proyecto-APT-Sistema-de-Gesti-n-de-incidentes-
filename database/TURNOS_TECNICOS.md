# Turnos del equipo técnico

Aplicar `20261109_turnos_tecnicos.sql` sobre la base configurada en el backend, después de crear la base maestra. El script agrega una tabla y conserva usuarios, equipos e incidencias. Reiniciar el backend después de actualizar el código.

La cuenta habilitada (`usuarios.activo`) permite iniciar sesión. La disponibilidad laboral se registra por separado en `turnos_tecnicos`.

Al entrar, el técnico ve su estado y puede pulsar **Iniciar turno**. El inicio es explícito: consultar el panel o iniciar sesión no activa automáticamente un turno. Puede finalizarlo desde el panel o mediante **Finalizar turno y cerrar sesión**. Cerrar sesión en cualquier dispositivo finaliza la disponibilidad del usuario en todos sus dispositivos. Si falla ese guardado, la sesión se conserva para reintentar.

Los turnos vencen ocho horas después de iniciarse y no se renuevan al consultar el panel. Al cerrar el navegador no se envía un cierre fiable: el vencimiento limita la disponibilidad restante. Cada consulta considera disponible solo un turno con `fecha_fin IS NULL AND vence > NOW()`, perteneciente a una cuenta técnica habilitada. El panel consulta el estado cada 15 segundos y al recuperar el foco.

Los inicios y cierres se conservan en la tabla. Al volver a iniciar se cierran los registros vencidos con su fecha de vencimiento. El bloqueo de la fila del usuario serializa los cambios para impedir inicios simultáneos duplicados.

Esta etapa registra disponibilidad. La creación de incidencias todavía conserva el comportamiento previo de asignación; la asignación automática se implementará en la siguiente etapa.
