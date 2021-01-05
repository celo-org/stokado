import { S3EventRecord, SQSRecord } from 'aws-lambda'

import { extractKeys } from '@app/flush/extractor'

describe('extractor', () => {
  const getS3EventRecord = (key: string): S3EventRecord => ({
    eventVersion: '2.1',
    eventSource: 'aws:s3',
    awsRegion: 'eu-west-1',
    eventTime: '2020-12-21T23:33:20.743Z',
    eventName: 'ObjectCreated:Post',
    userIdentity: {
      principalId: 'AWS:AROATRTUR2LSAVH4KPS2G:stokado-dev-authorize',
    },
    requestParameters: {
      sourceIPAddress: '138.199.18.164',
    },
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
        ownerIdentity: {
          principalId: 'AFQ05OLX7Y4BA',
        },
        arn: 'arn:aws:s3:::stokado-storage-dev',
      },
      object: {
        key,
        size: 65,
        eTag: 'beb9f48bc802ca5ca043bcc15e219a5a',
        sequencer: '005FE130C50A8E108C',
      },
    },
  })

  const getSqsRecord = (body: string): SQSRecord => ({
    messageId: '8aa4f5f9-5ff4-44a6-819e-9561fd7c7027',
    receiptHandle: 'handle',
    body,
    attributes: {
      ApproximateReceiveCount: '1',
      SentTimestamp: 'timestamp',
      SenderId: 'sender',
      ApproximateFirstReceiveTimestamp: 'timestamp',
    },
    messageAttributes: {},
    md5OfBody: '788cf1c20e96f312ee55f2db40a30923',
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn:aws:sqs:eu-west-1:243983831780:FileUpdatesQueue-dev-eu-west-1',
    awsRegion: 'eu-west-1',
  })

  it('extracts keys correctly from one sqs record with two s3 events', async () => {
    const keys = extractKeys([
      getSqsRecord(
        JSON.stringify({
          Records: [
            getS3EventRecord('signer/account/name'),
            getS3EventRecord('signer/account/name.signature'),
          ],
        })
      ),
    ])
    expect(keys.sort()).toEqual(['/signer/account/name', '/signer/account/name.signature'].sort())
  })

  it('extracts keys correctly from two sqs records with one s3 event each', async () => {
    const keys = extractKeys([
      getSqsRecord(
        JSON.stringify({
          Records: [getS3EventRecord('signer/account/name')],
        })
      ),
      getSqsRecord(
        JSON.stringify({
          Records: [getS3EventRecord('signer/account/name.signature')],
        })
      ),
    ])
    expect(keys.sort()).toEqual(['/signer/account/name', '/signer/account/name.signature'].sort())
  })
})
