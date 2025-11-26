import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { Sales } from './pages/Sales';
import { Users } from './pages/Users';
import { UserRole } from './types';

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />
              
              <Route path="/" element={
                <Layout>
                  <Dashboard />
                </Layout>
              } />
              
              <Route path="/products" element={
                <Layout allowedRoles={[UserRole.MANAGER, UserRole.SALESPERSON]}>
                  <Products />
                </Layout>
              } />
              
              <Route path="/sales" element={
                <Layout>
                  <Sales />
                </Layout>
              } />
              
              <Route path="/users" element={
                <Layout allowedRoles={[UserRole.MANAGER]}>
                  <Users />
                </Layout>
              } />

              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Router>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;