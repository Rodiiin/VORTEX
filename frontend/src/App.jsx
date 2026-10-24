import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Register from './components/Register';
import MainMenu from './components/MainMenu';
import Levels from './components/Levels';
import Configuracion from './components/Configuracion';
import Calibration from './components/Calibration';
import GameEngine from './components/GameEngine';

export default function App() {
  // Estado de vista de la aplicación: 'login' | 'register' | 'menu' | 'levels' | 'config' | 'calibration' | 'game'
  const [currentView, setCurrentView] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);
  const [calibrationData, setCalibrationData] = useState(null);

  // La vista inicial al cargar la aplicación (http://localhost:5173) siempre es 'login'
  // El Menú Principal se presenta únicamente cuando el usuario inicia sesión exitosamente.
  useEffect(() => {
    const savedUser = localStorage.getItem('vortex_user');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch {
        setCurrentUser(null);
      }
    }
  }, []);

  // Manejador de inicio de sesión exitoso (redirige directamente al Menú Principal)
  const handleLoginSuccess = (loginData) => {
    const user = loginData?.user || { username: loginData?.username || 'Piloto VORTEX' };
    setCurrentUser(user);
    setCurrentView('menu');
  };

  // Manejador de cierre de sesión
  const handleLogout = () => {
    localStorage.removeItem('vortex_token');
    localStorage.removeItem('vortex_user');
    setCurrentUser(null);
    setCurrentView('login');
  };

  // Manejador de finalización de calibración
  const handleCalibrationComplete = (params) => {
    setCalibrationData(params);
    setCurrentView('game');
  };

  return (
    <main style={{ width: '100%', minHeight: '100vh', position: 'relative' }}>
      {/* VISTA 1: INICIAR SESIÓN */}
      {currentView === 'login' && (
        <Login
          onLoginSuccess={handleLoginSuccess}
          onNavigateRegister={() => setCurrentView('register')}
          redirectUrl="/dashboard"
        />
      )}

      {/* VISTA 2: REGISTRO DE USUARIO */}
      {currentView === 'register' && (
        <Register
          onNavigateLogin={() => setCurrentView('login')}
        />
      )}

      {/* VISTA 3: MENÚ PRINCIPAL (POST-LOGIN VORTEX) */}
      {currentView === 'menu' && (
        <MainMenu
          user={currentUser}
          onStart={() => setCurrentView('levels')}
          onContinue={() => setCurrentView('levels')}
          onSettings={() => setCurrentView('config')}
          onExit={handleLogout}
        />
      )}

      {/* VISTA 4: SELECCIÓN DE NIVELES (solo el Tutorial lleva a calibración) */}
      {currentView === 'levels' && (
        <Levels
          onBack={() => setCurrentView('menu')}
          onSelectLevel={() => setCurrentView('calibration')}
        />
      )}

      {/* VISTA 5: CONFIGURACIÓN */}
      {currentView === 'config' && (
        <Configuracion
          onBack={() => setCurrentView('menu')}
        />
      )}

      {/* VISTA 6: CALIBRACIÓN BIOMECÁNICA PRE-PARTIDA */}
      {currentView === 'calibration' && (
        <Calibration
          onCalibrationComplete={handleCalibrationComplete}
          onBackToMenu={() => setCurrentView('menu')}
        />
      )}

      {/* VISTA 7: MOTOR DE JUEGO (GAME ENGINE PLACEHOLDER) */}
      {currentView === 'game' && (
        <GameEngine
          calibrationData={calibrationData}
          onBackToMenu={() => setCurrentView('menu')}
        />
      )}
    </main>
  );
}
