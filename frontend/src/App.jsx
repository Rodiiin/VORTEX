import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Register from './components/Register';
import MainMenu from './components/MainMenu';
import DashboardPlaceholder from './components/DashboardPlaceholder';

export default function App() {
  // Estado de vista de la aplicación: 'login' | 'register' | 'menu' | 'dashboard'
  const [currentView, setCurrentView] = useState('login');
  const [currentUser, setCurrentUser] = useState(null);

  // Comprobar si existe una sesión activa persistida en localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('vortex_token');
    const savedUser = localStorage.getItem('vortex_user');
    if (savedToken) {
      try {
        const userObj = savedUser ? JSON.parse(savedUser) : { username: 'Piloto VORTEX' };
        setCurrentUser(userObj);
        setCurrentView('menu');
      } catch {
        setCurrentUser({ username: 'Piloto VORTEX' });
        setCurrentView('menu');
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
          onSettings={() => console.log('Ajustes seleccionados')}
          onExit={handleLogout}
        />
      )}

      {/* VISTA 4: CENTRO DE CONTROL / DASHBOARD DE ENTRENAMIENTO */}
      {currentView === 'dashboard' && (
        <DashboardPlaceholder
          user={currentUser}
          onLogout={handleLogout}
        />
      )}
    </main>
  );
}
