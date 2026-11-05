import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { after, before, test } from 'node:test'
import { createApp } from '../src/app.js'

let baseUrl
let server

before(async () => {
  server = createServer(createApp())
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

  const address = server.address()
  baseUrl = `http://127.0.0.1:${address.port}`
})

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
})

test('reports health and API status', async () => {
  const health = await fetch(`${baseUrl}/api/health`).then((response) =>
    response.json(),
  )
  const status = await fetch(`${baseUrl}/api/status`).then((response) =>
    response.json(),
  )

  assert.equal(health.status, 'ok')
  assert.equal(health.app, 'app-service-builder-react-express-api')
  assert.equal(status.status, 'available')
})

test('reports deployment identity', async () => {
  const version = await fetch(`${baseUrl}/api/version`).then((response) =>
    response.json(),
  )

  assert.equal(version.app, 'app-service-builder-react-express-api')
  assert.match(version.framework, /^Express /)
  assert.match(version.runtime, /^v\d+/)
})

test('echoes JSON without requiring cross-origin access', async () => {
  const response = await fetch(`${baseUrl}/api/echo`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'hello' }),
  })

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    received: { message: 'hello' },
  })
})

test('returns selected request metadata without credentials', async () => {
  const response = await fetch(`${baseUrl}/api/request`, {
    headers: {
      'user-agent': 'builder-fullstack-test',
      authorization: 'sample-public-test-value',
      cookie: 'session=demo',
    },
  })
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.method, 'GET')
  assert.equal(body.path, '/api/request')
  assert.equal(body.headers.userAgent, 'builder-fullstack-test')
  assert.equal('authorization' in body.headers, false)
  assert.equal('cookie' in body.headers, false)
})

test('returns API misses as JSON', async () => {
  const response = await fetch(`${baseUrl}/api/missing`)

  assert.equal(response.status, 404)
  assert.deepEqual(await response.json(), {
    error: 'not_found',
    message: 'The requested API route does not exist.',
  })
})
