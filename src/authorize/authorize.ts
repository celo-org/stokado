import 'source-map-support/register'

import { Err, Ok, Result, RootError } from '@celo/base'

import AWS from 'aws-sdk'
import { validators } from './validators'

export enum AuthorizerErrorTypes {
  InvalidPayload = 'InvalidPayload',
  InvalidUploadPath = 'InvalidUploadPath',
  Unknown = 'Unknown',
}

export class InvalidPayloadError extends RootError<AuthorizerErrorTypes.InvalidPayload> {
  constructor() {
    super(AuthorizerErrorTypes.InvalidPayload)
  }
}

export class InvalidUploadPathError extends RootError<AuthorizerErrorTypes.InvalidUploadPath> {
  constructor() {
    super(AuthorizerErrorTypes.InvalidUploadPath)
  }
}

export type AuthorizerError = InvalidPayloadError | InvalidUploadPathError

export class Authorizer {
  private readonly s3: AWS.S3
  private readonly bucketName: string

  constructor(s3: AWS.S3, bucketName: string) {
    this.s3 = s3
    this.bucketName = bucketName
  }

  authorize = async (
    payload: string,
    expires: number,
    signer: string
  ): Promise<Result<AWS.S3.PresignedPost[], AuthorizerError>> => {
    let items = []
    try {
      items = JSON.parse(payload)
    } catch (e) {
      return Err(new InvalidPayloadError())
    }

    if (!Array.isArray(items) || items.length === 0) {
      return Err(new InvalidPayloadError())
    }

    try {
      return Ok(
        await Promise.all(
          items.map(({ path }) => {
            if (!path) {
              throw new InvalidUploadPathError()
            }

            const validator = validators.find((v) => v.match(path))

            if (!validator) {
              throw new InvalidUploadPathError()
            }

            const [min, max] = validator.range()

            return this.s3.createPresignedPost({
              Bucket: this.bucketName,
              Fields: {
                key: `${signer}${path}`,
              },
              Expires: expires,
              Conditions: [
                ['content-length-range', min, max],
                // ["eq", "$Content-Type", "application/octet-stream"],
              ],
            })
          })
        )
      )
    } catch (e) {
      return Err(e)
    }
  }
}
