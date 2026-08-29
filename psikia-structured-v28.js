/* Psikia Hub v2.8 — puente opcional a Structured Outputs
   Cargar DESPUÉS del script principal y después de psikia-dictation-v28.js.
   La OpenAI API key NUNCA vive aquí: solo se llama al Worker configurado.
*/
(() => {
  'use strict';

  const API_KEY = 'psikia_backend_url_v28';
  const TOKEN_KEY = 'psikia_backend_token_v28';
  const generateBtn = document.querySelector('#generate');
  const raw = document.querySelector('#raw');
  const visitType = document.querySelector('#visitType');
  const settingsTab = document.querySelector('#tab-settings');

  if (!generateBtn || !raw || !visitType) return;

  const oldGenerate = (() => {
    try { return typeof generate === 'function' ? generate : null; }
    catch (_) { return null; }
  })();

  if (oldGenerate) {
    try { generateBtn.removeEventListener('click', oldGenerate); } catch (_) {}
  }

  const escHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));

  const addSettings = () => {
    if (!settingsTab || document.querySelector('#psikiaApiBase')) return;
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <h2>Backend clínico</h2>
      <div class="notice info">
        La clave de OpenAI no se guarda en el navegador. Aquí solo se configura la URL del Worker
        y un token de acceso del propio backend.
      </div>
      <label>URL del Worker</label>
      <input id="psikiaApiBase" inputmode="url" placeholder="https://psikia-api.tu-subdominio.workers.dev">
      <label>Token del backend</label>
      <input id="psikiaApiToken" type="password" autocomplete="off" placeholder="Token configurado como secret en Cloudflare">
      <div class="row" style="margin-top:8px">
        <button id="psikiaSaveBackend">Guardar backend</button>
        <button id="psikiaClearBackend" class="ghost">Desactivar IA</button>
      </div>
      <div id="psikiaBackendState" class="small" style="margin-top:7px"></div>`;
    settingsTab.appendChild(card);

    const u = card.querySelector('#psikiaApiBase');
    const t = card.querySelector('#psikiaApiToken');
    const state = card.querySelector('#psikiaBackendState');
    u.value = localStorage.getItem(API_KEY) || '';
    t.value = localStorage.getItem(TOKEN_KEY) || '';

    const refresh = () => {
      state.textContent = localStorage.getItem(API_KEY)
        ? 'Structured Outputs activado para Valoración inicial y Urgencias.'
        : 'Sin backend: se mantiene la segmentación local actual.';
    };
    refresh();

    card.querySelector('#psikiaSaveBackend').addEventListener('click', () => {
      const url = u.value.trim().replace(/\/+$/, '');
      const token = t.value.trim();
      if (!url || !/^https:\/\//i.test(url)) {
        alert('Escribe una URL HTTPS válida del Worker.');
        return;
      }
      localStorage.setItem(API_KEY, url);
      localStorage.setItem(TOKEN_KEY, token);
      refresh();
      alert('Backend guardado. La API key de OpenAI sigue únicamente en Cloudflare.');
    });

    card.querySelector('#psikiaClearBackend').addEventListener('click', () => {
      localStorage.removeItem(API_KEY);
      localStorage.removeItem(TOKEN_KEY);
      u.value = '';
      t.value = '';
      refresh();
    });
  };

  const fieldMappings = {
    initial: {
      motivo_consulta_derivacion: 'Motivo de consulta / derivación',
      antecedentes_medicos_alergias: 'Antecedentes médicos / alergias',
      antecedentes_psiquiatricos_personales: 'Antecedentes psiquiátricos personales',
      antecedentes_familiares_psiquiatricos: 'Antecedentes familiares psiquiátricos',
      consumo_sustancias: 'Consumo de sustancias',
      situacion_personal_social_funcional: 'Situación personal, social y funcional',
      tratamiento_actual: 'Tratamiento actual',
      enfermedad_actual_evolucion_longitudinal: 'Enfermedad actual / evolución longitudinal',
      exploracion_psicopatologica: 'Exploración psicopatológica',
      pruebas_complementarias: 'Pruebas complementarias',
      juicio_clinico_diagnostico: 'Juicio clínico / diagnóstico',
      plan: 'Plan'
    },
    emergency: {
      motivo_consulta: 'Motivo de consulta',
      antecedentes_relevantes: 'Antecedentes relevantes',
      situacion_precipitante_enfermedad_actual: 'Situación precipitante / enfermedad actual',
      informacion_colateral_relevante: 'Información colateral relevante',
      exploracion_psicopatologica: 'Exploración psicopatológica',
      valoracion_medico_organica_pruebas_complementarias: 'Valoración médico-orgánica y pruebas complementarias',
      juicio_clinico: 'Juicio clínico',
      intervencion_realizada: 'Intervención realizada',
      respuesta_evolucion_durante_urgencias: 'Respuesta / evolución durante Urgencias',
      epicrisis_disposicion: 'Epicrisis y disposición'
    }
  };

  const reportTypeFor = (type) =>
    type === 'initial' ? 'valoracion_inicial' :
    type === 'emergency' ? 'urgencias' : null;

  const ensureUnassignedBox = () => {
    let box = document.querySelector('#psikiaUnassigned');
    if (!box) {
      box = document.createElement('div');
      box.id = 'psikiaUnassigned';
      box.className = 'notice warn';
      box.hidden = true;
      const seg = document.querySelector('#segmentationInfo');
      seg?.insertAdjacentElement('afterend', box);
    }
    return box;
  };

  const clearReviewMarkers = () => {
    document.querySelectorAll('.psikia-review-marker').forEach(x => x.remove());
    document.querySelectorAll('.reportSection').forEach(x => {
      x.style.background = '';
      x.style.borderRadius = '';
      x.style.paddingLeft = '';
      x.style.paddingRight = '';
    });
  };

  const markReview = (sectionName, label) => {
    const area = [...document.querySelectorAll('.reportEdit[data-sec]')]
      .find(x => x.dataset.sec === sectionName);
    const wrap = area?.closest('.reportSection');
    if (!wrap) return;
    wrap.style.background = '#fffaf0';
    wrap.style.borderRadius = '10px';
    wrap.style.paddingLeft = '7px';
    wrap.style.paddingRight = '7px';
    const marker = document.createElement('div');
    marker.className = 'psikia-review-marker small';
    marker.textContent = `⚠️ ${label}`;
    marker.style.marginTop = '4px';
    area.insertAdjacentElement('beforebegin', marker);
  };

  const applyStructured = (type, data) => {
    const mapping = fieldMappings[type];
    const out = {};
    const review = new Map();

    // Inicializa todas las secciones para conservar la plantilla vigente.
    try {
      templates[type].sections.forEach(sec => { out[sec] = ''; });
    } catch (_) {}

    for (const [key, section] of Object.entries(mapping || {})) {
      const field = data[key];
      if (!field || typeof field !== 'object') continue;
      out[section] = field.content || '';
      if (field.needs_review) review.set(section, 'Revisar extracción o completar información.');
    }

    const riskSection = type === 'initial' ? 'Valoración de riesgos' : 'Valoración de riesgos';
    const risk = data.valoracion_riesgos;
    if (risk && typeof risk === 'object') {
      // No inferimos una frase nueva: usamos solo evidencia literal del dictado.
      out[riskSection] = Array.isArray(risk.evidence) ? risk.evidence.join(' ') : '';
      if (risk.status === 'not_mentioned') {
        review.set(riskSection, 'Riesgo no mencionado en el dictado; no se ha inferido “riesgo bajo”.');
      } else if (risk.needs_review || risk.status === 'uncertain') {
        review.set(riskSection, `Valoración de riesgo marcada para revisión (${risk.status || 'incierta'}).`);
      }
    }

    try {
      reportData = out;
      renderReport();
    } catch (err) {
      console.error(err);
      throw new Error('No se pudo volcar la extracción estructurada a la plantilla.');
    }

    clearReviewMarkers();
    for (const [sec, msg] of review.entries()) markReview(sec, msg);

    const box = ensureUnassignedBox();
    const ua = Array.isArray(data.unassigned) ? data.unassigned : [];
    if (ua.length) {
      box.hidden = false;
      box.textContent = 'Sin asignar (no se ha forzado a ningún campo): ' +
        ua.map(x => {
          const candidates = Array.isArray(x.possible_sections) && x.possible_sections.length
            ? ` [posibles: ${x.possible_sections.join(', ')}]` : '';
          return `“${x.text || ''}”${candidates}`;
        }).join(' · ');
    } else {
      box.hidden = true;
      box.textContent = '';
    }

    const seg = document.querySelector('#segmentationInfo');
    if (seg) {
      seg.textContent =
        'Structured Outputs: cada campo procede del dictado y mantiene trazabilidad; lo no asignable no se fuerza.';
    }
  };

  const localFallback = (reason) => {
    if (oldGenerate) oldGenerate();
    else {
      try {
        reportData = segmentText(raw.value, visitType.value);
        renderReport();
      } catch (_) {}
    }
    const seg = document.querySelector('#segmentationInfo');
    if (seg && reason) seg.textContent = `${reason} Se ha usado la segmentación local; revisar antes de guardar.`;
  };

  const generateStructured = async () => {
    const transcript = raw.value.trim();
    if (!transcript) {
      alert('No hay texto para ordenar.');
      return;
    }

    const type = visitType.value;
    const reportType = reportTypeFor(type);
    const base = (localStorage.getItem(API_KEY) || '').replace(/\/+$/, '');
    const token = localStorage.getItem(TOKEN_KEY) || '';

    if (!reportType || !base) {
      localFallback(
        !reportType
          ? 'Structured Outputs todavía no está definido para este tipo de nota.'
          : 'Backend no configurado.'
      );
      return;
    }

    const oldText = generateBtn.textContent;
    generateBtn.disabled = true;
    generateBtn.textContent = 'Ordenando con IA…';

    try {
      const res = await fetch(`${base}/extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? {'X-Psikia-Token': token} : {})
        },
        cache: 'no-store',
        body: JSON.stringify({
          report_type: reportType,
          transcript
        })
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `Backend HTTP ${res.status}`);
      }
      applyStructured(type, payload);
    } catch (err) {
      console.error(err);
      localFallback(`No se pudo usar el backend (${err.message || 'error'}).`);
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = oldText;
    }
  };

  generateBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    generateStructured();
  });

  addSettings();

  window.PSIKIA_STRUCTURED_V28 = {
    version: '2.8',
    generate: generateStructured,
    enabled: () => !!localStorage.getItem(API_KEY)
  };
})();
