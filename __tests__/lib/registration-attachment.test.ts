import {
  findStoredAttachmentPath,
  parseRegistrationAttachmentPath,
} from '@/lib/registration-attachment'

const conferenceId = '11111111-1111-4111-8111-111111111111'
const filePath = `${conferenceId}/1710000000000_proof.pdf`
const publicUrl = `https://example.supabase.co/storage/v1/object/public/registration-attachments/${filePath}`

describe('registration attachment references', () => {
  it('reads a legacy public URL and a stored path as the same object', () => {
    expect(parseRegistrationAttachmentPath(publicUrl)).toBe(filePath)
    expect(parseRegistrationAttachmentPath(filePath)).toBe(filePath)
    expect(
      findStoredAttachmentPath(
        { bank_transfer_proof_url: publicUrl },
        filePath,
        conferenceId
      )
    ).toBe(filePath)
  })

  it('rejects another bucket, traversal, and a path that is not stored on the registration', () => {
    expect(
      parseRegistrationAttachmentPath(
        'https://example.supabase.co/storage/v1/object/public/abstracts/file.pdf'
      )
    ).toBeNull()
    expect(parseRegistrationAttachmentPath(`${conferenceId}/../proof.pdf`)).toBeNull()
    expect(
      parseRegistrationAttachmentPath(
        `https://example.supabase.co/storage/v1/object/public/registration-attachments/${conferenceId}/%2e%2e`
      )
    ).toBeNull()
    expect(parseRegistrationAttachmentPath(`${publicUrl}%E0%A4%A`)).toBeNull()
    expect(
      findStoredAttachmentPath(
        { bank_transfer_proof_url: publicUrl },
        `${conferenceId}/1710000000000_other.pdf`,
        conferenceId
      )
    ).toBeNull()
    expect(
      findStoredAttachmentPath(
        { bank_transfer_proof_url: publicUrl },
        publicUrl,
        '22222222-2222-4222-8222-222222222222'
      )
    ).toBeNull()
  })

  it('accepts a file reference saved inside custom registration data', () => {
    expect(
      findStoredAttachmentPath(
        { custom_data: { passport: publicUrl } },
        publicUrl,
        conferenceId
      )
    ).toBe(filePath)
  })
})
