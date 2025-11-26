import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { UserRole } from '../types';
import { 
  LogOut, 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  Menu,
  X,
  Moon,
  Sun,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Link, useLocation, Navigate } from 'react-router-dom';

interface LayoutProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export const Layout: React.FC<LayoutProps> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-slate-900">
        <div className="bg-white dark:bg-slate-800 p-8 rounded-lg shadow-md text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Acesso Negado</h1>
          <p className="text-gray-600 dark:text-gray-300 mb-4">Você não tem permissão para acessar esta página.</p>
          <Link to="/" className="text-blue-600 hover:underline">Voltar ao Início</Link>
        </div>
      </div>
    );
  }

  const navItems = [
    { 
      label: 'Dashboard', 
      path: '/', 
      icon: LayoutDashboard, 
      roles: [UserRole.MANAGER, UserRole.SALESPERSON, UserRole.CASHIER] 
    },
    { 
      label: 'Vendas', 
      path: '/sales', 
      icon: ShoppingCart, 
      roles: [UserRole.MANAGER, UserRole.SALESPERSON, UserRole.CASHIER] 
    },
    { 
      label: 'Produtos', 
      path: '/products', 
      icon: Package, 
      roles: [UserRole.MANAGER, UserRole.SALESPERSON] 
    },
    { 
      label: 'Usuários', 
      path: '/users', 
      icon: Users, 
      roles: [UserRole.MANAGER] 
    },
  ];

  const filteredNav = navItems.filter(item => user && item.roles.includes(user.role));

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-slate-900 overflow-hidden transition-colors duration-200">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 bg-slate-900 dark:bg-slate-950 text-white transform transition-all duration-300 ease-in-out
        lg:translate-x-0 lg:static lg:inset-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isCollapsed ? 'w-64 lg:w-20' : 'w-64'}
      `}>
        {/* Header */}
        <div className={`flex items-center h-16 bg-slate-950 dark:bg-black transition-all duration-300 ${isCollapsed ? 'justify-center px-0' : 'justify-between px-6'}`}>
          {!isCollapsed && <span className="text-xl font-bold tracking-wider whitespace-nowrap">ERP SYSTEM</span>}
          {isCollapsed && <span className="text-xl font-bold tracking-wider">ERP</span>}
          
          {/* Mobile Close Button */}
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-400">
            <X size={24} />
          </button>

          {/* Desktop Collapse Button */}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className={`hidden lg:flex items-center justify-center text-gray-400 hover:text-white transition-colors ${!isCollapsed ? '' : 'absolute -right-3 top-6 bg-slate-800 rounded-full p-1 border border-slate-700 shadow-lg'}`}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={20} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {filteredNav.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                title={isCollapsed ? item.label : ''}
                onClick={() => setIsSidebarOpen(false)}
                className={`flex items-center py-3 rounded-lg transition-colors group relative
                  ${isActive 
                    ? 'bg-blue-600 text-white' 
                    : 'text-gray-400 hover:bg-slate-800 hover:text-white'}
                  ${isCollapsed ? 'justify-center px-0' : 'space-x-3 px-4'}
                `}
              >
                <Icon size={20} className="shrink-0" />
                {!isCollapsed && <span className="whitespace-nowrap overflow-hidden transition-all duration-200">{item.label}</span>}
                
                {/* Tooltip for collapsed mode */}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-lg border border-slate-700">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>
        
        {/* Footer Actions */}
        <div className="absolute bottom-0 w-full p-4 bg-slate-950 dark:bg-black border-t border-slate-800">
           {/* Theme Toggle */}
           <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Mudar para Claro' : 'Mudar para Escuro'}
            className={`flex items-center mb-4 text-gray-400 hover:text-white hover:bg-slate-900 rounded-lg w-full transition-colors py-2
              ${isCollapsed ? 'justify-center px-0' : 'space-x-3 px-4'}
            `}
          >
            {theme === 'dark' ? <Sun size={20} className="shrink-0" /> : <Moon size={20} className="shrink-0" />}
            {!isCollapsed && <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>}
          </button>

          {/* User Profile */}
          <div className={`flex items-center mb-4 pt-4 border-t border-slate-800 ${isCollapsed ? 'justify-center px-0 flex-col gap-2' : 'space-x-3 px-2'}`}>
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm font-bold shrink-0 text-white cursor-default" title={user?.name}>
              {user?.name.charAt(0)}
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate w-32">{user?.name}</p>
                <p className="text-xs text-gray-400 truncate capitalize">{user?.role?.toLowerCase()}</p>
              </div>
            )}
          </div>

          {/* Logout */}
          <button
            onClick={logout}
            title="Sair do Sistema"
            className={`flex items-center w-full py-2 text-sm text-red-400 hover:bg-slate-900 rounded-lg transition-colors
               ${isCollapsed ? 'justify-center px-0' : 'space-x-2 px-4 justify-center'}
            `}
          >
            <LogOut size={16} className="shrink-0" />
            {!isCollapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-800 border-b dark:border-slate-700 lg:hidden">
          <button onClick={() => setIsSidebarOpen(true)} className="text-gray-600 dark:text-gray-300">
            <Menu size={24} />
          </button>
          <span className="font-semibold text-gray-800 dark:text-white">ERP Sales Manager</span>
          <div className="w-6" /> {/* Spacer */}
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-slate-900 p-6 transition-colors duration-200">
          {children}
        </main>
      </div>
    </div>
  );
};