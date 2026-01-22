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
  
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  if (lines.length === 0) {
    return [];
  }
  
  const arr = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const row = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const nextChar = line[j + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Comillas dobles escapadas
          current += '"';
          j++; // Saltar el siguiente carácter
        } else {
          // Toggle de comillas
          inQuotes = !inQuotes;
        }
      } else if (char === separator && !inQuotes) {
        // Separador encontrado (fuera de comillas)
        row.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Agregar la última columna
    row.push(current.trim());
    
    // Solo agregar filas que tengan al menos una columna con contenido
    if (row.length > 0 && row.some(col => col.length > 0)) {
      arr.push(row);
    }
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

