import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { Menu, LogOut, MonitorSmartphone, UtensilsCrossed, PackageSearch, BarChart3, Settings } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getCurrentUser, getActiveStoreConfig } from '../../utils/db';
import CaixaOverlay from '../caixa/CaixaOverlay';
import { getActiveCaixa } from '../../utils/caixa';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getCurrentUser();
  const [isCaixaOpen, setIsCaixaOpen] = useState(!!getActiveCaixa());

  const handleLogout = () => {
    navigate('/login');
  };

  const navItems = [
    { name: 'Caixa / Painel', path: '/dashboard', icon: MonitorSmartphone },
    { name: 'Mesas', path: '/tables', icon: UtensilsCrossed },
    { name: 'Estoque', path: '/inventory', icon: PackageSearch },
    { name: 'Totem Balcão', path: '/kiosk', icon: MonitorSmartphone },
    { name: 'Relatórios', path: '/reports', icon: BarChart3 },
    { name: 'Administração', path: '/admin', icon: Settings },
  ];

  const storeConfig = getActiveStoreConfig();
  const isKioskServiceEnabled = storeConfig ? storeConfig.services?.kiosk !== false : true;

  const filteredNavItems = navItems.filter(item => {
    if (item.path === '/kiosk' && !isKioskServiceEnabled) {
      return false;
    }
    if (user?.permissions) {
      return user.permissions.includes(item.path) || (item.path === '/kiosk' && user.role === 'Gerente');
    }
    // Fallback for old data
    if (user?.role === 'Vendedor') {
      return item.path === '/tables';
    }
    return true; // Gerente tem tudo
  });

  useEffect(() => {
    // Determine the allowed routes for current user
    let allowedPaths: string[] = [];
    if (user?.permissions) {
      allowedPaths = [...user.permissions];
    } else {
      allowedPaths = user?.role === 'Vendedor' ? ['/tables'] : ['/dashboard', '/tables', '/inventory', '/reports', '/admin', '/kiosk'];
    }

    // Force add /kiosk if kiosk service is active and user is Gerente/Admin
    if (user?.role === 'Gerente' && isKioskServiceEnabled && !allowedPaths.includes('/kiosk')) {
      allowedPaths.push('/kiosk');
    }

    // Checking if current path is allowed
    const isAllowed = allowedPaths.some(p => location.pathname.startsWith(p));
    
    if (!isAllowed) {
      if (allowedPaths.length > 0) {
        navigate(allowedPaths[0]); // fallback to first allowed path
      } else {
        navigate('/login');
      }
    }
  }, [user, location.pathname, navigate, isKioskServiceEnabled]);

  const initials = user && user.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'MA';

  return (
    <div className="bg-surface text-on-surface min-h-screen pb-24 md:pb-0 flex flex-col md:flex-row">
      {user?.role === 'Caixa' && !isCaixaOpen && <CaixaOverlay onOpen={() => setIsCaixaOpen(true)} />}
      {/* TopAppBar */}
      <header className="fixed top-0 left-0 w-full z-50 bg-surface dark:bg-surface-dim shadow-sm flex items-center justify-between px-margin-mobile md:px-margin-page h-16">
        <div className="flex items-center gap-3">
          <button className="p-2 hover:bg-surface-variant transition-colors duration-200 active:scale-95 text-primary">
            <Menu size={24} />
          </button>
          <h1 className="text-headline-lg-mobile md:text-headline-lg font-bold text-primary">
            QuickServe POS
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {user?.name?.includes('Central Admin') && (
            <button
              onClick={() => {
                const centralAdminUser = {
                  id: 999,
                  name: 'Administrador Central Sênior',
                  role: 'CentralAdmin',
                  meta: 'SaaS SysOwner',
                  active: true,
                  permissions: ['/central-admin']
                };
                localStorage.setItem('qsp_current_user', JSON.stringify(centralAdminUser));
                navigate('/central-admin');
              }}
              className="bg-secondary-container text-on-secondary-container text-[11px] px-3 py-1.5 rounded-lg font-bold hover:brightness-95 active:scale-95 transition-all flex items-center gap-1.5"
            >
              Voltar à Central
            </button>
          )}
          <span className="hidden md:block text-caption text-on-surface-variant">Operador: {user?.name || 'Admin'}</span>
          <button onClick={handleLogout} className="p-2 hover:bg-surface-variant transition-colors duration-200 active:scale-95 text-primary">
            <LogOut size={24} />
          </button>
        </div>
      </header>

      {/* Sidebar Navigation (Desktop) - Simulated for Admin/Inventory based on HTML */}
      <aside className="hidden md:flex fixed left-0 top-16 bottom-0 w-64 bg-surface dark:bg-surface-container flex-col py-4 shadow-xl z-40">
        <div className="px-6 mb-8 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-secondary text-white flex items-center justify-center font-bold text-lg">{initials}</div>
          <div>
            <p className="font-bold text-on-surface">{user?.name || 'Admin'}</p>
            <p className="text-[12px] text-on-surface-variant">{user?.role || 'Gerente'} • {user?.meta || 'Turno Ativo'}</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-4 px-6 py-3 mx-2 rounded-lg transition-all",
                  isActive 
                    ? "bg-secondary-container text-on-secondary-container font-bold" 
                    : "text-on-surface-variant hover:bg-surface-variant"
                )}
              >
                <Icon size={20} />
                <span className="font-body-lg">{item.name}</span>
              </Link>
            )
          })}
        </nav>
        <div className="p-6 border-t border-surface-container">
          <button onClick={handleLogout} className="flex items-center gap-4 text-error font-bold w-full p-2 hover:bg-error-container/10 rounded-lg transition-all">
            <LogOut size={20} />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow pt-20 px-4 md:px-margin-page md:ml-64 max-w-container-max mx-auto w-full">
        <Outlet />
      </main>

      {/* Bottom Nav Bar (Mobile) */}
      <nav className="md:hidden fixed bottom-0 w-full z-50 rounded-t-xl bg-surface dark:bg-surface-container-high shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] flex justify-around items-center h-20 px-2 pb-safe bg-opacity-95">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-xl transition-all active:scale-110",
                isActive 
                  ? "bg-primary-container text-on-primary-container" 
                  : "text-on-surface-variant hover:bg-surface-variant"
              )}
            >
              <Icon size={24} />
              <span className="text-[10px] uppercase font-bold mt-1">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
