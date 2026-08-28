'use strict';
const APP_VERSION='3.3';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const norm=s=>String(s??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const splitSentences=text=>String(text||'').replace(/\r/g,'\n').split(/\n+|(?<=[.!?;])\s+/).map(x=>x.trim()).filter(Boolean);
let currentReport={}, fullReport={}, currentType='first', lastInput='', presentationSlides=[], slideIndex=0, currentGroupSession=null, recognition=null, isDictating=false, compactMode=false;
let wakeLock=null, dictationWanted=false, restartTimer=null, draftTimer=null, sourceTrace={};
let scalePhotoData='';
const USERS_KEY='psikiaHubUsersV3';
let activeUserId='alejandro';
function slugifyUser(v){return norm(v).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,28)||`user-${Date.now()}`}
function loadUsers(){
 try{const u=JSON.parse(localStorage.getItem(USERS_KEY)||'null');if(u&&u.profiles&&Object.keys(u.profiles).length)return u}catch{}
 const seed={activeId:'alejandro',profiles:{alejandro:{id:'alejandro',name:'Alejandro',email:'Alejandro.ballesteros.prados@navarra.es',created:new Date().toISOString()}}};localStorage.setItem(USERS_KEY,JSON.stringify(seed));return seed;
}
function saveUsers(u){localStorage.setItem(USERS_KEY,JSON.stringify(u))}
function activeProfile(){const u=loadUsers();return u.profiles[activeUserId]||Object.values(u.profiles)[0]}
function storageKey(base){return `psikiaHub:${base}:v3:${activeUserId}`}
function migrateLegacyForActive(){
 const pairs=[['psikiaPatientsV2','patients'],['psikiaGroupHistoryV2','groupHistory'],['psikiaHubDraftV21','draft']];
 for(const [oldKey,newBase] of pairs){const nk=storageKey(newBase);if(localStorage.getItem(nk)==null&&localStorage.getItem(oldKey)!=null)localStorage.setItem(nk,localStorage.getItem(oldKey))}
}
function userInitials(name){const w=String(name||'').trim().split(/\s+/).filter(Boolean);return (w.length>1?(w[0][0]+w[w.length-1][0]):(w[0]||'U').slice(0,2)).toUpperCase()}
function renderUserUI(){
 const u=loadUsers();if(!u.profiles[activeUserId])activeUserId=u.activeId&&u.profiles[u.activeId]?u.activeId:Object.keys(u.profiles)[0];u.activeId=activeUserId;saveUsers(u);const p=u.profiles[activeUserId];
 const sel=$('#activeUserSelect');if(sel){sel.innerHTML=Object.values(u.profiles).map(x=>`<option value="${esc(x.id)}" ${x.id===activeUserId?'selected':''}>${esc(x.name||x.id)}</option>`).join('')}
 if($('#emailAddress'))$('#emailAddress').value=p?.email||'';if($('#activeUserBadge'))$('#activeUserBadge').textContent=userInitials(p?.name||p?.id);if($('#activeUserInline'))$('#activeUserInline').textContent=p?.name||'Profesional';
 if($('#customVocabulary'))$('#customVocabulary').value=localStorage.getItem(storageKey('vocabulary'))||'';
}
function setActiveUser(id){const u=loadUsers();if(!u.profiles[id])return;saveDraftNow();activeUserId=id;u.activeId=id;saveUsers(u);migrateLegacyForActive();$('#raw').value='';$('#patientCode').value='';$('#resultCard').hidden=true;currentReport={};fullReport={};lastInput='';restoreDraft();renderUserUI();updateContextHint();renderGroupHistory();setDictationStatus($('#raw').value?'Borrador del usuario recuperado.':'Guardado automático activo.')}
function addUserProfile(){const name=$('#newUserName').value.trim(),email=$('#newUserEmail').value.trim();if(!name)return alert('Escribe un nombre o iniciales para el profesional.');const u=loadUsers();let id=slugifyUser(name);let base=id,i=2;while(u.profiles[id])id=`${base}-${i++}`;u.profiles[id]={id,name,email,created:new Date().toISOString()};u.activeId=id;saveUsers(u);activeUserId=id;$('#newUserName').value='';$('#newUserEmail').value='';$('#raw').value='';$('#patientCode').value='';$('#resultCard').hidden=true;currentReport={};fullReport={};lastInput='';renderUserUI();updateContextHint();renderGroupHistory();setDictationStatus('Nuevo perfil activo. Guardado automático independiente.');alert('Usuario local creado. Sus datos quedan separados de los demás perfiles en este dispositivo.')}
function deleteActiveUser(){const u=loadUsers();if(Object.keys(u.profiles).length<=1)return alert('Debe quedar al menos un usuario local.');const p=u.profiles[activeUserId];if(!confirm(`¿Eliminar el perfil local ${p?.name||activeUserId} y sus datos guardados en este dispositivo?`))return;for(const base of ['patients','groupHistory','draft','vocabulary'])localStorage.removeItem(storageKey(base));delete u.profiles[activeUserId];activeUserId=Object.keys(u.profiles)[0];u.activeId=activeUserId;saveUsers(u);renderUserUI();$('#raw').value='';$('#patientCode').value='';$('#resultCard').hidden=true;restoreDraft();updateContextHint();renderGroupHistory()}
function escapeRegExp(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function applyCustomCorrections(text){let out=String(text||'');const safeBuiltIns=[[ /\bmodelo unido conductual\b/gi,'modelo cognitivo-conductual' ],[ /\bdescarrilamiento del organismo\b/gi,'descarrilamientos del curso del pensamiento' ],[ /\bparece que estemos inter[eé]s\b/gi,'muestra interés' ],[ /\bla consulta hasta el paciente\b/gi,'el paciente' ]];for(const [re,to] of safeBuiltIns)out=out.replace(re,to);const raw=localStorage.getItem(storageKey('vocabulary'))||'';for(const line of raw.split(/\n+/)){const m=line.split(/\s*=>\s*/);if(m.length<2||!m[0].trim()||!m.slice(1).join('=>').trim())continue;const from=escapeRegExp(m[0].trim()),to=m.slice(1).join('=>').trim();try{out=out.replace(new RegExp(from,'gi'),to)}catch{}}return out}

const labels={
 first:'Primera consulta',follow:'Consulta de seguimiento',acute:'Consulta en agudos',urInitial:'UR · valoración/ingreso',urFollow:'UR · seguimiento',pti:'UR · PTI',discharge:'UR · alta',emergency:'Urgencias',medicalGeneral:'Consulta médica general'
};
const sections={
 first:['Motivo de consulta / derivación','Antecedentes médicos no psiquiátricos','Antecedentes psiquiátricos personales','Antecedentes familiares psiquiátricos','Consumo de sustancias','Situación sociolaboral y funcional','Tratamiento actual','Enfermedad actual / evolución longitudinal','Exploración psicopatológica','Juicio clínico','Plan de tratamiento','Seguimiento'],
 urInitial:['Motivo de derivación / ingreso','Antecedentes médicos no psiquiátricos','Antecedentes psiquiátricos y de consumo','Antecedentes familiares psiquiátricos','Situación sociolaboral y funcional','Tratamiento actual','Enfermedad actual / evolución longitudinal','Exploración psicopatológica','Juicio clínico','Plan de tratamiento e intervención','Disposición / ingreso'],
 follow:['Resumen clínico','Evolución desde la última revisión','Exploración psicopatológica comparativa','Juicio clínico','Plan de tratamiento','Próxima cita'],
 urFollow:['Resumen clínico y funcional','Evolución clínica','Evolución funcional / rehabilitadora','Exploración psicopatológica comparativa','Juicio clínico','Plan de intervención','Próxima revisión'],
 acute:['Motivo de consulta','Resumen de antecedentes relevantes','Enfermedad actual / situación precipitante','Exploración psicopatológica','Juicio clínico','Intervención realizada','Plan / seguimiento'],
 emergency:['Motivo de consulta','Antecedentes relevantes','Situación precipitante / enfermedad actual','Exploración psicopatológica','Valoración de riesgo','Pruebas / actuaciones realizadas','Juicio clínico','Tratamiento / intervención','Disposición y plan inmediato'],
 pti:['Resumen clínico y funcional','Necesidades / problemas activos','Objetivos del ingreso','Intervención de Psiquiatría','Intervención de Psicología','Intervención de Enfermería','Intervención de Terapia Ocupacional','Intervención de Trabajo Social','Otras intervenciones / coordinación','Indicadores de seguimiento'],
 discharge:['Motivo y contexto del ingreso','Antecedentes relevantes','Evolución durante el ingreso','Intervenciones realizadas','Exploración psicopatológica al alta','Diagnóstico al alta','Tratamiento al alta','Situación funcional al alta','Plan de seguimiento y recursos','Objetivos pendientes / recomendaciones'],
 medicalGeneral:['Motivo / problema actual','Antecedentes médicos relevantes','Medicación y alergias','Historia del problema actual','Constantes','Exploración física','Pruebas / resultados','Valoración clínica / diagnóstico diferencial','Plan de tratamiento','Consejos de seguridad y seguimiento']
};

const cues={
 'Resumen clínico':['paciente con','en seguimiento','diagnost','tratamiento','ingresad','lleva','desde hace','centro de salud mental'],
 'Resumen clínico y funcional':['paciente con','en seguimiento','diagnost','tratamiento','ingresad','unidad de rehabilitacion','lleva ingresado','desde hace'],
 'Motivo de consulta / derivación':['motivo','derivad','primera cita','consulta por','remitid'],
 'Motivo de derivación / ingreso':['motivo','derivad','ingreso','unidad de rehabilitacion'],
 'Motivo de consulta':['motivo','acude','consulta por','derivad'],
 'Antecedentes médicos no psiquiátricos':['antecedentes medicos','somatic','quirurg','alerg','diabetes','hipertension','renal','hepatic','cardiop'],
 'Antecedentes psiquiátricos personales':['antecedentes psiqui','episodios previos','salud mental','ingreso previo','tratamiento previo'],
 'Antecedentes psiquiátricos y de consumo':['antecedentes psiqui','episodios previos','consumo','cannabis','alcohol','cocaina','abstinencia','tratamientos previos'],
 'Antecedentes familiares psiquiátricos':['antecedentes familiares','hermana','hermano','madre','padre','familiares'],
 'Consumo de sustancias':['consumo','cannabis','alcohol','cocaina','opiace','tabaco','toxic','abstinencia'],
 'Situación sociolaboral y funcional':['trabaja','paro','desemple','casad','hijos','pareja','convive','autocuidado','ocupacional','actividad','aislamiento','social','laboral','cuadrilla'],
 'Tratamiento actual':['tratamiento actual','tratamiento farmac','mg','miligr','escitalopram','fluoxetina','mirtazapina','lorazepam','sertralina','venlafaxina','duloxetina','vortioxetina','aripiprazol','olanzapina','risperidona','paliperidona','quetiapina','clozapina','litio','valproato','lamotrigina'],
 'Enfermedad actual / evolución longitudinal':['enfermedad actual','desde hace','a raiz','progresivamente','ultimos','meses','semanas','inicio','empeora','crisis','desencaden','actualmente'],
 'Enfermedad actual / situación precipitante':['situacion precipitante','a raiz','desde hace','actualmente','crisis','empeora','inicio'],
 'Situación precipitante / enfermedad actual':['situacion precipitante','a raiz','desde hace','actualmente','crisis','empeora','inicio'],
 'Exploración psicopatológica':['exploracion','consciente','orientad','contacto','discurso','hipotimia','eutimia','ansiedad','delir','alucin','ideacion','planes de futuro','sueño','apetito','abulia','anhedonia'],
 'Juicio clínico':['juicio clinico','diagnost','impresion clinica','compatible con','se mantiene'],
 'Plan de tratamiento':['plan de tratamiento','indicamos','recomendamos','mantener','retirar','iniciar','pauta','enfermer','psicolog','relajacion','intervencion'],
 'Seguimiento':['cita','revision','seguimiento','meses','semanas'],
 'Intervención realizada':['intervencion','pautamos','recomendamos','administramos','psicoeduc','relajacion','tratamiento'],
 'Plan / seguimiento':['cita','seguimiento','revision','mantener','retirar','deriv'],
 'Valoración de riesgo':['riesgo','autolit','suicid','heteroagres','autoagres','planificad','intento'],
 'Pruebas / actuaciones realizadas':['analit','ecg','electrocard','tac','resonancia','observacion','medicacion administrada'],
 'Tratamiento / intervención':['tratamiento','intervencion','administramos','pautamos','psicoeduc'],
 'Disposición y plan inmediato':['alta','ingreso','observacion','deriv','seguimiento','acompañad','cita'],
 'Evolución desde la última revisión':['desde la ultima','ha mejorado','ha empeorado','progresos','persiste','respuesta','tolerado','evolucion'],
 'Evolución clínica':['desde la ultima','ha mejorado','ha empeorado','evolucion','sintomas','respuesta'],
 'Evolución funcional / rehabilitadora':['autocuidado','actividad','grupo','ocupacional','social','funcional','avd','salida','cuadrilla','deporte'],
 'Exploración psicopatológica comparativa':['exploracion','consciente','orientad','discurso','crisis','afect','futuro','sueño','apetito','delir','alucin','ideacion'],
 'Plan de intervención':['mantener','retirar','iniciar','tratamiento','psicolog','enfermer','terapia ocupacional','trabajo social','objetivo','intervencion'],
 'Próxima cita':['cita','revision','seguimiento','meses','semanas'],
 'Próxima revisión':['cita','revision','seguimiento','meses','semanas'],
 'Motivo / problema actual':['motivo','consulta por','problema','molestia','dolor','tos','fiebre','lesion','erupcion','prurito'],
 'Antecedentes médicos relevantes':['antecedentes medicos','diabetes','hipertension','asma','epoc','cardiop','renal','hepatic','quirurg','inmunosupres','alergia previa'],
 'Medicación y alergias':['medicacion','tratamiento habitual','alergia','alergico','penicilina','anticoagul','corticoide','antibiotico'],
 'Historia del problema actual':['desde hace','inicio','evolucion','empeora','mejora','tos','esputo','disnea','fiebre','odinofagia','rinorrea','congestion','dolor','lesion','eritema','prurito','vesicula','papula','placa','herida'],
 'Constantes':['tension','presion arterial','ta ','frecuencia cardiaca','fc ','frecuencia respiratoria','fr ','temperatura','saturacion','sato2','spo2','glucemia'],
 'Exploración física':['exploracion fisica','auscultacion','murmullo vesicular','crepitantes','sibilancias','roncus','faringe','amigdala','adenopatia','abdomen','palpacion','piel','lesion','eritema','calor local','edema','exudado','costra','vesicula','papula','placa','neurologico'],
 'Pruebas / resultados':['analitica','hemograma','pcr','proteina c reactiva','test covid','test gripe','cultivo','radiografia','rx','ecografia','ecg','electrocardiograma','glucemia','resultado'],
 'Valoración clínica / diagnóstico diferencial':['valoracion','impresion','diagnostico','compatible con','probable','sospecha','diferencial','descartar','infeccion respiratoria','bronquitis','faringitis','dermatitis','celulitis'],
 'Consejos de seguridad y seguimiento':['si empeora','signos de alarma','urgencias','reconsultar','revalorar','control','revision','seguimiento','dificultad respiratoria','fiebre persistente']
};

function score(section,s){
 const n=norm(s);let total=(cues[section]||[]).reduce((a,k)=>a+(n.includes(norm(k))?1:0),0), t=norm(section);
 if(/juicio clinico/.test(t)&&/\bjuicio\b|diagnost|impresion clinica/.test(n))total+=6;
 if(/plan de tratamiento|plan \/ seguimiento|plan de intervencion|tratamiento \/ intervencion/.test(t)&&/plan de tratamiento|\bplan\b|indicamos|mantenemos|retiramos|iniciamos|intervencion/.test(n))total+=4;
 if(/exploracion psicopatologica/.test(t)&&/delir|alucin|autolit|suicid|orientad|discurso|afect|hipotim|eutim|planes de futuro|duerme|sueño|apetito|come bien/.test(n))total+=3;
 if(/tratamiento actual/.test(t)&&/\bmg\b|miligr|escitalopram|fluoxetina|mirtazapina|lorazepam|sertralina|venlafaxina|duloxetina|vortioxetina|aripiprazol|olanzapina|risperidona|paliperidona|quetiapina|clozapina|litio|valproato|lamotrigina/.test(n))total+=3;
 if(/seguimiento|proxima cita|proxima revision/.test(t)&&/cita|revision|seguimiento|dentro de \d+|en \d+ (?:mes|seman)/.test(n))total+=4;
 if(/constantes/.test(t)&&/sato2|spo2|saturacion|temperatura|\bta\b|presion arterial|frecuencia cardiaca|\bfc\b|frecuencia respiratoria|\bfr\b|glucemia/.test(n))total+=6;
 if(/exploracion fisica/.test(t)&&/auscult|murmullo|crepit|sibil|roncus|faring|amigdal|adenopat|abdomen|palp|piel|lesion|eritem|edema|exud|costra|vesicul|papul|placa/.test(n))total+=6;
 if(/pruebas \/ resultados/.test(t)&&/analit|hemograma|proteina c reactiva|\bpcr\b|test|cultivo|radiograf|ecografia|ecg|electrocard|resultado/.test(n))total+=6;
 if(/valoracion clinica/.test(t)&&/diagnost|impresion|compatible con|probable|sospecha|diferencial|descartar/.test(n))total+=6;
 if(/historia del problema actual/.test(t)&&/desde hace|inicio|evolucion|empeora|mejora|tos|esputo|disnea|fiebre|odinofagia|rinorrea|congestion|dolor|prurito/.test(n))total+=4;
 return total;
}
function dedupe(arr){const seen=new Set();return arr.filter(x=>{const k=norm(x).replace(/[^a-z0-9]+/g,' ').trim();if(!k||seen.has(k))return false;seen.add(k);return true})}
function smartSegments(text){
 let s=String(text||'').replace(/\r/g,' ').replace(/\s+/g,' ').trim();if(!s)return [];
 const pivots=[
  /\s+(?=(?:a\s+nivel\s+de\s+la\s+|en\s+la\s+)?exploraci[oó]n psicopatol[oó]gica\b)/ig,
  /\s+(?=(?:un\s+)?juicio(?:\s+cl[ií]nico)?\b)/ig,
  /\s+(?=(?:el\s+)?plan de tratamiento\b)/ig,
  /\s+(?=tratamiento actual\b)/ig,
  /\s+(?=enfermedad actual\b)/ig,
  /\s+(?=motivo de (?:consulta|derivaci[oó]n)\b)/ig,
  /\s+(?=antecedentes (?:m[eé]dicos|psiqui[aá]tricos|familiares)\b)/ig,
  /\s+(?=consumo de sustancias\b)/ig,
  /\s+(?=(?:pr[oó]xima\s+)?cita\b)/ig,
  /\s+(?=seguimiento\b)/ig,
  /\s+(?=en algunos momentos\b)/ig,
  /\s+(?=por lo tanto\b)/ig,
  /\s+(?=nos centramos\b)/ig,
  /\s+(?=hacemos una intervenci[oó]n\b)/ig
 ];
 pivots.forEach(re=>{s=s.replace(re,' ||| ')});
 let chunks=s.split(/\s*\|\|\|\s*|\n+|(?<=[.!?;])\s+/).map(x=>x.trim()).filter(x=>x&&!/^(?:un|una|el|la)$/i.test(x)), out=[];
 for(const c of chunks){
  if(c.split(/\s+/).length>30){
   const subs=c.split(/\s+(?:y|pero|aunque|por lo tanto)\s+(?=(?:actualmente|refiere|presenta|no presenta|no tiene|parece|se mantiene|hacemos|indicamos|retiramos|mantenemos|nos centramos|cita|juicio|plan|en algunos momentos)\b)/i).map(x=>x.trim()).filter(Boolean);
   out.push(...subs);
  }else out.push(c);
 }
 return out;
}
function sectionForHint(list,hint){
 const patterns={
  motive:/Motivo/i, medical:/Antecedentes médicos/i, psychHx:/Antecedentes psiquiátricos/i, family:/Antecedentes familiares/i,
  substances:/Consumo de sustancias|consumo/i, social:/Situación sociolaboral|funcional/i, treatment:/Tratamiento actual/i,
  illness:/Enfermedad actual|Evolución desde|Evolución clínica/i, mse:/Exploración psicopatológica/i, judgment:/Juicio clínico|Diagnóstico al alta/i,
  plan:/Plan de tratamiento|Plan de intervención|Tratamiento \/ intervención|Intervención realizada|Intervención y seguimiento/i,
  followup:/Seguimiento|Próxima cita|Próxima revisión|Disposición/i,
  vitals:/Constantes/i, physical:/Exploración física/i, investigations:/Pruebas \/ resultados/i, assessment:/Valoración clínica/i
 };
 return list.find(x=>patterns[hint]?.test(x))||null;
}
function hintedSegments(text,list){
 let s=String(text||'').replace(/\r/g,' ').replace(/\s+/g,' ').trim();
 const defs=[
  ['mse',/\b(?:(?:a\s+nivel\s+de\s+la|en\s+la|a\s+la)\s+)?exploraci[oó]n psicopatol[oó]gica\b/ig],
  ['judgment',/\bjuicio cl[ií]nico\b/ig],
  ['plan',/\b(?:el\s+)?plan de tratamiento\b/ig],
  ['treatment',/\btratamiento actual\b/ig],
  ['illness',/\benfermedad actual\b/ig],
  ['motive',/\bmotivo de (?:consulta|derivaci[oó]n|ingreso)\b/ig],
  ['medical',/\bantecedentes m[eé]dicos(?: no psiqui[aá]tricos)?\b/ig],
  ['psychHx',/\bantecedentes psiqui[aá]tricos(?: personales)?\b/ig],
  ['family',/\bantecedentes familiares(?: psiqui[aá]tricos)?\b/ig],
  ['substances',/\bconsumo de sustancias\b/ig],
  ['followup',/\bpr[oó]xima cita\b/ig],
  ['vitals',/\b(?:constantes|signos vitales)\b/ig],
  ['physical',/\bexploraci[oó]n f[ií]sica\b/ig],
  ['investigations',/\b(?:pruebas|resultados|investigaciones)\b/ig],
  ['assessment',/\b(?:valoraci[oó]n cl[ií]nica|impresi[oó]n diagn[oó]stica|diagn[oó]stico diferencial)\b/ig]
 ];
 for(const [key,re] of defs)s=s.replace(re,` |||@@${key}@@ `);
 const raw=s.split(/\s*\|\|\|\s*/).map(x=>x.trim()).filter(Boolean), out=[];let forced=null, phase='preMse';
 for(const part of raw){
  const m=part.match(/^@@([a-zA-Z]+)@@\s*(.*)$/s);
  if(m){
   if(m[1]==='mse')phase='mse';else if(m[1]==='judgment')phase='judgment';else if(m[1]==='plan')phase='plan';
   forced=sectionForHint(list,m[1]);if(m[2])out.push({text:m[2].trim(),forced,phase});continue
  }
  for(const seg of smartSegments(part))out.push({text:seg,forced,phase});
 }
 return out;
}
function normalizeSectionValue(section,value){let v=String(value||'').trim();if(!v)return '';
 const n=norm(v),sec=norm(section);
 if(/antecedentes medicos/.test(sec)&&/^(?:sin )?(?:antecedentes )?(?:medicos )?(?:de )?interes$/.test(n))return 'Sin antecedentes médicos de interés.';
 if(/antecedentes psiquiatricos/.test(sec)&&/^sin (?:episodios|antecedentes) previos/.test(n))return 'Sin antecedentes psiquiátricos previos de interés.';
 if(/consumo de sustancias/.test(sec)&&/^(?:niega|no refiere|sin consumo)$/.test(n))return 'No refiere consumo de sustancias.';
 return cleanClinicalText(v);
}
function classify(text, list){
 const out=Object.fromEntries(list.map(s=>[s,[]]));
 hintedSegments(text,list).forEach(({text:sent,forced,phase})=>{
  if(!sent||/^nota de evoluci[oó]n(?: cl[ií]nica)?[.:;]?$/i.test(sent.trim()))return;
  if(forced){out[forced].push(sent);return}
  let best=list[0],max=0;list.forEach(sec=>{const sc=score(sec,sent);if(sc>max){max=sc;best=sec}});
  const evo=list.find(x=>/Evolución desde|Evolución clínica|Enfermedad actual/.test(x));
  if(phase==='preMse'&&/Exploración psicopatológica/.test(best)&&evo)best=evo;
  if(max===0)best=evo||list[0];
  out[best].push(sent)
 });
 const joined=Object.fromEntries(Object.entries(out).map(([k,v])=>[k,normalizeSectionValue(k,dedupe(v).join(' '))]));
 const planKey=list.find(k=>/Plan de tratamiento|Plan de intervención|Tratamiento \/ intervención|Intervención y seguimiento/.test(k));
 const followKey=list.find(k=>/Próxima cita|Próxima revisión|Seguimiento$|Disposición/.test(k));
 if(planKey&&followKey&&joined[planKey]){
  const p=joined[planKey];
  const m=p.match(/^(.*?)(\b(?:citarlo|citarla|citamos|damos cita|se programa cita|nueva revisi[oó]n|revisi[oó]n en)\b.*)$/i);
  if(m&&m[2].split(/\s+/).length>=3){joined[planKey]=m[1].trim().replace(/[;,]+$/,'');joined[followKey]=[joined[followKey],m[2].trim()].filter(Boolean).join(' ')}
 }
 return joined;
}

function patientStore(){try{return JSON.parse(localStorage.getItem(storageKey('patients'))||'{}')}catch{return {}}}
function savePatientStore(obj){localStorage.setItem(storageKey('patients'),JSON.stringify(obj))}
function getCode(){return ($('#patientCode').value||'').trim().toUpperCase().replace(/[^A-ZÁÉÍÓÚÑ]/g,'').slice(0,2)}
function getContext(code=getCode()){return code?patientStore()[code]||null:null}
function updateContextHint(){const code=getCode(), c=getContext(code);$('#patientCode').value=code;$('#contextDot').classList.toggle('on',!!c);$('#contextHint').textContent=!code?'Código opcional A/AB para enlazar seguimientos.':c?`Contexto longitudinal de ${code} cargado · ${new Date(c.updated).toLocaleDateString('es-ES')}`:`Sin contexto previo para ${code}.`}

const medicationNames=['paliperidona','xeplion','trevicta','byannli','quetiapina','seroquel','risperidona','risperdal','aripiprazol','abilify','olanzapina','zyprexa','clozapina','leponex','amisulprida','solian','haloperidol','fluoxetina','prozac','escitalopram','cipralex','sertralina','venlafaxina','desvenlafaxina','duloxetina','mirtazapina','vortioxetina','brintellix','bupropion','litio','plenur','valproato','depakine','lamotrigina','lamictal','carbamazepina','lorazepam','orfidal','clonazepam','rivotril','diazepam'];
function cleanClinicalText(text){
 let s=String(text||'').replace(/\s+/g,' ').trim();if(!s)return '';
 s=s.replace(/\b(\d+(?:[.,]\d+)?)\s+miligramos?\b/gi,'$1 mg').replace(/\bduerme como un lir[oó]n\b/gi,'duerme bien');
 s=s.replace(/\bparece que parece que\b/gi,'parece que').replace(/\bel paciente el paciente\b/gi,'el paciente');
 s=s.charAt(0).toUpperCase()+s.slice(1);if(!/[.!?]$/.test(s))s+='.';return s;
}
function extractDiagnosisPhrase(text){
 const s=String(text||'');
 const patterns=[
  /\b(esquizofrenia(?:\s+(?:paranoide|desorganizada|residual|indiferenciada))?)\b/i,
  /\b(trastorno\s+(?:depresivo\s+(?:mayor|recurrente)[^,.;]{0,55}|bipolar(?:\s+(?:I|II|1|2))?[^,.;]{0,45}|de\s+p[aá]nico[^,.;]{0,45}|de\s+ansiedad\s+generalizada[^,.;]{0,35}|obsesivo[- ]compulsivo[^,.;]{0,35}|l[ií]mite\s+de\s+la\s+personalidad[^,.;]{0,20}))\b/i,
  /\b(depresi[oó]n\s+mayor[^,.;]{0,40})\b/i
 ];
 for(const re of patterns){const m=s.match(re);if(m)return m[1].trim()}
 const explicit=String(s).match(/(?:diagn[oó]stico|juicio cl[ií]nico)\s*(?:es|:)?\s*([^.;]{4,100})/i);if(explicit&&!/no cambia|sin cambios/i.test(explicit[1]))return explicit[1].trim();return '';
}
function extractMedicationPhrase(text){
 const s=String(text||'').replace(/\s+/g,' ').trim();if(!s)return '';
 const escaped=medicationNames.map(escapeRegExp).join('|'), hit=s.match(new RegExp(`\\b(?:${escaped})\\b`,'i'));if(!hit)return '';
 const idx=hit.index||0;let frag=s.slice(idx,Math.min(s.length,idx+145));
 const stop=frag.search(/\b(?:en\s+la\s+evoluci[oó]n|evoluci[oó]n\s+de\s+la\s+semana|a\s+la\s+exploraci[oó]n|exploraci[oó]n\s+psicopatol[oó]gica|juicio\s+cl[ií]nico|diagn[oó]stico\s+no\s+cambia|plan\s+de\s+tratamiento)\b/i);if(stop>8)frag=frag.slice(0,stop);
 const dose=frag.match(new RegExp(`^(?:${escaped})[^.;]{0,85}?(?:\\d+(?:[.,]\\d+)?\\s*(?:mg|miligramos?))[^.;]{0,38}`,'i'));if(dose)frag=dose[0];
 return frag.replace(/\b(\d+(?:[.,]\d+)?)\s+miligramos?\b/gi,'$1 mg').replace(/\s+/g,' ').trim().replace(/[,:;]+$/,'');
}
function isNoChangeDiagnosis(text){return /\b(?:diagn[oó]stico|juicio(?:\s+cl[ií]nico)?)\s+(?:no\s+cambia|sin\s+cambios|se\s+mantiene)|\bjuicio\s+cl[ií]nico\s+no\s+cambia/i.test(String(text||''))}
function hasTreatmentChange(text){return /\b(?:inici|retir|suspend|aument|redu|baj|sub|cambi|sustitu|ajust|modific)(?:amos|ar|a|o|e|ir)?\b/i.test(String(text||''))}
function currentPersistentFields(text,rep={}){
 const c=getContext()||{}, diagCandidates=['Diagnóstico al alta','Juicio clínico','Juicio clínico / diagnóstico'], treatCandidates=['Tratamiento actual','Tratamiento al alta','Medicación y alergias'];
 let diagnosis='';for(const k of diagCandidates){const v=String(rep[k]||'').trim();if(v&&!/sin cambios|no cambia|se mantiene/i.test(v)){diagnosis=extractDiagnosisPhrase(v)||v;break}}
 diagnosis=diagnosis||extractDiagnosisPhrase(text)||c.diagnosis||'';
 let treatment='';for(const k of treatCandidates){const v=String(rep[k]||'').trim();if(v){treatment=v;break}}
 treatment=extractMedicationPhrase(treatment)||extractMedicationPhrase(text)||(hasTreatmentChange(text)?'':c.treatment||'');
 return {diagnosis,treatment};
}
function contextSummary(c){return c?.summary||''}
function extractExplicitDiagnosis(text){
 const src=String(text||'').replace(/\s+/g,' ').trim();if(!src)return '';
 if(isNoChangeDiagnosis(src))return '';
 const m=src.match(/\b(?:juicio cl[ií]nico|diagn[oó]stico)\s*(?:es|:|compatible con)?\s*([^.;]{4,120}?)(?=\b(?:plan de tratamiento|seguimiento|cita|exploraci[oó]n|$))/i);
 if(m)return cleanClinicalText(m[1]).replace(/[.]$/,'');
 return extractDiagnosisPhrase(src);
}
function inferSummaryFromText(text,type){
 const segs=smartSegments(text);const picked=[];
 for(const s of segs){const n=norm(s);if(/exploracion psicopatologica|juicio clinico|plan de tratamiento/.test(n))break;if(/paciente con|en seguimiento|ingresad|tratamiento|diagnost|lleva .*semana|lleva .*mes/.test(n))picked.push(s);if(picked.join(' ').split(/\s+/).length>55)break}
 return picked.join(' ').trim();
}
function inferVisitTypeFromText(text,selected){
 const n=norm(text);
 if(/plan de tratamiento individualizado|\bpti\b/.test(n))return 'pti';
 if(/nota de evolucion|consulta de seguimiento|evolucion clinica|evolucion de la semana|desde la ultima revision/.test(n)){
  if(/unidad de rehabilitacion|unidad rehabilitacion|\bur\b|ingresad.*rehabilitacion/.test(n))return 'urFollow';
  if(selected==='first')return 'follow';
 }
 if(/informe de alta|alta de la unidad/.test(n))return 'discharge';
 if(/urgencias|atendido en urgencias/.test(n))return 'emergency';
 if(/consulta medica general|exploracion fisica|auscultacion|infeccion respiratoria|lesion cutanea|dermatitis|faringitis|bronquitis/.test(n)&&selected==='first')return 'medicalGeneral';
 return selected;
}
function findBlockMarkers(text){
 const defs=[
  ['evolution',/\b(?:en\s+la\s+)?evoluci[oó]n(?:\s+(?:cl[ií]nica|de\s+la\s+semana|desde\s+la\s+[uú]ltima\s+revisi[oó]n))?\b/ig],
  ['mse',/\b(?:a\s+la|en\s+la|a\s+nivel\s+de\s+la)?\s*exploraci[oó]n(?:\s+psicopatol[oó]gica)?\b/ig],
  ['judgment',/\b(?:juicio\s+cl[ií]nico|el\s+diagn[oó]stico\s+no\s+cambia|diagn[oó]stico\s+no\s+cambia|diagn[oó]stico\s+sin\s+cambios)\b/ig],
  ['plan',/\b(?:en\s+cuanto\s+al\s+)?(?:plan\s+de\s+tratamiento|plan\s+terap[eé]utico|plan\s+de\s+intervenci[oó]n)\b/ig]
 ];
 const hits=[];for(const [kind,re] of defs){let m;while((m=re.exec(text)))hits.push({kind,start:m.index,end:re.lastIndex,label:m[0]})}return hits.sort((a,b)=>a.start-b.start);
}
function splitFollowBlocks(text){
 const src=String(text||'').replace(/\s+/g,' ').trim(), hits=findBlockMarkers(src), out={summary:'',evolution:'',mse:'',judgment:'',plan:''};
 if(!hits.length){out.evolution=src;return out}
 const first=hits[0];out.summary=src.slice(0,first.start).trim();
 for(let i=0;i<hits.length;i++){const h=hits[i],next=hits[i+1];let body=src.slice(h.end,next?next.start:src.length).trim();if(!body)continue;out[h.kind]=[out[h.kind],body].filter(Boolean).join(' ').trim()}
 return out;
}
function sentenceList(items){return items.filter(Boolean).map(cleanClinicalText).join(' ')}
function extractEvolutionFacts(text){const s=String(text||''),n=norm(s),facts=[];
 if(/adaptad[oa].{0,30}actividades|acudido.{0,30}actividades|asistencia.{0,20}(?:buena|regular)/i.test(s))facts.push('Presenta adecuada adaptación y participación en las actividades de la Unidad.');
 if(/inter[eé]s.{0,45}ajedrez/i.test(s)){let f='Muestra especial interés por la actividad de ajedrez';if(/hijo/i.test(s))f+=', que relaciona con la posibilidad de reforzar el vínculo con su hijo';facts.push(f+'.')}
 if(/adherencia.{0,25}(?:buena|adecuada)|adherencia al tratamiento ha sido buena/i.test(s))facts.push('Mantiene buena adherencia al tratamiento.');
 if(/ideas?\s+(?:bizarras?|delirantes?)|productividad delirante|delirante.{0,20}bizar/i.test(s)){let f=/ocasional|alguna ocasi[oó]n|en algunos momentos/i.test(s)?'Persiste ocasionalmente productividad delirante de contenido bizarro.':'Persiste productividad delirante de contenido bizarro.';facts.push(f)}
 if(/duerme bien|sue[nñ]o.{0,20}(?:conservado|bueno)/i.test(s))facts.push('Sueño conservado.');
 if(/come bien|apetito.{0,15}(?:conservado|bueno)/i.test(s))facts.push('Apetito conservado.');
 if(!facts.length)return cleanClinicalText(s);
 return facts.join(' ');
}
function extractMSEFacts(text){const s=String(text||''),facts=[];
 if(/consciente.{0,12}orientad|orientad.{0,12}consciente/i.test(s))facts.push('Paciente consciente y orientado.');
 else if(/consciente/i.test(s))facts.push('Paciente consciente.');
 if(/discurso.{0,30}(?:formalmente|globalmente)?\s*(?:correcto|adecuado)/i.test(s))facts.push('Discurso globalmente adecuado.');
 if(/descarril/i.test(s))facts.push('Presenta ocasionalmente descarrilamientos del curso del pensamiento.');
 if(/neolog|logicismo/i.test(s))facts.push('Se objetivan alteraciones formales del pensamiento descritas en el dictado.');
 if(/ideas? delirantes?|contenido delirante|productividad delirante/i.test(s)){let f='Persisten ideas delirantes';if(/bizar/i.test(s))f+=' de contenido bizarro';facts.push(f+'.')}
 if(/sin desconex|no (?:parece que )?hay desconex/i.test(s))facts.push('Sin desconexión del medio.');
 if(/no (?:hay|parece que haya) alteraciones?.{0,30}(?:polaridad|afectiv)|sin alteraciones?.{0,30}(?:polaridad|afectiv)/i.test(s))facts.push('Sin alteraciones relevantes de la polaridad afectiva.');
 if(/no (?:hay|presenta|tiene).{0,25}(?:ideaci[oó]n )?autol[ií]tica|sin ideaci[oó]n autol[ií]tica/i.test(s))facts.push('Sin ideación autolítica referida.');
 if(/duerme bien|duerme\s+(?:y\s+)?come\s+bien|sue[nñ]o.{0,15}(?:conservado|bueno)/i.test(s))facts.push('Sueño conservado.');
 if(/come bien|apetito.{0,15}(?:conservado|bueno)/i.test(s))facts.push('Apetito conservado.');
 return facts.length?dedupe(facts).join(' '):cleanClinicalText(s);
}
function buildDescriptionFromContext(summaryBlock,text){const c=getContext()||{}, fields=currentPersistentFields(text,{}), persistentTreatment=fields.treatment||c.treatment||extractMedicationPhrase(summaryBlock)||'', parts=[];
 if(fields.diagnosis)parts.push(`Paciente con ${fields.diagnosis}`);else if(c.summary)parts.push(c.summary.replace(/^[A-ZÁÉÍÓÚÑ ]+:\s*/,'').slice(0,420));else if(summaryBlock)parts.push(cleanClinicalText(summaryBlock).replace(/\.$/,''));
 const n=norm(summaryBlock);if(/unidad (?:de )?rehabilitacion/.test(n)&&!/unidad de rehabilitacion/i.test(parts.join(' ')))parts[0]=(parts[0]||'Paciente')+' en seguimiento en Unidad de Rehabilitación';
 const dur=summaryBlock.match(/\b(?:ingresad[oa].{0,18})?(?:desde hace|hace|lleva ingresad[oa](?: durante)?)\s+([^,.;]{1,28}(?:semana|semanas|mes|meses|d[ií]as?))/i);if(dur&&!parts.join(' ').toLowerCase().includes(dur[1].toLowerCase()))parts.push(`en seguimiento/ingreso desde ${dur[1].trim()}`);
 let desc=parts.join(', ').replace(/, en seguimiento\/ingreso/,'; en seguimiento/ingreso');if(desc&&!/[.!?]$/.test(desc))desc+='.';
 if(persistentTreatment){desc+=' En tratamiento con '+persistentTreatment.replace(/^(?:con\s+)?/i,'').replace(/[.!?]+$/,'')+'.'}
 return desc.trim();
}
function buildPlanText(text,summaryBlock){const c=getContext()||{},fields=currentPersistentFields(text,{}),inheritedTreatment=c.treatment||extractMedicationPhrase(summaryBlock)||fields.treatment||'',facts=[];
 if(/mant(?:enemos|ener|iene).{0,25}tratamiento farmacol[oó]gico|tratamiento farmacol[oó]gico.{0,20}(?:se mantiene|sin cambios)/i.test(text)){facts.push(inheritedTreatment?`Se mantiene tratamiento farmacológico sin modificaciones: ${inheritedTreatment.replace(/[.!?]+$/,'')}.`:'Se mantiene tratamiento farmacológico previo sin modificaciones.')}
 if(/cognitivo.{0,15}conductual.{0,25}psicos|conductual.{0,25}psicos|cbtp/i.test(text)){let f='Se realiza intervención cognitivo-conductual para psicosis';if(/situaciones? problemas?.{0,35}(?:semana|concret)/i.test(text))f+=' aplicada a situaciones problema concretas de la última semana';facts.push(f+'.')}
 if(/hip[oó]tesis alternativa|b[uú]squeda de realidad|pruebas? de realidad|b[uú]squeda de evidencias/i.test(text))facts.push('Se trabaja generación de hipótesis alternativas y contraste/búsqueda de evidencias.');
 const ses=text.match(/\b(?:haremos|programamos|realizaremos)\s+(\w+|\d+)\s+sesiones?\s+individuales?/i);if(ses)facts.push(`Se planifican ${ses[1]} sesiones individuales.`);
 const cite=text.match(/\b(?:citarlo|citarla|citamos|revisi[oó]n|cita)\b([^.;]{0,75})/i);if(cite)facts.push(cleanClinicalText(`Próxima revisión ${cite[1].trim()}`));
 if(!facts.length)return cleanClinicalText(text);return dedupe(facts).join(' ');
}
function buildJudgmentText(text,summaryBlock,fullText=''){const c=getContext()||{},diag=c.diagnosis||extractDiagnosisPhrase(summaryBlock)||extractDiagnosisPhrase(fullText)||extractDiagnosisPhrase(lastInput);if(isNoChangeDiagnosis(`${text} ${fullText} ${lastInput}`))return diag?diag:'Se mantiene el juicio clínico previo.';const d=extractDiagnosisPhrase(text);return d||cleanClinicalText(text)}
function directFollowFallback(text){
 const src=String(text||'').replace(/\s+/g,' ').trim();
 const marks=findBlockMarkers(src),out={summary:'',evolution:'',mse:'',judgment:'',plan:''};
 if(!marks.length){out.evolution=src;return out}
 out.summary=src.slice(0,marks[0].start).trim();
 for(let i=0;i<marks.length;i++){const h=marks[i],next=marks[i+1],body=src.slice(h.end,next?next.start:src.length).trim();if(body)out[h.kind]=[out[h.kind],body].filter(Boolean).join(' ')}
 return out;
}
function ensureFollowBlocks(blocks,text){
 let b={...blocks};
 if(!b.mse&&/exploraci[oó]n|consciente|orientad|descarril|ideas? delirantes?|alucin|afectiv|autolit|apetito|duerme/i.test(text)){const d=directFollowFallback(text);if(d.mse)b=d}
 if(!b.plan&&/plan de tratamiento|mantenemos? el tratamiento|intervenci[oó]n cognitivo|cita|revisi[oó]n/i.test(text)){const d=directFollowFallback(text);if(d.plan)b=d}
 return b;
}
function buildFollow(text,type){
 const blocks=ensureFollowBlocks(splitFollowBlocks(text),text);sourceTrace={
  'Descripción del caso':blocks.summary,'Evolución':blocks.evolution,'Exploración psicopatológica':blocks.mse,'Juicio clínico':blocks.judgment,'Plan y seguimiento':blocks.plan
 };
 const desc=buildDescriptionFromContext(blocks.summary,text),evo=extractEvolutionFacts(blocks.evolution||(!blocks.mse?text:'')),mse=extractMSEFacts(blocks.mse),judg=buildJudgmentText(blocks.judgment,blocks.summary,text),plan=buildPlanText(blocks.plan,blocks.summary);
 if(type==='follow')return {'Resumen clínico':desc,'Evolución desde la última revisión':evo,'Exploración psicopatológica comparativa':mse,'Juicio clínico':judg,'Plan de tratamiento':plan,'Próxima cita':''};
 return {'Resumen clínico y funcional':desc,'Evolución clínica':evo,'Evolución funcional / rehabilitadora':'','Exploración psicopatológica comparativa':mse,'Juicio clínico':judg,'Plan de intervención':plan,'Próxima revisión':''};
}
function buildPTI(text){const c=contextSummary(getContext()), n=norm(`${c} ${text}`), goals=[];
 if(/depres|hipotim|anhed|apat|abul/.test(n))goals.push('Mejorar la sintomatología afectiva y recuperar actividad gratificante.');
 if(/autocuidado|higiene|avd/.test(n))goals.push('Mejorar autonomía y regularidad en autocuidado y actividades de la vida diaria.');
 if(/aisla|social|cuadrilla|interaccion/.test(n))goals.push('Incrementar participación social y reducir aislamiento.');
 if(/ocupacional|trabaj|empleo|actividad/.test(n))goals.push('Recuperar estructura ocupacional y avanzar hacia objetivos laborales realistas.');
 if(/psicos|delir|alucin/.test(n))goals.push('Mejorar afrontamiento, flexibilidad cognitiva y funcionamiento asociado a la clínica psicótica.');
 if(/consumo|cannabis|alcohol|cocaina/.test(n))goals.push('Reforzar motivación, reducción de riesgos y prevención de recaídas.');
 if(/autolit|suicid|autoagres/.test(n))goals.push('Monitorizar riesgo y consolidar estrategias de seguridad y afrontamiento.');
 if(!goals.length)goals.push('Mejorar funcionamiento global y avanzar en objetivos rehabilitadores individualizados.');
 return {
  'Resumen clínico y funcional':c||text,
  'Necesidades / problemas activos':splitSentences(text).filter(x=>/problema|dificult|deterior|aisla|autocuidado|sintom|riesgo|consumo|ocupacional|social/i.test(x)).join(' ')||'A concretar con el equipo a partir de la valoración funcional.',
  'Objetivos del ingreso':goals.map(x=>'• '+x).join('\n'),
  'Intervención de Psiquiatría':'Revisión de evolución clínica, tolerancia y respuesta al tratamiento; optimización farmacológica si procede y monitorización de riesgos.',
  'Intervención de Psicología':'Intervención individual/grupal orientada a formulación, psicoeducación, estrategias cognitivo-conductuales y objetivos funcionales según necesidades.',
  'Intervención de Enfermería':'Seguimiento clínico, adherencia, autocuidados, hábitos, educación sanitaria y entrenamiento de habilidades aplicables a la vida diaria.',
  'Intervención de Terapia Ocupacional':'Activación, estructuración de rutinas, actividades significativas, autonomía y objetivos ocupacionales.',
  'Intervención de Trabajo Social':'Valoración de red de apoyo, situación social/laboral y recursos comunitarios pertinentes.',
  'Otras intervenciones / coordinación':'Coordinación con dispositivos y recursos externos cuando resulte indicado.',
  'Indicadores de seguimiento':'Revisar evolución sintomática, funcionamiento, participación, adherencia y grado de consecución de los objetivos acordados.'
 };
}
function buildDischarge(text){const out=classify(text,sections.discharge);const c=contextSummary(getContext());if(!out['Antecedentes relevantes'])out['Antecedentes relevantes']=c;if(!out['Motivo y contexto del ingreso'])out['Motivo y contexto del ingreso']=c;return out}
function buildReport(text,type){if(['follow','urFollow'].includes(type))return buildFollow(text,type);if(type==='pti')return buildPTI(text);if(type==='discharge')return buildDischarge(text);return classify(text,sections[type]||sections.first)}
function wordCount(text){return String(text||'').trim().split(/\s+/).filter(Boolean).length}
function firstValue(rep,keys){for(const k of keys){if(String(rep[k]||'').trim())return rep[k]}return ''}
function joinValues(rep,keys){return keys.map(k=>String(rep[k]||'').trim()).filter(Boolean).join(' ')}
function shouldCompact(text,type){if(['follow','urFollow'].includes(type))return true;if(type==='medicalGeneral')return wordCount(text)<=180;if(['pti','discharge','emergency','urInitial'].includes(type))return false;return wordCount(text)<=145}
function compactReport(rep,type){
 if(type==='follow')return {
  'Descripción del caso':rep['Resumen clínico']||'',
  'Evolución':rep['Evolución desde la última revisión']||'',
  'Exploración psicopatológica':rep['Exploración psicopatológica comparativa']||'',
  'Juicio clínico':rep['Juicio clínico']||'',
  'Plan y seguimiento':joinValues(rep,['Plan de tratamiento','Próxima cita'])
 };
 if(type==='urFollow')return {
  'Descripción del caso':rep['Resumen clínico y funcional']||'',
  'Evolución clínica y funcional':joinValues(rep,['Evolución clínica','Evolución funcional / rehabilitadora']),
  'Exploración psicopatológica':rep['Exploración psicopatológica comparativa']||'',
  'Juicio clínico':rep['Juicio clínico']||'',
  'Plan y seguimiento':joinValues(rep,['Plan de intervención','Próxima revisión'])
 };
 if(type==='first')return {
  'Motivo de consulta / derivación':rep['Motivo de consulta / derivación']||'',
  'Descripción del caso':joinValues(rep,['Antecedentes médicos no psiquiátricos','Antecedentes psiquiátricos personales','Antecedentes familiares psiquiátricos','Consumo de sustancias','Situación sociolaboral y funcional','Tratamiento actual']),
  'Enfermedad actual / evolución':rep['Enfermedad actual / evolución longitudinal']||'',
  'Exploración psicopatológica':rep['Exploración psicopatológica']||'',
  'Juicio clínico':rep['Juicio clínico']||'',
  'Plan y seguimiento':joinValues(rep,['Plan de tratamiento','Seguimiento'])
 };
 if(type==='acute')return {
  'Motivo de consulta':rep['Motivo de consulta']||'',
  'Descripción del caso':rep['Resumen de antecedentes relevantes']||'',
  'Evolución / situación actual':rep['Enfermedad actual / situación precipitante']||'',
  'Exploración psicopatológica':rep['Exploración psicopatológica']||'',
  'Juicio clínico':rep['Juicio clínico']||'',
  'Intervención y seguimiento':joinValues(rep,['Intervención realizada','Plan / seguimiento'])
 };
 if(type==='medicalGeneral')return {
  'Motivo e historia actual':joinValues(rep,['Motivo / problema actual','Historia del problema actual']),
  'Antecedentes, medicación y alergias':joinValues(rep,['Antecedentes médicos relevantes','Medicación y alergias']),
  'Exploración médica':joinValues(rep,['Constantes','Exploración física']),
  'Pruebas / resultados':rep['Pruebas / resultados']||'',
  'Valoración clínica':rep['Valoración clínica / diagnóstico diferencial']||'',
  'Plan y seguimiento':joinValues(rep,['Plan de tratamiento','Consejos de seguridad y seguimiento'])
 };
 return {...rep};
}
function reportSectionHtml(sec,val){return `<div class="reportSection"><div class="reportTitle">${esc(sec)}</div><div class="reportText ${val?'':'empty'}" contenteditable="true" data-sec="${esc(sec)}">${esc(val||'')}</div></div>`}
function renderReport(){
 const list=Object.keys(currentReport), filled=list.filter(sec=>String(currentReport[sec]||'').trim());
 $('#reportHeading').textContent=labels[currentType]||'Nota clínica';
 $('#formatBadge').textContent=compactMode?'Formato breve automático':'Formato completo automático';
 $('#diagnosticDetails').hidden=currentType==='medicalGeneral';
 $('#therapyDetails').hidden=currentType==='medicalGeneral';
 $('#report').innerHTML=filled.length?filled.map(sec=>reportSectionHtml(sec,currentReport[sec])).join(''):'<div class="small">No se ha podido asignar contenido todavía. Puedes editar el dictado y volver a generar.</div>';
 $$('.reportText').forEach(el=>el.addEventListener('input',()=>{currentReport[el.dataset.sec]=el.textContent.trim();if(Object.prototype.hasOwnProperty.call(fullReport,el.dataset.sec))fullReport[el.dataset.sec]=currentReport[el.dataset.sec];el.classList.toggle('empty',!currentReport[el.dataset.sec])}));
 $('#diagnosticSuggestion').innerHTML=diagnosticHtml(lastInput,currentReport);$('#therapySuggestion').innerHTML=therapyHtml(`${lastInput} ${reportText()}`);if($('#traceText'))$('#traceText').textContent=lastInput;$('#resultCard').hidden=false;$('#resultCard').scrollIntoView({behavior:'smooth',block:'start'});
}
function reportText(){return Object.entries(currentReport).filter(([,v])=>String(v||'').trim()).map(([k,v])=>`${k.toUpperCase()}\n${String(v).trim()}`).join('\n\n')}
function suggestionText(id){return [...document.querySelectorAll(`#${id} .suggestionBox`)].map(x=>x.innerText.trim()).filter(Boolean).join('\n')}
function appendText(obj,key,prefix,text){if(!text)return false;const clean=String(text).replace(/\n+/g,' ').trim(), existing=String(obj[key]||'').trim();if(existing.includes(clean))return false;obj[key]=[existing,`${prefix}${clean}`].filter(Boolean).join(' ');return true}
function diagnosticTarget(rep){return Object.keys(rep).find(k=>/Diagnóstico al alta|Juicio clínico|Diagnóstico/i.test(k))||'Juicio clínico'}
function therapyTarget(rep){return Object.keys(rep).find(k=>/Intervención de Psicología|Plan de tratamiento e intervención|Plan de tratamiento|Plan de intervención|Tratamiento \/ intervención|Intervención realizada|Intervención y seguimiento|Plan y seguimiento/i.test(k))||'Plan de tratamiento'}
function addDiagnosticToDocument(){const t=suggestionText('diagnosticSuggestion');if(!t)return alert('No hay orientación diagnóstica concreta para añadir.');const key=diagnosticTarget(fullReport);appendText(fullReport,key,'Orientación diagnóstica: ',t);currentReport=compactMode?compactReport(fullReport,currentType):{...fullReport};renderReport();$('#diagnosticDetails').open=true;$('#saveHint').textContent='Orientación diagnóstica añadida al borrador. Revísala antes de enviar.'}
function addTherapyToDocument(){const t=suggestionText('therapySuggestion');if(!t)return alert('No hay intervención concreta para añadir.');const key=therapyTarget(fullReport);appendText(fullReport,key,'Intervención psicoterapéutica: ',t);currentReport=compactMode?compactReport(fullReport,currentType):{...fullReport};renderReport();$('#therapyDetails').open=true;$('#saveHint').textContent='Intervención psicoterapéutica añadida al borrador. Revísala antes de enviar.'}
function makeSummary(){const source=Object.keys(fullReport).length?fullReport:currentReport;const preferred=['Juicio clínico','Juicio clínico / diagnóstico','Diagnóstico al alta','Tratamiento actual','Tratamiento al alta','Plan de tratamiento','Plan de intervención','Evolución clínica','Evolución desde la última revisión','Situación sociolaboral y funcional'];const parts=[];preferred.forEach(k=>{if(source[k])parts.push(`${k}: ${source[k]}`)});if(!parts.length)parts.push(reportText().slice(0,1600));return parts.join(' ')}
function saveCurrentContext(){const code=getCode();if(!code)return $('#saveHint').textContent='Añade un código A/AB para guardar continuidad local.';const store=patientStore(),prev=store[code]||{},fields=currentPersistentFields(lastInput,fullReport);store[code]={...prev,summary:makeSummary().slice(0,2600),diagnosis:fields.diagnosis||prev.diagnosis||'',treatment:fields.treatment||prev.treatment||'',updated:new Date().toISOString(),type:currentType};savePatientStore(store);updateContextHint();$('#saveHint').textContent=`Contexto longitudinal de ${code} actualizado.`}

function diagnosticHtml(text,rep){const explicit=extractExplicitDiagnosis(text);const n=norm(`${text} ${reportText()}`);let lines=[];const prev=getContext()||{},currentDiag=extractDiagnosisPhrase(text)||prev.diagnosis||'';
 if(isNoChangeDiagnosis(text)&&currentDiag)lines.push(`<div class="suggestionBox"><strong>Juicio clínico mantenido</strong><br>${esc(currentDiag)}</div>`);
 else if(explicit)lines.push(`<div class="suggestionBox"><strong>Diagnóstico consignado en el dictado</strong><br>${esc(explicit)}</div>`);
 if(/agoraf|panico|crisis de angustia/.test(n))lines.push(`<div class="suggestionBox"><strong>Comprobar</strong><br>Valorar trastorno de pánico y/o agorafobia. Revisar si existen crisis inesperadas, cambio conductual persistente y duración de la evitación antes de fijar el código.</div>`);
 if(/depres|hipotim|anhed|abul|apatia/.test(n))lines.push(`<div class="suggestionBox"><strong>Comprobar</strong><br>Precisar duración del síndrome depresivo, número de síntomas, repercusión funcional, episodios previos y presencia/ausencia de síntomas psicóticos o maniformes antes de codificar.</div>`);
 if(/psicos|esquizof|delir|alucin/.test(n))lines.push(`<div class="suggestionBox"><strong>Comprobar</strong><br>Revisar temporalidad, síntomas positivos/negativos, afectivos, consumo de sustancias, funcionamiento y diagnósticos diferenciales antes de modificar el juicio clínico previo.</div>`);
 if(/bipolar|mania|maniaco|hipoman/.test(n))lines.push(`<div class="suggestionBox"><strong>Comprobar</strong><br>Precisar episodios maniformes/hipomaniformes, duración, repercusión y relación temporal con antidepresivos o sustancias.</div>`);
 if(!lines.length)lines.push(`<div class="small">No hay una diana diagnóstica clara extraíble del dictado. Si has consignado el juicio clínico, se mantiene como referencia para tu revisión.</div>`);
 return lines.join('');
}
function therapyHtml(text){const n=norm(text), ideas=[];
 if(/depres|anhed|apat|abul|aisla/.test(n))ideas.push(['Activación conductual','Definir una actividad pequeña, concreta y programable; anticipar barreras; registrar efecto sobre dominio/placer y revisar en la siguiente sesión.']);
 if(/panico|agoraf|crisis de angustia|evitacion/.test(n))ideas.push(['Pánico/agorafobia','Psicoeducar sobre el ciclo alarma–interpretación–evitación; construir una jerarquía de exposición gradual y acordar un primer paso manejable. La relajación puede usarse como habilidad complementaria, evitando convertirla en conducta de seguridad.']);
 if(/tension|relajacion|ansiedad flotante|nervios/.test(n))ideas.push(['Relajación muscular progresiva','Tensar de forma suave 5–7 segundos y soltar 15–20 segundos distintos grupos musculares, observando contraste tensión–distensión y evitando zonas dolorosas. Practicar inicialmente 10–15 minutos en contexto tranquilo.']);
 if(/psicos|esquizof|delir|parano|alucin/.test(n))ideas.push(['Metacognición / CBTp','Trabajar una situación concreta sin confrontar la creencia: separar hechos de interpretaciones, generar 2–3 explicaciones alternativas y estimar grado de certeza antes/después.']);
 if(/consumo|cannabis|alcohol|cocaina|craving/.test(n))ideas.push(['Entrevista motivacional / Matrix','Explorar ambivalencia, razones propias para el cambio, disparadores y una respuesta concreta ante una situación de alto riesgo.']);
 if(/limite|asert|dependen|sumis|conflicto interpersonal/.test(n))ideas.push(['Asertividad y límites','Ensayar una petición o negativa con estructura breve: describir situación, expresar necesidad, formular petición/límite y mantener el mensaje sin justificar en exceso.']);
 if(/tlp|borderline|desregul|impulsiv/.test(n))ideas.push(['Regulación emocional','Identificar emoción, intensidad, impulso y conducta; introducir una pausa y elegir una respuesta compatible con objetivos antes de actuar.']);
 if(/insom|sueño|despertar precoz/.test(n))ideas.push(['Sueño','Revisar regularidad horaria, tiempo en cama, siestas, activación nocturna y rutina de desaceleración; seleccionar uno o dos cambios observables.']);
 if(!ideas.length)ideas.push(['Intervención breve','Elegir un objetivo funcional concreto, formular qué mantiene la dificultad y ensayar una conducta alternativa verificable antes de la siguiente revisión.']);
 return ideas.slice(0,4).map(([t,d])=>`<div class="suggestionBox"><strong>${esc(t)}</strong><br>${esc(d)}</div>`).join('');
}


// ---- IMAGEN / CÁMARA PARA TAREAS EN PAPEL ----
function clearScalePhoto(){scalePhotoData='';const img=$('#scalePhotoPreview');if(img){img.src='';img.classList.remove('show')}}
function bindScaleImageInput(inputId,previewId='scalePhotoPreview'){
 const input=$('#'+inputId),img=$('#'+previewId);if(!input||!img)return;
 input.addEventListener('change',()=>{const file=input.files&&input.files[0];if(!file)return;if(!file.type.startsWith('image/'))return alert('Selecciona una imagen.');const reader=new FileReader();reader.onload=()=>{scalePhotoData=String(reader.result||'');img.src=scalePhotoData;img.classList.add('show');const open=$('#openScaleImage');if(open)open.disabled=false};reader.readAsDataURL(file)});
}
function openImageOverlay(src=scalePhotoData){if(!src)return alert('Primero fotografía o selecciona una imagen.');$('#imageOverlayImg').src=src;$('#imageOverlay').classList.add('active');$('#imageOverlay').setAttribute('aria-hidden','false')}
function closeImageOverlay(){const box=$('#imageOverlay');box.classList.remove('active');box.setAttribute('aria-hidden','true');$('#imageOverlayImg').src=''}
function photoCaptureHtml(label='Fotografiar hoja',allowFile=false){
 const capture=allowFile?'':' capture="environment"';
 return `<div class="photoBox"><div class="small">La imagen se usa solo en esta pantalla para ayudarte a valorar la tarea. <b>No se guarda en el histórico ni se adjunta al correo.</b></div><div class="photoActions"><label class="cameraLabel">📷 ${esc(label)}<input id="scalePhotoInput" type="file" accept="image/*"${capture}></label><button id="openScaleImage" type="button" class="secondary" disabled>🔎 Ver grande</button></div><img id="scalePhotoPreview" class="photoPreview" alt="Vista previa de la tarea en papel"></div>`;
}
function bindPhotoControls(){bindScaleImageInput('scalePhotoInput');const b=$('#openScaleImage');if(b)b.addEventListener('click',()=>openImageOverlay())}

// ---- ESCALAS / EXPLORACIONES OPCIONALES ----
function scaleSectionTarget(){
 if(currentType==='medicalGeneral')return 'Pruebas / resultados';
 if(currentType==='emergency')return 'Pruebas / actuaciones realizadas';
 return 'Escalas / exploraciones';
}
function scaleSelectHtml(id,label,max,value=''){return `<div><label for="${id}">${esc(label)}</label><input id="${id}" type="number" min="0" max="${max}" inputmode="numeric" value="${esc(value)}" placeholder="0–${max}"></div>`}
function renderScaleWorkspace(){
 clearScalePhoto();
 const type=$('#scaleType')?.value||'', box=$('#scaleWorkspace');if(!box)return;
 if(!type){box.innerHTML='';return}
 if(type==='motor'){
  const items=[['motor_tremor','Temblor'],['motor_rigidez','Rigidez'],['motor_bradi','Bradicinesia'],['motor_aca','Acatisia'],['motor_disc','Discinesias'],['motor_marcha','Marcha / equilibrio'],['motor_dist','Distonía u otros movimientos']];
  box.innerHTML=`<div class="scalePanel"><h3>Exploración motora breve</h3><div class="small">Registro clínico propio. Puntúa cada dominio: 0 ausente · 1 leve · 2 moderado · 3 marcado.</div><div class="scaleItems">${items.map(([id,l])=>`<div class="scaleItem"><label for="${id}">${esc(l)}</label><select id="${id}" class="motorScore"><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></div>`).join('')}</div><label for="motor_notes">Observaciones</label><textarea id="motor_notes" class="short" placeholder="Ej.: temblor fino distal; sin rigidez; marcha estable…"></textarea><div id="motor_result" class="scaleResult">Puntuación global orientativa: <span class="scaleScore">0/21</span></div><button id="addScaleResult" class="addSuggestion">＋ Añadir al informe</button></div>`;
  const update=()=>{const vals=[...document.querySelectorAll('.motorScore')].map(x=>Number(x.value)||0),sum=vals.reduce((a,b)=>a+b,0);$('#motor_result').innerHTML=`Puntuación global orientativa: <span class="scaleScore">${sum}/21</span>`};$$('.motorScore').forEach(x=>x.addEventListener('change',update));$('#addScaleResult').addEventListener('click',addScaleResult);return;
 }
 if(type==='clock'){
  const items=[['clock_circle','Contorno reconocible'],['clock_numbers','Números esperados presentes'],['clock_sequence','Secuencia numérica adecuada'],['clock_space','Distribución espacial global adecuada'],['clock_hands','Agujas representadas'],['clock_time','Hora solicitada representada']];
  box.innerHTML=`<div class="scalePanel"><h3>Test del reloj · tarea en papel</h3><div class="small">Utiliza la consigna y el sistema de puntuación que corresponda a tu protocolo. Esta pantalla añade una <b>checklist estructural propia</b> para registrar hallazgos; no sustituye una escala validada concreta.</div><label for="clock_instruction">Consigna / hora solicitada</label><input id="clock_instruction" placeholder="Ej.: dibujar un reloj y marcar la hora indicada"><div class="stimulusCard"><b>Paciente: papel y bolígrafo</b><div class="small" style="margin-top:6px">Administra la consigna de tu protocolo sin mostrar un reloj modelo en pantalla. Fotografía el resultado cuando termine.</div></div>${photoCaptureHtml('Fotografiar reloj')}<div class="scaleItems">${items.map(([id,l])=>`<div class="scaleItem"><label for="${id}">${esc(l)}</label><select id="${id}" class="clockScore"><option value="">—</option><option value="1">Sí</option><option value="0">No</option></select></div>`).join('')}</div><label for="clock_impression">Impresión clínica</label><select id="clock_impression"><option value="">Seleccionar…</option><option value="Adecuado">Adecuado</option><option value="Dudoso / límite">Dudoso / límite</option><option value="Alterado">Alterado</option></select><label for="clock_notes">Errores / observaciones</label><textarea id="clock_notes" class="short" placeholder="Ej.: números agrupados en hemicampo derecho; agujas incorrectas…"></textarea><div id="clock_result" class="scaleResult">Checklist estructural: <span class="scaleScore">6/6</span></div><div class="scaleNote">La foto permanece solo en memoria durante esta valoración. La puntuación automática por visión artificial no se usa en esta versión: los métodos de reloj no son equivalentes y la valoración humana sigue siendo necesaria.</div><button id="addScaleResult" class="addSuggestion">＋ Añadir al informe</button></div>`;
  const update=()=>{const xs=[...document.querySelectorAll('.clockScore')],done=xs.filter(x=>x.value!=='').length,sum=xs.reduce((a,x)=>a+(x.value===''?0:Number(x.value)||0),0);$('#clock_result').innerHTML=done===6?`Checklist estructural: <span class="scaleScore">${sum}/6</span>`:`Checklist estructural: <span class="scaleScore">${done}/6 ítems valorados</span>`};$$('.clockScore').forEach(x=>x.addEventListener('change',update));bindPhotoControls();$('#addScaleResult').addEventListener('click',addScaleResult);return;
 }
 if(type==='spiral'){
  box.innerHTML=`<div class="scalePanel"><h3>Espiral de Arquímedes / escritura</h3><div class="small">Útil como apoyo en la exploración de temblor y para seguimiento longitudinal. Pide la tarea en papel y fotografía el resultado. La app registra hallazgos clínicos, no aplica un algoritmo diagnóstico.</div>${photoCaptureHtml('Fotografiar espiral / escritura')}<label for="spiral_hand">Mano / muestra</label><select id="spiral_hand"><option value="">No especificada</option><option>Derecha</option><option>Izquierda</option><option>Ambas</option></select><div class="scaleItems"><div class="scaleItem"><label for="spiral_tremor">Temblor gráfico</label><select id="spiral_tremor"><option value="">—</option><option value="0">Ausente</option><option value="1">Leve</option><option value="2">Moderado</option><option value="3">Marcado</option></select></div><div class="scaleItem"><label for="spiral_micro">Micrografía / reducción de tamaño</label><select id="spiral_micro"><option value="">—</option><option value="0">Ausente</option><option value="1">Leve</option><option value="2">Moderada</option><option value="3">Marcada</option></select></div><div class="scaleItem"><label for="spiral_irregular">Irregularidad / interrupciones</label><select id="spiral_irregular"><option value="">—</option><option value="0">Ausente</option><option value="1">Leve</option><option value="2">Moderada</option><option value="3">Marcada</option></select></div></div><label for="spiral_notes">Observaciones</label><textarea id="spiral_notes" class="short" placeholder="Ej.: oscilación de amplitud regular; empeora al acercarse al centro; escritura progresivamente pequeña…"></textarea><div class="scaleNote">La espiral y la escritura pueden complementar la exploración de temblor, parkinsonismo, distonía o fenómenos funcionales. La interpretación debe integrarse con la exploración neurológica/motora.</div><button id="addScaleResult" class="addSuggestion">＋ Añadir al informe</button></div>`;bindPhotoControls();$('#addScaleResult').addEventListener('click',addScaleResult);return;
 }
 if(type==='stimulus'){
  box.innerHTML=`<div class="scalePanel"><h3>Estímulo visual autorizado</h3><div class="small">Permite mostrar en el móvil una lámina o imagen de un instrumento que tengas derecho a utilizar, sin incorporarla a Psikia Hub ni guardarla. Es útil para tareas visuoespaciales/cognitivas con material oficial.</div>${photoCaptureHtml('Elegir imagen',true)}<label for="stimulus_name">Prueba / estímulo</label><input id="stimulus_name" placeholder="Ej.: material oficial ACE-III"><label for="stimulus_result">Resultado clínico (opcional)</label><textarea id="stimulus_result" class="short" placeholder="Solo si quieres añadir el resultado al informe."></textarea><div class="scaleNote">No se incluyen en la app imágenes protegidas de MMSE, MoCA u otros instrumentos con restricciones. Puedes cargar temporalmente material oficial autorizado desde tu dispositivo.</div><button id="addScaleResult" class="addSuggestion">＋ Añadir resultado al informe</button></div>`;bindPhotoControls();$('#addScaleResult').addEventListener('click',addScaleResult);return;
 }
 if(type==='sad'){
  const labels=['Sexo masculino','Edad extrema según criterio del instrumento','Depresión / desesperanza','Intento previo','Consumo problemático de alcohol/drogas','Pérdida de pensamiento racional','Apoyo social limitado','Plan suicida organizado','Sin pareja / apoyo conyugal','Enfermedad médica relevante'];
  box.innerHTML=`<div class="scalePanel"><h3>SAD PERSONS</h3><div class="small">Registro orientativo de los 10 factores clásicos. 0 = no · 1 = sí.</div><div class="scaleItems">${labels.map((l,i)=>`<div class="scaleItem"><label for="sad_${i}">${esc(l)}</label><select id="sad_${i}" class="sadScore"><option value="0">0</option><option value="1">1</option></select></div>`).join('')}</div><div id="sad_result" class="scaleResult">Resultado: <span class="scaleScore">0/10</span></div><div class="scaleNote">No utilizar esta puntuación de forma aislada para decidir alta, ingreso o nivel de vigilancia; su capacidad predictiva es limitada. Debe integrarse en una valoración clínica estructurada del riesgo.</div><button id="addScaleResult" class="addSuggestion">＋ Añadir al informe</button></div>`;
  const update=()=>{const sum=[...document.querySelectorAll('.sadScore')].reduce((a,x)=>a+(Number(x.value)||0),0);$('#sad_result').innerHTML=`Resultado: <span class="scaleScore">${sum}/10</span>`};$$('.sadScore').forEach(x=>x.addEventListener('change',update));$('#addScaleResult').addEventListener('click',addScaleResult);return;
 }
 if(type==='ace'){
  box.innerHTML=`<div class="scalePanel"><h3>ACE-III · resultado</h3><div class="small">Introduce las puntuaciones obtenidas con el material oficial. Psikia Hub calcula el total y prepara la frase clínica.</div><div class="mini3">${scaleSelectHtml('ace_att','Atención',18)}${scaleSelectHtml('ace_mem','Memoria',26)}${scaleSelectHtml('ace_flu','Fluencia',14)}${scaleSelectHtml('ace_lang','Lenguaje',26)}${scaleSelectHtml('ace_vis','Visuoespacial',16)}</div><div id="ace_result" class="scaleResult">Total: <span class="scaleScore">—/100</span></div><div class="scaleNote">Los estímulos, imágenes y consignas completas deben administrarse desde la versión oficial/autorizada del instrumento.</div><button id="addScaleResult" class="addSuggestion">＋ Añadir al informe</button></div>`;
  ['ace_att','ace_mem','ace_flu','ace_lang','ace_vis'].forEach(id=>$('#'+id).addEventListener('input',updateAce));$('#addScaleResult').addEventListener('click',addScaleResult);return;
 }
 if(type==='mmse'){
  box.innerHTML=`<div class="scalePanel"><h3>MMSE · resultado externo</h3>${scaleSelectHtml('mmse_total','Puntuación total',30)}<label for="mmse_note">Comentario / interpretación clínica</label><textarea id="mmse_note" class="short" placeholder="Ej.: interpretar según edad, escolaridad y versión administrada."></textarea><div class="scaleNote">Psikia Hub no reproduce los ítems del MMSE. Registra aquí el resultado de una administración autorizada.</div><button id="addScaleResult" class="addSuggestion">＋ Añadir al informe</button></div>`;$('#addScaleResult').addEventListener('click',addScaleResult);return;
 }
 if(type==='asrs'){
  box.innerHTML=`<div class="scalePanel"><h3>TDAH adulto / ASRS</h3><label for="asrs_result">Resultado del cribado / puntuación</label><input id="asrs_result" placeholder="Ej.: cribado positivo; Parte A 5/6"><label for="asrs_note">Comentario clínico</label><textarea id="asrs_note" class="short" placeholder="Inicio en infancia, repercusión en más de un contexto, diagnósticos diferenciales…"></textarea><div class="scaleNote">Registro del resultado. Los ítems completos deben utilizarse conforme a la versión/licencia correspondiente.</div><button id="addScaleResult" class="addSuggestion">＋ Añadir al informe</button></div>`;$('#addScaleResult').addEventListener('click',addScaleResult);return;
 }
 if(type==='ipde'){
  box.innerHTML=`<div class="scalePanel"><h3>IPDE / personalidad</h3><label for="ipde_result">Resultado / módulos relevantes</label><input id="ipde_result" placeholder="Ej.: cribado positivo para rasgos límite y dependientes"><label for="ipde_note">Comentario clínico</label><textarea id="ipde_note" class="short" placeholder="Rasgos explorados, estabilidad temporal, repercusión, contexto…"></textarea><div class="scaleNote">Registro del resultado. No se reproducen aquí los ítems completos del instrumento.</div><button id="addScaleResult" class="addSuggestion">＋ Añadir al informe</button></div>`;$('#addScaleResult').addEventListener('click',addScaleResult);return;
 }
 box.innerHTML=`<div class="scalePanel"><h3>Otra escala / prueba</h3><label for="custom_scale_name">Nombre</label><input id="custom_scale_name" placeholder="Ej.: Barnes, Simpson-Angus, escala propia…"><label for="custom_scale_score">Resultado</label><input id="custom_scale_score" placeholder="Puntuación / resultado"><label for="custom_scale_note">Interpretación / comentario</label><textarea id="custom_scale_note" class="short"></textarea><button id="addScaleResult" class="addSuggestion">＋ Añadir al informe</button></div>`;$('#addScaleResult').addEventListener('click',addScaleResult);
}
function valNum(id,max){const el=$('#'+id);if(!el||el.value==='')return null;const v=Math.max(0,Math.min(max,Number(el.value)));return Number.isFinite(v)?v:null}
function updateAce(){const specs=[['ace_att',18],['ace_mem',26],['ace_flu',14],['ace_lang',26],['ace_vis',16]], vals=specs.map(([id,m])=>valNum(id,m));if(vals.some(v=>v===null)){$('#ace_result').innerHTML='Total: <span class="scaleScore">—/100</span>';return}const sum=vals.reduce((a,b)=>a+b,0);$('#ace_result').innerHTML=`Total: <span class="scaleScore">${sum}/100</span>`}
function getScaleResultText(){
 const type=$('#scaleType')?.value||'';
 if(type==='motor'){const names=['Temblor','Rigidez','Bradicinesia','Acatisia','Discinesias','Marcha/equilibrio','Distonía/otros'],vals=[...document.querySelectorAll('.motorScore')].map(x=>Number(x.value)||0),sum=vals.reduce((a,b)=>a+b,0),pos=names.map((n,i)=>vals[i]?`${n} ${vals[i]}/3`:null).filter(Boolean);const note=$('#motor_notes')?.value.trim();return `Exploración motora breve: ${sum}/21.${pos.length?' Hallazgos: '+pos.join(', ')+'.':''}${note?' '+note:''}`}
 if(type==='clock'){const xs=[...document.querySelectorAll('.clockScore')];if(xs.some(x=>x.value===''))return '';const vals=xs.map(x=>Number(x.value)||0),sum=vals.reduce((a,b)=>a+b,0),imp=$('#clock_impression')?.value.trim(),notes=$('#clock_notes')?.value.trim(),instruction=$('#clock_instruction')?.value.trim();return `Test del reloj: checklist estructural ${sum}/6${imp?`, impresión ${imp.toLowerCase()}`:''}.${instruction?' Consigna: '+instruction+'.':''}${notes?' '+notes:''}`}
 if(type==='spiral'){const hand=$('#spiral_hand')?.value.trim(),tv=$('#spiral_tremor')?.value,mv=$('#spiral_micro')?.value,iv=$('#spiral_irregular')?.value,note=$('#spiral_notes')?.value.trim(),sev=['ausente','leve','moderado','marcado'];if(tv===''&&mv===''&&iv===''&&!note)return '';const parts=[];if(tv!=='')parts.push(`temblor ${sev[Number(tv)]}`);if(mv!=='')parts.push(`micrografía ${sev[Number(mv)]}`);if(iv!=='')parts.push(`irregularidad ${sev[Number(iv)]}`);return `Espiral/escritura${hand?' ('+hand.toLowerCase()+')':''}: ${parts.join(', ')||'muestra registrada'}.${note?' '+note:''}`}
 if(type==='stimulus'){const name=$('#stimulus_name')?.value.trim(),r=$('#stimulus_result')?.value.trim();if(!r)return '';return `${name||'Tarea visuoespacial / estímulo visual'}: ${r}`}
 if(type==='sad'){const sum=[...document.querySelectorAll('.sadScore')].reduce((a,x)=>a+(Number(x.value)||0),0);return `SAD PERSONS: ${sum}/10. Puntuación orientativa integrada en la valoración clínica del riesgo; no utilizada de forma aislada para decisiones de disposición.`}
 if(type==='ace'){const specs=[['ace_att',18],['ace_mem',26],['ace_flu',14],['ace_lang',26],['ace_vis',16]],vals=specs.map(([id,m])=>valNum(id,m));if(vals.some(v=>v===null))return '';const sum=vals.reduce((a,b)=>a+b,0);return `ACE-III: ${sum}/100 (Atención ${vals[0]}/18, Memoria ${vals[1]}/26, Fluencia ${vals[2]}/14, Lenguaje ${vals[3]}/26, Visuoespacial ${vals[4]}/16).`}
 if(type==='mmse'){const total=valNum('mmse_total',30),note=$('#mmse_note')?.value.trim();if(total===null)return '';return `MMSE: ${total}/30.${note?' '+note:''}`}
 if(type==='asrs'){const r=$('#asrs_result')?.value.trim(),note=$('#asrs_note')?.value.trim();if(!r)return '';return `TDAH adulto / ASRS: ${r}.${note?' '+note:''}`}
 if(type==='ipde'){const r=$('#ipde_result')?.value.trim(),note=$('#ipde_note')?.value.trim();if(!r)return '';return `IPDE / personalidad: ${r}.${note?' '+note:''}`}
 if(type==='custom'){const n=$('#custom_scale_name')?.value.trim(),r=$('#custom_scale_score')?.value.trim(),note=$('#custom_scale_note')?.value.trim();if(!n&&!r&&!note)return '';return `${n||'Escala/prueba'}${r?': '+r:''}.${note?' '+note:''}`}
 return '';
}
function addScaleResult(){const text=getScaleResultText();if(!text)return alert('Completa el resultado antes de añadirlo.');const key=scaleSectionTarget();if(!fullReport[key])fullReport[key]='';appendText(fullReport,key,'',text);if(!currentReport[key])currentReport[key]='';appendText(currentReport,key,'',text);renderReport();$('#scalesDetails').open=true;$('#scaleType').value='';renderScaleWorkspace();$('#saveHint').textContent='Resultado de escala/exploración añadido al borrador. Revísalo antes de enviar.'}


function setDictationStatus(msg){const el=$('#dictationStatus');if(el)el.textContent=msg}
function saveDraftNow(msg){
 try{localStorage.setItem(storageKey('draft'),JSON.stringify({raw:$('#raw').value,code:getCode(),type:$('#visitType').value,updated:new Date().toISOString()}));if(msg)setDictationStatus(msg)}catch{}
}
function scheduleDraftSave(){clearTimeout(draftTimer);draftTimer=setTimeout(()=>saveDraftNow('Borrador guardado automáticamente.'),180)}
function restoreDraft(){
 try{const d=JSON.parse(localStorage.getItem(storageKey('draft'))||'null');if(!d||!d.raw)return;const age=Date.now()-new Date(d.updated).getTime();if(age>7*24*3600*1000)return;$('#raw').value=d.raw||'';if(d.code)$('#patientCode').value=d.code;if(d.type&&labels[d.type])$('#visitType').value=d.type;setDictationStatus('Borrador recuperado automáticamente. Puedes continuar dictando.')}catch{}
}
function clearDraft(){try{localStorage.removeItem(storageKey('draft'))}catch{};setDictationStatus('Borrador nuevo. Guardado automático activo.')}
async function acquireWakeLock(){if(!('wakeLock' in navigator)||wakeLock)return;try{wakeLock=await navigator.wakeLock.request('screen');wakeLock.addEventListener('release',()=>{wakeLock=null})}catch{}}
async function releaseWakeLock(){if(wakeLock){try{await wakeLock.release()}catch{}wakeLock=null}}
function mergeTranscript(existing,incoming){
 const a=String(existing||'').trim(), b=String(incoming||'').trim();if(!b)return a;if(!a)return b;
 const aw=a.split(/\s+/), bw=b.split(/\s+/), na=aw.map(norm), nb=bw.map(norm);
 const tailNorm=norm(aw.slice(-45).join(' ')), bNorm=norm(b);
 if(tailNorm.endsWith(bNorm)||norm(a).endsWith(bNorm))return a;
 let best=0,max=Math.min(45,aw.length,bw.length);
 for(let k=max;k>=1;k--){if(na.slice(-k).join(' ')===nb.slice(0,k).join(' ')){best=k;break}}
 const novel=bw.slice(best).join(' ').trim();
 if(!novel)return a;
 return `${a} ${novel}`.replace(/\s+/g,' ').trim();
}
function appendRecognized(text){const t=applyCustomCorrections(String(text||'').trim());if(!t)return;$('#raw').value=mergeTranscript($('#raw').value,t);saveDraftNow('Fragmento definitivo guardado · seguimos escuchando…')}
function stopDictation(message='Dictado detenido. El texto queda guardado.'){
 dictationWanted=false;isDictating=false;clearTimeout(restartTimer);if(recognition){try{recognition.stop()}catch{}recognition=null}releaseWakeLock();$('#dictate').textContent='🎙️ Dictar';setDictationStatus(message);saveDraftNow();
}
function startRecognitionLoop(){
 if(!dictationWanted||recognition)return;const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){dictationWanted=false;$('#raw').focus();setDictationStatus('Usa el micrófono del teclado: este navegador no ofrece dictado web.');return}
 const r=new SR();recognition=r;r.lang='es-ES';r.continuous=true;r.interimResults=false;r.maxAlternatives=1;isDictating=true;$('#dictate').textContent='⏹️ Detener dictado';acquireWakeLock();setDictationStatus('🎙️ Escuchando · pantalla activa · guardado automático.');
 r.onresult=e=>{let finalText='';for(let i=e.resultIndex;i<e.results.length;i++){if(e.results[i].isFinal)finalText+=e.results[i][0].transcript+' '}if(finalText)appendRecognized(finalText)};
 r.onerror=e=>{if(['not-allowed','service-not-allowed'].includes(e.error)){dictationWanted=false;setDictationStatus('Permiso de micrófono no disponible. Usa el micrófono del teclado.')}else if(e.error!=='aborted')setDictationStatus('El dictado se interrumpió; el texto reconocido sigue guardado.')};
 r.onend=()=>{if(recognition===r)recognition=null;isDictating=false;if(dictationWanted&&document.visibilityState==='visible'){restartTimer=setTimeout(startRecognitionLoop,300)}else{$('#dictate').textContent=dictationWanted?'🎙️ Reanudando…':'🎙️ Dictar';releaseWakeLock()}};
 try{r.start()}catch{recognition=null;restartTimer=setTimeout(startRecognitionLoop,500)}
}
function toggleDictation(){if(dictationWanted){stopDictation();return}dictationWanted=true;startRecognitionLoop()}

// ---- GROUPS ----
const groupCycles={
 assert:{name:'Asertividad y habilidades sociales',sessions:[
  {title:'1. Pasivo, agresivo, asertivo y manipulativo',duration:'60–70 min',concepts:[['Respuesta pasiva','No expresar la propia necesidad, ceder de forma habitual o evitar el conflicto aunque tenga un coste personal.'],['Respuesta agresiva','Defender la propia posición vulnerando o descalificando al otro, con amenaza, imposición o ataque.'],['Respuesta asertiva','Expresar una necesidad, opinión o límite de forma clara y respetuosa, aceptando que el otro puede no estar de acuerdo.'],['Respuesta manipulativa','Intentar obtener algo de forma indirecta mediante culpa, presión emocional, insinuación o mensajes ambiguos.']],
   caseTitle:'Caso: “Siempre acaba diciendo que sí”',caseText:'Mario lleva varios meses con ánimo bajo y tiende a evitar los conflictos. En su trabajo, un compañero le pide repetidamente que haga tareas adicionales que no forman parte de su turno. Mario acepta aunque sale más tarde y llega agotado a casa. Un día, tras varias semanas acumulando malestar, responde gritando: “¡Hazlo tú de una vez, que eres un aprovechado!”. Después se siente culpable y decide no volver a decir nada.',
   open:['¿Qué respuestas de Mario son pasivas y cuál es agresiva?','¿Qué necesidad legítima está intentando proteger?','¿Cómo podría haber intervenido antes de llegar al estallido?','¿Qué frase asertiva concreta podría utilizar mañana?'],
   quiz:{q:'Un compañero vuelve a pedirle que haga su tarea. ¿Cuál es la respuesta más asertiva?',options:['“Vale, no pasa nada”, aunque sabe que no puede asumirlo.','“Eres un vago. Siempre haces lo mismo.”','“Hoy no puedo hacer esa tarea. Necesito terminar la mía. Si hay que redistribuir trabajo, podemos hablarlo con el responsable.”','“Sí, claro… ya veo que algunos tienen mucha suerte”, esperando que capte la indirecta.'],correct:2,why:'La opción 3 describe la situación, pone un límite claro y propone una vía de solución sin atacar ni culpabilizar.'},
   dialogue:[['Terapeuta','¿Qué te dices justo antes de aceptar algo que no quieres hacer?'],['Paciente','Que si digo que no van a pensar que soy egoísta.'],['Terapeuta','¿Decir que no a una petición concreta significa necesariamente ser egoísta?'],['Paciente','No siempre, pero me cuesta tolerar que se molesten.'],['Terapeuta','Entonces quizá el objetivo no sea conseguir que nadie se moleste, sino aprender a mantener un límite aunque exista cierta incomodidad.']],
   pause:['¿Qué creencia mantiene la conducta pasiva?','¿Qué intenta cambiar el terapeuta: el pensamiento, la emoción o la conducta?','¿Qué frase alternativa podría ensayarse?'],
   exercise:'Role-play en tríadas. Persona A hace una petición excesiva; B practica una negativa breve; C observa si hubo claridad, respeto y exceso de justificación. Cambiar roles cada 3 minutos.',materials:['Tarjetas con 6 peticiones cotidianas ficticias','Hoja con cuatro estilos de respuesta','Reloj/temporizador de 3 minutos'],task:'Elegir una situación de bajo riesgo y preparar por escrito una frase asertiva de una o dos líneas.',slides:['¿Qué es ser asertivo?','Cuatro estilos de respuesta','Caso: Mario y las tareas extra','Pregunta al grupo: ¿qué harías tú?','Estructura de una respuesta asertiva','Role-play por tríadas']},
  {title:'2. Decir “no” sin justificar en exceso',duration:'60 min',concepts:[['Negativa asertiva','Respuesta clara y breve que reconoce la petición y mantiene el límite.'],['Disco rayado','Repetir el núcleo del límite con tono estable cuando aparecen presiones o nuevas justificaciones.']],caseTitle:'Caso: el favor que nunca termina',caseText:'Una amiga pide a Laura que la cubra por tercera vez en una actividad. Laura no quiere, pero teme decepcionarla. Empieza a inventar excusas complicadas y la conversación se convierte en una negociación interminable.',open:['¿Qué problema crea dar demasiadas explicaciones?','¿Cómo diferenciar una explicación razonable de una justificación defensiva?','¿Qué frase de “disco rayado” sería suficiente?'],quiz:{q:'¿Cuál sería una negativa más clara?',options:['“Ya veremos, quizá luego te digo.”','“No puedo esta vez. Entiendo que te venga mal, pero no voy a poder cubrirte.”','“Siempre me lo pides a mí.”','No responder al mensaje.'],correct:1,why:'Es clara, respetuosa y no abre una negociación falsa.'},dialogue:[['Terapeuta','Prueba a decir que no en una sola frase.'],['Paciente','No puedo porque esta semana estoy fatal, además…'],['Terapeuta','Para ahí. Ya tenemos suficiente. ¿Puedes repetir solo el límite?'],['Paciente','Esta vez no puedo cubrirte.'],['Terapeuta','Eso es. Ahora toleramos el silencio.']],pause:['¿Qué hace difícil el silencio después de decir no?','¿Qué emoción aparece y cuánto habría que tolerarla?'],exercise:'Ronda de negativas: cada persona recibe una tarjeta y responde en una sola frase. Segunda ronda: el interlocutor insiste y se practica repetir el límite.',materials:['Tarjetas de peticiones','Cronómetro'],task:'Practicar una negativa breve en contexto de bajo riesgo.',slides:['Decir no no es atacar','La trampa de justificar demasiado','Una frase clara','Cuando el otro insiste','Práctica']},
  {title:'3. Pedir lo que necesito',duration:'60 min',concepts:[['Petición concreta','Expresar qué conducta concreta se solicita, evitando esperar que el otro adivine la necesidad.']],caseTitle:'Caso: “Si me conociera, debería saberlo”',caseText:'David se enfada porque su pareja no le acompaña a una cita importante. Nunca se lo pidió directamente; esperaba que lo supiera. Cuando llega a casa se muestra distante y responde con monosílabos.',open:['¿Qué parte es necesidad y qué parte es expectativa?','¿Qué habría cambiado con una petición previa?','¿Cómo se puede pedir sin convertirlo en una exigencia?'],quiz:{q:'¿Qué petición es más concreta?',options:['“Nunca estás cuando te necesito.”','“Quiero que seas más atento.”','“¿Podrías acompañarme mañana a la cita de las 17:00? Para mí sería importante.”','“Da igual, ya iré solo.”'],correct:2,why:'Es específica, comprensible y permite que la otra persona responda.'},dialogue:[['Terapeuta','¿Qué te gustaría pedir exactamente?'],['Paciente','Que esté más pendiente.'],['Terapeuta','¿Cómo sabríamos mañana si eso ha ocurrido?'],['Paciente','Que me pregunte cómo ha ido la cita y cene conmigo.']],pause:['¿Por qué convertir necesidades globales en conductas observables ayuda?'],exercise:'Transformar 8 frases globales (“respétame”, “ayúdame más”, “sé más cariñoso”) en peticiones concretas y negociables.',materials:['Lista de frases globales'],task:'Preparar una petición concreta y realista.',slides:['Necesidad ≠ exigencia','Haz la petición observable','Caso David','Transformar frases globales','Práctica']},
  {title:'4. Críticas, desacuerdo y límites',duration:'65 min',concepts:[['Crítica útil','Se centra en una conducta concreta y su impacto.'],['Descalificación','Convierte una conducta en una etiqueta global sobre la persona.']],caseTitle:'Caso: una reunión tensa',caseText:'Durante una reunión, una compañera dice: “Tu propuesta no tiene sentido”. Elena siente vergüenza y responde: “Pues la tuya es peor”. La discusión se personaliza.',open:['¿Qué opciones existen entre callarse y contraatacar?','¿Cómo pedir que la crítica sea más concreta?'],quiz:{q:'Una respuesta posible sería:',options:['“Cállate, tú no tienes ni idea.”','“Vale, tienes razón en todo.”','“No estoy de acuerdo. Si ves un problema concreto en la propuesta, dime cuál y lo revisamos.”','Irse sin decir nada.'],correct:2,why:'Marca desacuerdo y devuelve la conversación a conductas o argumentos concretos.'},dialogue:[['Terapeuta','¿Qué fue lo que más te activó?'],['Paciente','Que pareciera que soy incompetente.'],['Terapeuta','¿Podemos responder a la frase concreta sin defender toda tu identidad?']],pause:['¿Qué cambia al separar conducta de identidad?'],exercise:'Role-play de crítica: recibir una crítica, pedir concreción, decidir qué parte se acepta y qué parte se rechaza.',materials:['Tarjetas de críticas leves/moderadas'],task:'Practicar una frase para pedir concreción ante una crítica.',slides:['Crítica ≠ identidad','Pedir concreción','Aceptar una parte','Discrepar sin atacar','Role-play']}
 ]},
 values:{name:'Valores, emoción y decisiones',sessions:[
  {title:'1. Qué me importa y cómo se nota',duration:'65 min',concepts:[['Valor','Dirección que orienta elecciones y conductas; no es una meta que se “termina”.'],['Meta','Resultado concreto que puede alcanzarse o completarse.']],caseTitle:'Dinámica de valores',caseText:'Cada persona elegirá cinco valores de una lista y después reducirá la selección a tres. No hay una respuesta correcta: el objetivo es observar qué prioriza cada uno y cómo cambia según la situación.',open:['¿Qué valor elegirías si solo pudieras conservar tres?','¿Qué conducta de esta semana demostraría ese valor?','¿Hay valores importantes que ahora mismo estés descuidando?'],values:['Familia','Amistad','Salud','Humor','Solidaridad','Autonomía','Aprendizaje','Creatividad','Honestidad','Seguridad','Aventura','Responsabilidad','Cuidado','Justicia','Trabajo','Espiritualidad','Curiosidad','Lealtad','Descanso','Contribución'],quiz:{q:'¿Cuál de estas opciones describe mejor un valor?',options:['“Perder 5 kg.”','“Ser una persona que cuida su salud.”','“Conseguir un contrato indefinido.”','“Terminar un curso.”'],correct:1,why:'Cuidar la salud es una dirección continua; las otras opciones son metas concretas.'},dialogue:[['Terapeuta','Dices que la familia es muy importante. ¿Cómo se vería ese valor esta semana?'],['Paciente','Podría llamar a mi hermano.'],['Terapeuta','Eso convierte un valor abstracto en una conducta concreta.']],pause:['¿Qué diferencia hay entre decir “la familia me importa” y actuar en esa dirección?'],guidedExercise:'Versión cerrada sin autorrevelación: presenta a Ana, que debe elegir entre acompañar a un familiar a una cita importante y cumplir un compromiso previo con un amigo. Reparte tres tarjetas —Familia, Lealtad, Responsabilidad— y pide al grupo elegir cuál parece priorizar Ana en cada una de tres decisiones ficticias. Después pregunta: “¿Puede haber dos respuestas razonables si cambian los valores priorizados?”.',exercise:'Selección 5→3 valores. Después, cada participante escribe una conducta pequeña que represente uno de ellos. Puesta en común voluntaria.',materials:['Lista de 20 valores','Papel y bolígrafo'],task:'Realizar una conducta pequeña alineada con uno de los tres valores elegidos.',slides:['Valores: direcciones, no metas','Elige 5','Ahora elige 3','¿Cómo se ve un valor en la conducta?','Compromiso pequeño']},
  {title:'2. Cuando dos valores chocan',duration:'70 min',concepts:[['Conflicto de valores','Dos direcciones importantes pueden competir; decidir implica priorizar temporalmente sin negar la importancia de la otra.']],caseTitle:'Caso: ayudar a un amigo o proteger mis límites',caseText:'Un amigo pide que canceles un plan familiar importante para ayudarle con una mudanza de última hora. Para ti son importantes la lealtad y la familia. No puedes hacer ambas cosas al mismo tiempo.',open:['¿Qué consejo le darías a un amigo en esta situación?','¿Qué te aconsejarías a ti mismo?','¿Sale el mismo consejo? ¿Por qué?','¿Qué valor estás priorizando y qué coste aceptas?'],quiz:{q:'¿Qué respuesta refleja mejor un conflicto de valores?',options:['“Si elijo una cosa significa que la otra no me importa.”','“Puedo valorar ambas cosas y aun así priorizar una hoy.”','“Siempre debo escoger a los demás antes que a mí.”','“Los valores sirven para evitar decisiones difíciles.”'],correct:1,why:'Priorizar en una situación concreta no elimina el valor de la alternativa.'},dialogue:[['Terapeuta','¿Qué le dirías a tu mejor amigo si estuviera en tu situación?'],['Paciente','Que mantenga el plan con su familia y ayude otro día.'],['Terapeuta','¿Y a ti qué te dices?'],['Paciente','Que si no voy soy mala persona.'],['Terapeuta','Ahí aparece una regla distinta para ti que para los demás.']],pause:['¿Somos más exigentes con nosotros que con un amigo?','¿Qué valor o miedo explica esa diferencia?'],exercise:'En parejas: cada persona recibe un dilema con dos valores en conflicto. Primero aconseja a “un amigo”; después responde qué haría ella misma. Comparar diferencias.',materials:['Tarjetas con 6 dilemas de valores','Lista de valores'],task:'Ante una decisión real, escribir: valores implicados, prioridad actual y coste que acepto.',slides:['Dos valores pueden chocar','Dilema: amigo vs familia','¿Qué aconsejarías a un amigo?','¿Qué te aconsejas a ti?','Elegir también implica aceptar un coste']},
  {title:'3. Emoción, pensamiento y conducta',duration:'60 min',concepts:[['Emoción','Respuesta afectiva con cambios subjetivos y corporales.'],['Pensamiento','Interpretación, imagen o evaluación que aparece ante una situación.'],['Conducta','Lo que hacemos o dejamos de hacer en respuesta a la situación.']],caseTitle:'Caso: mensaje sin respuesta',caseText:'Envías un mensaje importante y pasan seis horas sin respuesta. Piensas “está enfadado conmigo”, notas ansiedad y decides enviar cinco mensajes más.',open:['¿Qué es situación, qué es pensamiento, qué es emoción y qué es conducta?','¿Qué otras interpretaciones son posibles?','¿Qué cambia si la conducta es esperar una hora antes de actuar?'],quiz:{q:'“Seguro que no me responde porque ya no le importo” es principalmente:',options:['Una emoción','Un pensamiento/interpretación','Una conducta','Un hecho objetivo'],correct:1,why:'Es una interpretación sobre la situación, no un hecho comprobado.'},dialogue:[['Terapeuta','¿Qué sabes con certeza?'],['Paciente','Solo que no ha respondido.'],['Terapeuta','¿Y qué has añadido tú?'],['Paciente','Que está enfadado y que no le importo.']],pause:['¿Cómo cambia la emoción cuando distinguimos dato de interpretación?'],exercise:'Clasificar tarjetas en situación / pensamiento / emoción / conducta y después construir cadenas alternativas.',materials:['Tarjetas de ejemplos'],task:'Registrar una cadena breve situación–pensamiento–emoción–conducta.',slides:['Cuatro piezas','Situación','Pensamiento','Emoción','Conducta','Cambiar un eslabón']}
 ]},
 psychosis:{name:'Metacognición y psicosis',sessions:[
  {title:'1. Hechos, interpretaciones y certeza',duration:'65 min',concepts:[['Hecho','Información directamente observable o verificable.'],['Interpretación','Explicación que construimos a partir de los datos disponibles.'],['Certeza','Grado de seguridad que damos a una interpretación.']],caseTitle:'Caso: no me saludó',caseText:'Al entrar en una cafetería, una persona conocida mira hacia otro lado y no saluda. La primera interpretación es: “me evita porque habla mal de mí”.',open:['¿Qué sabemos con certeza?','¿Qué explicaciones alternativas existen?','¿Qué dato necesitaríamos para aumentar o reducir la certeza?'],quiz:{q:'¿Cuál es un hecho?',options:['“Me desprecia.”','“Me vio y fingió no verme.”','“Miró hacia otro lado y no me saludó.”','“Seguro que alguien le ha hablado de mí.”'],correct:2,why:'Describe lo observable sin añadir una explicación.'},dialogue:[['Terapeuta','¿Qué porcentaje de seguridad das a tu primera explicación?'],['Paciente','Un 90%.'],['Terapeuta','Vamos a buscar tres alternativas antes de volver a estimar la certeza.'],['Paciente','Podría no haberme visto, estar preocupado o ir con prisa.']],pause:['¿Cambiar la certeza significa negar la experiencia?','¿Qué utilidad tiene dejar un margen de duda?'],exercise:'Tarjetas ambiguas: separar datos e interpretaciones; generar al menos tres explicaciones y puntuar certeza 0–100 antes y después.',materials:['Tarjetas con situaciones ambiguas','Escala 0–100'],task:'Ante una situación ambigua, anotar un hecho y dos interpretaciones alternativas.',slides:['Nuestro cerebro interpreta','Hecho vs interpretación','Caso: no me saludó','Tres explicaciones','¿Cuánta certeza?']},
  {title:'2. Saltar a conclusiones',duration:'60 min',concepts:[['Decisión rápida','Conclusión tomada con pocos datos; puede ser útil a veces, pero aumenta errores en situaciones ambiguas.']],caseTitle:'Caso: el correo del jefe',caseText:'Recibes un correo que dice solo: “Mañana necesito hablar contigo”. Piensas inmediatamente que te van a despedir.',open:['¿Qué datos faltan?','¿Qué otras explicaciones caben?','¿Qué haría una persona que decide esperar a tener más información?'],quiz:{q:'¿Qué estrategia reduce el salto a conclusiones?',options:['Buscar solo información que confirme la primera idea.','Tomar una decisión inmediata para reducir la incertidumbre.','Recoger más datos y generar alternativas antes de concluir.','Evitar pensar en el tema por completo.'],correct:2,why:'Añadir información y alternativas reduce el riesgo de convertir una hipótesis en certeza.'},dialogue:[['Terapeuta','¿Qué evidencia tienes de que sea un despido?'],['Paciente','Ninguna directa.'],['Terapeuta','¿Qué datos te faltan antes de concluir?']],pause:['¿Por qué la incertidumbre empuja a cerrar una explicación demasiado pronto?'],exercise:'Juego de pistas progresivas: el grupo recibe una situación con 1, 2 y 4 datos; tras cada ronda registra su hipótesis y nivel de certeza.',materials:['Tarjetas de pistas'],task:'Esperar a disponer de un dato adicional antes de cerrar una conclusión en una situación cotidiana ambigua.',slides:['Pocos datos, mucha certeza','El correo de mañana','¿Qué información falta?','Hipótesis ≠ hecho','Esperar un dato más']}
 ]},
 anxiety:{name:'Ansiedad, pánico y regulación',sessions:[
  {title:'1. El ciclo de la ansiedad',duration:'60 min',concepts:[['Alarma','Activación fisiológica que prepara al organismo para responder.'],['Interpretación catastrófica','Lectura amenazante de sensaciones o situaciones que puede amplificar la alarma.'],['Evitación','Reducir contacto con lo temido; alivia a corto plazo pero puede mantener el miedo.']],caseTitle:'Caso: centro comercial',caseText:'Ana nota palpitaciones en un centro comercial. Piensa “me voy a desmayar”, sale rápidamente y se siente mejor. La semana siguiente decide no volver.',open:['¿Qué parte del ciclo produce alivio inmediato?','¿Qué aprende el cerebro al salir siempre?','¿Qué alternativa gradual podría plantearse?'],quiz:{q:'¿Qué conducta puede mantener el miedo a largo plazo?',options:['Permanecer gradualmente en la situación el tiempo acordado.','Salir siempre en cuanto aparece ansiedad.','Observar cómo sube y baja la activación.','Revisar interpretaciones catastróficas.'],correct:1,why:'La evitación inmediata reduce ansiedad a corto plazo y puede reforzar la idea de que la situación era peligrosa.'},dialogue:[['Terapeuta','¿Qué pasó después de salir?'],['Paciente','La ansiedad bajó.'],['Terapeuta','¿Y qué aprendiste de esa bajada?'],['Paciente','Que salir me salva.'],['Terapeuta','Ese aprendizaje es justo lo que tendremos que revisar de forma gradual y segura.']],pause:['¿Por qué algo que ayuda a corto plazo puede perjudicar a largo plazo?'],exercise:'Construir un círculo situación–pensamiento–sensación–conducta–consecuencia con un caso ficticio y proponer un punto de intervención.',materials:['Pizarra o diapositiva del ciclo'],task:'Identificar un episodio y completar el ciclo sin intentar cambiarlo todavía.',slides:['Ansiedad = alarma','El círculo que se retroalimenta','Caso: centro comercial','Alivio corto vs aprendizaje largo','¿Dónde podemos intervenir?']},
  {title:'2. Relajación muscular progresiva',duration:'55 min',concepts:[['Tensión–distensión','Contrastar de forma deliberada tensión suave y relajación para reconocer y reducir tensión muscular.']],caseTitle:'Antes de empezar',caseText:'La práctica se realiza sentados, sin dolor y sin forzar. Si un grupo muscular molesta, se omite. El objetivo no es “hacer desaparecer” toda ansiedad, sino aprender a detectar y soltar tensión.',open:['¿Dónde notas primero la tensión cuando estás activado?','¿Qué diferencia hay entre relajarse y obligarse a no sentir ansiedad?'],quiz:{q:'Durante la práctica conviene:',options:['Tensar al máximo aunque duela.','Mantener la respiración.','Tensar suavemente y soltar, observando el contraste.','Hacerla solo cuando la ansiedad es extrema.'],correct:2,why:'La práctica busca conciencia y distensión, no esfuerzo intenso.'},dialogue:[['Terapeuta','No buscamos ganar una competición de relajación.'],['Paciente','Entonces, ¿si sigo algo nervioso lo estoy haciendo mal?'],['Terapeuta','No. El objetivo es notar y soltar tensión, no controlar cada sensación.']],pause:['¿Qué expectativa poco realista puede convertir una técnica de relajación en otra fuente de presión?'],exercise:'Práctica guiada breve: manos/brazos, hombros, cara, abdomen y piernas. Tensión suave 5 segundos y distensión 15–20 segundos.',materials:['Sillas cómodas','Audio/lectura guiada opcional'],task:'Practicar 10 minutos en un momento tranquilo 3–4 días y observar qué grupos acumulan más tensión.',audio:'Siéntate con apoyo y deja los pies en el suelo. Observa primero cómo está tu cuerpo sin intentar cambiarlo. Cierra suavemente los puños durante cinco segundos, sin hacerte daño. Ahora suelta y nota durante unos segundos la diferencia entre tensión y distensión. Lleva después los hombros ligeramente hacia arriba, mantén unos segundos y suelta. Frunce suavemente la frente y relaja. Contrae de forma ligera el abdomen y suelta. Finalmente, presiona los pies contra el suelo unos segundos y deja de hacerlo. Respira con normalidad. No hace falta conseguir una relajación perfecta. Solo observa dónde puedes aflojar un poco más.',slides:['Relajación muscular progresiva','No buscamos “cero ansiedad”','Tensión suave · 5 s','Soltar · 15–20 s','Observar el contraste','Práctica guiada']}
 ]},
 motivation:{name:'Motivación y prevención de recaídas',sessions:[
  {title:'1. Ambivalencia y razones propias',duration:'60 min',concepts:[['Ambivalencia','Tener a la vez razones para mantener una conducta y razones para cambiarla.'],['Lenguaje de cambio','Expresiones propias sobre deseo, capacidad, razones, necesidad o compromiso para cambiar.']],caseTitle:'Caso: “Me ayuda y me perjudica”',caseText:'Óscar dice que el cannabis le ayuda a desconectar por la noche, pero también reconoce que al día siguiente se levanta tarde, falta a actividades y discute más con su familia.',open:['¿Qué gana a corto plazo?','¿Qué costes aparecen a medio plazo?','¿Qué razones para cambiar son de Óscar y cuáles serían de otras personas?'],quiz:{q:'¿Cuál es una respuesta más compatible con entrevista motivacional?',options:['“Tienes que dejarlo ya.”','“Si sigues así vas a fracasar.”','“Por una parte te ayuda a desconectar y por otra está interfiriendo con cosas que te importan. ¿Qué te preocupa más de todo esto?”','“No hablemos de lo bueno, centrémonos solo en los riesgos.”'],correct:2,why:'Refleja la ambivalencia y evoca la perspectiva de la persona sin confrontación.'},dialogue:[['Terapeuta','¿Qué te gusta de consumir?'],['Paciente','Me baja las vueltas.'],['Terapeuta','¿Y qué parte te está empezando a cansar?'],['Paciente','Perder las mañanas y discutir.']],pause:['¿Por qué preguntar también por las ventajas puede facilitar una conversación más honesta?'],exercise:'Balanza decisional con un hábito ficticio: ventajas/costes de mantener y cambiar; después identificar una razón propia para avanzar.',materials:['Plantilla de cuatro cuadrantes'],task:'Elegir un cambio pequeño y puntuar importancia/confianza de 0 a 10.',slides:['Ambivalencia es normal','Lo que ayuda / lo que cuesta','Razones propias','Escala 0–10','Un paso pequeño']}
 ]}
};

function fillCycles(){const cycle=$('#groupCycle');cycle.innerHTML=Object.entries(groupCycles).map(([k,v])=>`<option value="${k}">${esc(v.name)}</option>`).join('');fillSessions()}
function fillSessions(){const c=groupCycles[$('#groupCycle').value];$('#groupSession').innerHTML=c.sessions.map((s,i)=>`<option value="${i}">${esc(s.title)}</option>`).join('')}
function adaptGroup(feedback){const n=norm(feedback), tips=[];if(/poco dinam|poca particip|silencio|pasiv/.test(n))tips.push('Mantener formato cerrado: votación, elección A/B/C/D y ensayo con frases ya preparadas; no pedir experiencias personales.');if(/monopol|interrump|hablan mucho|desbord/.test(n))tips.push('Usar turnos breves y limitar intervenciones a aproximadamente un minuto.');if(/dificultad.*compr|atencion|cognitiv/.test(n))tips.push('Reducir explicación verbal y aumentar ejemplos, tarjetas y repetición.');if(/conflict|tension/.test(n))tips.push('Trabajar sobre personajes ficticios y evitar interpretar a miembros del grupo.');return tips}
function guidedScriptHtml(s){return `<div class="guidedScript"><b>Guion cerrado de conducción</b><div class="guidedStep exactPhrase">“Hoy vamos a trabajar con un caso ficticio. No hace falta contar nada personal. Primero escuchamos, después elegimos entre varias opciones y al final practicamos una respuesta concreta.”</div><div class="guidedStep"><b>1.</b> Lee el caso completo sin interrumpirlo y pide solo una votación rápida: “¿Qué opción encaja mejor: A, B, C o D?”</div><div class="guidedStep"><b>2.</b> Lee las cuatro respuestas de la pregunta de elección. Pide levantar uno, dos, tres o cuatro dedos. No solicites justificación todavía.</div><div class="guidedStep"><b>3.</b> Da la explicación preparada: ${esc(s.quiz?.why||'Revisar juntos por qué una opción encaja mejor que las demás.')}</div><div class="guidedStep"><b>4.</b> Haz el diálogo terapeuta–paciente exactamente como está escrito, repartiendo los dos papeles entre terapeuta y un voluntario o leyéndolo tú mismo.</div><div class="guidedStep"><b>5.</b> Ejecuta la dinámica concreta con instrucciones breves y tiempo limitado. Si nadie quiere participar, usa dos personajes ficticios y pide al grupo que elija cuál de dos respuestas sería más útil.</div><div class="guidedStep exactPhrase">Cierre: “No buscamos contar intimidades. La idea de hoy es llevarnos una herramienta y reconocer cuándo podría ser útil.”</div></div>`}
function renderGroupSession(){const cycle=groupCycles[$('#groupCycle').value], idx=Number($('#groupSession').value)||0, s=cycle.sessions[idx];currentGroupSession=s;const adapt=adaptGroup($('#groupFeedback').value);const guided=$('#groupGuidance').value==='guided';presentationSlides=s.slides||[s.title,...s.open];slideIndex=0;
 const concepts=(s.concepts||[]).map(([a,b])=>`<div class="concept"><b>${esc(a)}</b><div class="small">${esc(b)}</div></div>`).join('');
 const dialogue=(s.dialogue||[]).map(([who,t])=>`<div class="turn"><span class="${who==='Terapeuta'?'therapist':'patient'}">${esc(who)}:</span> ${esc(t)}</div>`).join('');
 const values=s.values?`<div class="values">${s.values.map(v=>`<span class="valueChip">${esc(v)}</span>`).join('')}</div>`:'';
 $('#groupOutput').innerHTML=`<div class="groupSession"><div class="groupHero"><div class="eyebrow">${esc(cycle.name)}</div><h2>${esc(s.title)}</h2><div class="small">Duración orientativa: ${esc(s.duration||'60 min')}</div></div><div class="groupBody">
 ${guided?guidedScriptHtml(s):''}<h3>1 · Conceptos para abrir la sesión</h3><div class="conceptGrid">${concepts}</div>${values}
 <h3>2 · Relato / caso para trabajar</h3><div class="case"><b>${esc(s.caseTitle)}</b><br>${esc(s.caseText)}</div>${guided?`<details><summary>Preguntas abiertas opcionales</summary><div class="detailBody"><ul class="questions">${(s.open||[]).map(q=>`<li>${esc(q)}</li>`).join('')}</ul></div></details>`:`<ul class="questions">${(s.open||[]).map(q=>`<li>${esc(q)}</li>`).join('')}</ul>`}
 <h3>3 · Pregunta de elección al grupo</h3><div><b>${esc(s.quiz.q)}</b></div><div class="mcq">${s.quiz.options.map((o,i)=>`<button type="button" data-q="${i}">${String.fromCharCode(65+i)}. ${esc(o)}</button>`).join('')}</div><div id="quizFeedback" class="feedback">Pulsa una opción para mostrar la explicación.</div>
 <h3>4 · Diálogo terapeuta–paciente</h3><div class="dialogue">${dialogue}</div>${(s.pause||[]).map(q=>`<div class="pause">⏸️ <b>Pausa al grupo:</b> ${esc(q)}</div>`).join('')}
 <h3>5 · Dinámica concreta</h3><div class="case">${esc(guided&&s.guidedExercise?s.guidedExercise:s.exercise)}</div><b>Material</b><ul class="materials">${(s.materials||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
 ${adapt.length?`<h3>Adaptación al grupo</h3><ul class="questions">${adapt.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:''}
 <h3>6 · Cierre / tarea</h3><div class="suggestionBox">${esc(s.task)}</div>
 <div class="actions"><button id="presentGroup">📺 Modo pantalla</button>${s.audio?'<button id="speakGroup" class="secondary">▶️ Leer práctica</button>':''}<button id="saveGroup" class="ghost">Guardar sesión</button></div>
 </div></div>`;
 $$('.mcq button').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.q);$$('.mcq button').forEach(x=>x.classList.remove('correct','wrong'));b.classList.add(i===s.quiz.correct?'correct':'wrong');$('#quizFeedback').textContent=s.quiz.why}));
 $('#presentGroup').addEventListener('click',openPresentation);$('#saveGroup').addEventListener('click',saveGroupHistory);if(s.audio)$('#speakGroup').addEventListener('click',()=>speak(s.audio));
}
function groupHistory(){try{return JSON.parse(localStorage.getItem(storageKey('groupHistory'))||'[]')}catch{return []}}
function saveGroupHistory(){if(!currentGroupSession)return;const h=groupHistory();h.unshift({date:new Date().toISOString(),cycle:groupCycles[$('#groupCycle').value].name,session:currentGroupSession.title,feedback:$('#groupFeedback').value.trim().slice(0,600)});localStorage.setItem(storageKey('groupHistory'),JSON.stringify(h.slice(0,50)));renderGroupHistory();alert('Sesión guardada en el histórico local del grupo.')}
function renderGroupHistory(){const h=groupHistory();$('#groupHistory').innerHTML=h.length?h.map(x=>`<div class="historyItem"><div class="meta">${new Date(x.date).toLocaleDateString('es-ES')} · ${esc(x.cycle)}</div><b>${esc(x.session)}</b>${x.feedback?`<div>${esc(x.feedback)}</div>`:''}</div>`).join(''):'Sin sesiones guardadas.'}
function openPresentation(){if(!presentationSlides.length)return;$('#presentation').classList.add('active');$('#presentation').setAttribute('aria-hidden','false');renderSlide();if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen().catch(()=>{})}
function closePresentation(){ $('#presentation').classList.remove('active');$('#presentation').setAttribute('aria-hidden','true');if(document.fullscreenElement)document.exitFullscreen().catch(()=>{}) }
function renderSlide(){const raw=presentationSlides[slideIndex]||'';$('#slide').innerHTML=`<div class="eyebrow">Psikia Hub · Grupo</div><h1>${esc(raw)}</h1><p>${slideIndex===0?esc(currentGroupSession?.caseText||''):'Pregunta abierta: ¿qué ideas, ejemplos o dudas os surgen?'}</p><div class="small">${slideIndex+1} / ${presentationSlides.length}</div>`}
function speak(text){if(!('speechSynthesis' in window))return alert('Este dispositivo no permite lectura de texto desde la app.');speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang='es-ES';u.rate=.9;speechSynthesis.speak(u)}

async function forceAppUpdate(){
 try{
  setDictationStatus('Actualizando archivos de Psikia Hub…');
  if('caches' in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)))}
  if('serviceWorker' in navigator){const regs=await navigator.serviceWorker.getRegistrations();for(const r of regs){try{await r.update()}catch{}}}
  localStorage.setItem('psikiaHubLastForcedUpdate',new Date().toISOString());
  const u=new URL(location.href);u.searchParams.set('v',APP_VERSION+'-'+Date.now());location.replace(u.toString());
 }catch(e){location.reload()}
}

// ---- EVENTS ----
$$('nav button').forEach(b=>b.addEventListener('click',()=>{$$('nav button').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.tab').forEach(t=>t.classList.remove('active'));$(`#tab-${b.dataset.tab}`).classList.add('active')}));
$('#patientCode').addEventListener('input',()=>{updateContextHint();scheduleDraftSave()});$('#visitType').addEventListener('change',scheduleDraftSave);$('#raw').addEventListener('input',scheduleDraftSave);$('#groupCycle').addEventListener('change',fillSessions);$('#groupGuidance').addEventListener('change',()=>{if(currentGroupSession)renderGroupSession()});
$('#generate').addEventListener('click',()=>{if(dictationWanted)stopDictation('Dictado detenido para generar la nota. Todo el texto está guardado.');const text=applyCustomCorrections($('#raw').value.trim());if(!text)return alert('Dicta o escribe primero la consulta.');$('#raw').value=text;lastInput=text;const selected=$('#visitType').value;currentType=inferVisitTypeFromText(text,selected);if(currentType!==selected){$('#visitType').value=currentType;setDictationStatus(`Tipo de nota ajustado a ${labels[currentType]} por una indicación explícita del dictado.`)}saveDraftNow();fullReport=buildReport(text,currentType);compactMode=shouldCompact(text,currentType);currentReport=compactMode?compactReport(fullReport,currentType):{...fullReport};renderReport();$('#saveHint').textContent=getCode()?'Revisa la nota y guarda la evolución o envíala para actualizar el contexto local.':''});
$('#clear').addEventListener('click',()=>{if(dictationWanted)stopDictation();$('#raw').value='';$('#resultCard').hidden=true;currentReport={};fullReport={};lastInput='';$('#saveHint').textContent='';clearDraft()});
$('#copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(reportText());alert('Informe copiado.')}catch{alert('No se pudo copiar automáticamente. Mantén pulsado sobre el texto para copiarlo.')}});
$('#saveContext').addEventListener('click',saveCurrentContext);
$('#email').addEventListener('click',()=>{const to=$('#emailAddress').value.trim();if(!to)return alert('Configura el correo profesional en Ajustes.');if(getCode())saveCurrentContext();const subject=encodeURIComponent(`Psikia Hub · ${labels[currentType]}${getCode()?` · ${getCode()}`:''}`);const body=encodeURIComponent(reportText());location.href=`mailto:${encodeURIComponent(to)}?subject=${subject}&body=${body}`});
$('#dictate').addEventListener('click',toggleDictation);$('#addDiagnostic').addEventListener('click',addDiagnosticToDocument);$('#addTherapy').addEventListener('click',addTherapyToDocument);
$('#scaleType').addEventListener('change',renderScaleWorkspace);
$('#closeImageOverlay').addEventListener('click',closeImageOverlay);$('#imageOverlay').addEventListener('click',e=>{if(e.target===$('#imageOverlay'))closeImageOverlay()});
$('#activeUserSelect').addEventListener('change',e=>setActiveUser(e.target.value));
$('#addUser').addEventListener('click',addUserProfile);$('#deleteUser').addEventListener('click',deleteActiveUser);
$('#emailAddress').addEventListener('change',()=>{const u=loadUsers();if(u.profiles[activeUserId]){u.profiles[activeUserId].email=$('#emailAddress').value.trim();saveUsers(u);renderUserUI()}});
$('#saveVocabulary').addEventListener('click',()=>{localStorage.setItem(storageKey('vocabulary'),$('#customVocabulary').value);alert('Correcciones de dictado guardadas para este usuario.')});if($('#forceUpdate'))$('#forceUpdate').addEventListener('click',forceAppUpdate);
$('#prepareGroup').addEventListener('click',renderGroupSession);$('#clearGroupHistory').addEventListener('click',()=>{if(confirm('¿Borrar el histórico grupal local?')){localStorage.removeItem(storageKey('groupHistory'));renderGroupHistory()}});
$('#clearPatients').addEventListener('click',()=>{if(confirm('¿Borrar todos los contextos locales A/AB?')){localStorage.removeItem(storageKey('patients'));updateContextHint();alert('Contextos locales borrados.')}});
$('#prevSlide').addEventListener('click',()=>{slideIndex=(slideIndex-1+presentationSlides.length)%presentationSlides.length;renderSlide()});$('#nextSlide').addEventListener('click',()=>{slideIndex=(slideIndex+1)%presentationSlides.length;renderSlide()});$('#closePresentation').addEventListener('click',closePresentation);

document.addEventListener('visibilitychange',()=>{saveDraftNow();if(document.visibilityState==='visible'&&dictationWanted&&!recognition){acquireWakeLock();startRecognitionLoop()}});
window.addEventListener('pagehide',()=>saveDraftNow());
localStorage.setItem('psikiaHubRunningVersion',APP_VERSION);const __users=loadUsers();activeUserId=(__users.activeId&&__users.profiles[__users.activeId])?__users.activeId:Object.keys(__users.profiles)[0];migrateLegacyForActive();renderUserUI();restoreDraft();fillCycles();renderGroupHistory();updateContextHint();if(!$('#raw').value)setDictationStatus('Guardado automático activo. Durante el dictado intentaremos mantener la pantalla encendida.');
