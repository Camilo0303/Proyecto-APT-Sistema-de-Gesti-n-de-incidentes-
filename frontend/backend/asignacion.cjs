async function asignarResponsable(conexion, idIncidencia, creador) {
  // Los turnos y las asignaciones bloquean primero las mismas filas de usuario.
  // READ COMMITTED permite contar lo confirmado por el envío anterior al obtener el bloqueo.
  await conexion.execute(`SELECT u.id_usuario FROM usuarios u
    WHERE u.activo=1 AND u.id_rol IN (SELECT id_rol FROM roles WHERE nombre='Técnico')
    ORDER BY u.id_usuario FOR UPDATE`);
  const [[tecnico]] = await conexion.execute(`SELECT u.id_usuario,
    CONCAT(u.nombre,' ',u.apellido) AS nombre,
    (SELECT COUNT(*) FROM incidencias i JOIN estados_incidencia e ON e.id_estado=i.id_estado
      WHERE i.id_responsable=u.id_usuario AND e.nombre IN ('Pendiente','Asignada','En proceso')) AS abiertas,
    (SELECT MAX(i.fecha_creacion) FROM incidencias i WHERE i.id_responsable=u.id_usuario) AS ultima_asignacion
    FROM usuarios u JOIN roles r ON r.id_rol=u.id_rol
    WHERE u.activo=1 AND r.nombre='Técnico'
      AND EXISTS (SELECT 1 FROM turnos_tecnicos t WHERE t.id_usuario=u.id_usuario
        AND t.fecha_fin IS NULL AND t.vence>NOW())
    ORDER BY abiertas,ultima_asignacion,u.id_usuario LIMIT 1`);
  if (!tecnico) return null;
  const [[estado]] = await conexion.execute("SELECT id_estado FROM estados_incidencia WHERE nombre='Asignada' ORDER BY id_estado LIMIT 1");
  if (!estado) throw new Error('Falta el estado Asignada para registrar el responsable.');
  const [[incidencia]] = await conexion.execute('SELECT id_estado FROM incidencias WHERE id_incidencia=?',[idIncidencia]);
  await conexion.execute('UPDATE incidencias SET id_responsable=?,id_estado=? WHERE id_incidencia=?', [tecnico.id_usuario,estado.id_estado,idIncidencia]);
  await conexion.execute(`INSERT INTO historial_incidencias
    (id_incidencia,tipo_movimiento,id_estado_anterior,id_estado_nuevo,id_usuario,id_responsable_asignado,comentario)
    VALUES(?,?,?,?,?,?,?)`,[idIncidencia,'ASIGNACION_AUTOMATICA',incidencia.id_estado,estado.id_estado,creador,tecnico.id_usuario,
    `Asignación automática al técnico en turno con menor carga (${Number(tecnico.abiertas)} incidencias abiertas antes de asignar).`]);
  return {id_usuario:tecnico.id_usuario,nombre:tecnico.nombre};
}
module.exports={asignarResponsable};
