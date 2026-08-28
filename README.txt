PSIKIANOTAS CLÍNICA — EXTENSIÓN “INTERVENCIÓN EN URGENCIAS” v1.0.0

Contenido
- urgencias_extension.json: reglas y estructura del módulo.
- urgencias_extension.js: módulo sin dependencias que expone la configuración y un constructor básico de informe.

Objetivo
Aplicar una plantilla específica SOLO a “Intervención en Urgencias”:
Motivo de consulta → Antecedentes → Cuadro actual → Información colateral →
Exploración psicopatológica → Riesgos → Valoración orgánica/pruebas si proceden →
Juicio clínico → Intervención realizada → Evolución → Epicrisis y disposición.

Reglas clave
1. “Intervención realizada” solo contiene actuaciones confirmadas como efectivamente realizadas.
2. Las sugerencias de IA permanecen separadas y revisables.
3. La epicrisis es una síntesis razonada y debe justificar alta, observación, ingreso,
   derivación u otro destino.
4. Diferenciar riesgo inmediato y riesgo basal.
5. Pruebas orgánicas/complementarias solo si proceden clínicamente.
6. No modificar evolutivo, PTI, historia general ni informes de rehabilitación.

Integración
Este paquete es independiente del código base. Puede importarse como configuración o
copiarse al proyecto. Para conectarlo automáticamente a un botón o pantalla concreta,
hará falta el archivo/código de esa app concreta.
