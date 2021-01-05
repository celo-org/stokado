import 'source-map-support/register'

import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda'

import AWS from 'aws-sdk'
import { Authorizer } from './authorize'
import { CredentialsOptions } from 'aws-sdk/lib/credentials'
import { guessSigner } from '@celo/utils/lib/signatureUtils'
import { makeAsyncThrowable } from '@celo/base'
import { toChecksumAddress } from 'ethereumjs-util'

export const bootstrap = (
  credentials: CredentialsOptions,
  region: string,
  expiresIn: number,
  bucketName: string
): APIGatewayProxyHandler => {
  AWS.config.update({ credentials, region })
  const s3 = new AWS.S3({ useAccelerateEndpoint: true })
  const authorizer = new Authorizer(s3, bucketName)

  return handlerFactory(authorizer, expiresIn)
}

const response = (statusCode: number, body: string): APIGatewayProxyResult => {
  return {
    statusCode,
    body,
  }
}

const handlerFactory = (authorizer: Authorizer, expiresIn: number): APIGatewayProxyHandler => {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.debug(event)

    const { headers, body: payload } = event
    const signature = headers.signature || headers.Signature

    if (!signature) {
      return response(401, 'Signature required')
    }

    let signer = ''
    try {
      signer = toChecksumAddress(guessSigner(payload, signature))
      console.debug('Guessed signer is', signer)
    } catch (e) {
      return response(403, 'Invalid signature provided')
    }

    try {
      const signedUrls = await makeAsyncThrowable(authorizer.authorize)(payload, expiresIn, signer)
      return response(200, JSON.stringify(signedUrls))
    } catch (e) {
      return response(400, e.errorType)
    }
  }
}
