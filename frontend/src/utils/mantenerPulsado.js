// El plazo se mide con reloj monótono, no contando clics ni repeticiones de teclado.
export function crearPulsacion({ activar, progreso, duracion = 5000,
  reloj = () => performance.now(), programar = setTimeout, cancelar = clearTimeout }) {
  let temporizador = null;
  let inicio = null;
  function detener() {
    if (temporizador !== null) cancelar(temporizador);
    temporizador = null;
    inicio = null;
    progreso(0);
  }
  function avanzar() {
    if (inicio === null) return;
    const transcurrido = reloj() - inicio;
    if (transcurrido >= duracion) {
      inicio = null; temporizador = null;
      progreso(0);
      activar();
      return;
    }
    progreso(Math.max(0, transcurrido / duracion));
    temporizador = programar(avanzar, Math.min(50, duracion - transcurrido));
  }
  return {
    iniciar() {
      if (inicio !== null) return;
      inicio = reloj();
      avanzar();
    },
    detener,
  };
}
