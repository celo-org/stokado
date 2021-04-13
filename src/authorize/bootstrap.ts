import 'source-map-support/register'

import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda'

import AWS from 'aws-sdk'
import { Authorizer } from './authorize'
import { CredentialsOptions } from 'aws-sdk/lib/credentials'
import { guessSigner } from '@celo/utils/lib/signatureUtils'
import { makeAsyncThrowable } from '@celo/base'
import { newKit } from '@celo/contractkit'
import { publicKeyToAddress } from '@celo/utils/lib/address'
import { toChecksumAddress } from 'ethereumjs-util'

export const bootstrap = (
  credentials: CredentialsOptions,
  region: string,
  expiresIn: number,
  bucketName: string,
  fornoUrl: string
): APIGatewayProxyHandler => {
  AWS.config.update({ credentials, region })
  const s3 = new AWS.S3({ useAccelerateEndpoint: true })
  const authorizer = new Authorizer(s3, bucketName)

  return handlerFactory(authorizer, expiresIn, fornoUrl)
}

const response = (statusCode: number, body: string): APIGatewayProxyResult => {
  return {
    statusCode,
    body,
  }
}

const handlerFactory = (
  authorizer: Authorizer,
  expiresIn: number,
  fornoUrl: string
): APIGatewayProxyHandler => {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    console.debug(event)

    const { headers, body: payload } = event
    const signature = headers.signature || headers.Signature

    if (!signature) {
      return response(401, 'Signature required')
    }

    try {
      const { address, data, signer } = JSON.parse(payload)

      const guessedSigner = toChecksumAddress(guessSigner(payload, signature))

      const kit = newKit(fornoUrl)
      const accounts = await kit.contracts.getAccounts()
      const DEK = await accounts.getDataEncryptionKey(address)

      if (guessedSigner !== publicKeyToAddress(DEK)) {
        console.info(
          `Guessed signer ${guessedSigner} !== address of DEK ${publicKeyToAddress(DEK)}`
        )
        return response(403, 'Invalid signature provided')
      }

      if (signer !== publicKeyToAddress(DEK)) {
        console.info(`Provided signer ${signer} !== address of DEK ${publicKeyToAddress(DEK)}`)
        return response(403, 'Invalid signer provided')
      }

      try {
        const signedUrls = await makeAsyncThrowable(authorizer.authorize)(
          data,
          expiresIn,
          guessedSigner
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
