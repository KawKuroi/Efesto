/**
 * Estima los costos basados en el número de tokens y el modelo utilizado.
 */

const COST_MATRIX = {
  // Claude models (Anthropic)
  'claude-3-5-sonnet-20241022': { inputCostPerM: 3.00, outputCostPerM: 15.00 },
  'claude-3-5-sonnet': { inputCostPerM: 3.00, outputCostPerM: 15.00 },
  'claude-3-5-haiku': { inputCostPerM: 0.80, outputCostPerM: 4.00 },
  
  // Gemini models (Google)
  'gemini-1.5-flash': { inputCostPerM: 0.075, outputCostPerM: 0.30 },
  'gemini-2.5-flash': { inputCostPerM: 0.075, outputCostPerM: 0.30 },
  'gemini-1.5-pro': { inputCostPerM: 1.25, outputCostPerM: 5.00 },
  'gemini-2.5-pro': { inputCostPerM: 1.25, outputCostPerM: 5.00 }
};

const DEFAULT_COST = { inputCostPerM: 1.0, outputCostPerM: 5.0 };

/**
 * Calcula el costo estimado en dólares de una llamada de API.
 * @param {string} model Modelo utilizado
 * @param {number} inputTokens Tokens de entrada
 * @param {number} outputTokens Tokens de salida
 * @returns {number} Costo total estimado en USD
 */
export function estimateCost(model, inputTokens, outputTokens) {
  // Encontrar correspondencia parcial o exacta de modelo
  const modelKey = Object.keys(COST_MATRIX).find(k => model.includes(k)) || '';
  const rates = COST_MATRIX[modelKey] || DEFAULT_COST;
  
  const inputCost = (inputTokens / 1_000_000) * rates.inputCostPerM;
  const outputCost = (outputTokens / 1_000_000) * rates.outputCostPerM;
  
  return inputCost + outputCost;
}

/**
 * Formatea el reporte de tokens de forma legible para el usuario en la terminal.
 * @param {string} agentNombre Nombre del agente ejecutor
 * @param {string} model Modelo utilizado
 * @param {number} inputTokens Tokens de entrada
 * @param {number} outputTokens Tokens de salida
 * @returns {string} Texto formateado con métricas
 */
export function formatTokenReport(agentNombre, model, inputTokens, outputTokens) {
  const cost = estimateCost(model, inputTokens, outputTokens);
  return `[${agentNombre}] Modelo: ${model} | Tokens Entrada: ${inputTokens} | Tokens Salida: ${outputTokens} | Costo Estimado: $${cost.toFixed(5)} USD`;
}
