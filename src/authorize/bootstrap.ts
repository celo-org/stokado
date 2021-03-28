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

    try {
      const typedData = JSON.parse(payload)
      const { signer, data, address } = typedData.message.payload

      const claimedSigner = toChecksumAddress(signer)
      const guessedSigner = toChecksumAddress(guessSigner(payload, signature))

      if (claimedSigner !== guessedSigner) {
        console.info(`Guessed signer ${guessedSigner} !== claimed signer ${claimedSigner}`)
        return response(403, 'Invalid signature provided')
      }

      try {
        const signedUrls = await makeAsyncThrowable(authorizer.authorize)(
          data,
          expiresIn,
          toChecksumAddress(address)
        )
        return response(200, JSON.stringify(signedUrls))
      } catch (e) {
        console.error(e)
        return response(400, e.errorType)
      }
    } catch (e) {
      console.debug(e)
      return response(400, 'Invalid request')
    }
  }
}
