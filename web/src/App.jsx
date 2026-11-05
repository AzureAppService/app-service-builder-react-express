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

      <section className="api-card" data-state={apiState.status}>
        <h2>Same-origin API status</h2>
        <p>
          <strong>{apiState.status}</strong>: {apiState.message}
        </p>
      </section>

      <nav aria-label="Test routes">
        <Link className="button" to="/products/widget-1">
          Open the frontend deep route
        </Link>
        <a href="/api/health">View API health</a>
        <a href="/api/version">View API version</a>
        <a href="/version.json">View frontend version</a>
      </nav>
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
