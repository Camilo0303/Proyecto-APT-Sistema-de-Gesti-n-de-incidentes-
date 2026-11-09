# Asignación automática de nuevas incidencias

Requiere la tabla de turnos de `20261109_turnos_tecnicos.sql` y los estados Pendiente y Asignada de la base maestra. No agrega columnas ni modifica reportes anteriores.

Al crear una incidencia se selecciona un usuario con rol Técnico, cuenta habilitada y un turno sin finalizar cuyo vencimiento sea posterior a la hora de MySQL. Se elige al que tenga menos incidencias en estado Pendiente, Asignada o En proceso. Resueltas, cerradas y anuladas no cuentan como carga abierta.

En igualdad de carga se prioriza al técnico cuya última incidencia actualmente asignada tenga la fecha de creación más antigua. Un técnico sin incidencias tiene prioridad en ese desempate. Si las fechas también coinciden se ordena por identificador de usuario.

La incidencia se crea Pendiente; si hay candidato, pasa a Asignada con ese responsable antes de confirmar la transacción. El trigger existente conserva el movimiento CREACION, y el backend agrega ASIGNACION_AUTOMATICA con estado anterior, nuevo estado, responsable y explicación. El creador se obtiene de la sesión. Se ignora cualquier responsable o equipo enviado por el cliente; equipo permanece nulo.

Las asignaciones utilizan READ COMMITTED y bloquean las filas de los técnicos habilitados en orden de identificador. Los cambios de turno utilizan el mismo bloqueo de usuario. Después de esperar el bloqueo se consulta la carga confirmada más reciente. Si falla cualquier escritura, incluida la del historial, se revierte la creación completa.

Sin técnicos disponibles, la incidencia se conserva Pendiente y sin responsable. No se reasignan automáticamente reportes anteriores ni se redistribuyen tareas cuando un técnico finaliza turno. El técnico responsable mantiene las acciones existentes para tomar y resolver su incidencia.

Reiniciar el backend después de actualizar el código. En una demostración, iniciar turno como técnico y reportar como profesor en sesiones de navegador independientes. Consultar el estado Asignada, su responsable y el movimiento en el historial administrativo.
