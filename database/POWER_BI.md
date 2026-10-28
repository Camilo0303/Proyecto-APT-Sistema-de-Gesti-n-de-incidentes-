# Datos de incidencias para Power BI

En Administración → Dashboard, aplica los filtros y pulsa **Descargar CSV para Power BI**.
La descarga incluye todos los registros coincidentes, sin el límite de las páginas del historial.
Solo está disponible para administradores autenticados. Las emergencias de Enfermería no se incluyen.

## Importación

En Power BI Desktop utiliza **Obtener datos → Texto/CSV**, selecciona el archivo y comprueba:

- Codificación UTF-8 y delimitador coma.
- Identificadores y piso: número entero.
- `fecha_creacion` y `fecha_cierre`: fecha/hora, con formato `yyyy-MM-dd HH:mm:ss`. No llevan conversión de zona horaria: son las fechas guardadas por MySQL.
- `horas_resolucion`: número decimal con punto como separador (configuración regional inglés si fuera necesario).
- Los valores vacíos de cierre, responsable o duración deben permanecer como nulos.

Cada fila representa una incidencia; `id_incidencia` es su clave. Incluye título, sala y código, edificio y piso, categoría, prioridad, estado y creador/responsable con sus identificadores. No contiene contraseñas ni correos.

`horas_resolucion` solo tiene valor cuando el estado actual es Resuelta o Cerrada y la fecha de cierre es igual o posterior a la creación. El promedio del dashboard usa esos registros; una muestra vacía muestra «Sin datos». Representa tiempo transcurrido hasta el cierre registrado, no horas laborales ni tiempo individual trabajado por cada técnico.

La distribución por responsable refleja la asignación actual. Los reportes de profesores reflejan uso, no desempeño. Las salas no están ponderadas por ocupación.

Los textos que pueden interpretarse como fórmulas llevan un apóstrofo inicial de protección. Los nombres de columnas permanecen estables para facilitar las siguientes importaciones.

## Actualización posterior

El CSV es una fotografía del momento de descarga. Para actualizar el informe, descarga nuevamente con los mismos filtros y reemplaza el archivo origen; después actualiza Power BI. La conexión automática directa a MySQL se puede configurar después con un usuario de solo lectura y acceso al servidor. GitHub sincroniza el código, no los datos de MySQL.
