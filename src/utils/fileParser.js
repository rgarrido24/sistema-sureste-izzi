import * as XLSX from 'xlsx';

/**
 * Parsea un archivo CSV
 * Maneja diferentes separadores (coma, punto y coma, tabulador) y codificaciones
 */
export function parseCSV(text) {
  // Remover BOM (Byte Order Mark) si existe
  if (text.charCodeAt(0) === 0xFEFF) {
    text = text.slice(1);
  }
  
  // Detectar separador de forma robusta (cuenta delimitadores fuera de comillas)
  const detectSeparator = (raw) => {
    const candidates = ['\t', ';', ','];
    const lines = raw.split(/\r?\n/).slice(0, 20);

    const countDelimsOutsideQuotes = (line, delim) => {
      let inQuotes = false;
      let count = 0;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const next = line[i + 1];
        if (ch === '"') {
          if (inQuotes && next === '"') {
            i++; // skip escaped quote
          } else {
            inQuotes = !inQuotes;
          }
        } else if (!inQuotes && ch === delim) {
          count++;
        }
      }
      return count;
    };

    // Promedio de delimitadores por línea (solo líneas con contenido)
    const scores = candidates.map((d) => {
      let total = 0;
      let used = 0;
      for (const line of lines) {
        if (!line || !line.trim()) continue;
        total += countDelimsOutsideQuotes(line, d);
        used++;
      }
      return { delim: d, score: used ? total / used : 0 };
    });

    scores.sort((a, b) => b.score - a.score);
    // Si todos son 0, default coma
    return scores[0]?.score > 0 ? scores[0].delim : ',';
  };

  const separator = detectSeparator(text);

  // Parseo de una sola pasada, respetando comillas que pueden contener
  // saltos de línea (ej. columna "Comentarios" con texto multilínea).
  // Partir el texto por \n antes de tiempo rompe esas filas en varias
  // y descuadra las columnas — por eso se procesa carácter por carácter
  // sobre el texto completo, y solo se cierra una fila con un salto de
  // línea que esté FUERA de comillas.
  const arr = [];
  let row = [];
  let current = '';
  let inQuotes = false;

  const pushCell = () => {
    row.push(current.trim());
    current = '';
  };
  const pushRow = () => {
    pushCell();
    if (row.some(col => col.length > 0)) {
      arr.push(row);
    }
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Saltar la comilla escapada
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === separator && !inQuotes) {
      pushCell();
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      // Saltar \r suelto (viene junto con \n en CRLF) sin cerrar fila con él
      if (char === '\r' && nextChar === '\n') continue;
      pushRow();
    } else {
      current += char;
    }
  }
  // Última fila si el archivo no termina en salto de línea
  if (current.length > 0 || row.length > 0) {
    pushRow();
  }

  return arr;
}

/**
 * Parsea un archivo Excel
 */
export function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Leer como array de arrays (mantiene los headers como primera fila)
  const data = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1, 
    defval: '',
    raw: false // Convertir números a strings
  });
  
  return data;
}

