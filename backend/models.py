from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from database import Base

class User(Base):
    """
    Modelo ORM para la tabla 'users' de PostgreSQL en VORTEX.
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)


class UserSession(Base):
    """
    Sesión iniciada con /api/auth/login. Sólo se guarda el hash SHA-256 del
    token: si la base de datos se filtra, los tokens no se pueden reutilizar.
    """
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    token_hash = Column(String(64), unique=True, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)


class UserCalibration(Base):
    """
    Calibración vigente de cada usuario (una fila por usuario).
    `data` guarda los perfiles (guardia, jab, gancho, esquiva) y umbrales;
    `results` las puntuaciones de cada paso de la calibración.
    """
    __tablename__ = "user_calibrations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    data = Column(JSONB, nullable=False)
    results = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class SandboxSession(Base):
    """
    Historial de sesiones de práctica libre (sandbox) tras la calibración:
    duración, golpes y esquivas contados y medidas máximas.
    """
    __tablename__ = "sandbox_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    stats = Column(JSONB, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
