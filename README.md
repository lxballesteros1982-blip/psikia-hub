# Psikia Hub v4.8 · adaptive_dictionary_v1

- Conserva íntegra la v4.7: MediaRecorder + Whisper Large v3 Turbo, PUSH por pulsación, ausencia de reinicios por silencios y Workers AI actual.
- No introduce Gemini ni cambia de proveedor/modelo.
- Añade aprendizaje terminológico local y explícito: solo aprende cuando el médico corrige una palabra de la última toma y pulsa **Aprender corrección**.
- Una regla queda como candidata con 1-2 confirmaciones y pasa a activa tras 3 confirmaciones idénticas.
- Las reglas activas se aplican localmente a futuras transcripciones antes de ordenar la nota.
- No aprende de inferencias del LLM, de silencios, ni del simple hecho de que una edición quede sin modificar.
- Las reglas se pueden revisar, eliminar individualmente o borrar por completo en Ajustes.
- Esta v1 guarda el diccionario aprendido solo en el dispositivo; la sincronización D1 se deja para una fase posterior.
- `clinical_facts_v1` y el benchmark Llama/Gemini quedan como siguiente paso del Worker, no se simulan en el frontend.

# Psikia Hub v4.7 · vocabulario clínico y guardas semánticas

- Dictado continuo mediante MediaRecorder + Whisper Large v3 Turbo.
- Vocabulario psiquiátrico/farmacológico integrado en el Worker.
- Campo opcional de vocabulario local en Ajustes para recursos, siglas y topónimos.
- Correcciones conservadoras de errores de reconocimiento muy frecuentes.
- Reglas de Urgencias más estrictas para información colateral, evolución posterior a intervención y juicio clínico.
- Sin fallback silencioso si Workers AI falla.
- La salida sigue siendo un borrador que requiere revisión y validación médica.

# Psikia Hub v4.6 · Whisper + Workers AI

Esta versión cambia el dictado a grabación continua por pulsación (MediaRecorder) y transcripción con Whisper Large v3 Turbo en el Worker. Los silencios ya no provocan reinicios automáticos del reconocimiento del navegador.

La estructuración de notas usa Workers AI con salida JSON estructurada. Si el Worker falla en un tipo de nota soportado, la app conserva el dictado y muestra el error: no aplica un fallback local silencioso.

El profesional debe revisar y validar siempre la salida antes de incorporarla a la historia clínica.

# Psikia Hub v4.5 · Cloudflare Workers AI conectado

PWA clínica local-first, no comercial, para apoyo a documentación clínica. El profesional debe revisar y validar siempre la salida antes de incorporarla a la historia clínica.

## v4.5 · conexión del frontend con el Worker

- Conecta `Ordenar nota` con `https://psikia-hub-api.lxballesteros1982.workers.dev`.
- El frontend envía `report_type + transcript` al Worker y recibe JSON clínico limpio.
- Traduce los nombres técnicos de secciones del Worker a los campos visibles de la app.
- Integra `medication_changes` en las cuatro pautas revisables.
- El botón `Probar conexión` consulta ahora el endpoint real del Worker.
- El informe de alta conserva por ahora el segmentador local porque el Worker actual no tiene todavía una plantilla específica de alta.
- Si el Worker falla, la app mantiene el fallback local.
- La nota activa sigue sin persistirse; mini historia y ajustes permanecen locales.


## Historial previo

PWA clínica local-first, no comercial, para apoyo a documentación clínica. El profesional debe revisar y validar siempre la salida antes de incorporarla a la historia clínica.

## Cambio principal

Esta versión sustituye el troceado literal de frases por un motor local en varias capas:

1. corrección conservadora del dictado y vocabulario aprendido por usuario;
2. detección de marcadores/secciones clínicas;
3. extracción de hechos (diagnóstico, medicación, evolución funcional, hallazgos psicopatológicos, intervención y seguimiento);
4. contexto/negación simple;
5. reescritura en prosa clínica por sección;
6. continuidad longitudinal: diagnóstico y tratamiento persisten salvo cambio explícito;
7. diferencial adaptativo: más hipótesis con poca información y menos al aumentar los datos clínicos.

Incluye además el add-on visible de Escalas/Exploraciones, orientación diagnóstica adaptativa, **opciones farmacoterapéuticas seleccionables**, consulta médica general, grupos TMG, cámara, multiusuario local y correo en texto.

## Referencias técnicas abiertas utilizadas como arquitectura

- **medSpaCy**: Sectionizer, segmentación clínica y ConText (negación/contexto), MIT.
- **Apache cTAKES**: arquitectura modular para extraer síntomas, diagnósticos, medicamentos y temporalidad, Apache.
- **CogStack / MedCAT**: normalización de conceptos clínicos y personalización del vocabulario, Apache/MIT según componente.
- **PlanTL-GOB-ES / Barcelona Supercomputing Center**: modelos biomédico-clínicos oficiales en español, Apache 2.0. No se descarga el modelo pesado en el móvil en esta versión; se usa como referencia para una posible capa local futura.
- **SymSpell**: corrección/fuzzy matching eficiente; la app utiliza una implementación JS conservadora propia inspirada en este enfoque.
- **AEMPS CIMA**: fuente oficial y abierta para nombres de medicamentos, principios activos, dosis, formas y vías. Esta versión mantiene un diccionario local conservador y aprendizaje de correcciones; no envía el dictado a CIMA.
- **CIE-10-ES / eCIEMaps 2026**: referencia oficial para códigos diagnósticos.

## Prueba de regresión

El dictado patrón de UR con esquizofrenia/pariperidona se comprueba antes de publicar esta versión. Debe producir de forma separada:
- descripción del caso;
- evolución clínica/funcional;
- exploración psicopatológica;
- juicio clínico;
- plan y seguimiento.

## Privacidad

Los recursos externos anteriores no reciben contenido clínico en esta versión. El procesamiento esencial se realiza localmente en el navegador/PWA. El diseño no equivale a certificación jurídica, de seguridad o de producto sanitario.


## v4.1 · fuentes clínicas y farmacoterapia

- Añade un acordeón **Tratamiento farmacológico · opciones** y acceso rápido 💊.
- Sugiere estrategias y moléculas según síndrome/diferencial, tratamiento actual, respuesta, adherencia y señales de seguridad.
- En psicosis contempla mantener tratamiento eficaz, LAI si hay problemas de adherencia, comparación por perfiles y clozapina si se documenta resistencia confirmada.
- En depresión, ansiedad/pánico y trastorno bipolar ofrece alternativas breves y monitorización clave.
- Las opciones no modifican el informe hasta que el profesional selecciona una y pulsa “Añadir opción”.
- No se incorporan dosis automáticas: deben verificarse ficha técnica vigente, AEMPS/CIMA, interacciones y situación clínica individual.
- Fuentes clínicas de diseño: DSM-5-TR, Emergencies in Psychiatry, Maudsley 15e, Stahl Prescriber’s Guide 8e y apuntes de psicofarmacología aportados al proyecto. Los textos originales no se distribuyen dentro de la PWA.
