# Psikia Hub v4.1 · motor clínico híbrido local

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

Incluye además el add-on visible de Escalas/Exploraciones, consulta médica general, grupos TMG, cámara, multiusuario local y correo en texto.

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


## v4.1 · Biblioteca clínica local
- Mejora de exploración psicopatológica y riesgo basada en los manuales aportados por el usuario.
- Revisión farmacológica opcional conservadora (alerta, nunca autocorrección silenciosa).
- Urgencias con extracción explícita de riesgo, exploración física e investigaciones cuando se dictan.
