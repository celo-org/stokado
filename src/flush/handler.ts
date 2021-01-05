import 'source-map-support/register'

import { SQSHandler } from 'aws-lambda'
import { bootstrap } from './bootstrap'

export const handle: SQSHandler = bootstrap(
  {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  },
  process.env.AWS_REGION,
  process.env.CDN_DISTRIBUTION_ID
)
