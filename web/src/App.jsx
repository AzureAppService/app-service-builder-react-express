import { useEffect, useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import './App.css'

function Layout({ eyebrow, title, children }) {
  return (
    <main>
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children}
    </main>
  )
}

function Home() {
  const [inspection, setInspection] = useState('Choose a health or version check. Results stay on this page.')
  const [checking, setChecking] = useState(false)
  async function inspect(path) {
    setChecking(true)
    setInspection(`Checking ${path}...`)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
      const response = await fetch(path, { signal: controller.signal })
      const body = await response.text()
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      setInspection(`${path} · HTTP ${response.status}\n${body}\nHealth checks show process readiness only, not Azure deployment status.`)
    } catch {
      setInspection(`${path} could not be checked. Confirm the frontend and API are reachable, then retry.`)
    } finally {
      clearTimeout(timeout)
      setChecking(false)
    }
  }
  const [apiState, setApiState] = useState({
    status: 'loading',
    message: 'Contacting the Express API...',
  })

  useEffect(() => {
    const controller = new AbortController()

    fetch('/api/status', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`)
        }
        return response.json()
      })
      .then((body) => setApiState(body))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setApiState({
            status: 'error',
            message: error.message,
          })
        }
      })

    return () => controller.abort()
  }, [])

  return (
    <Layout
      eyebrow="App Service Builder / React + Express"
      title="React and Express are running"
    >
      <p>
        The static React frontend and Express API share one public hostname.
      </p>

      <section className="api-card" data-state={apiState.status} aria-live="polite">
        <h2>Same-origin API status</h2>
        <p>
          <strong>{apiState.status}</strong>: {apiState.message}
        </p>
      </section>

      <nav aria-label="Test routes">
        <Link className="button" to="/products/widget-1">
          Open the frontend deep route
        </Link>
        <button type="button" disabled={checking} onClick={() => inspect('/api/health')}>Check API health</button>
        <button type="button" disabled={checking} onClick={() => inspect('/api/version')}>Check API version</button>
        <button type="button" disabled={checking} onClick={() => inspect('/version.json')}>Check frontend version</button>
      </nav>
      <pre className="inspection" role="status">{inspection}</pre>
      <details>
        <summary>Customize this sample</summary>
        <p>Edit <code>web/src/App.jsx</code> in your own fork to change this page. Edit <code>api/src/app.js</code> to change the API response. Rebuild, test, commit and redeploy your fork; this page does not edit GitHub.</p>
      </details>
      <p><a href="https://builderapps.azure.com/docs/">App Service Builder documentation</a> · <a href="https://react.dev/learn">React documentation</a></p>
    </Layout>
  )
}

function Product() {
  return (
    <Layout eyebrow="Frontend deep-link test" title="Widget 1">
      <p>
        This React route proves that frontend navigation remains separate from
        the API prefix.
      </p>
      <nav>
        <Link className="button" to="/">
          Return home
        </Link>
      </nav>
    </Layout>
  )
}

function NotFound() {
  return (
    <Layout eyebrow="Frontend client-side 404" title="Page not found">
      <p>The React SPA handled this unknown non-API route.</p>
      <nav>
        <Link className="button" to="/">
          Return home
        </Link>
      </nav>
    </Layout>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/products/widget-1" element={<Product />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
