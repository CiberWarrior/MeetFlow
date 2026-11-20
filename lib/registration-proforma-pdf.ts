import jsPDF from 'jspdf'
import { PDF_UNICODE_FONT, registerUnicodeFont } from '@/lib/pdf-unicode-font'

export interface ProformaLineItem {
  description: string
  amount: number
}

export interface ProformaInvoiceInput {
  locale: 'hr' | 'en'
  conferenceName: string
  registrationNumber: string
  issueDate: Date
  dueDate?: Date | null
  billToName: string
  billToEmail?: string | null
  billToVat?: string | null
  billToAddress?: string | null
  issuerName: string
  issuerAddress?: string | null
  iban: string
  bankName?: string | null
  swiftBic?: string | null
  currency: string
  paymentModel?: string | null
  paymentReference?: string | null
  paymentDescription?: string | null
  lineItems: ProformaLineItem[]
  vatPercentage?: number | null
}

const LABELS = {
  en: {
    title: 'PROFORMA INVOICE',
    number: 'Proforma no.',
    date: 'Issue date',
    dueDate: 'Payment due',
    billTo: 'Bill to',
    issuer: 'Payment to',
    description: 'Description',
    amount: 'Amount',
    total: 'Total',
    paymentDetails: 'Payment instructions',
    recipient: 'Recipient',
    model: 'Model',
    reference: 'Payment reference',
    paymentDescription: 'Payment description',
    vatNote: 'Prices include VAT ({vat}%)',
    footer: 'Please quote the payment reference when transferring.',
  },
  hr: {
    title: 'PREDRAČUN',
    number: 'Broj predračuna',
    date: 'Datum izdavanja',
    dueDate: 'Rok plaćanja',
    billTo: 'Kupac',
    issuer: 'Primatelj uplate',
    description: 'Opis',
    amount: 'Iznos',
    total: 'Ukupno',
    paymentDetails: 'Podaci za uplatu',
    recipient: 'Primatelj',
    model: 'Model',
    reference: 'Poziv na broj',
    paymentDescription: 'Opis plaćanja',
    vatNote: 'Cijene uključuju PDV ({vat}%)',
    footer: 'Pri uplati navedite model i poziv na broj.',
  },
} as const

function formatDate(date: Date, locale: 'hr' | 'en'): string {
  return date.toLocaleDateString(locale === 'hr' ? 'hr-HR' : 'en-GB')
}

function formatMoney(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`
}

function setPdfFont(doc: jsPDF, style: 'normal' | 'bold' = 'normal') {
  doc.setFont(PDF_UNICODE_FONT, style)
}

export function generateProformaInvoicePdf(input: ProformaInvoiceInput): Buffer {
  const t = LABELS[input.locale]
  const doc = new jsPDF()
  registerUnicodeFont(doc)
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20
  let y = margin

  doc.setFontSize(18)
  setPdfFont(doc, 'bold')
  doc.text(t.title, margin, y)
  y += 10

  doc.setFontSize(10)
  setPdfFont(doc, 'normal')
  doc.text(`${t.number}: ${input.registrationNumber}`, margin, y)
  y += 5
  doc.text(`${t.date}: ${formatDate(input.issueDate, input.locale)}`, margin, y)
  y += 5
  if (input.dueDate) {
    doc.text(`${t.dueDate}: ${formatDate(input.dueDate, input.locale)}`, margin, y)
    y += 5
  }
  doc.text(input.conferenceName, margin, y)
  y += 12

  setPdfFont(doc, 'bold')
  doc.text(t.billTo, margin, y)
  y += 6
  setPdfFont(doc, 'normal')
  doc.text(input.billToName, margin, y)
  y += 5
  if (input.billToEmail) {
    doc.text(input.billToEmail, margin, y)
    y += 5
  }
  if (input.billToVat) {
    doc.text(`VAT/OIB: ${input.billToVat}`, margin, y)
    y += 5
  }
  if (input.billToAddress) {
    const lines = doc.splitTextToSize(input.billToAddress, pageWidth - margin * 2)
    doc.text(lines, margin, y)
    y += lines.length * 5
  }
  y += 6

  setPdfFont(doc, 'bold')
  doc.text(t.description, margin, y)
  doc.text(t.amount, pageWidth - margin, y, { align: 'right' })
  y += 4
  doc.line(margin, y, pageWidth - margin, y)
  y += 6

  setPdfFont(doc, 'normal')
  let total = 0
  for (const item of input.lineItems) {
    total += item.amount
    const descLines = doc.splitTextToSize(item.description, pageWidth - margin * 2 - 40)
    doc.text(descLines, margin, y)
    doc.text(formatMoney(item.amount, input.currency), pageWidth - margin, y, { align: 'right' })
    y += Math.max(descLines.length * 5, 6)
  }

  y += 2
  doc.line(margin, y, pageWidth - margin, y)
  y += 6
  setPdfFont(doc, 'bold')
  doc.text(t.total, pageWidth - margin - 45, y)
  doc.text(formatMoney(total, input.currency), pageWidth - margin, y, { align: 'right' })
  y += 10

  if (input.vatPercentage) {
    setPdfFont(doc, 'normal')
    doc.setFontSize(9)
    doc.text(t.vatNote.replace('{vat}', String(input.vatPercentage)), margin, y)
    y += 8
  }

  doc.setFontSize(11)
  setPdfFont(doc, 'bold')
  doc.text(t.paymentDetails, margin, y)
  y += 7
  doc.setFontSize(10)
  setPdfFont(doc, 'normal')
  doc.text(`${t.recipient}: ${input.issuerName}`, margin, y)
  y += 5
  if (input.issuerAddress) {
    const lines = doc.splitTextToSize(input.issuerAddress, pageWidth - margin * 2)
    doc.text(lines, margin, y)
    y += lines.length * 5
  }
  doc.text(`IBAN: ${input.iban}`, margin, y)
  y += 5
  if (input.bankName) {
    doc.text(`${input.locale === 'hr' ? 'Banka' : 'Bank'}: ${input.bankName}`, margin, y)
    y += 5
  }
  if (input.swiftBic) {
    doc.text(`SWIFT/BIC: ${input.swiftBic}`, margin, y)
    y += 5
  }
  if (input.paymentModel) {
    doc.text(`${t.model}: ${input.paymentModel}`, margin, y)
    y += 5
  }
  if (input.paymentReference) {
    doc.text(`${t.reference}: ${input.paymentReference}`, margin, y)
    y += 5
  }
  if (input.paymentDescription) {
    doc.text(`${t.paymentDescription}: ${input.paymentDescription}`, margin, y)
    y += 5
  }
  doc.text(`${t.amount}: ${formatMoney(total, input.currency)}`, margin, y)
  y += 8

  doc.setFontSize(9)
  doc.setTextColor(90, 90, 90)
  doc.text(t.footer, margin, y)

  return Buffer.from(doc.output('arraybuffer'))
}
