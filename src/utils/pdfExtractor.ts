// pdfjs-dist (~2.2MB con su worker) solo se descarga cuando de verdad se importa un PDF,
// en vez de en el bundle principal: la mayoría de sesiones nunca usan este flujo.
let pdfjsLibPromise: Promise<typeof import('pdfjs-dist')> | null = null;
function loadPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import('pdfjs-dist').then((pdfjsLib) => {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.mjs',
          import.meta.url
        ).toString();
      } catch {
        // Si falla la resolución de URL, pdfjs intentará usar el worker por defecto
      }
      return pdfjsLib;
    });
  }
  return pdfjsLibPromise;
}

/**
 * Extrae todo el texto plano de un archivo PDF (ArrayBuffer o File).
 */
export async function extractTextFromPdf(input: ArrayBuffer | File | Uint8Array): Promise<string> {
  const pdfjsLib = await loadPdfjs();
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
