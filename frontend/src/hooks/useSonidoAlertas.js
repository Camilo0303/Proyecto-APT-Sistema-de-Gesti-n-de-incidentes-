import { useEffect, useRef, useState } from 'react';

export default function useSonidoAlertas(alertas) {
  const [activo, setActivo] = useState(false);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const audio = useRef(null);
  const habilitado = useRef(false);
  const conocidas = useRef(null);
  const nodos = useRef(new Set());
  const montado = useRef(true);

  function detener() {
    for (const nodo of nodos.current) {
      try { nodo.stop(); } catch { /* El tono ya terminó. */ }
      nodo.disconnect();
    }
    nodos.current.clear();
  }
  function sonar() {
    const contexto = audio.current;
    if (!habilitado.current || contexto?.state !== 'running') return;
    detener();
    // Tres tonos breves con volumen moderado y sin archivos externos.
    [0, 0.3, 0.6].forEach((retraso, indice) => {
      const tono = contexto.createOscillator();
      const volumen = contexto.createGain();
      const inicio = contexto.currentTime + retraso;
      tono.type = 'sine'; tono.frequency.value = indice === 1 ? 1046 : 880;
      volumen.gain.setValueAtTime(0, inicio);
      volumen.gain.linearRampToValueAtTime(0.12, inicio + 0.015);
      volumen.gain.linearRampToValueAtTime(0, inicio + 0.2);
      tono.connect(volumen); volumen.connect(contexto.destination);
      nodos.current.add(tono);
      tono.onended = () => { nodos.current.delete(tono); tono.disconnect(); volumen.disconnect(); };
      tono.start(inicio); tono.stop(inicio + 0.21);
    });
  }

  useEffect(() => {
    if (!alertas) return;
    const pendientes = new Set(alertas.filter(a => a.estado === 'Pendiente').map(a => String(a.id_alerta)));
    const hayNueva = conocidas.current !== null && [...pendientes].some(id => !conocidas.current.has(id));
    conocidas.current = pendientes;
    if (hayNueva) sonar();
  }, [alertas]);

  useEffect(() => {
    montado.current = true;
    const nodosActuales = nodos.current;
    return () => {
      montado.current = false; habilitado.current = false;
      for (const nodo of nodosActuales) { try { nodo.stop(); } catch { /* Ya terminó. */ } nodo.disconnect(); }
      nodosActuales.clear();
      const contexto = audio.current; audio.current = null;
      if (contexto && contexto.state !== 'closed') void contexto.close().catch(() => {});
    };
  }, []);

  async function alternar() {
    if (ocupado) return;
    setError('');
    if (habilitado.current) {
      habilitado.current = false; setActivo(false); detener(); return;
    }
    setOcupado(true);
    try {
      const Constructor = window.AudioContext || window.webkitAudioContext;
      if (!Constructor) throw new Error('Este navegador no permite avisos sonoros.');
      if (!audio.current || audio.current.state === 'closed') {
        audio.current = new Constructor();
        const contexto = audio.current;
        contexto.onstatechange = () => {
          if (montado.current && habilitado.current && contexto.state !== 'running') {
            habilitado.current = false; setActivo(false); detener();
            setError('El navegador pausó el audio. Pulsa Activar avisos sonoros para reanudarlo.');
          }
        };
      }
      // resume se llama directamente desde el botón para cumplir la política de audio.
      await audio.current.resume();
      if (!montado.current) return;
      if (audio.current.state !== 'running') throw new Error('El navegador bloqueó el audio. Vuelve a activar el sonido.');
      habilitado.current = true; setActivo(true); sonar();
    } catch (e) {
      if (montado.current) { habilitado.current = false; setActivo(false); setError(e.message || 'No se pudo activar el sonido.'); }
    } finally { if (montado.current) setOcupado(false); }
  }
  return { activo, error, ocupado, alternar };
}
