function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function wordsNorm(s){return norm(s).replace(/[^a-z0-9]+/gi,' ').replace(/\s+/g,' ').trim()}
function startsWithWords(longer,shorter){const a=wordsNorm(longer),b=wordsNorm(shorter);return !!b&&(a===b||a.startsWith(b+' '))}
function sameEnough(a,b){const x=wordsNorm(a),y=wordsNorm(b);return x===y||(x.length>24&&y.length>24&&(x.includes(y)||y.includes(x)))}
function mergeWithoutEcho(existing,incoming){
 const a=String(existing||'').trim(), b=String(incoming||'').trim(); if(!a)return b; if(!b)return a;
 if(sameEnough(a,b))return wordsNorm(b).length>wordsNorm(a).length?b:a;
 const aw=a.split(/\s+/), bw=b.split(/\s+/); let overlap=0;
 for(let k=Math.min(28,aw.length,bw.length);k>=2;k--){
  if(wordsNorm(aw.slice(-k).join(' '))===wordsNorm(bw.slice(0,k).join(' '))){overlap=k;break}
 }
 const tail=bw.slice(overlap).join(' '); return tail?`${a} ${tail}`:a;
}
function canonicalResults(e){
 const finals=[];
 for(let i=0;i<e.results.length;i++){const r=e.results[i],tx=String(r?.[0]?.transcript||'').replace(/\s+/g,' ').trim();if(tx&&r.isFinal)finals.push(tx)}
 const collapsed=[];
 for(const tx of finals){
  if(!collapsed.length){collapsed.push(tx);continue}
  const last=collapsed[collapsed.length-1];
  if(startsWithWords(tx,last)){collapsed[collapsed.length-1]=tx;continue}
  if(startsWithWords(last,tx)||sameEnough(last,tx))continue;
  collapsed.push(tx);
 }
 return collapsed.join(' ').replace(/\s+/g,' ').trim();
}
function clean(txt,finish=false){let x=String(txt||'').replace(/\s+/g,' ').trim();if(!x)return'';x=x[0].toUpperCase()+x.slice(1);if(finish&&!/[.!?…]$/.test(x))x+='.';return x}
function combineWithBase(base,piece){
 base=String(base||'').trim();piece=String(piece||'').trim();
 if(!base)return{text:piece,echoTrimmed:false};if(!piece)return{text:base,echoTrimmed:false};
 if(sameEnough(base,piece))return{text:base,echoTrimmed:true};
 const bw=base.split(/\s+/),pw=piece.split(/\s+/);let overlap=0;
 for(let k=Math.min(24,bw.length,pw.length);k>=1;k--){
  const a=wordsNorm(bw.slice(-k).join(' ')),b=wordsNorm(pw.slice(0,k).join(' '));
  if(a===b&&(k>=2||a.length>=4)){overlap=k;break}
 }
 const trimmed=overlap?pw.slice(overlap).join(' '):piece;
 if(!trimmed)return{text:base,echoTrimmed:!!overlap};
 return{text:overlap?`${base} ${trimmed}`:`${base}\n${trimmed}`,echoTrimmed:!!overlap};
}
function event(xs){return{results:xs.map(x=>({isFinal:true,0:{transcript:x}}))}}
function assertEq(got,want,label){const ok=got===want;console.log(`${ok?'OK  ':'FAIL'} ${label}`);if(!ok){console.log(' got ',JSON.stringify(got));console.log(' want',JSON.stringify(want))}return ok}
let ok=true;

// A. Hipótesis creciente en un mismo array.
ok=assertEq(canonicalResults(event(['Paciente','Paciente con','Paciente con trastorno bipolar'])),'Paciente con trastorno bipolar','A hipótesis creciente')&&ok;

// B. Dos finales clínicamente distintos.
ok=assertEq(canonicalResults(event(['Paciente con trastorno bipolar','Acude por episodio depresivo'])),'Paciente con trastorno bipolar Acude por episodio depresivo','B finales distintos')&&ok;

// C. Eco entre sesiones: una palabra larga repetida.
let r=combineWithBase('En seguimiento, previamente estable.','Estable Acude a urgencias.');
ok=assertEq(r.text,'En seguimiento, previamente estable. Acude a urgencias.','C eco entre sesiones')&&ok;
ok=assertEq(String(r.echoTrimmed),'true','C marca echoTrimmed')&&ok;

// D. Una palabra corta no se recorta: puede ser repetición legítima.
r=combineWithBase('Tratamiento de','de momento se mantiene.');
ok=assertEq(r.text,'Tratamiento de\nde momento se mantiene.','D conector corto no recortado')&&ok;

// E. Solapamiento de dos palabras sí se recorta.
r=combineWithBase('Se mantiene muy estable','muy estable y colaborador.');
ok=assertEq(r.text,'Se mantiene muy estable y colaborador.','E solapamiento 2 palabras')&&ok;

// F. mergeWithoutEcho conserva frases distintas sin depender de resultIndex.
ok=assertEq(mergeWithoutEcho('Niega ideación suicida','Mantiene planes de futuro'),'Niega ideación suicida Mantiene planes de futuro','F frases distintas')&&ok;

console.log(ok?'\nTODOS LOS TESTS V2.8 PASAN':'\nHAY TESTS V2.8 FALLANDO');
process.exitCode=ok?0:1;
