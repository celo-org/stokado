import * as event from './authorize.req.json'

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda/trigger/api-gateway-proxy'
import { privateKeyToPublicKey, publicKeyToAddress } from '@celo/utils/lib/address'

import FormData from 'form-data'
import { OffchainDataWrapper } from '@celo/identity/lib/offchain-data-wrapper'
import fetch from 'node-fetch'
import { handle } from '@app/authorize/handler'
import { newKit } from '@celo/contractkit'
import { signBuffer } from '@celo/identity/lib/offchain/utils'

describe('e2e test', () => {
  it('adds an account, sets a DEK for the account and generates signature of event body', async () => {
    // these values were then manually copied into authorize.req.json
    const writerPrivate = '0xdcef435698f5d070035071541c14440fde752ea847d863d88418218f93ad5a1a'
    const writerPublic = privateKeyToPublicKey(writerPrivate)
    const writerAddress = publicKeyToAddress(writerPublic)
    const writerEncryptionKeyPrivate =
      '0xc029c933337a6a1b08fc75c56dfba605bfbece471c356923ef79056c5f0a2e81'
    const writerEncryptionKeyPublic = privateKeyToPublicKey(writerEncryptionKeyPrivate)
    const writerEncryptionKeyAddress = publicKeyToAddress(writerEncryptionKeyPublic)
    const writerKit = newKit(process.env.FORNO_URL)
    writerKit.addAccount(writerPrivate)
    writerKit.addAccount(writerEncryptionKeyPrivate)
    writerKit.defaultAccount = writerAddress
    const dataPath = '/account/name'
    const signedUrlsPayload = {
      address: writerAddress,
      expiration: 9999999999999,
      signer: writerEncryptionKeyAddress,
      data: [
        {
          path: dataPath,
        },
        {
          path: `${dataPath}.signature`,
        },
      ],
    }

    const bufferPayload = Buffer.from(JSON.stringify(signedUrlsPayload))
    const signature = await signBuffer(
      { kit: writerKit, signer: writerEncryptionKeyAddress } as OffchainDataWrapper,
      dataPath,
      bufferPayload
    )
    expect(signature).toBe(
      '0x0aea94dbe2cdbd2ae3be7e78dc2df9c16a5ef14b12a0d00bb1ec5ab1c2bc7cf536add485cb66303de88b4b4ed474e0319373a3ddd149e044f76e578e9e30377d01'
    )
  })

  it('gets a pre-signed post url, uses it to upload a string to s3 and checks that the string is correct', async () => {
    // please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY env vars by using the export command before running
    const handleResponse = (await handle(
      (event as unknown) as APIGatewayProxyEvent,
      null,
      null
    )) as APIGatewayProxyResult
    const preSignedPost = JSON.parse(handleResponse.body)[0]
    const formData = new FormData()
    const dataPayload = 'some random string'

    Object.entries(preSignedPost.fields).forEach(([k, v]) => {
      formData.append(k, v)
    })
    formData.append('file', dataPayload)

    await fetch(preSignedPost.url, {
      method: 'POST',
      headers: {
        enctype: 'multipart/form-data',
      },
      body: formData,
    }).then((x) => x.text())

    await new Promise((resolve) => setTimeout(resolve, 30000))

    const getFileResponse = await fetch(
      'https://dev-stokado-data.celo-testnet.org/0x17Dd1686F1B592C7d0869b439ddd1fCD669b352f/account/name'
    )
    expect(await getFileResponse.text()).toBe(dataPayload)
  }, 35000)
})
