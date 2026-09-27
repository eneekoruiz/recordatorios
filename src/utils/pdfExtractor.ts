import * as pdfjsLib from 'pdfjs-dist';

// En Vite, el worker de pdfjs se puede cargar como URL o usar el worker empaquetado
if (typeof window !== 'undefined') {
  try {
    // Intentar configurar worker si está disponible
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.mjs',
      import.meta.url
    ).toString();
  } catch {
    // Si falla la resolución de URL, pdfjs intentará usar el worker por defecto
  }
}

/**
 * Extrae todo el texto plano de un archivo PDF (ArrayBuffer o File).
 */
export async function extractTextFromPdf(input: ArrayBuffer | File | Uint8Array): Promise<string> {
  let data: ArrayBuffer | Uint8Array;
  if (input instanceof Uint8Array || input instanceof ArrayBuffer) {
    data = input;
  } else {
    data = await input.arrayBuffer();
  }

  const loadingTask = pdfjsLib.getDocument({
    data: data instanceof Uint8Array ? data : new Uint8Array(data),
    useWorkerFetch: false,
    useSystemFonts: true
  });

  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const pageTexts: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    const strings: string[] = [];
    
    for (const item of content.items) {
      if ('str' in item) {
        strings.push(item.str);
      }
    }
    
    pageTexts.push(strings.join(' '));
  }

  return pageTexts.join('\n\n');
}
