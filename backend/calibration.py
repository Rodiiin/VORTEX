import json
from typing import Any, Dict, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from database import get_db
from models import User, UserCalibration, SandboxSession
from auth import get_current_user

router = APIRouter()

# Límite de tamaño de cada bloque JSON (la calibración ocupa unos pocos KB)
MAX_JSON_BYTES = 64 * 1024


def _check_size(value: Optional[Dict[str, Any]], name: str) -> Optional[Dict[str, Any]]:
    if value is not None and len(json.dumps(value)) > MAX_JSON_BYTES:
        raise ValueError(f"'{name}' supera el tamaño máximo permitido ({MAX_JSON_BYTES // 1024} KB).")
    return value


# --- Esquemas Pydantic ---
class CalibrationSaveRequest(BaseModel):
    calibration: Dict[str, Any] = Field(..., description="Perfiles y umbrales calibrados (guardia, jab, gancho, esquiva)")
    results: Optional[Dict[str, Any]] = Field(default=None, description="Puntuaciones de cada paso de la calibración")
    sandbox: Optional[Dict[str, Any]] = Field(default=None, description="Estadísticas de la sesión de práctica libre")

    @field_validator("calibration")
    @classmethod
    def validate_calibration(cls, v: Dict[str, Any]) -> Dict[str, Any]:
        return _check_size(v, "calibration")

    @field_validator("results")
    @classmethod
    def validate_results(cls, v: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        return _check_size(v, "results")

    @field_validator("sandbox")
    @classmethod
    def validate_sandbox(cls, v: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        return _check_size(v, "sandbox")


class CalibrationResponse(BaseModel):
    calibration: Dict[str, Any]
    results: Optional[Dict[str, Any]] = None
    updated_at: Optional[datetime] = None
    sandbox_session_id: Optional[int] = None


# --- Endpoints ---
@router.get(
    "/me",
    response_model=CalibrationResponse,
    summary="Obtener la calibración guardada del usuario"
)
def get_my_calibration(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Endpoint GET /api/calibration/me: devuelve la última calibración guardada
    por el usuario autenticado, o 404 si todavía no ha guardado ninguna.
    """
    row = db.query(UserCalibration).filter(UserCalibration.user_id == user.id).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todavía no hay una calibración guardada.")
    return CalibrationResponse(calibration=row.data, results=row.results, updated_at=row.updated_at)


@router.put(
    "/me",
    response_model=CalibrationResponse,
    summary="Guardar la calibración y la sesión de práctica del usuario"
)
def save_my_calibration(
    payload: CalibrationSaveRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Endpoint PUT /api/calibration/me:
    - Crea o reemplaza la calibración vigente del usuario autenticado.
    - Si se envían estadísticas del sandbox, las añade a su historial.
    Todo se guarda en una sola transacción.
    """
    try:
        row = db.query(UserCalibration).filter(UserCalibration.user_id == user.id).first()
        if row:
            row.data = payload.calibration
            row.results = payload.results
        else:
            row = UserCalibration(user_id=user.id, data=payload.calibration, results=payload.results)
            db.add(row)

        sandbox_row = None
        if payload.sandbox:
            sandbox_row = SandboxSession(user_id=user.id, stats=payload.sandbox)
            db.add(sandbox_row)

        db.commit()
        db.refresh(row)
        if sandbox_row:
            db.refresh(sandbox_row)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al guardar la calibración: {str(exc)}"
        )

    return CalibrationResponse(
        calibration=row.data,
        results=row.results,
        updated_at=row.updated_at,
        sandbox_session_id=sandbox_row.id if sandbox_row else None,
    )
