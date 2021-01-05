import 'source-map-support/register'

import { SQSEvent, SQSHandler } from 'aws-lambda'

import AWS from 'aws-sdk'
import { CredentialsOptions } from 'aws-sdk/lib/credentials'
import { Flusher } from './flush'
import { extractKeys } from './extractor'

export const bootstrap = (
  credentials: CredentialsOptions,
  region: string,
  distributionId: string
): SQSHandler => {
  AWS.config.update({ credentials, region })
  const cloudFront = new AWS.CloudFront()
  const flusher = new Flusher(cloudFront, distributionId)

  return handlerFactory(flusher)
}

const handlerFactory = (flusher: Flusher): SQSHandler => {
  return async (event: SQSEvent): Promise<void> => {
    console.debug(JSON.stringify(event, null, 2))

    let keys = []

    try {
      keys = extractKeys(event.Records)
    } catch (e) {
      console.error('Cannot extract keys from the message', e)
      throw new Error('Invalid payload')
    }

    if (keys.length === 0) {
      console.warn('Empty keys set', JSON.stringify(event, null, 2))
      throw new Error('Empty keys')
    }

    const result = await flusher.flush(keys)
    console.debug(result)
  }
}
