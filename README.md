# Stokado

Stokado is responsible for providing secure off-chain storage for Valora users.

In order to upload data to the storage, users need to retrieve a pre-signed URL by making a request to the authorization endpoint and then upload the content using the URL.

## Code

Stokado is a serverless application that consists of two functions:

- `src/authorize` - the Authorizer responsible for generation of pre-signed URLs.
- `src/flush` - the CDN cache invalidation function triggered when a new version of the file is uploaded.
In our case we have:

## Installation

```bash
git clone git@github.com:celo-org/stokado.git
cd stokado
# Install Stokado dependencies
yarn
```

## Running

The function can be invoked locally using these commands:

```bash
# Invoke the authorize function
$ yarn invoke --function=authorize --path=test/authorize.req.json
# Invoke the flush function
$ yarn invoke --function=flush --path=test/flush.req.json
```

See [authorize.req.json](./test/authorize.req.json) and [flush.req.json](./test/flush.req.json) for sample requests payloads.
