# Psikia Hub v2.0 beta

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
