import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { stripVTControlCharacters } from 'node:util'
import apiPackageJson from './api/package.json' with { type: 'json' }
import { createApp } from './api/src/app.js'

test('manifest keeps separate frontend and API roots and routes', async () => {
  const manifest = await readFile(new URL('./builder.yaml', import.meta.url), 'utf8')
  assert.equal(manifest.replaceAll('\r\n', '\n'), `components:
  - name: web
    rootDirectory: web
    path: /

  - name: api
    rootDirectory: api
    role: web
    platform: nodejs
    path: /api
    run:
      port: 8080
      start: npm start
      healthCheckPath: /api/health
`)
})

test('frontend build contains only static assets and public metadata', async () => {
  const entries = await readdir(new URL('./web/dist/', import.meta.url))
  assert.deepEqual(entries.sort(), ['assets', 'index.html', 'version.json'])
  const version = JSON.parse(await readFile(new URL('./web/dist/version.json', import.meta.url), 'utf8'))
  assert.deepEqual(version, {
    app: 'app-service-builder-react-express-web',
    version: '1.0.0',
    framework: 'React 19 with Vite 8',
  })
  const assets = await readdir(new URL('./web/dist/assets/', import.meta.url))
  assert.ok(assets.some((name) => name.endsWith('.js')))
  assert.ok(assets.some((name) => name.endsWith('.css')))
  assert.ok(assets.every((name) => /^[\w-]+\.(js|css)$/.test(name)))
})

test('built frontend and real API share one local origin', { timeout: 30000 }, async (t) => {
  const api = createServer(createApp())
  await new Promise((resolve, reject) => {
    api.once('error', reject)
    api.listen(0, '127.0.0.1', resolve)
  })
  t.after(() => new Promise((resolve, reject) => {
    api.close((error) => error ? reject(error) : resolve())
  }))
  const address = api.address()
  assert.ok(address && typeof address !== 'string')

  const preview = spawn(process.execPath, [
    fileURLToPath(new URL('./web/node_modules/vite/bin/vite.js', import.meta.url)),
    'preview', '--host', '127.0.0.1', '--port', '0', '--strictPort',
  ], {
    cwd: new URL('./web/', import.meta.url),
    env: { ...process.env, API_PROXY_TARGET: `http://127.0.0.1:${address.port}` },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const closed = new Promise((resolve) => preview.once('close', resolve))
  t.after(async () => {
    if (preview.exitCode === null && preview.signalCode === null) {
      preview.kill('SIGTERM')
    }
    await closed
  })

  const origin = await new Promise((resolve, reject) => {
    let output = ''
    const timeout = setTimeout(() => reject(new Error(`Preview did not become ready: ${output}`)), 10000)
    const finish = (error, url) => {
      clearTimeout(timeout)
      if (error) reject(error)
      else resolve(url)
    }
    preview.once('error', (error) => finish(error))
    preview.once('close', (code) => finish(new Error(`Preview exited (${code}): ${output}`)))
    preview.stderr.on('data', (chunk) => { output += chunk.toString() })
    preview.stdout.on('data', (chunk) => {
      output += chunk.toString()
      const url = stripVTControlCharacters(output).match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0]
      if (url) finish(null, url)
    })
  })

  const root = await fetch(origin)
  assert.equal(root.status, 200)
  assert.match(root.headers.get('content-type'), /text\/html/)
  const html = await root.text()
  assert.ok(html.includes('<title>App Service Builder: React + Express sample</title>'))
  assert.match(html, /<div id="root"><\/div>/)
  assert.doesNotMatch(html, /\/src\/|node_modules/)
  for (const route of ['/products/widget-1', '/unknown-client-route']) {
    const response = await fetch(new URL(route, origin))
    assert.equal(response.status, 200)
    assert.equal(await response.text(), html)
  }

  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map((match) => match[1])
  const styles = [...html.matchAll(/<link\b[^>]*\bhref="([^"]+\.css)"/g)].map((match) => match[1])
  assert.equal(scripts.length, 1)
  assert.equal(styles.length, 1)
  for (const [asset, contentType] of [
    ...scripts.map((asset) => [asset, /javascript/]),
    ...styles.map((asset) => [asset, /text\/css/]),
  ]) {
    assert.match(asset, /^\/assets\/[\w-]+\.(js|css)$/)
    const response = await fetch(new URL(asset, origin))
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type'), contentType)
    assert.ok((await response.text()).length > 0)
  }

  for (const [path, expected] of [
    ['/version.json', { app: 'app-service-builder-react-express-web' }],
    ['/api/health', { status: 'ok', app: 'app-service-builder-react-express-api' }],
    ['/api/status', { status: 'available' }],
    ['/api/version', { app: 'app-service-builder-react-express-api', framework: `Express ${apiPackageJson.dependencies.express}` }],
    ['/api/request', { method: 'GET', path: '/api/request' }],
  ]) {
    const response = await fetch(new URL(path, origin))
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type'), /application\/json/)
    const body = await response.json()
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(body[key], value, `${path}: ${key}`)
    }
  }

  const echo = await fetch(new URL('/api/echo', origin), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message: 'hello' }),
  })
  assert.equal(echo.status, 200)
  assert.deepEqual(await echo.json(), { received: { message: 'hello' } })

  const missing = await fetch(new URL('/api/missing', origin))
  assert.equal(missing.status, 404)
  assert.match(missing.headers.get('content-type'), /application\/json/)
  assert.deepEqual(await missing.json(), {
    error: 'not_found',
    message: 'The requested API route does not exist.',
  })
})
