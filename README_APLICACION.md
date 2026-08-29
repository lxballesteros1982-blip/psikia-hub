# Psikia Hub v2.8 — hardening a partir de la revisión de Claude

Este paquete NO sustituye todavía toda la PWA. Está pensado para aplicarse encima de la versión
actual sin tirar el trabajo que ya funciona.

## Qué aplicaría ya

1. **Dictado Android v2.8**
   - deduplicación por contenido, no por `resultIndex`;
   - conserva la lógica de hipótesis crecientes;
   - corrige el eco entre sesiones manuales con `combineWithBase`;
   - no reinicia automáticamente tras silencios;
   - si recorta un posible eco, lo avisa para revisión visual.

2. **Structured Outputs**
   - solo para **Valoración inicial** y **Urgencias**, porque son los dos schemas ya definidos;
   - lo no dictado queda `null`, no se inventa;
   - lo ambiguo puede quedar en `unassigned`;
   - la ausencia de mención de riesgo NO se convierte en riesgo bajo;
   - el frontend envía únicamente `report_type` + `transcript`, no código de paciente ni mini-historia.

3. **Backend mínimo Cloudflare Worker**
   - la API key de OpenAI queda en un secret del Worker;
   - `store:false`;
   - CORS restringido al origen de GitHub Pages;
   - token de acceso propio del backend para no dejar un proxy público que pueda consumir saldo;
   - sin RAG todavía. La puerta para Vectorize queda abierta, pero no se suben libros ni historiales en este paquete.

## Cómo añadir los dos scripts al frontend

Copia en la raíz del repo:
- `psikia-dictation-v28.js`
- `psikia-structured-v28.js`

Y, al final de `index.html`, **después del script actual de la app y antes de `</body>`**, añade:

```html
<script src="./psikia-dictation-v28.js?v=28"></script>
<script src="./psikia-structured-v28.js?v=28"></script>
```

El parche de dictado retira el listener antiguo del botón y coloca el nuevo.
El parche Structured Outputs hace lo mismo con `Ordenar nota`.

## Desplegar el Worker

```bash
cd cloudflare-worker
npm install
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put PSIKIA_CLIENT_TOKEN
npm run deploy
```

Después:
- abre Psikia Hub → Ajustes → Backend clínico;
- pega la URL HTTPS del Worker;
- pega el mismo `PSIKIA_CLIENT_TOKEN`.

**Nunca** pegues la API key de OpenAI en Psikia Hub.

## Datos de salud

Este paquete es un andamiaje técnico, no una validación jurídica. Antes de utilizar transcripciones
reales de pacientes fuera del dispositivo hay que cerrar el circuito de protección de datos:
DPA aplicable, política de retención, base jurídica/encargo de tratamiento y requisitos de residencia
o localización de datos de la organización.

No se debe asumir que un Worker gratuito ejecuta exclusivamente en la UE por defecto.
Si se exige procesamiento/localización estrictamente europea, hay que configurarlo/contratarlo
expresamente o elegir una arquitectura que lo garantice.

## OpenAI

El Worker usa `POST /v1/responses` con `text.format.type="json_schema"`, `strict:true` y `store:false`.
El modelo se configura por `OPENAI_MODEL`; el ejemplo deja `gpt-5.4-mini`.

## Pruebas

```bash
node test_dictado_v28.mjs
```

Debe terminar con `TODOS LOS TESTS V2.8 PASAN`.

## Siguiente fase (no activada aquí)

Cuando Valoración inicial y Urgencias funcionen bien con casos simulados:
- definir schemas equivalentes para Evolutivo, PTI y Alta;
- añadir recuperación RAG separada de la extracción;
- decidir qué corpus puede salir del dispositivo y con qué base/contrato;
- solo después valorar Vectorize/pgvector e historial sincronizado.
