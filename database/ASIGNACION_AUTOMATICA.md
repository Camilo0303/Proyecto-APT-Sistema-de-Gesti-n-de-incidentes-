# Asignación automática de incidencias

Requiere la tabla de turnos de `20261109_turnos_tecnicos.sql` y los estados Pendiente y Asignada de la base maestra.

Al crear una incidencia se selecciona un usuario con rol Técnico, cuenta habilitada y un turno sin finalizar cuyo vencimiento sea posterior a la hora de MySQL. Se elige al que tenga menos incidencias en estado Pendiente, Asignada o En proceso. Resueltas, cerradas y anuladas no cuentan como carga abierta.

En igualdad de carga se prioriza al técnico cuya última incidencia actualmente asignada tenga la fecha de creación más antigua. Un técnico sin incidencias tiene prioridad en ese desempate. Si las fechas también coinciden se ordena por identificador de usuario.

La incidencia se crea Pendiente; si hay candidato, pasa a Asignada con ese responsable antes de confirmar la transacción. El trigger existente conserva el movimiento CREACION, y el backend agrega ASIGNACION_AUTOMATICA con estado anterior, nuevo estado, responsable y explicación. El creador se obtiene de la sesión. Se ignora cualquier responsable o equipo enviado por el cliente; equipo permanece nulo.

Las asignaciones utilizan READ COMMITTED y bloquean las filas de los técnicos habilitados en orden de identificador. Los cambios de turno utilizan el mismo bloqueo de usuario. Después de esperar el bloqueo se consulta la carga confirmada más reciente. Si falla cualquier escritura, incluida la del historial, se revierte la creación completa.

Sin técnicos disponibles, la incidencia se conserva Pendiente y sin responsable. Al iniciar turno, se revisan esos reportes desde el más antiguo y se aplica la misma selección por menor carga para cada uno. La carga se recalcula después de cada asignación. La operación se limita a reportes pendientes sin responsable. Cada asignación conserva su movimiento ASIGNACION_AUTOMATICA y registra como actor al técnico que inició el turno.

El alta del turno, el reparto y sus historiales se confirman en una sola transacción. Si falla una escritura se revierte la operación completa. Repetir el inicio de turno permite reintentar el reparto sin duplicar un turno vigente ni asignaciones ya realizadas. Las tareas asignadas conservan su responsable cuando un técnico finaliza turno.

Reiniciar el backend después de actualizar el código. En una demostración, iniciar turno como técnico y reportar como profesor en sesiones de navegador independientes. Consultar el estado Asignada, su responsable y el movimiento en el historial administrativo.
