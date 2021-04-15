import 'source-map-support/register'

import { APIGatewayProxyEvent, APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda'

import AWS from 'aws-sdk'
import { Authorizer } from './authorize'
import { CredentialsOptions } from 'aws-sdk/lib/credentials'
import { EIP712TypedData } from '@celo/utils/lib/sign-typed-data-utils'
import {verifyEIP712TypedDataSigner} from '@celo/utils/lib/signatureUtils'
import { makeAsyncThrowable } from '@celo/base'
import { newKit } from '@celo/contractkit'
import { publicKeyToAddress } from '@celo/utils/lib/address'
import { keccak256 } from 'ethereumjs-util'

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
      const { address, data, expiration } = JSON.parse(payload)
      const { address, data, signer } = JSON.parse(payload)

      if(Date.now() > expiration){
        console.info(`This request has expired`)
        return response(403, 'This request has expired')
      }
      const guessedSigner = toChecksumAddress(guessSigner(payload, signature))

      const kit = newKit(fornoUrl)
      const accounts = await kit.contracts.getAccounts()
      const DEK = await accounts.getDataEncryptionKey(address)

      if (guessedSigner !== publicKeyToAddress(DEK)) {
        console.info(
          `Guessed signer ${guessedSigner} !== address of DEK ${publicKeyToAddress(DEK)}`
        )
      const bufferPayload = Buffer.from(payload)
      const typedData = buildEIP712TypedData(data.path, bufferPayload)
      const validSigner = verifyEIP712TypedDataSigner(typedData, signature, address)
       if (!validSigner) {
        console.info(`The guessed signer !== claimed signer ${address}`)
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
          address
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


function buildEIP712TypedData(
  path: string,
  data: Buffer
): EIP712TypedData {
  // const chainId = this is the network ID https://eth.wiki/json-rpc/API#net_version
  const EIP712Domain = [
    { name: 'name', type: 'string' },
    { name: 'version', type: 'string' },
    { name: 'chainId', type: 'uint256' },
  ]

  let types = {}
  let message = {}

  types = {
    ClaimWithPath: [
      { name: 'path', type: 'string' },
      { name: 'hash', type: 'string' },
    ],
  }
  message = {
    hash: keccak256(data).toString('hex'),
  }

  return {
    types: {
      EIP712Domain,
      ...types,
    },
    domain: {
      name: 'CIP8 Claim',
      version: '1.0.0',
      chainId,
    },
    primaryType: 'ClaimWithPath',
    message: {
      path,
      ...message,
    },
  }
}
