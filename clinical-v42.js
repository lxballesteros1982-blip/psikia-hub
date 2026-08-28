/* Psikia Hub v4.2 — capa clínica Kaplan/Maudsley/Stahl
 * Añade pruebas complementarias contextuales y refuerza la farmacoterapia.
 * Las sugerencias son apoyo a decisión y nunca órdenes automáticas.
 */
(function(){
  'use strict';
  const V42_VERSION='4.2';

  function v42Esc(s){
    if(typeof esc==='function') return esc(String(s??''));
    return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }
  function v42Norm(s){return typeof norm==='function'?norm(String(s||'')):String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
  function v42Has(s,re){return re.test(v42Norm(s))}
  function v42Unique(arr){const seen=new Set();return arr.filter(x=>!seen.has(x.id)&&(seen.add(x.id),true))}
  function v42Proposal(id,title,why,when,source,priority=50){return {id,title,why,when,source,priority}}

  function v42ClinicalText(text){
    let rpt='';
    try{rpt=typeof reportText==='function'?reportText():''}catch{}
    let ctx='';
    try{ctx=typeof getContext==='function'?(getContext()?.summary||''):''}catch{}
    return `${text||''} ${rpt} ${ctx}`.trim();
  }

  function v42InvestigationOptions(text){
    const full=v42ClinicalText(text),n=v42Norm(full),opts=[];
    const add=o=>opts.push(o);
    const type=(typeof currentType!=='undefined'&&currentType)||document.querySelector('#visitType')?.value||'';
    const firstOrAcute=['first','acute','emergency','urInitial','medicalGeneral'].includes(type);
    const psychosis=/psicos|esquizofren|delir|alucin/.test(n);
    const organicRed=/primer episodio|inicio agudo|inicio brusco|confus|desorient|fluctua|deterioro cogn|cambio cogn|fiebre|neurolog|focal|convul|crisis comicial|traumatismo crane|catatoni|alteracion de conciencia|alteracion conciencia/.test(n);
    const substances=/cannabis|cocaina|cocaína|anfet|estimulante|alcohol|opiace|opioide|benzodiazep|sustancia|intoxic|abstinencia/.test(n);
    const seizure=/convul|crisis comicial|epilep|ausencia|desconexion|desconexión|temporal/.test(n);
    const neuro=/focal|cefalea nueva|traumatismo crane|deterioro cogn|demencia|confus|desorient|neurolog|marcha|ataxia|inicio tardio|inicio tardío/.test(n);
    const thyroid=/tiroid|hipotiroid|hipertiroid|bocio|intolerancia al frio|intolerancia al calor|perdida de peso inexplic|ganancia de peso inexplic|taquicardia inexplic/.test(n);
    const nutrition=/macroci|anemia|malnutri|desnutri|vegan|vegetarian|parestes|neuropat|b12|folato|alcoholismo cron/.test(n);
    const hypona=/hiponatr|siadh|confus|caidas|caídas|ancian|diuretico|diurético/.test(n);
    const cardio=/qt|qtc|arrit|cardiopat|sincope|síncope|palpitacion|palpitación|hipokal|hipomag|muerte subita|muerte súbita/.test(n);
    const reproductive=/embaraz|gesta|lactan|potencial reproduct|anticoncep|fertil/.test(n);

    if(firstOrAcute && (psychosis||organicRed||/mania|depres.*grave|catatoni|agita/.test(n))){
      add(v42Proposal('medical-review','Evaluación somática dirigida','Revisar constantes, exploración física y neurológica y seleccionar analítica básica solo en función de la presentación y comorbilidad.','Especialmente en primer episodio, cambio clínico marcado, urgencias o cuando la presentación no sea la habitual.','Kaplan & Sadock · Emergencies',92));
    }
    if((psychosis&&firstOrAcute)||organicRed){
      add(v42Proposal('basic-organic','Analítica orientada a causas médicas reversibles','Considerar hemograma, electrolitos, función renal/hepática, glucosa y TSH cuando el cuadro, antecedentes o exploración hagan plausible una contribución orgánica.','No se propone como panel universal: elegir componentes según edad, clínica, medicación y hallazgos.','Kaplan & Sadock',83));
    }
    if(substances){
      add(v42Proposal('tox','Tóxicos / alcohol de forma dirigida','Una determinación toxicológica puede ayudar cuando existe duda sobre exposición reciente y el resultado modificaría diagnóstico, seguridad o tratamiento.','Interpretar junto a anamnesis, ventana de detección y posibles falsos positivos/negativos.','Kaplan & Sadock',86));
    }
    if(neuro||organicRed){
      add(v42Proposal('neuroimaging','Neuroimagen si hay indicación clínica','Valorar TC o RM ante focalidad, traumatismo, deterioro cognitivo no explicado, inicio atípico/tardío u otros signos que hagan sospechar patología neurológica estructural.','La modalidad depende de la urgencia y la hipótesis clínica; no es una prueba rutinaria para todo cuadro psiquiátrico.','Kaplan & Sadock',88));
    }
    if(seizure){
      add(v42Proposal('eeg','EEG si se sospechan crisis o fenómeno episódico neurológico','Puede ser útil ante sospecha de epilepsia, episodios de desconexión/alteración de conciencia o clínica compatible con origen temporal.','Solicitar por la hipótesis neurológica concreta, no como cribado de psicosis.','Kaplan & Sadock',87));
    }
    if(thyroid){
      add(v42Proposal('tsh','Función tiroidea','La clínica o antecedentes aportan una señal endocrina que puede imitar o modular síntomas afectivos, ansiosos o cognitivos.','TSH ± pruebas adicionales según resultado y contexto clínico.','Kaplan & Sadock',74));
    }
    if(nutrition){
      add(v42Proposal('b12-folate','Hemograma y B12/folato si la clínica lo apoya','Anemia, dieta de riesgo, alcoholismo, síntomas neurológicos o cognitivos pueden justificar descartar déficits relevantes.','Evitar solicitarlo de rutina si no existe una pista clínica o analítica.','Kaplan & Sadock',70));
    }

    const ap=/clozapin|olanzapin|quetiapin|risperid|paliperid|amisul|aripipraz|lurasid|ziprasid|haloper|antipsicot/.test(n);
    const cloz=/clozapin/.test(n);
    const lithium=/\blitio\b|pleno?ur|priadel/.test(n);
    const valpro=/valpro|depakine|ácido valpro|acido valpro/.test(n);
    const carba=/carbamaz|tegretol/.test(n);
    const ssri=/sertralin|escitalopram|citalopram|fluoxetin|paroxetin|fluvoxamin|isrs/.test(n);
    const snri=/venlafax|desvenlafax|duloxetin|irsn/.test(n);
    const stimulant=/metilfenid|lisdexanf|atomoxet|estimulante/.test(n);

    if(ap){
      add(v42Proposal('ap-metabolic','Monitorización física y metabólica del antipsicótico','Revisar peso/IMC, tensión arterial y metabolismo glucídico/lipídico según fármaco, situación basal y evolución.','Intensificar si existe ganancia ponderal, diabetes/dislipemia o fármacos de mayor carga metabólica.','Kaplan & Sadock · Maudsley · Stahl',95));
      add(v42Proposal('ap-neuroendo','Efectos motores y prolactina según perfil','Explorar síntomas extrapiramidales; valorar prolactina si hay síntomas o se utiliza un fármaco con mayor propensión a elevarla.','No convertir prolactina en una prueba aislada sin interpretar síntomas, fármaco y situación basal.','Kaplan & Sadock · Maudsley',75));
      if(cardio||/ziprasid|haloper|quetiapin|risperid|citalopram/.test(n)) add(v42Proposal('ecg','ECG / electrolitos si existe riesgo de QT','El riesgo cardiovascular, síncope, interacciones o combinación de fármacos con potencial de prolongar QT justifican una revisión específica.','Valorar ECG y K/Mg según riesgo y protocolo; revisar medicación concomitante.','Maudsley · Stahl · actualización CIMA',90));
    }
    if(cloz){
      add(v42Proposal('clozapine-protocol','Protocolo específico de clozapina','Comprobar hemograma/ANC y el programa local de monitorización; revisar estreñimiento, infección/fiebre, metabolismo y toxicidades graves.','La vigilancia de miocarditis (p. ej., troponina/CRP) debe seguir el protocolo local vigente y la fase de tratamiento.','Stahl · Maudsley · protocolo local vigente',100));
    }
    if(lithium){
      add(v42Proposal('lithium-monitor','Monitorización de litio','Revisar función renal, función tiroidea, electrolitos/calcio e interacciones; controlar nivel plasmático si ya está en tratamiento.','ECG y situación reproductiva cuando corresponda; especial atención a deshidratación y cambios que alteren la eliminación renal.','Kaplan & Sadock · Maudsley · Stahl',98));
    }
    if(valpro){
      add(v42Proposal('valproate-monitor','Monitorización de valproato','Considerar hemograma/plaquetas, función hepática y nivel plasmático cuando sea clínicamente útil.','Comprobar además las restricciones reproductivas y de seguridad vigentes antes de iniciar o mantener.','Kaplan & Sadock · Maudsley · actualización AEMPS/CIMA',96));
    }
    if(carba){
      add(v42Proposal('carbamazepine-monitor','Monitorización de carbamazepina','Revisar hemograma/plaquetas, función hepática y sodio; considerar nivel plasmático e interacciones según situación clínica.','Atender a rash, toxicidad hematológica/hepática e interacciones por inducción enzimática.','Kaplan & Sadock · Maudsley · Stahl',94));
    }
    if((ssri||snri)&&hypona){
      add(v42Proposal('sodium-ad','Sodio si existe riesgo de hiponatremia','Edad, diuréticos, antecedentes de SIADH/hiponatremia, caídas o confusión aumentan el valor de controlar sodio con antidepresivos serotoninérgicos.','Solicitar de forma dirigida y repetir según evolución/riesgo.','Maudsley · Stahl',80));
    }
    if(snri){
      add(v42Proposal('snri-bp','TA/FC con IRSN','Venlafaxina y otros IRSN pueden requerir seguimiento de tensión y frecuencia cardiaca según dosis, comorbilidad y tolerancia.','Revisar además función renal/hepática e interacciones según la molécula elegida.','Kaplan & Sadock · Maudsley · Stahl',79));
    }
    if(stimulant){
      add(v42Proposal('adhd-vitals','TA/FC, peso y antecedentes cardiovasculares','Antes y durante estimulantes/atomoxetina conviene seguir constantes, peso/apetito, sueño y antecedentes cardiovasculares.','ECG solo cuando la historia/exploración o el protocolo lo indiquen; revisar uso de sustancias.','Stahl · Maudsley · actualización CIMA',86));
    }
    if(reproductive&&(lithium||valpro||carba||ap||ssri||snri)){
      add(v42Proposal('reproductive','Revisión de embarazo/lactancia y potencial reproductivo','La elección y monitorización psicofarmacológica cambia si existe embarazo, lactancia o posibilidad reproductiva relevante.','Contrastar siempre la situación concreta con ficha técnica y recomendaciones vigentes.','Maudsley · Stahl · AEMPS/CIMA vigente',97));
    }

    return v42Unique(opts).sort((a,b)=>b.priority-a.priority).slice(0,7);
  }

  function v42InvestigationsHtml(text){
    const opts=v42InvestigationOptions(text);
    if(!opts.length) return '<div class="small">No aparece una indicación clara para añadir pruebas complementarias específicas. La ausencia de sugerencias no sustituye la valoración clínica.</div>';
    const intro='<div class="legalBox"><b>Propuestas contextuales, no órdenes.</b> Kaplan se usa para ampliar el diferencial médico y las pruebas pertinentes; Maudsley/Stahl para monitorización farmacológica. Las guías y AEMPS/CIMA actúan como capa de actualización y contraste.</div>';
    return intro+opts.map((o,i)=>`<label class="pharmOption v42InvestOption"><input type="checkbox" name="investChoice" value="${v42Esc(o.id)}" ${i===0?'checked':''}><span><strong>${v42Esc(o.title)}</strong><br>${v42Esc(o.why)}<br><span class="small"><b>Cuándo:</b> ${v42Esc(o.when)} · <b>Base:</b> ${v42Esc(o.source)}</span></span></label>`).join('');
  }

  function v42SelectedInvestigationText(){
    const ids=[...document.querySelectorAll('input[name="investChoice"]:checked')].map(x=>x.value);
    if(!ids.length)return '';
    const options=v42InvestigationOptions(typeof lastInput!=='undefined'?lastInput:'');
    return options.filter(o=>ids.includes(o.id)).map(o=>`${o.title}: ${o.why} ${o.when}`).join(' ');
  }

  function v42InvestigationTarget(rep){
    return Object.keys(rep||{}).find(k=>/Pruebas \/ resultados|Pruebas \/ actuaciones realizadas|Pruebas complementarias/i.test(k))
      || (typeof therapyTarget==='function'?therapyTarget(rep):'Plan de tratamiento');
  }

  function v42AddInvestigations(){
    const t=v42SelectedInvestigationText();
    if(!t)return alert('Selecciona al menos una propuesta de prueba o monitorización.');
    const key=v42InvestigationTarget(fullReport);
    if(typeof appendText==='function')appendText(fullReport,key,'Pruebas complementarias / monitorización a valorar: ',t);
    else fullReport[key]=`${fullReport[key]||''} Pruebas complementarias / monitorización a valorar: ${t}`.trim();
    currentReport=compactMode?compactReport(fullReport,currentType):{...fullReport};
    renderReport();
    const d=document.querySelector('#investigationsDetails');if(d)d.open=true;
    const h=document.querySelector('#saveHint');if(h)h.textContent='Pruebas/monitorización añadidas como propuesta revisable. No se han convertido en órdenes automáticas.';
  }

  function v42EnsureInvestigationsPanel(){
    let d=document.querySelector('#investigationsDetails');
    if(!d){
      const pharm=document.querySelector('#pharmDetails'),dx=document.querySelector('#diagnosticDetails');
      if(!pharm&&!dx)return;
      d=document.createElement('details');d.id='investigationsDetails';
      d.innerHTML='<summary>Pruebas complementarias · opciones</summary><div class="detailBody"><div id="investigationsSuggestion"></div><button id="addInvestigations" class="addSuggestion">＋ Añadir seleccionadas al documento</button></div>';
      (pharm?.parentNode||dx.parentNode).insertBefore(d,pharm||dx.nextSibling);
    }
    const add=document.querySelector('#addInvestigations');
    if(add&&!add.dataset.v42bound){add.addEventListener('click',v42AddInvestigations);add.dataset.v42bound='1'}
  }

  function v42RenderInvestigations(){
    v42EnsureInvestigationsPanel();
    const d=document.querySelector('#investigationsDetails');
    if(d)d.hidden=(typeof currentType!=='undefined'&&currentType==='medicalGeneral')?false:false;
    const el=document.querySelector('#investigationsSuggestion');
    if(el)el.innerHTML=v42InvestigationsHtml(typeof lastInput!=='undefined'?`${lastInput} ${typeof reportText==='function'?reportText():''}`:'');
  }

  function v42EnhanceQuickBar(){
    const bar=document.querySelector('#v4AddonBar');if(!bar||document.querySelector('#quickInvestigations'))return;
    const b=document.createElement('button');b.type='button';b.id='quickInvestigations';b.className='secondary';b.textContent='🧪 Pruebas';
    const pharm=document.querySelector('#quickPharm');bar.insertBefore(b,pharm||null);
    b.addEventListener('click',()=>{v42EnsureInvestigationsPanel();const d=document.querySelector('#investigationsDetails');d.open=true;d.scrollIntoView({behavior:'smooth',block:'start'})});
  }

  // Refuerza el módulo farmacológico previo sin introducir prescripción automática.
  if(typeof v41PharmOptions==='function'){
    const base=v41PharmOptions;
    v41PharmOptions=function(text){
      const r=base(text);
      const monitor={
        maintain:'Confirmar que la monitorización específica del tratamiento actual está al día.',
        sgaprof:'Antes de elegir, revisar constantes/peso y riesgo metabólico; valorar prolactina, EPS y ECG según fármaco y riesgo.',
        lai:'Además de la respuesta oral previa, revisar requisitos de inicio, intervalos, interacciones y monitorización de la molécula concreta.',
        aripiprazole:'Vigilar especialmente activación/acatisia; mantener evaluación metabólica y cardiovascular contextual.',
        lurasidone:'Revisar interacciones CYP, administración con alimentos, EPS/acatisia y riesgo cardiometabólico individual.',
        olanzapine:'Dar peso explícito a peso/IMC, glucosa/HbA1c, lípidos y TA.',
        clozapine:'Aplicar protocolo local de hemograma/ANC, estreñimiento, metabolismo y vigilancia de miocarditis/toxicidades graves.',
        'bipolar-lit':'Integrar función renal, TSH, electrolitos/calcio, nivel plasmático e interacciones; ECG/reproducción cuando corresponda.',
        valproate:'Integrar hemograma/plaquetas, función hepática, nivel cuando sea útil y restricciones reproductivas vigentes.',
        ssri:'Considerar sodio en grupos de riesgo, sangrado/interacciones y ECG si hay riesgo de QT.',
        'anx-ssri':'Considerar sodio en grupos de riesgo, sangrado/interacciones y ECG si hay riesgo de QT.',
        snri:'Añadir seguimiento de TA/FC y función renal/hepática según molécula y contexto.',
        'anx-snri':'Añadir seguimiento de TA/FC y síndrome de retirada; revisar función renal/hepática según molécula.',
        'adhd-stim':'Registrar TA/FC, peso/apetito, sueño, antecedentes cardiovasculares y uso de sustancias.',
        'adhd-nonstim':'Registrar TA/FC, peso, función hepática si procede e interacciones.'
      };
      for(const o of r.options||[]){
        if(monitor[o.id]&&!o.watch.includes(monitor[o.id]))o.watch+=` ${monitor[o.id]}`;
        const parts=String(o.source||'').split('/').map(x=>x.trim()).filter(Boolean);
        if(!parts.some(x=>/Kaplan/i.test(x)))parts.unshift('Kaplan');
        o.source=[...new Set(parts)].join(' / ');
      }
      return r;
    };
  }

  // Sustituye solo la presentación del módulo farmacológico para expresar la jerarquía acordada.
  pharmacotherapyHtml=function(text){
    const r=v41PharmOptions(text);
    if(!r.options.length)return '<div class="small">No hay una diana farmacológica suficientemente clara en la información actual. El módulo no fuerza una propuesta sin síndrome/diagnóstico orientativo.</div>';
    let intro='<div class="legalBox"><b>Apoyo a decisión, no prescripción.</b> Base clínica integrada: Kaplan + Maudsley + Stahl. Las guías vigentes y AEMPS/CIMA se usan para actualizar y contrastar indicaciones, restricciones, interacciones y ficha técnica antes de aplicar una opción.</div>';
    if(r.flags.length)intro+=`<div class="small" style="margin:7px 0"><b>Factores detectados para modular la elección:</b> ${r.flags.map(v42Esc).join(' · ')}</div>`;
    const cards=r.options.map((o,i)=>`<label class="pharmOption"><input type="radio" name="pharmChoice" value="${v42Esc(o.id)}" ${i===0?'checked':''}><span><strong>${v42Esc(o.title)}</strong><br><span>${v42Esc(o.why)}</span><br><span class="small"><b>Vigilar:</b> ${v42Esc(o.watch)} · <b>Base:</b> ${v42Esc(o.source)}</span></span></label>`).join('');
    return intro+cards+'<div class="small" style="margin-top:8px">El motor guarda reglas breves y paráfrasis clínicas, no los textos de los manuales.</div>';
  };

  // Envuelve renderReport para mantener intacto el motor 4.1 y añadir la nueva capa.
  if(typeof renderReport==='function'){
    const baseRender=renderReport;
    renderReport=function(){
      v42EnsureInvestigationsPanel();
      baseRender();
      v42RenderInvestigations();
      v42EnhanceQuickBar();
    };
  }

  function v42PatchUI(){
    v42EnsureInvestigationsPanel();
    document.querySelectorAll('.versionBadge').forEach(x=>x.textContent='v4.2');
    const settings=document.querySelector('#tab-settings .card:nth-of-type(2)');
    if(settings){
      const smalls=[...settings.querySelectorAll('.small')];
      const foot=smalls.find(x=>/Versión 4\.1|Versión 4\.0/.test(x.textContent));
      if(foot)foot.textContent='Versión 4.2 · Kaplan clínico + pruebas complementarias contextuales + farmacoterapia reforzada';
    }
    const sourceDetails=[...document.querySelectorAll('#tab-settings details')].find(d=>/Fuentes clínicas del motor/.test(d.querySelector('summary')?.textContent||''));
    if(sourceDetails){
      const body=sourceDetails.querySelector('.detailBody');
      if(body)body.innerHTML='<p><b>Base clínica integrada:</b> <i>Kaplan & Sadock’s Pocket Handbook of Clinical Psychiatry</i>, <i>The Maudsley Prescribing Guidelines in Psychiatry</i> 15e y <i>Stahl’s Prescriber’s Guide</i> 8e.</p><p><b>Diagnóstico:</b> DSM-5-TR como referencia de criterios y estructura diagnóstica; Kaplan amplía diagnóstico diferencial, evaluación médica y pruebas complementarias.</p><p><b>Actualización:</b> guías clínicas vigentes y AEMPS/CIMA funcionan como capa de contraste para recomendaciones actuales, indicaciones, restricciones, interacciones y ficha técnica.</p><p class="small">La PWA contiene reglas breves y paráfrasis, no los textos de los manuales. Toda propuesta debe ser revisada por el psiquiatra antes de incorporarse a la historia clínica.</p>';
    }
    const style=document.createElement('style');style.id='v42Style';style.textContent='.addonBar{grid-template-columns:repeat(5,1fr)!important}.v42InvestOption{background:#fbfdfe}@media(max-width:430px){.addonBar{grid-template-columns:repeat(3,1fr)!important}.addonBar button{font-size:11px;padding:8px 3px}}';document.head.appendChild(style);
    try{localStorage.setItem('psikiaHubRunningVersion',V42_VERSION)}catch{}
  }

  v42PatchUI();
})();
