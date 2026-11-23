-- ==============================================================================
-- VORTEX - DATABASE INITIALIZATION SCRIPT
-- ==============================================================================

-- Creación de tabla para verificar conectividad y persistencia
CREATE TABLE IF NOT EXISTS system_status (
    id SERIAL PRIMARY KEY,
    service_name VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    initialized_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Inserción de registro semilla para test de lectura
INSERT INTO system_status (service_name, status)
VALUES ('database', 'ready')
ON CONFLICT DO NOTHING;
-- Creación de tabla para usuarios del sistema
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Sesiones iniciadas con /api/auth/login (sólo se guarda el hash SHA-256 del token)
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_user_sessions_user_id ON user_sessions (user_id);

-- Calibración vigente de cada usuario (perfiles de guardia, jab, gancho y esquiva)
CREATE TABLE IF NOT EXISTS user_calibrations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    results JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Historial de sesiones de práctica libre (sandbox) tras la calibración
CREATE TABLE IF NOT EXISTS sandbox_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stats JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_sandbox_sessions_user_id ON sandbox_sessions (user_id);
