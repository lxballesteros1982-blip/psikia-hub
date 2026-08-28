# Psikia Hub v2.2 beta

Rediseño mobile-first inspirado en flujos de escriba clínico: sesión -> dictado -> nota estructurada -> revisión -> correo.

## Cambios principales
- Navegación reducida a Notas, Grupo y Ajustes.
- Código local A/AB para continuidad entre primera valoración y seguimientos.
- Tipos: primera consulta, seguimiento, agudos, UR valoración, UR seguimiento, PTI, alta y urgencias.
- Orientación diagnóstica e intervención psicoterapéutica como desplegables opcionales debajo de la nota.
- Pestaña Navarra eliminada; los recursos quedan como conocimiento contextual para futuros planes.
- Grupo ampliado con conceptos, casos ficticios, preguntas abiertas, elección múltiple, diálogos terapeuta-paciente, pausas, dinámicas, tareas y modo pantalla/TV.
- Histórico grupal agregado local.
- Relajación muscular con lectura guiada mediante síntesis de voz del dispositivo cuando esté disponible.

## Actualización de la PWA instalada
Subir los archivos de esta carpeta al mismo repositorio `psikia-hub`, sustituyendo los anteriores. GitHub Pages mantiene la misma URL. El service worker usa una caché nueva (`psikia-hub-v20`) y fuerza actualización de los archivos al volver a abrir la app con conexión.


## v2.2
- Guardado incremental del dictado y recuperación de borrador.
- Wake Lock durante el dictado cuando Android/Chrome lo permite.
- Reanudación del reconocimiento si se interrumpe.
- Clasificación clínica mejorada para dictados largos sin puntuación.
- Solo se muestran de inicio los apartados con contenido; los vacíos quedan plegados.


## Cambios v2.2
- Formato breve/completo automático según tipo y extensión.
- Botones + para incorporar orientación diagnóstica o psicoterapéutica al borrador final.
- Envío por correo como texto en el cuerpo del mensaje.
- Terapia grupal con modo muy guiado por defecto, sin necesidad de autorrevelación.
