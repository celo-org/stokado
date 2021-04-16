import 'source-map-support/register'
import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda'
import AWS from 'aws-sdk'
import { Authorizer } from './authorize'
import { CredentialsOptions } from 'aws-sdk/lib/credentials'
import { OffchainDataWrapper } from '@celo/identity/lib/offchain-data-wrapper'
import { buildEIP712TypedData } from '@celo/identity/lib/offchain/utils'
import { makeAsyncThrowable } from '@celo/base'
import { newKit } from '@celo/contractkit'
import { publicKeyToAddress } from '@celo/utils/lib/address'
import { verifyEIP712TypedDataSigner } from '@celo/utils/lib/signatureUtils'

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
      const { address, data, signer, expiration } = JSON.parse(payload)

      const isNumeric = (value) => /^-?\d+$/.test(value)

      if (!expiration || !isNumeric(expiration)) {
        return response(400, `Invalid expiration provided: ${expiration}`)
      }

      if (Date.now() > expiration) {
        console.info(`This request has expired`)
        return response(403, 'This request has expired')
      }

      const kit = newKit(fornoUrl)
      const accounts = await kit.contracts.getAccounts()
      const DEK = await accounts.getDataEncryptionKey(address)

      if (signer !== publicKeyToAddress(DEK)) {
        console.info(`Provided signer ${signer} !== address of DEK ${publicKeyToAddress(DEK)}`)
        return response(403, 'Invalid signer provided')
      }

      const bufferPayload = Buffer.from(payload)
      const typedData = await buildEIP712TypedData(
        { kit } as OffchainDataWrapper,
        data[0].path,
        bufferPayload
      )

      const validSigner = verifyEIP712TypedDataSigner(typedData, signature, signer)
      if (!validSigner) {
        console.info(`The guessed signer !== claimed signer ${address}`)
        return response(403, 'Invalid signature provided')
      }

      try {
        const signedUrls = await makeAsyncThrowable(authorizer.authorize)(data, expiresIn, address)
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
