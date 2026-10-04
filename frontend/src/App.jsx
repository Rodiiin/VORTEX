import React, { useState, useEffect } from 'react'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export default function App() {
  const [healthData, setHealthData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastChecked, setLastChecked] = useState(null)

  const checkHealth = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`, {
        headers: { 'Accept': 'application/json' }
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`)
      }
      setHealthData(data)
    } catch (err) {
      console.error("Health check error:", err)
      setError(err.message || 'Error de conexión con el Backend')
      setHealthData(null)
    } finally {
      setLoading(false)
      setLastChecked(new Date().toLocaleTimeString())
    }
  }

  useEffect(() => {
    checkHealth()
  }, [])

  const isFullyConnected = healthData?.status === 'ok' && healthData?.db_connected === true

  return (
    <div className="vortex-container">
      {/* Glow Effects */}
      <div className="glow-sphere glow-sphere-1" />
      <div className="glow-sphere glow-sphere-2" />

      {/* Main Content */}
      <main className="vortex-card">
        {/* Header */}
        <header className="vortex-header">
          <div className="brand-badge">🥊 EXERGAME PLATFORM</div>
          <h1 className="brand-title">VORTEX</h1>
          <p className="brand-subtitle">
            AI-Powered Shadow Boxing & Movement Fitness Web Platform
          </p>
        </header>

        {/* Master Status Banner */}
        <section className="status-hero">
          {loading ? (
            <div className="hero-status-box hero-status-loading">
              <span className="spinner"></span>
              <div>
                <h2>Verificando conectividad...</h2>
                <p>Consultando estado de Backend y Base de Datos</p>
              </div>
            </div>
          ) : isFullyConnected ? (
            <div className="hero-status-box hero-status-success">
              <div className="status-icon success-icon">✓</div>
              <div>
                <h2>Sistema listo y conectado</h2>
                <p>{healthData.message}</p>
              </div>
            </div>
          ) : (
            <div className="hero-status-box hero-status-error">
              <div className="status-icon error-icon">✕</div>
              <div>
                <h2>Desconexión o Error Detectado</h2>
                <p>{error || 'No se pudo validar la integridad de todos los servicios'}</p>
              </div>
            </div>
          )}
        </section>

        {/* Microservices Breakdown Grid */}
        <section className="services-grid">
          {/* Frontend Service */}
          <div className="service-pill service-online">
            <div className="service-top">
              <span className="pill-dot active"></span>
              <span className="service-name">Frontend (React + Vite)</span>
            </div>
            <div className="service-meta">
              <span className="badge">Puerto 5173</span>
              <span className="badge badge-success">Online</span>
            </div>
          </div>

          {/* Backend Service */}
          <div className={`service-pill ${healthData ? 'service-online' : 'service-offline'}`}>
            <div className="service-top">
              <span className={`pill-dot ${healthData ? 'active' : 'inactive'}`}></span>
              <span className="service-name">Backend (FastAPI)</span>
            </div>
            <div className="service-meta">
              <span className="badge">Puerto 8000</span>
              <span className={`badge ${healthData ? 'badge-success' : 'badge-danger'}`}>
                {healthData ? 'Conectado' : 'Sin respuesta'}
              </span>
            </div>
          </div>

          {/* Database Service */}
          <div className={`service-pill ${healthData?.db_connected ? 'service-online' : 'service-offline'}`}>
            <div className="service-top">
              <span className={`pill-dot ${healthData?.db_connected ? 'active' : 'inactive'}`}></span>
              <span className="service-name">Base de Datos (PostgreSQL)</span>
            </div>
            <div className="service-meta">
              <span className="badge">Puerto 5432</span>
              <span className={`badge ${healthData?.db_connected ? 'badge-success' : 'badge-danger'}`}>
                {healthData?.db_connected ? 'Enlace Activo' : 'Desconectada'}
              </span>
            </div>
          </div>
        </section>

        {/* Technical Data Output */}
        <section className="debug-box">
          <div className="debug-header">
            <span>Respuesta de <code>GET /api/health</code></span>
            {lastChecked && <span className="timestamp">Última verificación: {lastChecked}</span>}
          </div>
          <pre className="debug-pre">
            {loading 
              ? 'Esperando respuesta...' 
              : healthData 
                ? JSON.stringify(healthData, null, 2) 
                : JSON.stringify({ error: error || 'Servicio no disponible' }, null, 2)}
          </pre>
        </section>

        {/* Actions Toolbar */}
        <footer className="vortex-actions">
          <button 
            className="btn btn-primary" 
            onClick={checkHealth} 
            disabled={loading}
          >
            {loading ? 'Comprobando...' : '🔄 Re-verificar Conexión'}
          </button>
          <a 
            href={`${API_BASE_URL}/docs`} 
            target="_blank" 
            rel="noreferrer" 
            className="btn btn-secondary"
          >
            📖 Swagger API Docs
          </a>
        </footer>
      </main>
    </div>
  )
}
