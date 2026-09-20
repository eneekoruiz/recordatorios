import type { TaskItem } from '../models/Task';

export interface ExtractedPriceResult {
  price: number;
  cleanText: string;
}

/**
 * Motor de extracción de precios para lenguaje natural y notas en español.
 * Soporta sufijos (€, euros, eur, e, $), prefijos (€, $) y patrones comunes.
 * Evita falsos positivos como rangos o unidades: "(5 a 10 unidades)", "(10 a 20 pares)", o conjunciones "10 e ir".
 */
export function extractPrice(text?: string | null, isNote = false): ExtractedPriceResult | null {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  // 0. Si es una nota y consiste únicamente en un número (ej. "50", "50.00", "50,00")
  if (isNote) {
    const pureNumMatch = trimmed.match(/^(\d+(?:[.,]\d{1,2})?)$/);
    if (pureNumMatch) {
      const val = parseFloat(pureNumMatch[1].replace(',', '.'));
      if (!isNaN(val) && val > 0) {
        return { price: val, cleanText: '' };
      }
    }
  }

  // 1. Prefijo explícito: 'precio: 50', 'coste: 50', 'valor: 50', 'precio: 50 e'
  const explicitPrefix = /(?:^|\s|\()(?:precio|coste|valor)\s*:\s*(\d+(?:[.,]\d{1,2})?)(?:\s*(?:€|euros?|eur\.?|\$|usd|e\b))?(?:\s*\)|\s*$|\s*[,;.])/i;
  const expMatch = trimmed.match(explicitPrefix);
  if (expMatch) {
    const val = parseFloat(expMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      const clean = cleanExtractedSnippet(trimmed, explicitPrefix);
      return { price: val, cleanText: clean };
    }
  }

  // 2. Prefijo de divisa: '€50', '€ 50', '$50', 'por €50'
  const prefixCur = /(?:^|\s|\()(?:por\s+|coste\s+|precio\s+)?(?:€|\$)\s*(\d+(?:[.,]\d{1,2})?)(?:\s*\)|\s*$|\s*[,;.])/i;
  const preMatch = trimmed.match(prefixCur);
  if (preMatch) {
    const val = parseFloat(preMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      const clean = cleanExtractedSnippet(trimmed, prefixCur);
      return { price: val, cleanText: clean };
    }
  }

  // 3. Sufijo de divisa: '100 e', '100e', '100 €', '100€', '100 euros', '100 eur', '100$'
  // Protegemos contra la conjunción castellana "e": no hacer match si le sigue una palabra que empieza por 'i' o 'hi' ("10 e ir")
  const suffixCur = /(?:^|\s|\()(?:por\s+|coste\s+|precio\s+)?(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?|eur\.?|\$|usd|e\b)(?:\s*\)|\s*$|\s*[,;.])(?!\s*(?:i\w+|hi\w+))/i;
  const sufMatch = trimmed.match(suffixCur);
  if (sufMatch) {
    const val = parseFloat(sufMatch[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) {
      const clean = cleanExtractedSnippet(trimmed, suffixCur);
      return { price: val, cleanText: clean };
    }
  }

  return null;
}

/**
 * Limpia el fragmento de precio del texto original de forma elegante,
 * eliminando paréntesis vacíos, comas flotantes o espacios redundantes.
 */
function cleanExtractedSnippet(originalText: string, pattern: RegExp): string {
  let result = originalText.replace(pattern, ' ');
  // Eliminar paréntesis que hayan quedado vacíos ej. "Zapatillas ()" -> "Zapatillas"
  result = result.replace(/\(\s*\)/g, ' ');
  // Eliminar comas o guiones huérfanos al final
  result = result.replace(/\s*[,;-]\s*$/g, '');
  // Normalizar espacios múltiples
  result = result.replace(/\s+/g, ' ').trim();
  return result;
}

/**
 * Normaliza una tarea existente o nueva, extrayendo el precio de su título o descripción/nota
 * si no lo tenía parametrizado, y limpiando redundancias.
 */
export function normalizeTaskPrices(task: TaskItem): { task: TaskItem; modified: boolean } {
  let modified = false;
  let price = task.price;
  let title = task.title || '';
  let description = task.description;

  // 1. Si la tarea no tiene precio (o es <= 0), revisar si la nota/descripción lo contiene
  if ((price === undefined || price === null || price <= 0) && description) {
    const noteExtracted = extractPrice(description, true);
    if (noteExtracted && noteExtracted.price > 0) {
      price = noteExtracted.price;
      description = noteExtracted.cleanText || undefined;
      modified = true;
    }
  }

  // 2. Si la tarea aún no tiene precio, revisar si el título lo contiene
  if ((price === undefined || price === null || price <= 0) && title) {
    const titleExtracted = extractPrice(title, false);
    if (titleExtracted && titleExtracted.price > 0) {
      price = titleExtracted.price;
      if (titleExtracted.cleanText) {
        title = titleExtracted.cleanText;
      }
      modified = true;
    }
  }

  // 3. Si el precio ya está fijado (o recién extraído), limpiar redundancia en el título
  // ej: "Ropa interior 100 e" con price = 100 -> title pasa a ser "Ropa interior"
  if (price !== undefined && price > 0 && title) {
    const titleExtracted = extractPrice(title, false);
    if (titleExtracted && titleExtracted.price === price && titleExtracted.cleanText) {
      if (title !== titleExtracted.cleanText) {
        title = titleExtracted.cleanText;
        modified = true;
      }
    }
  }

  // 4. Si la descripción era puramente el precio idéntico, limpiarla para evitar duplicados
  if (price !== undefined && price > 0 && description) {
    const noteExtracted = extractPrice(description, true);
    if (noteExtracted && noteExtracted.price === price && !noteExtracted.cleanText) {
      description = undefined;
      modified = true;
    }
  }

  if (modified) {
    return {
      task: {
        ...task,
        title,
        description,
        price,
        updated_at: new Date().toISOString(),
        _is_dirty: true
      },
      modified: true
    };
  }

  return { task, modified: false };
}
