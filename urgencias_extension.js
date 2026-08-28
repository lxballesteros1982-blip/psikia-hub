/**
 * PsikiaNotas Clínica — Extensión Intervención en Urgencias v1.0.0
 * Configuración independiente del resto de módulos.
 */
(function (root) {
  const EXT = {"id": "psikianotas.intervencion_urgencias.v1", "name": "Intervención en Urgencias", "scope": "urgencias_only", "version": "1.0.0", "report_sections": ["Motivo de consulta", "Antecedentes relevantes", "Situación precipitante / enfermedad actual", "Información colateral relevante", "Exploración psicopatológica", "Valoración de riesgos", "Valoración médico-orgánica / pruebas complementarias", "Juicio clínico", "Intervención realizada", "Respuesta / evolución en Urgencias", "Epicrisis y disposición"], "risk_assessment": {"domains": ["Suicidio / autolesión", "Heteroagresividad", "Vulnerabilidad / capacidad de autocuidado", "Impulsividad / intoxicación", "Factores protectores"], "distinguish": ["Riesgo inmediato", "Riesgo basal"]}, "organic_assessment": {"rule": "Sugerir exploración física, constantes, analítica, tóxicos, ECG, neuroimagen u otras pruebas únicamente cuando estén clínicamente indicadas por el cuadro y el diagnóstico diferencial.", "never_automatic_battery": true}, "clinical_judgment": {"include": ["Síndrome principal", "Diagnóstico probable o provisional", "Diagnósticos diferenciales relevantes", "Especial atención a causas orgánicas y relacionadas con sustancias"]}, "performed_intervention": {"rule": "Registrar únicamente actuaciones realmente realizadas y confirmadas por el médico.", "examples": ["Desescalada / contención verbal", "Reducción de estímulos / medidas ambientales", "Medidas de seguridad", "Tratamiento farmacológico administrado", "Observación", "Pruebas complementarias realizadas", "Interconsultas", "Información colateral obtenida", "Coordinación con recursos", "Medidas legales"], "ai_suggestions_separate": true, "ai_suggestions_never_mark_as_done_without_confirmation": true}, "epicrisis": {"purpose": "Síntesis clínica razonada, no repetición de la historia.", "must_include": ["Resumen del cuadro y contexto", "Evolución tras la intervención", "Hallazgos clave y dudas/exclusiones relevantes", "Riesgo inmediato y basal", "Factores de riesgo y protección", "Juicio clínico", "Justificación explícita del destino", "Plan de seguimiento y medidas de seguridad"], "dispositions": ["Alta", "Observación", "Ingreso", "Derivación", "Otro"], "decision_rule": "Explicar por qué la disposición elegida resulta adecuada frente a alternativas razonables."}, "safety": {"do_not_modify_other_modules": ["Evolutivo ordinario", "PTI", "Historia clínica general", "Informes de rehabilitación"], "suggestions_are_revisable": true, "final_clinical_decision_requires_physician_confirmation": true}};

  function buildEmergencyReport(data = {}) {
    const sectionMap = {};
    EXT.report_sections.forEach(section => {
      sectionMap[section] = data[section] || "";
    });
    return {
      module: EXT.name,
      scope: EXT.scope,
      sections: sectionMap,
      rules: {
        performedInterventionOnlyIfConfirmed: true,
        aiSuggestionsSeparate: true,
        epicrisisMustJustifyDisposition: true,
        organicTestsOnlyWhenClinicallyIndicated: true
      }
    };
  }

  const api = { config: EXT, buildEmergencyReport };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.PSIKIA_URGENCIAS_EXTENSION = api;
  }
})(typeof window !== "undefined" ? window : globalThis);
