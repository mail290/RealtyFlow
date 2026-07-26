
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Pipeline from './pages/Pipeline';
import ImageStudio from './pages/ImageStudio';
import MarketPulse from './pages/MarketPulse';
import LiveAssistant from './components/LiveAssistant';
import ContentCMS from './pages/ContentCMS';
import GrowthHub from './pages/GrowthHub';
import Settings from './pages/Settings';
import Inventory from './pages/Inventory';
import Care from './pages/Care';
import Login from './pages/Login';
import { authStore } from './services/authService';

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(authStore.isAuthenticated());

  useEffect(() => {
    return authStore.subscribe(() => {
      setIsAuthenticated(authStore.isAuthenticated());
    });
  }, []);

  return (
    <HashRouter>
      <Routes>
        {/* Offentlige ruter */}
        <Route path="/login" element={
          isAuthenticated ? <Navigate to="/" replace /> : <Login />
        } />

        {/* Beskyttede ruter */}
        <Route path="/*" element={
          isAuthenticated ? (
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/pipeline" element={<Pipeline />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/care" element={<Care />} />
                <Route path="/market" element={<MarketPulse />} />
                <Route path="/growth" element={<GrowthHub />} />
                <Route path="/studio" element={<ImageStudio />} />
                <Route path="/content" element={<ContentCMS />} />
                <Route path="/assistant" element={<div className="w-full py-4 lg:py-8"><LiveAssistant /></div>} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          ) : (
            <Navigate to="/login" replace />
          )
        } />
      </Routes>
    </HashRouter>
  );
};

export default App;
