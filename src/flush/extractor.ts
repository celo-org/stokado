import { S3Event, S3EventRecord, SQSRecord } from 'aws-lambda'

const reducer = (accumulator: string[], sqsRecord: SQSRecord) => {
  const s3Event: S3Event = JSON.parse(sqsRecord.body)
  const keys = s3Event.Records.map((record: S3EventRecord) => `/${record.s3.object.key}`)
  return accumulator.concat(keys)
}

export const extractKeys = (records: SQSRecord[]): string[] => {
  return records.reduce(reducer, [])
}
