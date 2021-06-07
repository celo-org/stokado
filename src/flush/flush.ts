import 'source-map-support/register'

import AWS from 'aws-sdk'
import { PromiseResult } from 'aws-sdk/lib/request'

export class Flusher {
  private readonly cdn: AWS.CloudFront
  private readonly distributionId: string

  constructor(cdn: AWS.CloudFront, distributionId: string) {
    this.cdn = cdn
    this.distributionId = distributionId
  }

  flush(
    keys: string[],
    messageId: string
  ): Promise<PromiseResult<AWS.CloudFront.CreateInvalidationResult, AWS.AWSError>> {
    console.debug('Flushing the keys', keys)

    const invalidationRequest = this.createInvalidationRequest(
      keys,
      this.getInvalidationReference(messageId),
      this.distributionId
    )
    console.debug(invalidationRequest)

    return this.cdn.createInvalidation(invalidationRequest).promise()
  }

  private getInvalidationReference(messageId: string): string {
    return `invalidation-${messageId}`
  }

  private createInvalidationRequest(
    keys: string[],
    callerReference: string,
    distributionId: string
  ): AWS.CloudFront.Types.CreateInvalidationRequest {
    return {
      DistributionId: distributionId,
      InvalidationBatch: {
        CallerReference: callerReference,
        Paths: {
          Quantity: keys.length,
          Items: keys,
        },
      },
    }
  }
}
