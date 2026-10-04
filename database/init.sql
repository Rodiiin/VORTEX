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
