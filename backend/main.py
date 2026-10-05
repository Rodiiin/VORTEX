import os
from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from database import check_db_connection, engine, Base
import models
from auth import router as auth_router

# Inicialización automática de tablas en PostgreSQL
try:
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"Advertencia al inicializar tablas de la base de datos: {e}")

app = FastAPI(
    title="VORTEX API",
    description="Backend API para VORTEX - Shadow Boxing AI Exergame",
    version="1.0.0"
)

# Configuración de CORS
cors_origins_env = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Inclusión del enrutador de autenticación
app.include_router(auth_router, prefix="/api/auth", tags=["Autenticación"])

@app.get("/")
def read_root():
    return {
        "service": "VORTEX API",
        "status": "online",
        "docs_url": "/docs"
    }

@app.get("/api/health")
def health_check(response: Response):
    """
    Endpoint de verificación de salud del sistema.
    Prueba la conexión a la base de datos PostgreSQL y retorna el estado general.
    """
    try:
        check_db_connection()
        return {
            "status": "ok",
            "db_connected": True,
            "message": "Backend y BD conectados correctamente"
        }
    except Exception as e:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "error",
            "db_connected": False,
            "message": f"Error conectando a la base de datos: {str(e)}"
        }
