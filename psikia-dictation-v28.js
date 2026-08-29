/* Psikia Hub v2.8 — hardening de dictado Android
   Cargar DESPUÉS del script principal de Psikia Hub.
   - No confía en resultIndex para deduplicar.
   - No reinicia SpeechRecognition tras silencios.
   - Recorta eco entre sesiones manuales.
   - Avisa cuando recorta un posible eco.
*/
(() => {
  'use strict';

  const btn = document.querySelector('#dictate');
  const raw = document.querySelector('#raw');
  const status = document.querySelector('#dictationStatus');
  if (!btn || !raw || !status) return;

  // El listener del index existente conserva la referencia antigua.
  // Lo retiramos antes de instalar el flujo v2.8.
  try {
    if (typeof toggleDictation === 'function') {
      btn.removeEventListener('click', toggleDictation);
    }
  } catch (_) {}

  const nrm = (s) => String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const wordsNormV28 = (s) => nrm(s)
    .replace(/[^a-z0-9]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const startsWithWordsV28 = (longer, shorter) => {
    const a = wordsNormV28(longer), b = wordsNormV28(shorter);
    return !!b && (a === b || a.startsWith(b + ' '));
  };

  const sameEnoughV28 = (a, b) => {
    const x = wordsNormV28(a), y = wordsNormV28(b);
    return x === y ||
      (x.length > 24 && y.length > 24 && (x.includes(y) || y.includes(x)));
  };

  const mergeWithoutEchoV28 = (existing, incoming) => {
    const a = String(existing || '').trim();
    const b = String(incoming || '').trim();
    if (!a) return b;
    if (!b) return a;
    if (sameEnoughV28(a, b)) {
      return wordsNormV28(b).length > wordsNormV28(a).length ? b : a;
    }
    const aw = a.split(/\s+/), bw = b.split(/\s+/);
    let overlap = 0;
    for (let k = Math.min(28, aw.length, bw.length); k >= 2; k--) {
      if (wordsNormV28(aw.slice(-k).join(' ')) ===
          wordsNormV28(bw.slice(0, k).join(' '))) {
        overlap = k;
        break;
      }
    }
    const tail = bw.slice(overlap).join(' ');
    return tail ? `${a} ${tail}` : a;
  };

  const canonicalResultsV28 = (e) => {
    const finals = [];
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i];
      const tx = String(r?.[0]?.transcript || '').replace(/\s+/g, ' ').trim();
      if (tx && r.isFinal) finals.push(tx);
    }
    if (!finals.length) return '';

    const collapsed = [];
    for (const tx of finals) {
      if (!collapsed.length) {
        collapsed.push(tx);
        continue;
      }
      const last = collapsed[collapsed.length - 1];
      if (startsWithWordsV28(tx, last)) {
        collapsed[collapsed.length - 1] = tx;
        continue;
      }
      if (startsWithWordsV28(last, tx) || sameEnoughV28(last, tx)) continue;
      collapsed.push(tx);
    }
    return collapsed.join(' ').replace(/\s+/g, ' ').trim();
  };

  const spokenPunctuationV28 = (text) => {
    // Reutiliza la implementación de la app si está disponible.
    try {
      if (typeof spokenPunctuation === 'function') return spokenPunctuation(text);
    } catch (_) {}
    let x = String(text || '').trim();
    x = x.replace(/\b(nuevo parrafo|nuevo párrafo|punto y aparte)\b/gi, '\n');
    x = x.replace(/\b(punto y seguido|punto)\b/gi, '. ');
    x = x.replace(/\b(coma)\b/gi, ', ');
    x = x.replace(/\b(punto y coma)\b/gi, '; ');
    return x.replace(/\s+([,.;:])/g, '$1')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n +/g, '\n')
      .trim();
  };

  const cleanSpeechChunkV28 = (txt, finish = false) => {
    let x = spokenPunctuationV28(txt).replace(/\s+/g, ' ').trim();
    if (!x) return '';
    x = x.charAt(0).toUpperCase() + x.slice(1);
    if (finish && !/[.!?…]$/.test(x)) x += '.';
    return x;
  };

  const combineWithBaseV28 = (base, piece) => {
    base = String(base || '').trim();
    piece = String(piece || '').trim();
    if (!base) return { text: piece, echoTrimmed: false };
    if (!piece) return { text: base, echoTrimmed: false };
    if (sameEnoughV28(base, piece)) return { text: base, echoTrimmed: true };

    const bw = base.split(/\s+/), pw = piece.split(/\s+/);
    let overlap = 0;
    for (let k = Math.min(24, bw.length, pw.length); k >= 1; k--) {
      const a = wordsNormV28(bw.slice(-k).join(' '));
      const b = wordsNormV28(pw.slice(0, k).join(' '));
      // Una sola palabra solo se recorta si tiene >=4 caracteres normalizados.
      if (a === b && (k >= 2 || a.length >= 4)) {
        overlap = k;
        break;
      }
    }
    const trimmed = overlap ? pw.slice(overlap).join(' ') : piece;
    if (!trimmed) return { text: base, echoTrimmed: !!overlap };
    return {
      text: overlap ? `${base} ${trimmed}` : `${base}\n${trimmed}`,
      echoTrimmed: !!overlap
    };
  };

  let sr = null;
  let active = false;
  let stoppedByUser = false;
  let speechSessionBase = '';
  let speechSessionText = '';
  let lastEventText = '';
  let trimmedDuringSession = false;

  const setMicV28 = (on, msg) => {
    btn.classList.toggle('listening', on);
    btn.textContent = on ? '⏹️ Pulsar para detener' : '🎙️ Pulsar para hablar';
    if (msg) status.textContent = msg;
  };

  const syncLegacyState = (r, on) => {
    // Mantiene compatibles los botones "Nueva nota/Borrar" del index existente.
    try { recognition = r; } catch (_) {}
    try { listening = on; } catch (_) {}
    try { requestedListening = on; } catch (_) {}
  };

  const updateSpeechSessionV28 = (candidate) => {
    if (!candidate) return;

    if (!speechSessionText) {
      speechSessionText = candidate;
    } else if (startsWithWordsV28(candidate, speechSessionText)) {
      speechSessionText = candidate;
    } else if (startsWithWordsV28(speechSessionText, candidate)) {
      // Hipótesis más corta ya contenida: no hacer nada.
    } else if (lastEventText && startsWithWordsV28(candidate, lastEventText)) {
      // Android puede emitir una hipótesis final creciente en eventos separados.
      const base = speechSessionText;
      if (wordsNormV28(base).endsWith(wordsNormV28(lastEventText))) {
        const baseWords = base.split(/\s+/);
        const lastWords = lastEventText.split(/\s+/);
        speechSessionText = [
          ...baseWords.slice(0, Math.max(0, baseWords.length - lastWords.length)),
          ...candidate.split(/\s+/)
        ].join(' ').trim();
      } else {
        speechSessionText = candidate;
      }
    } else {
      // Importante: no usamos results.length/resultIndex como criterio de corrección.
      speechSessionText = mergeWithoutEchoV28(speechSessionText, candidate);
    }

    lastEventText = candidate;
    const piece = cleanSpeechChunkV28(speechSessionText, false);
    const merged = combineWithBaseV28(speechSessionBase, piece);
    raw.value = merged.text;
    raw.scrollTop = raw.scrollHeight;
    if (merged.echoTrimmed) {
      trimmedDuringSession = true;
      status.textContent =
        'Dictando… se ha recortado un posible eco de Android al inicio de este bloque; revísalo.';
    } else {
      status.textContent = 'Dictando… texto consolidado sin duplicar hipótesis crecientes.';
    }
  };

  const finalizeSpeechSessionV28 = () => {
    const piece = cleanSpeechChunkV28(speechSessionText, true);
    const merged = combineWithBaseV28(speechSessionBase, piece);
    raw.value = merged.text;
    raw.scrollTop = raw.scrollHeight;
    speechSessionBase = raw.value.trim();
    speechSessionText = '';
    lastEventText = '';
    if (merged.echoTrimmed) trimmedDuringSession = true;
    return merged.echoTrimmed;
  };

  const disposeRecognition = () => {
    const r = sr;
    sr = null;
    active = false;
    syncLegacyState(null, false);
    if (r) {
      try {
        r.onresult = null;
        r.onerror = null;
        r.onend = null;
      } catch (_) {}
    }
  };

  const startV28 = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setMicV28(false,
        'Este navegador no ofrece reconocimiento Web Speech. Puedes escribir o usar el micrófono del teclado.');
      return;
    }

    stoppedByUser = false;
    trimmedDuringSession = false;
    speechSessionBase = raw.value.trim();
    speechSessionText = '';
    lastEventText = '';

    const r = new SR();
    sr = r;
    r.lang = 'es-ES';
    r.continuous = true;
    r.interimResults = false;
    r.maxAlternatives = 1;
    try { if ('unspokenPunctuation' in r) r.unspokenPunctuation = true; } catch (_) {}

    r.onstart = () => {
      active = true;
      syncLegacyState(r, true);
      setMicV28(true,
        'Dictando. Una pulsación inicia y otra detiene; no se reinicia automáticamente por silencios.');
    };

    r.onresult = (e) => {
      const candidate = canonicalResultsV28(e);
      if (candidate) updateSpeechSessionV28(candidate);
    };

    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        stoppedByUser = true;
        disposeRecognition();
        setMicV28(false, 'Permiso de micrófono denegado.');
      } else if (e.error !== 'no-speech' && e.error !== 'aborted') {
        status.textContent = `Dictado interrumpido: ${e.error}. Pulsa para continuar.`;
      }
    };

    r.onend = () => {
      finalizeSpeechSessionV28();
      const wasStoppedByUser = stoppedByUser;
      disposeRecognition();
      if (trimmedDuringSession) {
        setMicV28(false,
          wasStoppedByUser
            ? 'Dictado detenido. Se recortó un posible eco de Android: revisa el enlace entre bloques.'
            : 'Android cerró el reconocimiento. Se recortó un posible eco: revisa el enlace entre bloques y pulsa para continuar.');
      } else {
        setMicV28(false,
          wasStoppedByUser
            ? 'Dictado detenido.'
            : 'Android cerró el reconocimiento tras una pausa. No se reinicia automáticamente; pulsa para continuar.');
      }
    };

    try {
      r.start();
    } catch (_) {
      disposeRecognition();
      setMicV28(false, 'No se pudo iniciar el reconocimiento. Pulsa de nuevo.');
    }
  };

  const stopV28 = () => {
    if (!sr && !active) return;
    stoppedByUser = true;
    try { sr?.stop(); }
    catch (_) {
      finalizeSpeechSessionV28();
      disposeRecognition();
      setMicV28(false, 'Dictado detenido.');
    }
  };

  const toggleV28 = (e) => {
    e?.preventDefault();
    e?.stopImmediatePropagation();
    if (active || sr) stopV28();
    else startV28();
  };

  btn.addEventListener('click', toggleV28);

  // Si otro control limpia/inicia nota mientras se dicta, detener antes.
  document.addEventListener('click', (e) => {
    const id = e.target?.id;
    if (['newNote', 'newNoteTop', 'clearRaw', 'discardDraft'].includes(id) && (active || sr)) {
      stopV28();
    }
  }, true);

  window.PSIKIA_DICTATION_V28 = {
    version: '2.8',
    canonicalResults: canonicalResultsV28,
    mergeWithoutEcho: mergeWithoutEchoV28,
    combineWithBase: combineWithBaseV28,
    stop: stopV28
  };

  status.textContent =
    'Dictado v2.8 activo: deduplicación por contenido, sin reinicio automático y protección de eco entre bloques.';
})();
