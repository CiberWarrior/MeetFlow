import fs from 'fs'
import path from 'path'
import type jsPDF from 'jspdf'

export const PDF_UNICODE_FONT = 'NotoSans'

let regularBase64: string | null = null
let boldBase64: string | null = null

function loadFontBase64(fileName: string): string {
  const fontPath = path.join(process.cwd(), 'assets', 'fonts', fileName)
  return fs.readFileSync(fontPath).toString('base64')
}

/**
 * Registers Noto Sans on a jsPDF document so Latin Extended text
 * (Croatian č, ć, š, ž, đ and similar) can be drawn.
 */
export function registerUnicodeFont(doc: jsPDF): void {
  if (!regularBase64) regularBase64 = loadFontBase64('NotoSans-Regular.ttf')
  if (!boldBase64) boldBase64 = loadFontBase64('NotoSans-Bold.ttf')

  doc.addFileToVFS('NotoSans-Regular.ttf', regularBase64)
  doc.addFont('NotoSans-Regular.ttf', PDF_UNICODE_FONT, 'normal')
  doc.addFileToVFS('NotoSans-Bold.ttf', boldBase64)
  doc.addFont('NotoSans-Bold.ttf', PDF_UNICODE_FONT, 'bold')
  doc.setFont(PDF_UNICODE_FONT, 'normal')
}
