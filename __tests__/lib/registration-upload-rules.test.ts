import {
  resolveRegistrationUploadRules,
  uploadContentType,
  uploadExtension,
} from '@/lib/registration-attachment'

describe('resolveRegistrationUploadRules', () => {
  it('uses bank proof defaults when the conference has no file fields', () => {
    expect(resolveRegistrationUploadRules({})).toEqual({
      allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
      maxSizeMb: 10,
    })
  })

  it('adds file field types and the largest field size from settings', () => {
    const rules = resolveRegistrationUploadRules({
      custom_registration_fields: [
        { type: 'text', fileTypes: ['.exe'] },
        { type: 'file', fileTypes: ['.docx', '.txt'], maxFileSize: 25 },
      ],
    })
    expect(rules.allowedExtensions).toEqual(
      expect.arrayContaining(['.pdf', '.jpg', '.jpeg', '.png', '.docx', '.txt'])
    )
    expect(rules.maxSizeMb).toBe(25)
  })

  it('ignores unsafe types even when stored in settings', () => {
    const rules = resolveRegistrationUploadRules({
      custom_registration_fields: [{ type: 'file', fileTypes: ['.html', '.exe', '.svg'] }],
    })
    expect(rules.allowedExtensions).not.toEqual(expect.arrayContaining(['.html']))
    expect(rules.allowedExtensions).not.toContain('.exe')
    expect(rules.allowedExtensions).not.toContain('.svg')
  })

  it('caps a stored field size at 50 MB', () => {
    const rules = resolveRegistrationUploadRules({
      custom_registration_fields: [{ type: 'file', maxFileSize: 5000 }],
    })
    expect(rules.maxSizeMb).toBe(50)
  })

  it('does not let a browser hint widen types or size', () => {
    const rules = resolveRegistrationUploadRules({}, {
      allowedExtensions: ['.html', '.exe'],
      maxFileSizeMb: '500',
    })
    expect(rules.allowedExtensions).toEqual(['.pdf', '.jpg', '.jpeg', '.png'])
    expect(rules.maxSizeMb).toBe(10)
  })

  it('lets a browser hint narrow to one field', () => {
    const rules = resolveRegistrationUploadRules(
      { custom_registration_fields: [{ type: 'file', fileTypes: ['.pdf', '.docx'], maxFileSize: 20 }] },
      { allowedExtensions: ['.docx'], maxFileSizeMb: '5' }
    )
    expect(rules).toEqual({ allowedExtensions: ['.docx'], maxSizeMb: 5 })
  })
})

describe('upload helpers', () => {
  it('reads the last extension in lowercase', () => {
    expect(uploadExtension('Proof.PDF')).toBe('.pdf')
    expect(uploadExtension('archive.pdf.html')).toBe('.html')
    expect(uploadExtension('noextension')).toBe('')
  })

  it('derives the stored content type from the extension', () => {
    expect(uploadContentType('.pdf')).toBe('application/pdf')
    expect(uploadContentType('.jpg')).toBe('image/jpeg')
    expect(uploadContentType('.html')).toBe('application/octet-stream')
  })
})
