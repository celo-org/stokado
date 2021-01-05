import 'source-map-support/register'

import { APIGatewayProxyHandler } from 'aws-lambda'
import { bootstrap } from './bootstrap'

export const handle: APIGatewayProxyHandler = bootstrap(
  {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  },
  process.env.AWS_REGION,
  parseInt(process.env.AUTHORIZATION_EXPIRES_IN, 10),
  process.env.BUCKET_NAME
)
