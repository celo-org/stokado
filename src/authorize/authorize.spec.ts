import { Authorizer, AuthorizerErrorTypes } from '@app/authorize/authorize'

import AWS from 'aws-sdk'
import AWSMock from 'aws-sdk-mock'

describe('authorizer', () => {
  const s3 = new AWS.S3()
  const bucket = 'bucket'
  const signer = 'signer'
  const expiresInSeconds = 10
  const authorizer = new Authorizer(s3, bucket)

  it('returns error for invalid json payload', async () => {
    const result = await authorizer.authorize(null, expiresInSeconds, signer)
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.error.errorType).toEqual(AuthorizerErrorTypes.InvalidPayload)
    }
  })

  it('returns error for empty array payload', async () => {
    const result = await authorizer.authorize([], expiresInSeconds, signer)
    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.error.errorType).toEqual(AuthorizerErrorTypes.InvalidPayload)
    }
  })

  it('returns error if one of the paths is unknown', async () => {
    const result = await authorizer.authorize(
      [{ path: '/something/random' }, { path: '/account/name' }],
      expiresInSeconds,
      signer
    )

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.error.errorType).toEqual(AuthorizerErrorTypes.InvalidUploadPath)
    }
  })

  it('returns error if one of the paths is absent', async () => {
    const paths = JSON.parse('[{"notpath": "/account/name.signature"}, {"path": "/account/name"}]')
    const result = await authorizer.authorize(paths, expiresInSeconds, signer)

    expect(result.ok).toBe(false)
    if (result.ok === false) {
      expect(result.error.errorType).toEqual(AuthorizerErrorTypes.InvalidUploadPath)
    }
  })

  it('returns result if input is valid', async () => {
    const key = '/account/name'
    const expectedParameters = {
      Bucket: bucket,
      Fields: { key: `${signer}${key}` },
      Expires: expiresInSeconds,
      Conditions: [['content-length-range', 0, 100]],
    }

    AWSMock.setSDKInstance(AWS)
    AWSMock.mock('S3', 'createPresignedPost', (params: AWS.S3.PresignedPost.Params, callback) => {
      expect(params).toEqual(expectedParameters)
      callback(null, 'successfulMock')
    })

    const newAuthorizer = new Authorizer(new AWS.S3(), bucket)
    const result = await newAuthorizer.authorize([{ path: `${key}` }], expiresInSeconds, signer)

    expect(result.ok).toBe(true)
    AWSMock.restore('S3')
  })
})
