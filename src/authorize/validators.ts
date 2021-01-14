import 'source-map-support/register'

export const MAX_NAME_LENGTH = 100
export const MAX_PICTURE_LENGTH = 50_000
export const SIGNATURE_SIZE = 65
export const MIN_CIPHERTEXT_LENGTH = 128
export const MAX_CIPHERTEXT_LENGTH = 130

export interface UploadValidator {
  match: (path: string) => boolean
  range: () => [number, number]
}

export const validators: UploadValidator[] = [
  {
    match: (path: string) => path === '/account/name' || path === '/account/name.enc',
    range: () => [0, MAX_NAME_LENGTH],
  },
  {
    match: (path: string) => path === '/account/picture' || path === '/account/picture.enc',
    range: () => [0, MAX_PICTURE_LENGTH],
  },
  {
    match: (path: string) => path.endsWith('.signature'),
    range: () => [SIGNATURE_SIZE, SIGNATURE_SIZE],
  },
  {
    match: (path: string) => !!path.match(/\/ciphertexts\/[a-fA-F0-9]+$/),
    range: () => [128, 130],
  },
]
