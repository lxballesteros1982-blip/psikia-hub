# Psikia Hub v3.3 — motor clínico local y actualización anticaché

Versión acumulativa de Psikia Hub orientada a móvil, sin API comercial obligatoria.

## Qué corrige esta versión

- Muestra **v3.3** de forma visible en la cabecera para saber qué motor está ejecutando realmente el móvil.
- Carga `app.js` y el service worker con versión explícita para evitar mezclar interfaz nueva con JavaScript antiguo.
- Añade **Ajustes → Actualizar aplicación** para borrar cachés PWA y forzar la descarga del motor vigente.
- Refuerza el motor de seguimiento/UR con detección por **secciones y alcance**: contexto → evolución → exploración → juicio → plan.
- Mantiene diagnóstico y tratamiento longitudinales salvo cambio explícito.
- Evita que “diagnóstico no cambia” convierta toda la transcripción en una sugerencia diagnóstica.
- Incluye correcciones ASR seguras de expresiones muy características sin autocorregir diagnósticos o fármacos.
- Mantiene escalas/exploraciones opcionales y las hace más visibles en el flujo del borrador.

## Diseño del motor

El motor local sigue un enfoque ligero inspirado en los *sectionizers* de NLP clínico: detecta marcadores explícitos, asigna alcance hasta el siguiente bloque y aplica reglas semánticas clínicas dentro de cada sección. Se ha preferido este enfoque sobre ejecutar Python/R en el teléfono para mantener la PWA pequeña, rápida, privada y sin costes recurrentes.

Como referencias técnicas se han revisado medSpaCy/Sectionizer, Stanza (Stanford), FreeLing (TALP-UPC), modelos españoles BETO/ALBETO (Universidad de Chile) y Transformers.js. Un modelo semántico local puede añadirse más adelante como fallback, pero no es necesario para el flujo principal de esta versión.

## Benchmark de regresión

La nota de seguimiento de esquizofrenia usada durante las pruebas debe producir, aproximadamente:

- Descripción del caso: esquizofrenia paranoide + UR + paliperidona IM 100 mg mensual.
- Evolución: adaptación/participación, ajedrez-vínculo con hijo, adherencia, productividad delirante ocasional.
- Exploración: consciente/orientado, discurso, descarrilamientos, ideas delirantes, sueño/apetito.
- Juicio: diagnóstico previo sin cambios.
- Plan: mantener tratamiento + intervención cognitivo-conductual para psicosis.

## Actualización desde GitHub Pages

Subir todos los archivos al raíz del repositorio `psikia-hub`, hacer commit y esperar el check verde de Pages. Después abrir una vez:

`https://lxballesteros1982-blip.github.io/psikia-hub/?v=3.3`

La cabecera debe mostrar **v3.3**. Si no aparece, usar **Ajustes → Actualizar aplicación**.
