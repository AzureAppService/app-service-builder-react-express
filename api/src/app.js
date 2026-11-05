import express from 'express'
import packageJson from '../package.json' with { type: 'json' }

const frameworkVersion = packageJson.dependencies.express

function deploymentInfo() {
  return {
    app: packageJson.name,
    version: packageJson.version,
    framework: `Express ${frameworkVersion}`,
    runtime: process.version,
    deploymentMarker: process.env.DEPLOYMENT_MARKER ?? 'local',
    runtimeMarker: process.env.RUNTIME_MARKER ?? 'local',
  }
}

export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.use(express.json({ limit: '16kb' }))

  app.get('/api/health', (_request, response) => {
    response.json({
      status: 'ok',
      app: packageJson.name,
      deploymentMarker: process.env.DEPLOYMENT_MARKER ?? 'local',
    })
  })

  app.get('/api/status', (_request, response) => {
    response.json({
      status: 'available',
      message: 'The React frontend reached the Express API on the same origin.',
      timestamp: new Date().toISOString(),
    })
  })

  app.get('/api/version', (_request, response) => {
    response.json(deploymentInfo())
  })

  app.get('/api/request', (request, response) => {
    response.json({
      method: request.method,
      path: request.path,
      headers: {
        host: request.get('host') ?? null,
        userAgent: request.get('user-agent') ?? null,
        forwardedProto: request.get('x-forwarded-proto') ?? null,
      },
    })
  })

  app.post('/api/echo', (request, response) => {
    response.json({ received: request.body })
  })

  app.use('/api', (_request, response) => {
    response.status(404).json({
      error: 'not_found',
      message: 'The requested API route does not exist.',
    })
  })

  return app
}
