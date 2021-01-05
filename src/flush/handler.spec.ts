// import { APIGatewayProxyEventHeaders } from 'aws-lambda'
import { S3EventRecord, SQSEvent, SQSRecord } from 'aws-lambda'

import AWS from 'aws-sdk'
import AWSMock from 'aws-sdk-mock'
import { bootstrap } from '@app/flush/bootstrap'
import { handle } from '@app/flush/handler'

describe('flush handler', () => {
  const key = '0x2104243428e1b04fFe63854ddBc279D183CF076a/account/name.signature'
  const distributionId = 'distribution'

  const getHandler = () =>
    bootstrap(
      {
        accessKeyId: 'accessKeyId',
        secretAccessKey: 'secretAccessKey',
        sessionToken: 'sessionToken',
      },
      'eu-west-1',
      distributionId
    )

  const getEvent = (records: SQSRecord[]): SQSEvent => ({
    Records: records,
  })

  const getS3Record = (key: string): S3EventRecord => ({
    eventVersion: '2.1',
    eventSource: 'aws:s3',
    awsRegion: 'eu-west-1',
    eventTime: '2020-12-21T23:33:20.743Z',
    eventName: 'ObjectCreated:Post',
    userIdentity: {
      principalId: 'AWS:AROATRTUR2LSAVH4KPS2G:stokado-dev-authorize',
    },
    requestParameters: { sourceIPAddress: '138.199.18.164' },
    responseElements: {
      'x-amz-request-id': 'DB41007A89B7D131',
      'x-amz-id-2':
        'cpJIgP4bjuKSiAmisOQRIHgP9BXftdEemBvneIHO3CCROHWQEJl8+ITNXbMTHLeuX7xDGZ0a5oRNUeckZwezB/8WCFtDtTaM',
    },
    s3: {
      s3SchemaVersion: '1.0',
      configurationId: 'ceadd2cd-90f4-4375-afbf-6765799f849c',
      bucket: {
        name: 'stokado-storage-dev',
        ownerIdentity: { principalId: 'AFQ05OLX7Y4BA' },
        arn: 'arn:aws:s3:::stokado-storage-dev',
      },
      object: {
        key,
        size: key.length,
        eTag: 'beb9f48bc802ca5ca043bcc15e219a5a',
        sequencer: '005FE130C50A8E108C',
      },
    },
  })

  const getSQSRecord = (body: string): SQSRecord => ({
    messageId: '8aa4f5f9-5ff4-44a6-819e-9561fd7c7027',
    receiptHandle:
      'AQEBKYJc1CPDc+ov6FYLuCAb+AP3ayBwPjsx8rb2CufozoiQESI0RlaNH/IZOfYe37z4N4bejWXELeokOfqZzUGsQZkdJszNe2PxJCSl/CNGHfn1uf3J4uL6riKWEn2LcEQlrYvdrCWxVxnwDZyAbLGJDyDLH0k3Im85QOnb5/L/95FVWoy+E2eA3x65HuOKocIH+FM9/kvPEI6y4qO9BZag34v5yCaImrWjmk/vG5DSPtEeWrJOJANBRyBV4BIjGH2VdfuBvNuaRID98jNMjOcNTBuPyLdEwML1sIE5K7vJ1/3OvoeXzAr258em9qXrdVv9NVQP7hKujhL/HHt2G+boORDAs1OXLra0+FYNAnxkXAb+7a8NIktIVZpV+VOerf+EcH0dbinfRPvGlVEfHX4JOWQF+q7kvyTZ3UtM2vGEVQA=',
    body,
    attributes: {
      ApproximateReceiveCount: '1',
      SentTimestamp: '2020-01-01',
      SenderId: 'sender',
      ApproximateFirstReceiveTimestamp: '2020-01-01',
    },
    messageAttributes: {},
    md5OfBody: '788cf1c20e96f312ee55f2db40a30923',
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn:aws:sqs:eu-west-1:243983831780:FileUpdatesQueue-dev-eu-west-1',
    awsRegion: 'eu-west-1',
  })

  it('throws for invalid payload', async () => {
    const handler = getHandler()
    const event = getEvent([getSQSRecord('')])

    await expect(handler(event, null, null)).rejects.toThrow('Invalid payload')
  })

  it('it ignores empty events', async () => {
    const handler = getHandler()
    const event = getEvent([
      getSQSRecord(
        JSON.stringify({
          Records: [],
        })
      ),
    ])

    await expect(handler(event, null, null)).rejects.toThrow('Empty keys')
  })

  it('handles valid payload', async () => {
    AWSMock.setSDKInstance(AWS)

    AWSMock.mock(
      'CloudFront',
      'createInvalidation',
      (params: AWS.CloudFront.Types.CreateInvalidationRequest, callback) => {
        expect(params.DistributionId).toEqual(distributionId)
        expect(params.InvalidationBatch.CallerReference).toContain('invalidation-')
        expect(params.InvalidationBatch.Paths.Quantity).toEqual(1)
        expect(params.InvalidationBatch.Paths.Items).toEqual([`/${key}`])

        callback(null, 'successfulMock')
      }
    )

    const handler = getHandler()
    const event = getEvent([
      getSQSRecord(
        JSON.stringify({
          Records: [getS3Record(key)],
        })
      ),
    ])

    await handler(event, null, null)

    AWSMock.restore('CloudFront')
  })

  it('uses bootstrapped handler', async () => {
    expect(handle).toBeInstanceOf(Function)
  })
})
