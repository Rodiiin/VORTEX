import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Register from './components/Register';
import DashboardPlaceholder from './components/DashboardPlaceholder';

export default function App() {
  // Estado de vista de la aplicación: 'login' | 'register' | 'dashboard'
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
        setCurrentView('dashboard');
      } catch {
        setCurrentUser({ username: 'Piloto VORTEX' });
        setCurrentView('dashboard');
      }
    }
  }, []);

  // Manejador de inicio de sesión exitoso
  const handleLoginSuccess = (loginData) => {
    const user = loginData?.user || { username: loginData?.username || 'Piloto VORTEX' };
    setCurrentUser(user);
    setCurrentView('dashboard');
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

      {/* VISTA 3: PLACEHOLDER POST-LOGIN / DASHBOARD */}
      {currentView === 'dashboard' && (
        <DashboardPlaceholder
          user={currentUser}
          onLogout={handleLogout}
        />
      )}
    </main>
  );
}
