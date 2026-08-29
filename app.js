'use strict';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const KEY_PAT = 'psikia_v44_patients';
const KEY_SET = 'psikia_v44_settings';
const DEFAULT_EMAIL = 'Alejandro.ballesteros.prados@navarra.es';


const WORKER_REPORT_TYPE = {
  ur_initial: 'ingreso_ur',
  csm_initial: 'primera_csm',
  evolution: 'evolutivo',
  pti: 'pti',
  emergency: 'urgencias'
};

const WORKER_SECTION_MAP = {
  ur_initial: {
    motivo_derivacion: 'Motivo de derivación / ingreso',
    antecedentes_familiares: 'Antecedentes familiares',
    situacion_social_laboral_funcional: 'Situación social, laboral y funcional',
    antecedentes_medicos: 'Antecedentes médicos no psiquiátricos',
    tratamiento_actual: 'Tratamiento actual',
    enfermedad_actual_longitudinal: 'Enfermedad actual / evolución longitudinal',
    exploracion_psicopatologica: 'Exploración psicopatológica',
    diagnostico_hipotesis: 'Juicio clínico / hipótesis diagnóstica',
    plan: 'Plan'
  },
  csm_initial: {
    motivo_consulta_procedencia: 'Motivo de consulta / procedencia',
    antecedentes_medicos: 'Antecedentes médicos no psiquiátricos',
    antecedentes_psiquiatricos: 'Antecedentes psiquiátricos',
    antecedentes_familiares: 'Antecedentes familiares',
    consumo_sustancias: 'Consumo de sustancias',
    situacion_social_laboral: 'Situación social y laboral',
    tratamiento_actual: 'Tratamiento actual',
    enfermedad_actual: 'Enfermedad actual',
    exploracion_psicopatologica: 'Exploración psicopatológica',
    orientacion_diagnostica: 'Orientación diagnóstica',
    plan: 'Plan'
  },
  evolution: {
    resumen_contexto: 'Resumen clínico longitudinal',
    evolucion_clinica: 'Evolución desde la última revisión',
    funcionamiento_situacion_psicosocial: 'Funcionamiento / rehabilitación',
    exploracion_psicopatologica: 'Exploración psicopatológica comparativa',
    orientacion_diagnostica: 'Juicio clínico'
  },
  pti: {
    resumen_caso: 'Resumen clínico y funcional',
    necesidades_problemas: 'Necesidades / problemas activos',
    objetivos_smart: 'Objetivos SMART',
    intervencion_psiquiatria: 'Intervención de Psiquiatría',
    intervencion_psicologia: 'Intervención de Psicología',
    intervencion_enfermeria: 'Intervención de Enfermería',
    intervencion_terapia_ocupacional: 'Intervención de Terapia Ocupacional',
    intervencion_trabajo_social: 'Intervención de Trabajo Social',
    otras_intervenciones: 'Otras intervenciones / coordinación'
  },
  emergency: {
    motivo_consulta: 'Motivo de consulta',
    antecedentes_relevantes: 'Antecedentes relevantes',
    situacion_precipitante_enfermedad_actual: 'Situación precipitante / enfermedad actual',
    informacion_colateral: 'Información colateral relevante',
    exploracion_psicopatologica: 'Exploración psicopatológica',
    valoracion_riesgos: 'Valoración de riesgos',
    valoracion_medico_organica_pruebas: 'Valoración médico-orgánica y pruebas complementarias',
    juicio_clinico: 'Juicio clínico',
    intervencion_realizada: 'Intervención realizada',
    respuesta_evolucion_urgencias: 'Respuesta / evolución durante Urgencias',
    epicrisis_disposicion: 'Epicrisis y disposición'
  }
};

function workerSupportsType(type){
  return Boolean(WORKER_REPORT_TYPE[type]);
}

function mergeField(target, value, prefix=''){
  const v=String(value || '').trim();
  if(!v) return target || '';
  const piece=prefix ? `${prefix}${v}` : v;
  return [target, piece].filter(Boolean).join('\n').trim();
}

function mapWorkerSections(type, source){
  const out=Object.fromEntries(templates[type].sections.map(s=>[s,'']));
  const src=source && typeof source==='object' ? source : {};
  const map=WORKER_SECTION_MAP[type] || {};

  for(const [key, label] of Object.entries(map)){
    if(label in out) out[label]=mergeField(out[label], src[key]);
  }

  // Campos que el Worker separa más que la interfaz actual.
  if(type==='ur_initial'){
    out['Antecedentes psiquiátricos y consumo']=mergeField(out['Antecedentes psiquiátricos y consumo'], src.antecedentes_psiquiatricos);
    out['Antecedentes psiquiátricos y consumo']=mergeField(out['Antecedentes psiquiátricos y consumo'], src.consumo_sustancias, src.consumo_sustancias ? 'Consumo de sustancias: ' : '');
  }

  if(type==='evolution'){
    let treatment='';
    treatment=mergeField(treatment, src.adherencia_tolerabilidad);
    treatment=mergeField(treatment, src.tratamiento_actual, src.tratamiento_actual ? 'Tratamiento actual: ' : '');
    out['Adherencia, tolerancia y tratamiento actual']=treatment;

    let plan='';
    plan=mergeField(plan, src.cambios_tratamiento, src.cambios_tratamiento ? 'Cambios de tratamiento: ' : '');
    plan=mergeField(plan, src.plan);
    out['Plan de tratamiento']=plan;
  }

  if(type==='pti'){
    let indicators='';
    indicators=mergeField(indicators, src.indicadores_resultado);
    indicators=mergeField(indicators, src.frecuencia_seguimiento, src.frecuencia_seguimiento ? 'Frecuencia/seguimiento: ' : '');
    indicators=mergeField(indicators, src.fecha_revision, src.fecha_revision ? 'Revisión: ' : '');
    out['Indicadores y revisión']=indicators;
  }

  return out;
}

function populateMedicationChanges(changes){
  const items=Array.isArray(changes) ? changes.slice(0,4) : [];
  if(!items.length) return;
  for(let i=1;i<=items.length;i++){
    const item=items[i-1] || {};
    const name=$('#medName'+i);
    const plan=$('#medPlan'+i);
    if(!name || !plan) continue;
    name.value=String(item.drug || '').trim();
    const parts=[];
    if(item.dose) parts.push(String(item.dose).trim());
    if(item.schedule) parts.push(String(item.schedule).trim());
    if(item.route) parts.push('Vía '+String(item.route).trim());
    if(item.duration_or_change) parts.push(String(item.duration_or_change).trim());
    plan.value=parts.join(' · ');
  }
}

const templates = {
  ur_initial: {
    label: 'Ingreso / valoración inicial UR',
    sections: [
      'Motivo de derivación / ingreso',
      'Antecedentes psiquiátricos y consumo',
      'Antecedentes familiares',
      'Situación social, laboral y funcional',
      'Antecedentes médicos no psiquiátricos',
      'Tratamiento actual',
      'Enfermedad actual / evolución longitudinal',
      'Exploración psicopatológica',
      'Valoración de riesgos',
      'Juicio clínico / hipótesis diagnóstica',
      'Plan'
    ]
  },
  csm_initial: {
    label: 'Primera consulta CSM',
    sections: [
      'Motivo de consulta / procedencia',
      'Antecedentes médicos no psiquiátricos',
      'Antecedentes psiquiátricos',
      'Antecedentes familiares',
      'Consumo de sustancias',
      'Situación social y laboral',
      'Tratamiento actual',
      'Enfermedad actual',
      'Exploración psicopatológica',
      'Valoración de riesgos',
      'Orientación diagnóstica',
      'Plan'
    ]
  },
  evolution: {
    label: 'Evolutivo / seguimiento',
    sections: [
      'Resumen clínico longitudinal',
      'Evolución desde la última revisión',
      'Funcionamiento / rehabilitación',
      'Adherencia, tolerancia y tratamiento actual',
      'Exploración psicopatológica comparativa',
      'Valoración de riesgos',
      'Pruebas / incidencias clínicas',
      'Juicio clínico',
      'Plan de tratamiento',
      'Próxima revisión / coordinación'
    ]
  },
  pti: {
    label: 'PTI',
    sections: [
      'Resumen clínico y funcional',
      'Necesidades / problemas activos',
      'Riesgos y factores protectores',
      'Objetivos SMART',
      'Intervención de Psiquiatría',
      'Intervención de Psicología',
      'Intervención de Enfermería',
      'Intervención de Terapia Ocupacional',
      'Intervención de Trabajo Social',
      'Otras intervenciones / coordinación',
      'Indicadores y revisión'
    ]
  },
  emergency: {
    label: 'Intervención en Urgencias',
    sections: [
      'Motivo de consulta',
      'Antecedentes relevantes',
      'Situación precipitante / enfermedad actual',
      'Información colateral relevante',
      'Exploración psicopatológica',
      'Valoración de riesgos',
      'Valoración médico-orgánica y pruebas complementarias',
      'Juicio clínico',
      'Intervención realizada',
      'Respuesta / evolución durante Urgencias',
      'Epicrisis y disposición'
    ]
  },
  discharge: {
    label: 'Informe de alta',
    sections: [
      'Motivo y contexto del ingreso',
      'Antecedentes relevantes',
      'Evolución durante el ingreso',
      'Intervenciones realizadas',
      'Exploración psicopatológica al alta',
      'Valoración de riesgos al alta',
      'Pruebas complementarias relevantes',
      'Diagnóstico al alta',
      'Tratamiento al alta',
      'Situación funcional al alta',
      'Epicrisis',
      'Plan de seguimiento'
    ]
  }
};

const cueMap = {
  'Motivo de derivación / ingreso':['motivo','derivad','ingreso por','procedencia'],
  'Motivo de consulta / procedencia':['motivo','consulta por','acude por','procedencia','derivad'],
  'Motivo de consulta':['motivo','consulta por','acude por','traido','traida','ambulancia','policia'],
  'Motivo y contexto del ingreso':['motivo','ingreso por','contexto del ingreso','derivad'],
  'Antecedentes psiquiátricos y consumo':['antecedentes psiqui','ingresos previos','episodios previos','diagnostico previo','consumo','alcohol','cannabis','cocaina','toxico'],
  'Antecedentes psiquiátricos':['antecedentes psiqui','ingresos previos','episodios previos','diagnostico previo','intentos previos'],
  'Antecedentes familiares':['antecedentes familiares','familiares psiqui'],
  'Antecedentes relevantes':['antecedentes','ingresos previos','diagnostico previo','tratamiento previo','alergia','somatico'],
  'Antecedentes médicos no psiquiátricos':['antecedentes medicos','antecedentes somaticos','alergia','hipertension','diabetes','cardiop','renal','hepatic','neurolog','quirurg','epilep'],
  'Consumo de sustancias':['consumo','alcohol','cannabis','cocaina','opio','heroina','anfetamina','toxico','tabaco','intoxicacion'],
  'Situación social, laboral y funcional':['convive','pareja','hijos','familia','trabaja','laboral','pension','autocuidado','avd','vivienda','ocupacional'],
  'Situación social y laboral':['convive','pareja','hijos','familia','trabaja','laboral','pension','vivienda'],
  'Tratamiento actual':['tratamiento actual','toma','mg','pauta','medicacion habitual','adherencia'],
  'Enfermedad actual / evolución longitudinal':['enfermedad actual','desde hace','actualmente','inicio','empeora','mejora','ultimas semanas','desencaden','sintomas actuales'],
  'Enfermedad actual':['enfermedad actual','desde hace','actualmente','inicio','empeora','mejora','ultimas semanas','sintomas actuales'],
  'Resumen clínico longitudinal':['diagnostico de base','historia longitudinal','resumen clinico','desde el ingreso'],
  'Evolución desde la última revisión':['desde la ultima','ultima revision','ha mejorado','ha empeorado','persiste','evolucion','respuesta','se mantiene'],
  'Funcionamiento / rehabilitación':['autocuidado','avd','grupo','actividad','ocupacional','laboral','social','salidas','rehabilit','rutina'],
  'Adherencia, tolerancia y tratamiento actual':['adherencia','tolerancia','efectos secundarios','tratamiento actual','toma','mg','inyectable'],
  'Exploración psicopatológica':['exploracion','consciente','orientad','colaborador','contacto','discurso','lenguaje','afecto','hipotim','eutim','ansiedad','delir','alucin','ideacion','psicomot','insight','sueño','apetito'],
  'Exploración psicopatológica comparativa':['exploracion','orientad','discurso','afecto','ansiedad','delir','alucin','ideacion','psicomot','respecto a'],
  'Exploración psicopatológica al alta':['exploracion','al alta','orientad','discurso','afecto','delir','alucin','ideacion','planes de futuro'],
  'Valoración de riesgos':['riesgo','suicid','autoles','heteroagres','agresiv','violencia','impulsiv','vulnerab','protector','arma','fuga'],
  'Valoración de riesgos al alta':['riesgo','suicid','autoles','heteroagres','protector','al alta','planes de futuro'],
  'Riesgos y factores protectores':['riesgo','suicid','autoles','heteroagres','vulnerab','protector','apoyo familiar'],
  'Pruebas / incidencias clínicas':['analit','ecg','incidencia','urgencia','somatico','caida','efecto adverso','niveles'],
  'Pruebas complementarias relevantes':['analit','ecg','tac','resonancia','niveles','resultado'],
  'Valoración médico-orgánica y pruebas complementarias':['constantes','tension arterial','temperatura','saturacion','exploracion fisica','analit','ecg','toxic','orina','tac','glucemia','neurolog'],
  'Juicio clínico / hipótesis diagnóstica':['juicio clinico','diagnost','impresion clinica','compatible con','sindrome','hipotesis'],
  'Orientación diagnóstica':['juicio clinico','diagnost','orientacion','impresion clinica','compatible con','sindrome'],
  'Juicio clínico':['juicio clinico','diagnost','impresion','compatible con','sindrome','diferencial'],
  'Diagnóstico al alta':['diagnostico al alta','diagnost','cie','f20','f31','f32','f33','f41','f60'],
  'Plan':['plan','indicamos','pautamos','iniciar','aumentar','subir','disminuir','retirar','mantener','derivar'],
  'Plan de tratamiento':['plan','iniciar','aumentar','subir','disminuir','retirar','mantener','pautar','objetivo'],
  'Próxima revisión / coordinación':['proxima','revision','cita','coordina','seguimiento','mes','semana'],
  'Necesidades / problemas activos':['necesidad','problema','dificultad','deficit','precisa','requiere'],
  'Objetivos SMART':['objetivo','meta','se propone','mejorar','mantener','reducir'],
  'Intervención de Psiquiatría':['psiquiatr','farmaco','medicacion','pauta','diagnost','ajuste'],
  'Intervención de Psicología':['psicolog','psicoterapia','cognitiv','dbt','act ','mindfulness'],
  'Intervención de Enfermería':['enfermer','adherencia','educacion sanitaria','constantes','cuidados'],
  'Intervención de Terapia Ocupacional':['terapia ocupacional','ocupacional','avd','actividad','rutina','taller'],
  'Intervención de Trabajo Social':['trabajo social','social','prestacion','vivienda','empleo','recurso residencial'],
  'Otras intervenciones / coordinación':['coordina','familia','centro de salud mental','etac','recurso','derivacion'],
  'Indicadores y revisión':['indicador','revisar objetivo','seguimiento','participacion','autonomia','funcionamiento'],
  'Evolución durante el ingreso':['evolucion','durante el ingreso','progresivamente','mejoria','respuesta','estabiliza'],
  'Intervenciones realizadas':['intervencion','se realiza','tratamiento','psicoeduc','coordinacion'],
  'Tratamiento al alta':['tratamiento al alta','pauta al alta','mg','mantener','retirar','iniciar'],
  'Situación funcional al alta':['funcional','autocuidado','avd','laboral','social','al alta','autonomia'],
  'Epicrisis':['epicrisis','resumen final','en conjunto','tras evolucion'],
  'Plan de seguimiento':['seguimiento','cita','recurso','centro de salud mental','derivacion','revision'],
  'Situación precipitante / enfermedad actual':['precipitante','desencaden','tras','despues de','desde hace','hoy','ayer','ultimas horas','actualmente','empeoramiento','crisis','agudizacion'],
  'Información colateral relevante':['informacion colateral','segun familia','refiere la familia','madre refiere','padre refiere','pareja refiere','policia refiere','acompañante','se contacta con'],
  'Intervención realizada':['se administra','administramos','contencion','desescalada','reduccion de estimulos','observacion','medidas de seguridad','se realiza','se contacta'],
  'Respuesta / evolución durante Urgencias':['durante urgencias','tras la administracion','posteriormente','evoluciona','se calma','cede','persiste','respuesta','reevaluacion'],
  'Epicrisis y disposición':['epicrisis','alta a domicilio','alta domiciliaria','se decide ingreso','ingreso en','observacion','derivacion','acompañado','seguimiento','disposicion']
};

let reportData = {};
let unclassified = [];
let mediaRecorder = null;
let mediaStream = null;
let audioChunks = [];
let recording = false;
let transcribing = false;
let reloadOnControllerChange = false;

function currentTemplate(){ return templates[$('#visitType').value]; }

function spokenPunctuation(text){
  let x = String(text || '').trim();
  x = x.replace(/\b(nuevo parrafo|nuevo párrafo|punto y aparte)\b/gi, '\n');
  x = x.replace(/\b(punto y seguido|punto)\b/gi, '. ');
  x = x.replace(/\b(coma)\b/gi, ', ');
  x = x.replace(/\b(punto y coma)\b/gi, '; ');
  x = x.replace(/\s+([,.;:])/g, '$1').replace(/[ \t]+/g, ' ').replace(/\n +/g, '\n').trim();
  return x;
}

function setMic(on,msg){
  const b=$('#dictate');
  b.classList.toggle('listening',on);
  b.textContent=on?'⏹️ Pulsar para detener':'🎙️ Pulsar para hablar';
  b.disabled=transcribing;
  if(msg) $('#dictationStatus').textContent=msg;
}

function bestRecorderMime(){
  const candidates=['audio/webm;codecs=opus','audio/webm','audio/mp4'];
  for(const mime of candidates){
    try{ if(window.MediaRecorder?.isTypeSupported?.(mime)) return mime; }catch(_){}
  }
  return '';
}

async function transcribeBlob(blob){
  const base=($('#workerUrl').value||'').trim().replace(/\/+$/,'');
  if(!base) throw new Error('Configura primero el Worker en Ajustes');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),45000);
  try{
    const res=await fetch(base+'/transcribe',{
      method:'POST',
      headers:{'Content-Type':blob.type||'application/octet-stream',...(getSettings().vocabulary?{'X-Psikia-Vocabulary':encodeURIComponent(getSettings().vocabulary)}:{})},
      body:blob,
      signal:controller.signal
    });
    let data={};
    try{data=await res.json();}catch(_){throw new Error('Respuesta no JSON al transcribir');}
    if(!res.ok||!data.ok) throw new Error(data.error||('HTTP '+res.status));
    return String(data.text||'').trim();
  }catch(err){
    if(err?.name==='AbortError') throw new Error('La transcripción tardó demasiado');
    throw err;
  }finally{clearTimeout(timer);}
}

async function startRecording(){
  if(transcribing||recording) return;
  if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder){
    setMic(false,'Este navegador no permite grabación continua. Puedes escribir o pegar el texto.');
    return;
  }
  try{
    mediaStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    audioChunks=[];
    const mime=bestRecorderMime();
    mediaRecorder=mime?new MediaRecorder(mediaStream,{mimeType:mime}):new MediaRecorder(mediaStream);
    mediaRecorder.ondataavailable=e=>{if(e.data&&e.data.size)audioChunks.push(e.data);};
    mediaRecorder.onstop=async()=>{
      recording=false;
      mediaStream?.getTracks().forEach(t=>t.stop());
      mediaStream=null;
      const blob=new Blob(audioChunks,{type:mediaRecorder?.mimeType||mime||'audio/webm'});
      audioChunks=[];
      if(!blob.size){setMic(false,'No se capturó audio.');return;}
      transcribing=true;setMic(false,'Transcribiendo el dictado…');
      try{
        const text=await transcribeBlob(blob);
        const cleaned=spokenPunctuation(text).trim();
        const current=$('#raw').value.trim();
        $('#raw').value=[current,cleaned].filter(Boolean).join(current&&cleaned?'\n':'');
        $('#raw').scrollTop=$('#raw').scrollHeight;
        updatePrivacyWarning();
        $('#dictationStatus').textContent='Dictado transcrito. Pulsa de nuevo para añadir otra toma.';
      }catch(err){
        $('#dictationStatus').textContent='No se pudo transcribir: '+(err?.message||String(err))+'. El texto anterior se conserva.';
      }finally{
        transcribing=false;setMic(false);
      }
    };
    mediaRecorder.start(1000);
    recording=true;
    setMic(true,'Grabando de forma continua… los silencios no reinician el micrófono. Pulsa para terminar.');
  }catch(err){
    mediaStream?.getTracks().forEach(t=>t.stop());mediaStream=null;recording=false;
    setMic(false,'No se pudo abrir el micrófono: '+(err?.message||String(err)));
  }
}

function stopRecording(){
  if(!recording||!mediaRecorder)return;
  setMic(true,'Cerrando grabación…');
  try{mediaRecorder.stop();}catch(_){recording=false;mediaStream?.getTracks().forEach(t=>t.stop());mediaStream=null;setMic(false,'Dictado detenido.');}
}

function toggleDictation(e){
  e?.preventDefault();
  if(transcribing)return;
  if(recording)stopRecording();else startRecording();
}

function headingForChunk(text,type){
  const n=norm(text).replace(/[:\-–—]+/g,' ').trim();
  for(const sec of templates[type].sections){
    const sn=norm(sec).replace(/[/()]/g,' ').replace(/\s+/g,' ').trim();
    if(n===sn || n.startsWith(sn+' ') || n.startsWith(sn+':')) return sec;
    const short=sn.split(' ').filter(w=>w.length>3).slice(0,4).join(' ');
    if(short && n.startsWith(short+' ')) return sec;
  }
  return null;
}
function splitClinical(text,type){
  const raw=spokenPunctuation(text).replace(/\r/g,'').trim(); if(!raw)return [];
  const firstPass=raw.split(/\n+|(?<=[.!?;])\s+(?=[A-ZÁÉÍÓÚÑ0-9])/u).map(x=>x.trim()).filter(Boolean);
  const out=[];
  for(const chunk of firstPass){
    const forced=headingForChunk(chunk,type);
    if(forced){
      const idx=norm(chunk).indexOf(norm(forced).split('/')[0].trim());
      let content=chunk;
      const colon=chunk.indexOf(':');
      if(colon>=0) content=chunk.slice(colon+1).trim();
      else if(idx===0) content=chunk.replace(new RegExp('^'+forced.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),'').replace(/^\s*[-:–—]?\s*/,'').trim();
      out.push({text:content,forced});
    } else out.push({text:chunk,forced:null});
  }
  return out;
}
function localScore(section,chunk){
  const n=norm(chunk), cues=cueMap[section]||[]; let score=0;
  for(const c of cues) if(n.includes(norm(c))) score += c.length>10?3:2;
  const sn=norm(section);
  if(/suicid|autoles|heteroagres|riesgo/.test(n) && /riesgo/.test(sn)) score+=12;
  if(/alucin|delir|afecto|discurso|orientad|psicomot|insight/.test(n) && /exploracion psicopatologica/.test(sn)) score+=9;
  if(/analit|ecg|tac|toxic|glucemia|constantes/.test(n) && /(pruebas|medico-organica)/.test(sn)) score+=10;
  if(/se administra|se realiza|desescalada|contencion|medidas de seguridad/.test(n) && /intervencion realizada/.test(sn)) score+=12;
  if(/alta a domicilio|se decide ingreso|ingreso en|epicrisis|disposicion/.test(n) && /(epicrisis|disposicion)/.test(sn)) score+=12;
  if(/tratamiento actual|toma|mg|pauta habitual/.test(n) && /(tratamiento actual|adherencia)/.test(sn)) score+=8;
  if(/iniciar|aumentar|subir|disminuir|retirar|mantener|pautar|derivar/.test(n) && /(plan|tratamiento al alta|intervencion de psiquiatria)/.test(sn)) score+=8;
  if(/desde hace|actualmente|empeor|agudizacion|precipitante|desencaden/.test(n) && /(enfermedad actual|situacion precipitante|evolucion desde)/.test(sn)) score+=7;
  if(/acude por|consulta por|derivad|ingresa por|traid[oa] por/.test(n) && /motivo/.test(sn)) score+=8;
  return score;
}
function routeLocal(chunk,type,previous){
  const sections=templates[type].sections; let best=null,bestScore=0,second=0;
  for(const sec of sections){
    const sc=localScore(sec,chunk);
    if(sc>bestScore){second=bestScore;bestScore=sc;best=sec;} else if(sc>second)second=sc;
  }
  if(bestScore>=6 || (bestScore>=4 && bestScore-second>=2)) return best;
  if(previous && chunk.length<130 && bestScore===0) return previous;
  return null;
}
function segmentLocal(text,type){
  const t=templates[type], out=Object.fromEntries(t.sections.map(s=>[s,[]]));
  const unresolved=[]; let previous=null;
  splitClinical(text,type).forEach(obj=>{
    if(!obj.text)return;
    if(obj.forced && out[obj.forced]){ out[obj.forced].push(obj.text); previous=obj.forced; return; }
    const sec=routeLocal(obj.text,type,previous);
    if(sec){out[sec].push(obj.text);previous=sec;} else {unresolved.push(obj.text);previous=null;}
  });
  return {sections:Object.fromEntries(t.sections.map(s=>[s,out[s].join(' ').replace(/\s+([,.;:])/g,'$1').trim()])),unclassified:unresolved,engine:'local'};
}

function getSettings(){
  let stored={}; try{stored=JSON.parse(localStorage.getItem(KEY_SET)||'{}');}catch(_){}
  const cfg=window.PSIKIA_CONFIG||{};
  return {email:stored.email||DEFAULT_EMAIL,workerUrl:stored.workerUrl||cfg.apiBase||'',vocabulary:stored.vocabulary||''};
}
function saveSettings(){
  const s={email:$('#emailAddress').value.trim()||DEFAULT_EMAIL,workerUrl:$('#workerUrl').value.trim().replace(/\/+$/,''),vocabulary:($('#localVocabulary')?.value||'').trim().slice(0,1400)};
  localStorage.setItem(KEY_SET,JSON.stringify(s));
  $('#workerStatus').textContent='Ajustes guardados.';
  updateEngineStatus();
}
function workerEndpoint(){ const base=($('#workerUrl').value||'').trim().replace(/\/+$/,''); return base||''; }
function privacyScan(text){
  const hits=[];
  if(/\b\d{8}[A-Z]\b/i.test(text))hits.push('DNI/NIE aparente');
  if(/\b(?:nhc|historia|hc)\s*[:#-]?\s*\d{5,}\b/i.test(text))hits.push('número de historia aparente');
  if(/\b(?:tel[eé]fono|m[oó]vil)\s*[:#-]?\s*\d{9}\b/i.test(text))hits.push('teléfono aparente');
  if(/\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?\b/.test(text))hits.push('nombre completo posible');
  return [...new Set(hits)];
}
function updatePrivacyWarning(){
  const hits=privacyScan($('#raw').value); const box=$('#privacyNotice');
  if(hits.length){box.hidden=false;box.innerHTML='<b>Revisa antes de enviar al motor:</b> posible identificador directo ('+esc(hits.join(', '))+').';}
  else box.hidden=true;
}
async function segmentWithWorker(text,type,signal){
  const endpoint=workerEndpoint(); if(!endpoint) throw new Error('WORKER_NOT_CONFIGURED');
  const reportType=WORKER_REPORT_TYPE[type]; if(!reportType) throw new Error('WORKER_TYPE_NOT_SUPPORTED');
  const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({report_type:reportType,transcript:text}),signal});
  let data={}; try{data=await res.json();}catch(_){throw new Error('Respuesta no JSON del Worker');}
  if(!res.ok || !data.ok) throw new Error(data.error||('HTTP '+res.status));
  return {
    sections:mapWorkerSections(type,data.sections||{}),
    unclassified:[],
    medicationChanges:Array.isArray(data.medication_changes)?data.medication_changes:[],
    engine:'workers_ai',
    model:data.model||''
  };
}
async function generate(){
  const text=$('#raw').value.trim(); if(!text){alert('No hay dictado o texto para ordenar.');return;}
  updatePrivacyWarning();
  const hits=privacyScan(text);
  if(hits.length && workerEndpoint()){
    if(!confirm('He detectado un posible identificador directo. ¿Quieres enviar igualmente este texto al Worker?'))return;
  }
  const btn=$('#generate'); btn.disabled=true; btn.textContent='Ordenando…';
  const type=$('#visitType').value;
  try{
    let result;
    if(workerEndpoint() && workerSupportsType(type)){
      $('#engineStatus').textContent='Ordenando con Cloudflare Workers AI…';
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),30000);
      try{
        result=await segmentWithWorker(text,type,controller.signal);
      }finally{clearTimeout(timer);}
    } else {
      result=segmentLocal(text,type);
      if(workerEndpoint() && !workerSupportsType(type)){
        $('#engineStatus').textContent='Este tipo de nota aún usa el segmentador local; el Worker no tiene plantilla equivalente.';
      }
    }
    reportData=result.sections; unclassified=result.unclassified||[];
    populateMedicationChanges(result.medicationChanges||[]);
    renderReport(result.engine,result.model||'');
    if(result.engine==='workers_ai') $('#engineStatus').textContent='Nota ordenada con Workers AI.';
  }catch(err){
    console.warn('Worker error:',err);
    const msg=err?.name==='AbortError'?'El Worker tardó más de 30 segundos.':(err?.message||String(err));
    $('#engineStatus').textContent='No se pudo ordenar con IA: '+msg+' El dictado se conserva íntegro; no se ha aplicado fallback local.';
    alert('No se pudo estructurar la nota con la IA.\n\n'+msg+'\n\nEl dictado se conserva y no se ha sustituido por una segmentación local.');
  }finally{btn.disabled=false;btn.textContent='✨ Ordenar nota';}
}
function renderReport(engine='local',model=''){
  const t=currentTemplate(), host=$('#reportSections'); host.innerHTML=''; $('#reportHeading').textContent=t.label;
  for(const sec of t.sections){
    const wrap=document.createElement('div'); wrap.className='reportSection';
    wrap.innerHTML=`<div class="reportTitle">${esc(sec)}</div><textarea class="reportEdit" data-sec="${esc(sec)}" placeholder="${esc(sec)}">${esc(reportData[sec]||'')}</textarea>`;
    host.appendChild(wrap);
  }
  $$('.reportEdit[data-sec]').forEach(el=>el.addEventListener('input',()=>{reportData[el.dataset.sec]=el.value.trim();}));
  const info=$('#segmentationInfo');
  if(engine==='workers_ai'){
    info.className='notice ai'; info.innerHTML='<b>Motor:</b> Cloudflare Workers AI'+(model?' · '+esc(model):'')+'. Estructura el dictado y devuelve JSON clínico; no añade recomendaciones bibliográficas.';
  }else{
    info.className='notice ok'; info.innerHTML='<b>Motor local:</b> cada fragmento se asigna a un único destino; lo dudoso queda para revisión.';
  }
  renderUnclassified(); $('#reportCard').hidden=false; $('#reportCard').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderUnclassified(){
  const host=$('#unclassifiedReview'); host.innerHTML=''; if(!unclassified.length)return;
  const box=document.createElement('div'); box.className='notice warn'; box.innerHTML=`<b>Revisar:</b> ${unclassified.length} fragmento(s) no asignado(s) con suficiente seguridad.`; host.appendChild(box);
  unclassified.forEach((txt,idx)=>{
    const d=document.createElement('div'); d.className='reviewItem';
    const opts=currentTemplate().sections.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
    d.innerHTML=`<div class="reviewText">${esc(txt)}</div><div class="row" style="margin-top:7px"><select class="reviewTarget" data-idx="${idx}"><option value="">Elegir campo…</option>${opts}</select><button class="secondary assignReview" data-idx="${idx}">Añadir</button></div>`;
    host.appendChild(d);
  });
  $$('.assignReview').forEach(b=>b.onclick=()=>{
    const idx=Number(b.dataset.idx), sel=$(`.reviewTarget[data-idx="${idx}"]`), target=sel.value; if(!target)return;
    reportData[target]=[reportData[target],unclassified[idx]].filter(Boolean).join(' ').trim();
    unclassified.splice(idx,1); renderReport('local');
  });
}
function collectReportText(){
  return currentTemplate().sections.map(s=>{const v=(reportData[s]||'').trim();return v?`${s.toUpperCase()}\n${v}`:''}).filter(Boolean).join('\n\n');
}
function clearCurrentNote(confirmIt=true,keepPatient=false){
  if(confirmIt && !confirm('¿Limpiar la nota actual? La mini historia guardada no se borra.'))return;
  try{if(recording&&mediaRecorder){mediaRecorder.onstop=null;mediaRecorder.stop();}}catch(_){} mediaStream?.getTracks().forEach(t=>t.stop()); mediaStream=null; mediaRecorder=null; audioChunks=[]; recording=false; transcribing=false; reportData={};unclassified=[];
  if(!keepPatient){$('#patientCode').value='';$('#diagnosis').value='';}
  $('#raw').value='';$('#reportCard').hidden=true;$('#reportSections').innerHTML='';$('#unclassifiedReview').innerHTML='';
  for(let i=1;i<=4;i++){const n=$('#medName'+i),p=$('#medPlan'+i);if(n)n.value='';if(p)p.value='';}
  setMic(false,'Dictado listo. Pulsa para empezar.'); updatePatientContext();updatePrivacyWarning(); window.scrollTo({top:0,behavior:'smooth'});
}
function getPatients(){try{return JSON.parse(localStorage.getItem(KEY_PAT)||'{}');}catch(_){return {};}}
function setPatients(x){localStorage.setItem(KEY_PAT,JSON.stringify(x));}
function savePatientEntry(){
  const code=$('#patientCode').value.trim().toUpperCase(); if(!code){alert('Añade al menos una inicial/código de paciente.');return;}
  const dx=$('#diagnosis').value.trim(), text=collectReportText()||$('#raw').value.trim(); if(!text){alert('No hay contenido que guardar.');return;}
  const p=getPatients(); if(!p[code])p[code]={diagnosis:dx,entries:[]}; if(dx)p[code].diagnosis=dx;
  p[code].entries.unshift({date:new Date().toISOString(),type:currentTemplate().label,summary:text.replace(/\s+/g,' ').slice(0,320),text});
  p[code].entries=p[code].entries.slice(0,100); setPatients(p);renderPatients();updatePatientContext();alert('Entrada guardada en la mini historia.');
}
function renderPatients(){
  const q=norm($('#patientFilter').value),p=getPatients(),host=$('#patientList');host.innerHTML='';
  const arr=Object.entries(p).filter(([c,v])=>!q||norm(c+' '+(v.diagnosis||'')).includes(q)).sort((a,b)=>(b[1].entries?.[0]?.date||'').localeCompare(a[1].entries?.[0]?.date||''));
  if(!arr.length){host.innerHTML='<div class="card small">No hay pacientes guardados.</div>';return;}
  for(const [code,v] of arr){
    const card=document.createElement('div');card.className='patientCard';
    card.innerHTML=`<div class="patientTop"><div><div class="patientCode">${esc(code)}</div><div class="patientDx">${esc(v.diagnosis||'Sin diagnóstico de presunción')}</div><div class="patientActions"><button class="secondary openPat" data-code="${esc(code)}">Abrir</button><button class="ghost newPat" data-code="${esc(code)}">Nueva nota</button></div></div><span class="badge">${(v.entries||[]).length} entradas</span></div>${(v.entries||[]).slice(0,8).map(e=>`<div class="entry"><div class="entryMeta">${new Date(e.date).toLocaleString('es-ES')} · ${esc(e.type)}</div><div class="entrySummary">${esc(e.summary)}</div></div>`).join('')}`;
    host.appendChild(card);
  }
  $$('.openPat').forEach(b=>b.onclick=()=>{const code=b.dataset.code,v=p[code];$('#patientCode').value=code;$('#diagnosis').value=v.diagnosis||'';updatePatientContext();showTab('note');});
  $$('.newPat').forEach(b=>b.onclick=()=>{const code=b.dataset.code,v=p[code];clearCurrentNote(false,true);$('#patientCode').value=code;$('#diagnosis').value=v.diagnosis||'';updatePatientContext();showTab('note');});
}
function updatePatientContext(){
  const code=$('#patientCode').value.trim().toUpperCase(),p=getPatients()[code],box=$('#patientContext');
  if(!p){box.textContent='Sin contexto longitudinal seleccionado.';return;}
  const last=(p.entries||[])[0]; box.textContent=`${code} · ${p.diagnosis||'sin diagnóstico'} · ${(p.entries||[]).length} entradas${last?`\nÚltima: ${new Date(last.date).toLocaleDateString('es-ES')} · ${last.type}\n${last.summary}`:''}`;
}
function showTab(name){$$('.tab').forEach(x=>x.classList.remove('active'));$('#tab-'+name).classList.add('active');$$('nav button').forEach(x=>x.classList.toggle('active',x.dataset.tab===name));if(name==='patients')renderPatients();}
function initMeds(){
  const host=$('#medGrid'); for(let i=1;i<=4;i++){
    const d=document.createElement('div');d.className='medSlot';d.innerHTML=`<b>Cambio ${i}</b><label>Fármaco</label><input id="medName${i}" placeholder="Fármaco"><label>Pauta concreta</label><textarea id="medPlan${i}" class="mini" placeholder="Dosis, pauta, vía si procede, duración/cambio programado"></textarea>`;host.appendChild(d);
  }
}
function applyMeds(){
  const lines=[];for(let i=1;i<=4;i++){const n=$('#medName'+i).value.trim(),p=$('#medPlan'+i).value.trim();if(n||p)lines.push((n?n+': ':'')+p);}if(!lines.length)return;
  if(!Object.keys(reportData).length){const local=segmentLocal($('#raw').value,$('#visitType').value);reportData=local.sections;unclassified=local.unclassified;}
  const type=$('#visitType').value;
  const target=type==='emergency'?'Intervención realizada':type==='discharge'?'Tratamiento al alta':type==='evolution'?'Plan de tratamiento':type==='pti'?'Intervención de Psiquiatría':'Plan';
  reportData[target]=[reportData[target],...lines].filter(Boolean).join('\n');renderReport('local');
}
function copyText(t){
  if(!t.trim())return;
  navigator.clipboard?.writeText(t).then(()=>alert('Informe copiado.')).catch(()=>{const ta=document.createElement('textarea');ta.value=t;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();alert('Informe copiado.');});
}
async function testWorker(){
  const base=($('#workerUrl').value||'').trim().replace(/\/+$/,''); const box=$('#workerStatus'); if(!base){box.textContent='No hay URL configurada.';return;}
  box.textContent='Probando…';
  try{
    const r=await fetch(base,{cache:'no-store'});
    const d=await r.json();
    if(!r.ok || !d.ok)throw new Error(d.error||('HTTP '+r.status));
    box.innerHTML='<span class="statusDot ok"></span>Worker disponible · '+esc(d.engine||'Cloudflare Workers AI')+' · binding AI '+(d.ai_binding?'activo':'no detectado')+'.';
  }
  catch(e){box.innerHTML='<span class="statusDot warn"></span>No se pudo conectar: '+esc(e.message||String(e));}
}
function updateEngineStatus(){
  const s=getSettings(); $('#engineStatus').innerHTML=s.workerUrl?'<span class="statusDot ok"></span>Ordenación: Cloudflare Worker + Workers AI (sin fallback silencioso).':'<span class="statusDot warn"></span>Ordenación: segmentador local. Configura el Worker en Ajustes.';
}
function loadSettings(){const s=getSettings();$('#emailAddress').value=s.email;$('#workerUrl').value=s.workerUrl;if($('#localVocabulary'))$('#localVocabulary').value=s.vocabulary||'';updateEngineStatus();}
function emailReport(){
  const to=$('#emailAddress').value.trim()||DEFAULT_EMAIL,subject=encodeURIComponent(`Psikia · ${$('#patientCode').value||'nota'} · ${currentTemplate().label}`),body=encodeURIComponent(collectReportText());
  location.href=`mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`;
}

$('#dictate').addEventListener('click',toggleDictation);$('#dictate').addEventListener('contextmenu',e=>e.preventDefault());
$('#generate').onclick=generate;$('#clearRaw').onclick=()=>{if(confirm('¿Borrar solo el dictado?')){$('#raw').value='';updatePrivacyWarning();}};
$('#newNote').onclick=()=>clearCurrentNote(true,false);$('#newNoteTop').onclick=()=>clearCurrentNote(true,false);$('#discardDraft').onclick=()=>clearCurrentNote(true,false);
$('#savePatient').onclick=savePatientEntry;$('#copyReport').onclick=()=>copyText(collectReportText());$('#emailReport').onclick=emailReport;$('#applyMeds').onclick=applyMeds;
['patientCode','diagnosis'].forEach(id=>$('#'+id).addEventListener('input',updatePatientContext));$('#raw').addEventListener('input',updatePrivacyWarning);
$('#visitType').addEventListener('change',()=>{reportData={};unclassified=[];$('#reportCard').hidden=true;$('#reportSections').innerHTML='';});
$('#patientFilter').addEventListener('input',renderPatients);$('#openPatients').onclick=()=>showTab('patients');$$('nav button').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
$('#saveSettings').onclick=saveSettings;$('#testWorker').onclick=testWorker;

// Elimina borradores de versiones antiguas: se conserva solo la mini historia explícita.
['psikia_v25_draft','psikia_v24_draft','psikia_draft'].forEach(k=>localStorage.removeItem(k));
initMeds();loadSettings();renderPatients();clearCurrentNote(false,false);

if('serviceWorker' in navigator){
  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('./sw.js');
      if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
      reg.addEventListener('updatefound',()=>{const nw=reg.installing;if(!nw)return;nw.addEventListener('statechange',()=>{if(nw.state==='installed'&&navigator.serviceWorker.controller)nw.postMessage({type:'SKIP_WAITING'});});});
      navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloadOnControllerChange)return;reloadOnControllerChange=true;location.reload();});
    }catch(e){console.warn('SW registration failed',e);}
  });
}
