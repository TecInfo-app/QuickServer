import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { Menu, LogOut, MonitorSmartphone, UtensilsCrossed, PackageSearch, BarChart3, Settings, ExternalLink, Building2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getCurrentUser, getActiveStoreConfig, checkAndApplyStoreFromURL, getStoreSlug } from '../../utils/db';
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

  useEffect(() => {
    checkAndApplyStoreFromURL();
  }, [location.search, location.hash]);

  const storeConfig = getActiveStoreConfig();
  const currentStoreSlug = storeConfig ? getStoreSlug(storeConfig) : '';

  useEffect(() => {
    if (storeConfig && storeConfig.name) {
      document.title = `${storeConfig.name} - QuickServe POS`;
    } else {
      document.title = 'QuickServe POS';
    }
  }, [storeConfig]);

  const handleLogout = () => {
    const logoutTarget = currentStoreSlug ? `/login?store=${currentStoreSlug}` : '/login';
    navigate(logoutTarget);
  };

  const navItems = [
    { name: 'Caixa / Painel', path: '/dashboard', icon: MonitorSmartphone },
    { name: 'Mesas', path: '/tables', icon: UtensilsCrossed },
    { name: 'Estoque', path: '/inventory', icon: PackageSearch },
    { name: 'Totem Balcão', path: '/kiosk', icon: MonitorSmartphone, target: '_blank' },
    { name: 'Relatórios', path: '/reports', icon: BarChart3 },
    { name: 'Administração', path: '/admin', icon: Settings },
  ];

  const getNavPath = (basePath: string) => {
    return currentStoreSlug ? `${basePath}?store=${currentStoreSlug}` : basePath;
  };

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
    if (!user || user.role === 'Cliente') {
      navigate(currentStoreSlug ? `/login?store=${currentStoreSlug}` : '/login');
      return;
    }

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
        // Prefer dashboard or tables over kiosk as fallback route
        const fallback = allowedPaths.find(p => p !== '/kiosk') || allowedPaths[0];
        navigate(fallback);
      } else {
        navigate('/login');
      }
    }
  }, [user, location.pathname, navigate, isKioskServiceEnabled, currentStoreSlug]);

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
          <div className="flex items-center gap-3">
            <h1 className="text-headline-lg-mobile md:text-headline-lg font-bold text-primary">
              QuickServe POS
            </h1>
            {storeConfig?.name && (
              <div className="hidden sm:flex items-center gap-1.5 bg-brand-primary/10 border border-brand-primary/20 px-3 py-1 rounded-xl text-caption font-extrabold text-brand-primary">
                <Building2 size={16} />
                <span className="truncate max-w-[200px]">{storeConfig.name}</span>
              </div>
            )}
          </div>
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
          <div className="w-12 h-12 rounded-full bg-secondary text-white flex items-center justify-center font-bold text-lg shrink-0">{initials}</div>
          <div className="overflow-hidden">
            <p className="font-bold text-on-surface truncate">{user?.name || 'Admin'}</p>
            <p className="text-[12px] text-on-surface-variant">{user?.role || 'Gerente'} • {user?.meta || 'Turno Ativo'}</p>
            {storeConfig?.name && (
              <div className="flex items-center gap-1.5 text-caption font-bold text-primary mt-1">
                <Building2 size={14} className="shrink-0" />
                <span className="truncate max-w-[150px]">{storeConfig.name}</span>
              </div>
            )}
          </div>
        </div>
        <nav className="flex-1 space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = item.icon;
            const targetProp = (item as any).target;
            const targetPath = getNavPath(item.path);

            if (targetProp === '_blank') {
              const fullHref = `${window.location.origin}${window.location.pathname}#${targetPath}`;
              return (
                <a
                  key={item.path}
                  href={fullHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-4 px-6 py-3 mx-2 rounded-lg transition-all",
                    isActive 
                      ? "bg-secondary-container text-on-secondary-container font-bold" 
                      : "text-on-surface-variant hover:bg-surface-variant"
                  )}
                >
                  <Icon size={20} />
                  <span className="font-body-lg flex-grow flex items-center justify-between gap-1.5">
                    <span>{item.name}</span>
                    <ExternalLink size={14} className="opacity-60" />
                  </span>
                </a>
              );
            }

            return (
              <Link
                key={item.path}
                to={targetPath}
                className={cn(
                  "flex items-center gap-4 px-6 py-3 mx-2 rounded-lg transition-all",
                  isActive 
                    ? "bg-secondary-container text-on-secondary-container font-bold" 
                    : "text-on-surface-variant hover:bg-surface-variant"
                )}
              >
                <Icon size={20} />
                <span className="font-body-lg flex-grow flex items-center justify-between gap-1.5">
                  <span>{item.name}</span>
                </span>
              </Link>
            );
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
          const targetProp = (item as any).target;
          const targetPath = getNavPath(item.path);

          if (targetProp === '_blank') {
            const fullHref = `${window.location.origin}${window.location.pathname}#${targetPath}`;
            return (
              <a
                key={item.path}
                href={fullHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex flex-col items-center justify-center p-2 rounded-xl transition-all active:scale-110",
                  isActive 
                    ? "bg-primary-container text-on-primary-container" 
                    : "text-on-surface-variant hover:bg-surface-variant"
                )}
              >
                <Icon size={24} />
                <span className="text-[10px] uppercase font-bold mt-1 flex items-center gap-0.5">
                  <span>{item.name}</span>
                  <ExternalLink size={10} className="opacity-60" />
                </span>
              </a>
            );
          }

          return (
            <Link
              key={item.path}
              to={targetPath}
              className={cn(
                "flex flex-col items-center justify-center p-2 rounded-xl transition-all active:scale-110",
                isActive 
                  ? "bg-primary-container text-on-primary-container" 
                  : "text-on-surface-variant hover:bg-surface-variant"
              )}
            >
              <Icon size={24} />
              <span className="text-[10px] uppercase font-bold mt-1 flex items-center gap-0.5">
                <span>{item.name}</span>
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
