import { APIGatewayProxyEvent, APIGatewayProxyEventHeaders } from 'aws-lambda'
import { ContractKit, newKit } from '@celo/contractkit'
import { privateKeyToPublicKey, publicKeyToAddress } from '@celo/utils/lib/address'

import AWS from 'aws-sdk'
import AWSMock from 'aws-sdk-mock'
import { bootstrap } from '@app/authorize/bootstrap'
import { ensureLeading0x } from '@celo/base'
import { handle } from '@app/authorize/handler'

describe('authorizer handler', () => {
  const writerPrivate = '0xdcef435698f5d070035071541c14440fde752ea847d863d88418218f93ad5a1a'
  const writerPublic = privateKeyToPublicKey(writerPrivate)
  const writerAddress = publicKeyToAddress(writerPublic)
  const writerEncryptionKeyPrivate =
    '0xc029c933337a6a1b08fc75c56dfba605bfbece471c356923ef79056c5f0a2e81'
  const kit = newKit('https://alfajores-forno.celo-testnet.org')
  kit.addAccount(writerPrivate)
  kit.addAccount(writerEncryptionKeyPrivate)
  kit.defaultAccount = writerAddress

  const bucket = 'bucket'
  const expiresInSeconds = 10

  const getHandler = () =>
    bootstrap(
      {
        accessKeyId: 'accessKeyId',
        secretAccessKey: 'secretAccessKey',
        sessionToken: 'sessionToken',
      },
      'eu-west-1',
      expiresInSeconds,
      bucket
    )

  const getSignature = async (payload: string, kit: ContractKit) => {
    const hexPayload = ensureLeading0x(Buffer.from(payload).toString('hex'))
    return await kit.getWallet().signPersonalMessage(kit.defaultAccount, hexPayload)
  }

  const getEvent = (body: string, headers: APIGatewayProxyEventHeaders): APIGatewayProxyEvent => ({
    headers,
    multiValueHeaders: {},
    httpMethod: 'POST',
    path: '/authorize',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: {},
    requestContext: {
      resourceId: 'v27zzr',
      resourcePath: '/authorize',
      httpMethod: 'POST',
      authorizer: null,
      extendedRequestId: 'XtJuSExhjoEFTuw=',
      requestTime: '17/Dec/2020:16:38:38 +0000',
      path: '/dev/authorize',
      accountId: '243983831780',
      protocol: 'HTTP/1.1',
      stage: 'dev',
      domainPrefix: 'kel03d4ef0',
      requestTimeEpoch: 1608223118520,
      requestId: 'b8ae94ef-4c53-4cba-aa8d-9551e434f81c',
      identity: {
        cognitoIdentityPoolId: null,
        accountId: null,
        cognitoIdentityId: null,
        caller: null,
        sourceIp: '138.199.18.93',
        principalOrgId: null,
        accessKey: null,
        cognitoAuthenticationType: null,
        cognitoAuthenticationProvider: null,
        userArn: null,
        userAgent: 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)',
        user: null,
        apiKey: null,
        apiKeyId: null,
      },
      domainName: 'kel03d4ef0.execute-api.eu-west-1.amazonaws.com',
      apiId: 'kel03d4ef0',
    },
    resource: 'resource',
    isBase64Encoded: false,
    body,
  })

  it('does not process request without signature', async () => {
    const handler = getHandler()
    const event = getEvent('', {})
    const result = await handler(event, null, null)

    expect(result).not.toBeUndefined()

    if (result) {
      expect(result.statusCode).toBe(401)
      expect(result.body).toBe('Signature required')
    }
  })

  it('handles invalid signature', async () => {
    const payload = JSON.stringify({
      address: kit.defaultAccount,
      data: [{ path: 'foo' }],
    })
    const handler = getHandler()
    const event = getEvent(payload, {
      Signature: 'asdf',
    })
    const result = await handler(event, null, null)
    console.log(result)

    expect(result).not.toBeUndefined()

    if (result) {
      expect(result.statusCode).toBe(400)
      expect(result.body).toBe('Invalid request')
    }
  })

  it('validates signature', async () => {
    const payload = JSON.stringify({
      address: kit.defaultAccount,
      data: [{ path: 'foo' }],
    })

    const handler = getHandler()
    const event = getEvent(payload, {
      Signature:
        '0x82e7beb4f72f875fc8f30da40d8d820823736525d001c36307edc3dae54bddca2803231a609e57c5f2c05290db30157da202904b726c08c61c374597abb47c7700',
    })
    const result = await handler(event, null, null)
    console.log(result)

    expect(result).not.toBeUndefined()

    if (result) {
      expect(result.statusCode).toBe(403)
      expect(result.body).toBe('Invalid signature provided')
    }
  })

  it('handles valid payload', async () => {
    const payload = JSON.stringify({
      address: kit.defaultAccount,
      data: [{ path: '/account/name' }, { path: '/account/name.signature' }],
    })

    AWSMock.setSDKInstance(AWS)
    AWSMock.mock('S3', 'createPresignedPost', (params: AWS.S3.PresignedPost.Params, callback) => {
      expect(params.Fields.key).toContain(kit.defaultAccount)
      callback(null, 'successfulMock')
    })

    const handler = getHandler()
    const event = getEvent(payload, {
      Signature: await getSignature(payload, kit),
    })

    const result = await handler(event, null, null)

    expect(result).not.toBeUndefined()

    if (result) {
      expect(result.statusCode).toBe(200)
    }
    AWSMock.restore('S3')
  })

  it('wraps path errors in 400', async () => {
    const payload = JSON.stringify({
      address: kit.defaultAccount,
      data: [{ path: 'foo' }],
    })

    const handler = getHandler()
    const event = getEvent(payload, {
      Signature: await getSignature(payload, kit),
    })

    const result = await handler(event, null, null)

    expect(result).not.toBeUndefined()

    if (result) {
      expect(result.statusCode).toBe(400)
      expect(result.body).toBe('InvalidUploadPath')
    }
  })

  it('uses bootstrapped handler', async () => {
    expect(handle).toBeInstanceOf(Function)
  })
})
