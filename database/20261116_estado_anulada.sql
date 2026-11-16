INSERT INTO estados_incidencia (nombre, descripcion)
SELECT 'Anulada', 'Incidencia anulada con motivo registrado en el historial'
WHERE NOT EXISTS (
  SELECT 1 FROM estados_incidencia WHERE nombre = 'Anulada'
);
