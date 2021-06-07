import AWS from 'aws-sdk'
import AWSMock from 'aws-sdk-mock'
import { Flusher } from './flush'

describe('flush', () => {
  it('creates invalidation request', async () => {
    const distributionId = 'distribution'
    const keys = ['/some/key']

    const expectedInvalidationResult = { ok: true }
    AWSMock.setSDKInstance(AWS)
    AWSMock.mock(
      'CloudFront',
      'createInvalidation',
      (params: AWS.CloudFront.Types.CreateInvalidationRequest, callback) => {
        expect(params.DistributionId).toBe(distributionId)
        expect(params.InvalidationBatch.CallerReference).toEqual('invalidation-unique-message-id')
        expect(params.InvalidationBatch.Paths.Quantity).toBe(1)
        expect(params.InvalidationBatch.Paths.Items).toEqual(keys)
        callback(null, expectedInvalidationResult)
      }
    )

    const cdn = new AWS.CloudFront()

    const flusher = new Flusher(cdn, distributionId)
    const result = await flusher.flush(keys, 'unique-message-id')

    expect(result).toBe(expectedInvalidationResult)
    AWSMock.restore('CloudFront')
  })
})
