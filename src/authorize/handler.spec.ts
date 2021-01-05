import { APIGatewayProxyEvent, APIGatewayProxyEventHeaders } from 'aws-lambda'

import AWS from 'aws-sdk'
import AWSMock from 'aws-sdk-mock'
import { bootstrap } from '@app/authorize/bootstrap'
import { handle } from '@app/authorize/handler'

describe('authorizer handler', () => {
  const bucket = 'bucket'
  const expiresInSeconds = 10
  const payload = '[{"path": "/account/name"}, {"path": "/account/name.signature"}]'
  const validSignature =
    '0xf94258ca073c0df9084d78bb11fb58a3a14b0e776dd06e1aa76e3a9b622aa0e51bbe45b84a15fffafeebbcab7cd86ed74f48e64c8758d5dc373abc8477f6922f01'
  const validSigner = '0x622f9Bf48e17753131dC32151f989BDc13aAA072'

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

  it('validates signature', async () => {
    const handler = getHandler()
    const event = getEvent('', {
      Signature: 'asdf',
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
    AWSMock.setSDKInstance(AWS)
    AWSMock.mock('S3', 'createPresignedPost', (params: AWS.S3.PresignedPost.Params, callback) => {
      expect(params.Fields.key).toContain(validSigner)
      callback(null, 'successfulMock')
    })

    const handler = getHandler()
    const event = getEvent(payload, {
      Signature: validSignature,
    })

    const result = await handler(event, null, null)

    expect(result).not.toBeUndefined()

    if (result) {
      expect(result.statusCode).toBe(200)
    }
    AWSMock.restore('S3')
  })

  it('wraps path errors in 400', async () => {
    const handler = getHandler()
    const event = getEvent(JSON.stringify([{ path: 'foo' }]), {
      Signature: validSignature,
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
