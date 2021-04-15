import * as event from './authorize.req.json'
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda/trigger/api-gateway-proxy'
import { privateKeyToPublicKey, publicKeyToAddress } from '@celo/utils/lib/address'
import FormData from 'form-data'
import { ensureLeading0x } from '@celo/base'
import fetch from 'node-fetch'
import { handle } from '@app/authorize/handler'
import { newKit } from '@celo/contractkit'

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
    const hexPayload = ensureLeading0x(Buffer.from(event.body).toString('hex'))
    const signature = await writerKit
      .getWallet()
      .signPersonalMessage(writerEncryptionKeyAddress, hexPayload)

    const accounts = await writerKit.contracts.getAccounts()
    await accounts
      .setAccountDataEncryptionKey(writerEncryptionKeyPublic)
      .sendAndWaitForReceipt({ from: writerAddress })

    expect(signature).toBe(
      '0x60fc4b5845e9f74081b03217becf85386808f4d313138e9bd2cf3db3aca5d9b468fc1023a2e19b20c69d475b6d2f71d370c2c8ecb0111d1039a7e822105ae29201'
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
