/**
 * The proforma must embed a Unicode font so Croatian characters can render.
 * jsPDF stores custom-font text as glyph ids, so we assert the font embed
 * and that generation succeeds with č/ć/š/ž/đ in the payload.
 */
import fs from 'fs'
import { generateProformaInvoicePdf } from '@/lib/registration-proforma-pdf'

describe('generateProformaInvoicePdf', () => {
  it('embeds Noto Sans and accepts Croatian characters without throwing', () => {
    const pdf = generateProformaInvoicePdf({
      locale: 'hr',
      conferenceName: 'IST 2027',
      registrationNumber: 'REG-001-test',
      issueDate: new Date('2026-11-19T12:00:00Z'),
      dueDate: new Date('2026-11-26T12:00:00Z'),
      billToName: 'Ivan Horvat',
      billToEmail: 'ivan@example.com',
      issuerName: 'e-Tours d.o.o.',
      iban: 'HR6524840081100145534',
      bankName: 'Zagrebačka banka',
      swiftBic: 'ZABAHR2X',
      currency: 'EUR',
      paymentReference: 'REG-001-test',
      lineItems: [{ description: 'Sudionik (do 31. 3. 2027.)', amount: 500 }],
    })

    expect(pdf.subarray(0, 4).toString('ascii')).toBe('%PDF')
    const raw = pdf.toString('latin1')
    expect(raw).toContain('NotoSans')
    // Regular + Bold TTF are embedded; Helvetica-only PDFs were ~5 KB.
    expect(pdf.length).toBeGreaterThan(100_000)

    if (process.env.WRITE_PROFORMA_SAMPLE === '1') {
      fs.writeFileSync('/tmp/proforma-hr-sample.pdf', pdf)
    }
  })
})
