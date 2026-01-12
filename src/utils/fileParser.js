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
  
  // Detectar separador: primero intentar tabulador, luego punto y coma, luego coma
  let separator = ',';
  if (text.includes('\t')) {
    separator = '\t';
  } else if (text.includes(';')) {
    separator = ';';
  }
  
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

