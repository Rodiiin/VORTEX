import re
import secrets
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
import bcrypt

from database import get_db
from models import User

router = APIRouter()

# --- Funciones de Seguridad y Hashing ---
def hash_password(password: str) -> str:
    """Hashea una contraseña utilizando bcrypt con salt automático."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica si la contraseña ingresada en texto plano coincide con el hash bcrypt."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

# --- Expresión Regular para Validación de Correo ---
EMAIL_REGEX = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"

# --- Esquemas Pydantic ---
class UserRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Nombre de usuario único")
    email: str = Field(..., description="Correo electrónico del usuario")
    password: str = Field(..., min_length=6, description="Contraseña de al menos 6 caracteres")

    @field_validator("username")
    @classmethod
    def validate_username(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("El nombre de usuario no puede estar vacío.")
        if len(clean) < 3:
            raise ValueError("El nombre de usuario debe tener al menos 3 caracteres.")
        return clean

    @field_validator("email")
    @classmethod
    def validate_email(cls, v: str) -> str:
        clean = v.strip().lower()
        if not clean:
            raise ValueError("El correo electrónico no puede estar vacío.")
        if not re.match(EMAIL_REGEX, clean):
            raise ValueError("El formato del correo electrónico no es válido.")
        return clean

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("La contraseña debe tener al menos 6 caracteres.")
        return v

class UserLoginRequest(BaseModel):
    username: str = Field(..., description="Nombre de usuario o correo electrónico")
    password: str = Field(..., description="Contraseña del usuario")

class UserInfoResponse(BaseModel):
    id: int
    username: str
    email: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class RegisterResponse(BaseModel):
    message: str
    user: UserInfoResponse

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserInfoResponse

# --- Endpoints de Autenticación ---

@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    response_model=RegisterResponse,
    summary="Registrar nuevo usuario en VORTEX"
)
def register(payload: UserRegisterRequest, db: Session = Depends(get_db)):
    """
    Endpoint POST /api/auth/register:
    - Valida existencia previa de username o email en PostgreSQL.
    - Si existe: Retorna HTTP 400 con mensaje explicativo JSON.
    - Si no existe: Hashea la contraseña con bcrypt y guarda el usuario en la tabla 'users'.
    - En caso de éxito: Retorna HTTP 201 Created.
    """
    clean_username = payload.username
    clean_email = payload.email

    # Verificar si ya existe usuario con el mismo username o email
    existing_user = db.query(User).filter(
        (User.username == clean_username) | (User.email == clean_email)
    ).first()

    if existing_user:
        if existing_user.username.lower() == clean_username.lower() and existing_user.email.lower() == clean_email.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El nombre de usuario y el correo electrónico ya están registrados."
            )
        elif existing_user.username.lower() == clean_username.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El nombre de usuario ya está registrado."
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="El correo electrónico ya está registrado."
            )

    # Hashear contraseña con bcrypt
    hashed = hash_password(payload.password)

    # Persistir en la tabla users
    new_user = User(
        username=clean_username,
        email=clean_email,
        hashed_password=hashed,
        is_active=True
    )

    try:
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al registrar usuario en la base de datos: {str(exc)}"
        )

    return RegisterResponse(
        message="¡Cuenta creada con éxito!",
        user=UserInfoResponse.model_validate(new_user)
    )

@router.post(
    "/login",
    status_code=status.HTTP_200_OK,
    response_model=LoginResponse,
    summary="Iniciar sesión en VORTEX"
)
def login(payload: UserLoginRequest, db: Session = Depends(get_db)):
    """
    Endpoint POST /api/auth/login:
    - Autentica credenciales contra PostgreSQL mediante bcrypt.
    - Genera token de sesión y retorna datos del usuario autenticado.
    """
    clean_identifier = payload.username.strip()

    user = db.query(User).filter(
        (User.username == clean_identifier) | (User.email == clean_identifier.lower())
    ).first()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas. Verifica tu usuario y contraseña."
        )

    token = f"vortex_token_{secrets.token_urlsafe(32)}"

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserInfoResponse.model_validate(user)
    )
