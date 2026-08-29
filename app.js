'use strict';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const KEY_PAT = 'psikia_v44_patients';
const KEY_SET = 'psikia_v44_settings';
const DEFAULT_EMAIL = 'Alejandro.ballesteros.prados@navarra.es';

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
let recognition = null;
let dictationWanted = false;
let recognitionRunning = false;
let manualStop = false;
let restartTimer = null;
let sessionBase = '';
let sessionText = '';
let lastEventText = '';
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

function wordsNorm(s){ return norm(s).replace(/[^a-z0-9ñáéíóúü]+/gi,' ').replace(/\s+/g,' ').trim(); }
function startsWithWords(longer, shorter){ const a=wordsNorm(longer), b=wordsNorm(shorter); return !!b && (a===b || a.startsWith(b+' ')); }
function sameEnough(a,b){ const x=wordsNorm(a), y=wordsNorm(b); return x===y || (x.length>24 && y.length>24 && (x.includes(y) || y.includes(x))); }
function mergeWithoutEcho(existing,incoming){
  const a=String(existing||'').trim(), b=String(incoming||'').trim(); if(!a)return b; if(!b)return a;
  if(sameEnough(a,b)) return wordsNorm(b).length>wordsNorm(a).length?b:a;
  const aw=a.split(/\s+/), bw=b.split(/\s+/); let overlap=0;
  for(let k=Math.min(32,aw.length,bw.length);k>=2;k--){
    if(wordsNorm(aw.slice(-k).join(' '))===wordsNorm(bw.slice(0,k).join(' '))){overlap=k;break;}
  }
  const tail=bw.slice(overlap).join(' '); return tail?`${a} ${tail}`:a;
}
function cleanSpeechChunk(txt, finish=false){
  let x=spokenPunctuation(txt).replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim(); if(!x)return '';
  x=x.charAt(0).toUpperCase()+x.slice(1);
  if(finish && !/[.!?…]$/.test(x)) x+='.';
  return x;
}
function canonicalResults(e){
  const finals=[];
  for(let i=0;i<e.results.length;i++){
    const r=e.results[i], tx=String(r?.[0]?.transcript||'').replace(/\s+/g,' ').trim();
    if(tx && r.isFinal) finals.push(tx);
  }
  if(!finals.length)return '';
  const collapsed=[];
  for(const tx of finals){
    if(!collapsed.length){collapsed.push(tx);continue;}
    const last=collapsed[collapsed.length-1];
    if(startsWithWords(tx,last)){collapsed[collapsed.length-1]=tx;continue;}
    if(startsWithWords(last,tx)||sameEnough(last,tx))continue;
    collapsed.push(tx);
  }
  return collapsed.join(' ').replace(/\s+/g,' ').trim();
}
function updateSpeechSession(candidate,event){
  if(!candidate)return;
  if(!sessionText) sessionText=candidate;
  else if(startsWithWords(candidate,sessionText)) sessionText=candidate;
  else if(startsWithWords(sessionText,candidate)) {}
  else if(event.results.length>1) sessionText=candidate;
  else if(lastEventText && startsWithWords(candidate,lastEventText)){
    const base=sessionText, bn=wordsNorm(base), ln=wordsNorm(lastEventText);
    if(bn.endsWith(ln)){
      const idx=norm(base).lastIndexOf(norm(lastEventText));
      sessionText=idx>=0?base.slice(0,idx)+candidate:candidate;
    } else sessionText=candidate;
  } else sessionText=mergeWithoutEcho(sessionText,candidate);
  lastEventText=candidate;
  const piece=cleanSpeechChunk(sessionText,false);
  $('#raw').value=[sessionBase,piece].filter(Boolean).join(sessionBase&&piece?'\n':'');
  $('#raw').scrollTop=$('#raw').scrollHeight;
  updatePrivacyWarning();
}
function finalizeSpeechCycle(){
  const piece=cleanSpeechChunk(sessionText,true);
  const combined=[sessionBase,piece].filter(Boolean).join(sessionBase&&piece?'\n':'');
  $('#raw').value=combined.trim();
  sessionBase=$('#raw').value.trim(); sessionText=''; lastEventText='';
  updatePrivacyWarning();
}
function setMic(on,msg){
  const b=$('#dictate'); b.classList.toggle('listening',on); b.textContent=on?'⏹️ Pulsar para detener':'🎙️ Pulsar para hablar';
  if(msg) $('#dictationStatus').textContent=msg;
}
function makeRecognition(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition; if(!SR)return null;
  const r=new SR(); r.lang='es-ES'; r.continuous=true; r.interimResults=false; r.maxAlternatives=1;
  try{ if('unspokenPunctuation' in r) r.unspokenPunctuation=true; }catch(_){}
  r.onstart=()=>{
    recognitionRunning=true; sessionBase=$('#raw').value.trim(); sessionText=''; lastEventText='';
    setMic(true,'Dictando… Se detiene solo cuando vuelves a pulsar.');
  };
  r.onresult=e=>{ const fin=canonicalResults(e); if(fin)updateSpeechSession(fin,e); $('#dictationStatus').textContent='Dictando… texto consolidado sin repetir hipótesis.'; };
  r.onerror=e=>{
    if(e.error==='not-allowed'||e.error==='service-not-allowed'){
      dictationWanted=false; recognitionRunning=false; setMic(false,'Permiso de micrófono denegado.'); return;
    }
    if(!['no-speech','aborted'].includes(e.error)) $('#dictationStatus').textContent='Incidencia de dictado: '+e.error+'. Reintentando mientras siga activo…';
  };
  r.onend=()=>{
    finalizeSpeechCycle(); recognitionRunning=false;
    if(dictationWanted && !manualStop){
      setMic(true,'Dictando… pausa detectada; continúo sin que tengas que tocar el botón.');
      clearTimeout(restartTimer);
      restartTimer=setTimeout(()=>startRecognitionCycle(),180);
    } else {
      setMic(false,'Dictado detenido.');
    }
  };
  return r;
}
function startRecognitionCycle(){
  if(!dictationWanted || manualStop)return;
  if(!recognition) recognition=makeRecognition();
  if(!recognition){ dictationWanted=false; setMic(false,'Este navegador no ofrece Web Speech. Puedes escribir o pegar el texto.'); return; }
  try{ recognition.start(); }catch(_){
    clearTimeout(restartTimer);
    restartTimer=setTimeout(()=>{ if(dictationWanted&&!manualStop)startRecognitionCycle(); },350);
  }
}
function toggleDictation(e){
  e?.preventDefault();
  if(dictationWanted){
    dictationWanted=false; manualStop=true; clearTimeout(restartTimer);
    try{ if(recognitionRunning)recognition.stop(); else recognition.abort(); }catch(_){}
    finalizeSpeechCycle(); setMic(false,'Dictado detenido.'); return;
  }
  manualStop=false; dictationWanted=true; startRecognitionCycle();
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
  return {email:stored.email||DEFAULT_EMAIL,workerUrl:stored.workerUrl||cfg.apiBase||''};
}
function saveSettings(){
  const s={email:$('#emailAddress').value.trim()||DEFAULT_EMAIL,workerUrl:$('#workerUrl').value.trim().replace(/\/+$/,'')};
  localStorage.setItem(KEY_SET,JSON.stringify(s));
  $('#workerStatus').textContent='Ajustes guardados.';
  updateEngineStatus();
}
function workerEndpoint(){ const base=($('#workerUrl').value||'').trim().replace(/\/+$/,''); return base?base+'/api/note':''; }
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
async function segmentWithWorker(text,type){
  const endpoint=workerEndpoint(); if(!endpoint) throw new Error('WORKER_NOT_CONFIGURED');
  const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({report_type:type,transcript:text})});
  let data={}; try{data=await res.json();}catch(_){throw new Error('Respuesta no JSON del Worker');}
  if(!res.ok || !data.ok) throw new Error(data.error||('HTTP '+res.status));
  return {sections:data.sections||{},unclassified:Array.isArray(data.unclassified)?data.unclassified:[],engine:'openai',model:data.model||''};
}
async function generate(){
  const text=$('#raw').value.trim(); if(!text){alert('No hay dictado o texto para ordenar.');return;}
  updatePrivacyWarning();
  const hits=privacyScan(text);
  if(hits.length && workerEndpoint()){
    if(!confirm('He detectado un posible identificador directo. ¿Quieres enviar igualmente este texto al Worker?'))return;
  }
  const btn=$('#generate'); btn.disabled=true; btn.textContent='Ordenando…';
  let result;
  try{
    if(workerEndpoint()){
      $('#engineStatus').textContent='Usando Worker + OpenAI Structured Outputs…';
      result=await segmentWithWorker(text,$('#visitType').value);
    } else result=segmentLocal(text,$('#visitType').value);
  }catch(err){
    console.warn('Worker unavailable, local fallback:',err);
    result=segmentLocal(text,$('#visitType').value);
    $('#engineStatus').textContent='El Worker no respondió; he usado el segmentador local. '+(err?.message||'');
  }finally{btn.disabled=false;btn.textContent='✨ Ordenar nota';}
  reportData=result.sections; unclassified=result.unclassified||[]; renderReport(result.engine,result.model||'');
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
  if(engine==='openai'){
    info.className='notice ai'; info.innerHTML='<b>Motor:</b> OpenAI Structured Outputs'+(model?' · '+esc(model):'')+'. Solo reordena el contenido enviado; no añade recomendaciones clínicas bibliográficas.';
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
  dictationWanted=false; manualStop=true; clearTimeout(restartTimer); try{recognition?.abort();}catch(_){}
  recognitionRunning=false; sessionBase='';sessionText='';lastEventText=''; reportData={};unclassified=[];
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
  try{const r=await fetch(base+'/health',{cache:'no-store'});const d=await r.json();if(!r.ok)throw new Error('HTTP '+r.status);box.innerHTML='<span class="statusDot ok"></span>Worker disponible · RAG '+(d.rag_enabled?'activo':'preparado/no activo')+'.';}
  catch(e){box.innerHTML='<span class="statusDot warn"></span>No se pudo conectar: '+esc(e.message||String(e));}
}
function updateEngineStatus(){
  const s=getSettings(); $('#engineStatus').innerHTML=s.workerUrl?'<span class="statusDot ok"></span>Ordenación: Worker + OpenAI (con fallback local).':'<span class="statusDot warn"></span>Ordenación: segmentador local. Configura el Worker en Ajustes para Structured Outputs.';
}
function loadSettings(){const s=getSettings();$('#emailAddress').value=s.email;$('#workerUrl').value=s.workerUrl;updateEngineStatus();}
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
