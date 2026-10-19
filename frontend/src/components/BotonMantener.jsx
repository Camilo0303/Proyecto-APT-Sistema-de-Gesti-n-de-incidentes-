import { useEffect, useRef, useState } from 'react';
import { crearPulsacion } from '../utils/mantenerPulsado';

export default function BotonMantener({ deshabilitado, enviando, activar }) {
  const [progreso, setProgreso] = useState(0);
  const controlador = useRef(null);
  const origen = useRef(null);
  const callback = useRef(activar);
  useEffect(() => { callback.current = activar; }, [activar]);
  useEffect(() => {
    const control = crearPulsacion({ activar: () => { origen.current = null; callback.current(); }, progreso: setProgreso });
    controlador.current = control;
    const detener = () => { origen.current = null; control.detener(); };
    const visibilidad = () => { if (document.hidden) detener(); };
    window.addEventListener('blur', detener);
    document.addEventListener('visibilitychange', visibilidad);
    return () => {
      control.detener(); controlador.current = null; origen.current = null;
      window.removeEventListener('blur', detener);
      document.removeEventListener('visibilitychange', visibilidad);
    };
  }, [deshabilitado]);
  function detener() { origen.current = null; controlador.current?.detener(); }
  function iniciar(fuente) {
    if (deshabilitado || origen.current !== null) return;
    origen.current = fuente; controlador.current?.iniciar();
  }
  return <>
    <button type="button" className="panico-activar panico-mantener" disabled={deshabilitado}
      aria-describedby="panico-instruccion" style={{ '--avance': `${progreso * 100}%` }}
      onPointerDown={e => {
        if (!e.isPrimary || e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        iniciar(`puntero-${e.pointerId}`);
      }}
      onPointerUp={detener} onPointerCancel={detener} onPointerLeave={detener} onLostPointerCapture={detener}
      onBlur={detener} onContextMenu={e => e.preventDefault()}
      onKeyDown={e => {
        if (e.key === 'Escape') { detener(); return; }
        if (e.key !== ' ' && e.key !== 'Enter') return;
        e.preventDefault();
        if (!e.repeat) iniciar(`tecla-${e.key}`);
      }}
      onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); detener(); } }}
      onClick={e => e.preventDefault()}>
      <span aria-hidden="true">!</span>
      <strong>{enviando ? 'Enviando alerta…' : progreso > 0 ? `Mantén presionado · ${Math.max(1, Math.ceil(5 * (1 - progreso)))} s` : 'MANTÉN 5 S PARA ALERTAR'}</strong>
    </button>
    <div className="panico-barra" role="progressbar" aria-label="Tiempo de pulsación para activar la alerta" aria-valuemin={0} aria-valuemax={5} aria-valuenow={Math.min(5, Math.floor(progreso * 5))}><span style={{ width: `${progreso * 100}%` }} /></div>
    <p id="panico-instruccion" className="panico-nota">Mantén el botón presionado durante 5 segundos con el dedo o el mouse. Con teclado, mantén Espacio o Enter. Suelta antes para cancelar.</p>
  </>;
}
