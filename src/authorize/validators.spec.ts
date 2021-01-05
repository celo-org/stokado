import {
  MAX_CIPHERTEXT_LENGTH,
  MAX_NAME_LENGTH,
  MAX_PICTURE_LENGTH,
  MIN_CIPHERTEXT_LENGTH,
  SIGNATURE_SIZE,
  validators,
} from '@app/authorize/validators'

describe('authorizer', () => {
  it('validates names', async () => {
    const validator = validators.find((v) => v.match('/account/name'))
    expect(validator).not.toBeUndefined()
    const [, max] = validator.range()
    expect(max).toBe(MAX_NAME_LENGTH)
  })

  it('allows sigantures', async () => {
    const validator = validators.find((v) => v.match('/something/blah.signature'))
    expect(validator).not.toBeUndefined()

    const [min, max] = validator.range()
    expect(min).toEqual(max)
    expect(max).toEqual(SIGNATURE_SIZE)
  })

  it('allows pictures', async () => {
    const validator = validators.find((v) => v.match('/account/picture'))
    expect(validator).not.toBeUndefined()

    const [, max] = validator.range()
    expect(max).toEqual(MAX_PICTURE_LENGTH)
  })

  it('allows ciphertexts', async () => {
    const validator = validators.find((v) => v.match('/ciphertexts/abCdeF01234'))
    expect(validator).not.toBeUndefined()

    const [min, max] = validator.range()
    expect(min).toEqual(MIN_CIPHERTEXT_LENGTH)
    expect(max).toEqual(MAX_CIPHERTEXT_LENGTH)
  })

  it('validates ciphertexts format', async () => {
    const validator = validators.find((v) => v.match('/ciphertexts/asdf'))
    expect(validator).toBeUndefined()
  })
})
