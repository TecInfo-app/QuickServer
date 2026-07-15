import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Building2, Users, MonitorSmartphone, Shield, CheckCircle, AlertTriangle, Key, Trash2, 
  Plus, Search, HelpCircle, ArrowLeft, RefreshCw, LogIn, ExternalLink, ShieldAlert, BadgeInfo, Copy 
} from 'lucide-react';
import { Store, getStoredStores, saveStores, setCurrentUser, User, createNewStore, deleteStore } from '../utils/db';
import AlertModal from '../components/ui/AlertModal';

export default function CentralAdmin() {
  const navigate = useNavigate();
  const [stores, setStores] = useState<Store[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // New Store Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newStore, setNewStore] = useState({
    name: '',
    ownerName: '',
    email: '',
    password: '',
    status: 'ACTIVE' as const,
    services: {
      kiosk: true,
      advancedReports: true,
      unlimitedTables: true
    }
  });

  // Alert State
  const [alertState, setAlertState] = useState<{ 
    isOpen: boolean; 
    title: string; 
    message: string; 
    onConfirm?: () => void 
  }>({
    isOpen: false,
    title: '',
    message: ''
  });

  // Visible Passwords Mapping
  const [visiblePasswords, setVisiblePasswords] = useState<{ [storeId: string]: boolean }>({});

  useEffect(() => {
    const loadStores = () => {
      setStores(getStoredStores());
    };
    loadStores();
    window.addEventListener('qsp_database_updated', loadStores);
    return () => {
      window.removeEventListener('qsp_database_updated', loadStores);
    };
  }, []);

  useEffect(() => {
    // Ensure Firebase Auth is signed in as Central Admin so Firestore writes are authorized
    let unsubscribe: (() => void) | null = null;
    const checkAndSignInCentralAdmin = async () => {
      try {
        const { auth } = await import('../utils/firebase');
        const { signInWithEmailAndPassword, onAuthStateChanged } = await import('firebase/auth');
        
        unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (!user || user.email?.toLowerCase() !== 'iranildo@quickserve.com') {
            console.log("Enforcing Firebase Auth Central Admin sign in...");
            try {
              await signInWithEmailAndPassword(auth, 'iranildo@quickserve.com', '123456');
              console.log("Firebase Auth Central Admin sign in successful.");
            } catch (err) {
              console.error("Failed to sign in Central Admin in Firebase Auth:", err);
            }
          }
        });
      } catch (err) {
        console.error("Failed to automatically sign in Central Admin in Firebase Auth:", err);
      }
    };
    checkAndSignInCentralAdmin();
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const triggerAlert = (title: string, message: string, onConfirm?: () => void) => {
    setAlertState({ isOpen: true, title, message, onConfirm });
  };

  const handleTogglePassword = (storeId: string) => {
    setVisiblePasswords(prev => ({ ...prev, [storeId]: !prev[storeId] }));
  };

  // Generate random password
  const generatePassword = () => {
    const chars = '1234567890';
    let pass = '';
    for (let i = 0; i < 6; i++) {
      pass += chars[Math.floor(Math.random() * chars.length)];
    }
    setNewStore(prev => ({ ...prev, password: pass }));
  };

  // Create store slug
  const generateSlug = (name: string) => {
    return 'store_' + name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove accents
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .trim();
  };

  // Create New Store Handler
  const handleCreateStore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStore.name || !newStore.ownerName || !newStore.email || !newStore.password) {
      triggerAlert('Erro', 'Por favor preencha todos os campos obrigatórios.');
      return;
    }

    const storeId = generateSlug(newStore.name) + '_' + Date.now();
    const existing = getStoredStores();

    // Check email uniqueness across stores
    const emailConflict = existing.some(s => s.email.toLowerCase() === newStore.email.toLowerCase());
    if (emailConflict) {
      triggerAlert('Conflito', 'Já existe uma loja registrada com o e-mail/usuário master digitado.');
      return;
    }

    const createdStore: Store = {
      id: storeId,
      name: newStore.name,
      ownerName: newStore.ownerName,
      email: newStore.email,
      password: newStore.password,
      status: newStore.status,
      services: { ...newStore.services },
      createdAt: new Date().toISOString()
    };

    // Use our beautiful cloud + local seed helper!
    createNewStore(createdStore);

    // Refresh state list
    setStores(getStoredStores());
    setShowAddModal(false);

    // Success notify
    triggerAlert(
      'Loja Ativada!', 
      `A loja "${newStore.name}" foi criada com sucesso na central de administração e salva no Firebase!\n\nEnvie os dados de acesso ao cliente:\n• Usuário Master: ${newStore.email}\n• Senha Master: ${newStore.password}`
    );

    // Reset Form
    setNewStore({
      name: '',
      ownerName: '',
      email: '',
      password: '',
      status: 'ACTIVE',
      services: {
        kiosk: true,
        advancedReports: true,
        unlimitedTables: true
      }
    });
  };

  // Delete Store Handler
  const handleDeleteStore = (store: Store) => {
    triggerAlert(
      'Remover Loja?', 
      `Atenção: remover a loja "${store.name}" apagará permanentemente seu registro do SaaS central e do Firestore. Deseja continuar?`,
      () => {
        // Use our db helper to remove locally & from Firestore
        deleteStore(store.id);

        // Clear active store ID if we deleted the currently active store context
        const activeStoreId = localStorage.getItem('active_store_id');
        if (activeStoreId === store.id) {
          localStorage.removeItem('active_store_id');
        }

        // Refresh state list
        setStores(getStoredStores());

        // Wipe all dynamic prefix entries in localStorage for this store
        const storePrefix = `${store.id}_`;
        const keysToWipe: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(storePrefix)) {
            keysToWipe.push(key);
          }
        }
        keysToWipe.forEach(k => localStorage.removeItem(k));

        triggerAlert('Sucesso', `Registro da loja "${store.name}" e seus dados foram completamente excluídos.`);
      }
    );
  };

  // Toggle Services Addon
  const handleToggleService = (storeId: string, serviceKey: 'kiosk' | 'advancedReports' | 'unlimitedTables') => {
    const updated = stores.map(store => {
      if (store.id === storeId) {
        return {
          ...store,
          services: {
            ...store.services,
            [serviceKey]: !store.services[serviceKey]
          }
        };
      }
      return store;
    });
    setStores(updated);
    saveStores(updated);
  };

  // Toggle Store general status (ACTIVE/SUSPENDED)
  const handleToggleStoreStatus = (storeId: string) => {
    const updated = stores.map(store => {
      if (store.id === storeId) {
        const nextStatus = store.status === 'ACTIVE' ? 'SUSPENDED' as const : 'ACTIVE' as const;
        return {
          ...store,
          status: nextStatus
        };
      }
      return store;
    });
    setStores(updated);
    saveStores(updated);
  };

  // Impersonate Store (Quick login into client store)
  const handleImpersonateStore = (store: Store) => {
    triggerAlert(
      'Ambiente do Cliente',
      `Você será redirecionado para gerenciar e visualizar a loja "${store.name}" de forma virtualizada como se fosse o Proprietário. Continuar?`,
      () => {
        // Set active store ID
        localStorage.setItem('active_store_id', store.id);
        
        // Define representing user as Store Manager
        const impersonatingUser: User = {
          id: 100,
          name: `${store.ownerName} (Central Admin)`,
          role: 'Gerente',
          meta: 'Suporte Central',
          active: true,
          permissions: ['/dashboard', '/tables', '/inventory', '/reports', '/admin']
        };

        setCurrentUser(impersonatingUser);
        navigate('/dashboard');
      }
    );
  };

  // Return to Login / Exit Central Panel
  const handleLogoutCentral = () => {
    localStorage.removeItem('qsp_current_user');
    navigate('/login');
  };

  // Stats Counters
  const totalStores = stores.length;
  const activeStores = stores.filter(s => s.status === 'ACTIVE').length;
  const suspendedStores = stores.filter(s => s.status === 'SUSPENDED').length;
  const totemStores = stores.filter(s => s.services?.kiosk).length;

  const filteredStores = stores.filter(store => 
    (store.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (store.ownerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (store.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStoreLink = (storeId: string) => {
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}#/login?store=${storeId}`;
  };

  return (
    <div className="min-h-screen bg-surface px-margin-mobile md:px-margin-page py-6">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-surface-container/60 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 text-primary flex items-center justify-center rounded-xl">
              <Shield size={24} />
            </div>
            <h1 className="text-headline-lg font-bold text-on-surface">Painel Central de Lojas SaaS</h1>
          </div>
          <p className="text-caption text-on-surface-variant mt-1">
            Controle de licenciamento do sistema, liberação de Totem Autoatendimento e gerenciamento de franqueados/clientes.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-3 bg-brand-primary text-on-primary font-bold rounded-xl flex items-center gap-2 hover:brightness-95 active:scale-95 transition-all cursor-pointer text-caption"
          >
            <Plus size={18} />
            Cadastrar Nova Loja
          </button>
          <button
            onClick={handleLogoutCentral}
            className="px-4 py-3 bg-surface border border-outline-variant text-on-surface font-semibold rounded-xl hover:bg-surface-variant flex items-center gap-2 transition-all cursor-pointer text-caption"
          >
            <ArrowLeft size={16} />
            Sair do Painel
          </button>
        </div>
      </header>

      {/* Stats Counter Row */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-on-surface-variant/70 uppercase tracking-wider">Lojas Cadastradas</p>
            <p className="text-display font-extrabold text-on-surface">{totalStores}</p>
          </div>
          <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center rounded-xl">
            <Building2 size={24} />
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-on-surface-variant/70 uppercase tracking-wider">Lojas Ativas</p>
            <p className="text-display font-extrabold text-success">{activeStores}</p>
          </div>
          <div className="w-12 h-12 bg-success/10 text-success flex items-center justify-center rounded-xl">
            <CheckCircle size={24} />
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-on-surface-variant/70 uppercase tracking-wider">Lojas Suspensas</p>
            <p className="text-display font-extrabold text-error">{suspendedStores}</p>
          </div>
          <div className="w-12 h-12 bg-error/10 text-error flex items-center justify-center rounded-xl">
            <AlertTriangle size={24} />
          </div>
        </div>

        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-6 flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <p className="text-[11px] font-bold text-on-surface-variant/70 uppercase tracking-wider">Totem Habilitado</p>
            <p className="text-display font-extrabold text-secondary">{totemStores}</p>
          </div>
          <div className="w-12 h-12 bg-secondary/10 text-secondary flex items-center justify-center rounded-xl">
            <MonitorSmartphone size={24} />
          </div>
        </div>
      </section>

      {/* Main Table Card */}
      <main className="bg-surface-container-lowest border border-outline-variant/30 rounded-3xl overflow-hidden shadow-sm">
        <header className="p-6 border-b border-surface-container flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Building2 className="text-primary" size={24} />
            <h2 className="text-title-large font-bold text-on-surface">Diretório Central de Clientes</h2>
          </div>

          <div className="relative max-w-xs w-full">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-on-surface-variant">
              <Search size={18} />
            </div>
            <input
              type="text"
              placeholder="Pesquisar loja, proprietário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-surface-alt border border-outline-variant rounded-xl text-caption focus:border-primary outline-none transition-all placeholder:text-on-surface-variant/60 text-on-surface"
            />
          </div>
        </header>

        {filteredStores.length === 0 ? (
          <div className="p-12 text-center text-on-surface-variant">
            <Building2 className="mx-auto text-on-surface-variant/35 mb-4 animate-pulse" size={48} />
            <p className="text-body-lg font-bold">Nenhuma loja encontrada</p>
            <p className="text-caption mt-1">Experimente remover os filtros de busca ou cadastre uma nova loja.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-alt/70 border-b border-surface-container text-caption font-bold text-on-surface-variant/80 uppercase tracking-wider">
                  <th className="py-4 px-6">Identificação da Loja</th>
                  <th className="py-4 px-6">Proprietário / Slug ID</th>
                  <th className="py-4 px-6">Link Único de Loja</th>
                  <th className="py-4 px-6">Credenciais Master</th>
                  <th className="py-4 px-6">Serviços Habilitados</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {filteredStores.map(store => (
                  <tr key={store.id} className="hover:bg-surface-alt/40 transition-colors group">
                    <td className="py-5 px-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${store.status === 'SUSPENDED' ? 'bg-surface-variant text-on-surface-variant' : 'bg-success/10 text-success'}`}>
                          <Building2 size={20} />
                        </div>
                        <div>
                          <p className="text-body-lg font-bold text-on-surface flex items-center gap-2">
                            {store.name}
                            {store.status === 'SUSPENDED' && (
                              <span className="text-[9px] bg-error-container text-error px-1.5 py-0.5 rounded uppercase font-bold tracking-wide">
                                Suspenso
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-on-surface-variant">Cadastrado em: {new Date(store.createdAt).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-5 px-6">
                      <div>
                        <p className="text-body-medium font-semibold text-on-surface">{store.ownerName}</p>
                        <p className="font-mono text-[10px] text-primary bg-primary-container/20 px-2 py-0.5 rounded w-fit mt-1 select-all">
                          {store.id}
                        </p>
                      </div>
                    </td>

                    <td className="py-5 px-6">
                      <div className="flex flex-col gap-1 max-w-[220px]">
                        <span className="font-mono text-[10px] text-secondary bg-secondary-container/10 border border-secondary/20 px-2 py-1 rounded select-all break-all block overflow-hidden text-ellipsis whitespace-nowrap" title={getStoreLink(store.id)}>
                          {getStoreLink(store.id)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(getStoreLink(store.id));
                            triggerAlert('Copiado!', 'Link único da loja copiado para a área de transferência com sucesso!');
                          }}
                          className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1 self-start cursor-pointer"
                        >
                          <Copy size={12} /> Copiar Link
                        </button>
                      </div>
                    </td>

                    <td className="py-5 px-6">
                      <div className="space-y-1 font-mono text-[11px]">
                        <p className="text-on-surface-variant">
                          Reg.: <span className="text-on-surface font-semibold bg-surface-alt/70 px-2 py-0.5 rounded">{store.email}</span>
                        </p>
                        <div className="flex items-center gap-1.5 text-on-surface-variant">
                          <span>Senha:</span>
                          <span className="text-on-surface font-bold bg-surface-alt/70 px-1.5 py-0.5 rounded">
                            {visiblePasswords[store.id] ? store.password : '••••'}
                          </span>
                          <button
                            onClick={() => handleTogglePassword(store.id)}
                            className="text-primary hover:underline text-[10px]"
                          >
                            {visiblePasswords[store.id] ? 'ocultar' : 'revelar'}
                          </button>
                        </div>
                      </div>
                    </td>

                     <td className="py-5 px-6">
                      <div className="flex flex-col gap-2">
                        {/* Kiosk Service Toggle */}
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!!store.services?.kiosk}
                            onChange={() => handleToggleService(store.id, 'kiosk')}
                            className="w-4 h-4 rounded border-outline-variant text-secondary-dim focus:ring-secondary"
                          />
                          <span className={`text-caption ${store.services?.kiosk ? 'text-secondary font-bold' : 'text-on-surface-variant/60 line-through'}`}>
                            Totem Autoatendimento
                          </span>
                        </label>

                        {/* Enhanced reports toggle */}
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!!store.services?.advancedReports}
                            onChange={() => handleToggleService(store.id, 'advancedReports')}
                            className="w-4 h-4 rounded border-outline-variant text-secondary-dim focus:ring-secondary"
                          />
                          <span className={`text-caption ${store.services?.advancedReports ? 'text-secondary font-bold' : 'text-on-surface-variant/60 line-through'}`}>
                            Relatórios Avançados
                          </span>
                        </label>

                        {/* Unlimited Tables toggle */}
                        <label className="flex items-center gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!!store.services?.unlimitedTables}
                            onChange={() => handleToggleService(store.id, 'unlimitedTables')}
                            className="w-4 h-4 rounded border-outline-variant text-secondary-dim focus:ring-secondary"
                          />
                          <span className={`text-caption ${store.services?.unlimitedTables ? 'text-secondary font-bold' : 'text-on-surface-variant/60 line-through'}`}>
                            Mesas Ilimitadas
                          </span>
                        </label>
                      </div>
                    </td>

                    <td className="py-5 px-6 text-center">
                      <button
                        onClick={() => handleToggleStoreStatus(store.id)}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${
                          store.status === 'ACTIVE'
                            ? 'bg-success/15 text-success border-success/30 hover:bg-success/25'
                            : 'bg-error/15 text-error border-error/30 hover:bg-error/25'
                        }`}
                      >
                        {store.status === 'ACTIVE' ? '✓ Ativo' : '⚠ Suspenso'}
                      </button>
                    </td>

                    <td className="py-5 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Impersonate */}
                        <button
                          onClick={() => handleImpersonateStore(store)}
                          className="p-2 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded-lg transition-all flex items-center justify-center"
                          title="Entrar/Acessar Ambiente Virtual da Loja"
                        >
                          <LogIn size={16} />
                        </button>

                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteStore(store)}
                          className="p-2 hover:bg-error-container/20 text-error rounded-lg opacity-40 group-hover:opacity-100 transition-opacity"
                          title="Excluir Loja permanentemente"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Info Warning Container */}
      <footer className="mt-8 bg-surface-container-low p-5 rounded-2xl border border-outline-variant/30 flex items-start gap-4">
        <ShieldAlert className="text-secondary shrink-0" size={24} />
        <div>
          <h4 className="text-body-lg font-bold text-on-surface">Instruções de Licenciamento Multi-Lojas</h4>
          <p className="text-caption text-on-surface-variant leading-relaxed mt-1">
            Cada cliente cadastrado possui armazenamento isolado no dispositivo/terminal de vendas (através do SlugID dinâmico como prefixo de LocalStorage). 
            Ao habilitar ou desabilitar o status de <strong>Totem Autoatendimento</strong> ou <strong>Relatórios Financeiros Avançados</strong>, os limites de acessos serão refletidos nas respectivas contas assim que realizarem o login.
          </p>
        </div>
      </footer>

      {/* CREATE NEW STORE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-scrim/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-surface-container-lowest max-w-lg w-full rounded-[28px] overflow-hidden border border-outline-variant/30 shadow-2xl">
            <header className="p-6 border-b border-surface-container bg-surface-alt">
              <div className="flex items-center gap-3">
                <Building2 className="text-primary font-bold" size={24} />
                <h3 className="text-title-large font-bold text-on-surface">Cadastrar Nova Loja</h3>
              </div>
              <p className="text-caption text-on-surface-variant mt-1">Insira as informações comerciais para emitir o login de acesso do cliente.</p>
            </header>

            <form onSubmit={handleCreateStore} className="p-6 space-y-4">
              <div>
                <label className="block text-caption font-semibold text-on-surface-variant mb-1 ml-1" htmlFor="storeName">Nome Comercial do Estabelecimento *</label>
                <input
                  id="storeName"
                  type="text"
                  placeholder="Ex: Pizzaria Forno Nobre"
                  value={newStore.name}
                  onChange={(e) => setNewStore({ ...newStore, name: e.target.value })}
                  required
                  className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 focus:border-primary outline-none transition-all text-body-medium text-on-surface placeholder:text-on-surface-variant/40"
                />
              </div>

              <div>
                <label className="block text-caption font-semibold text-on-surface-variant mb-1 ml-1" htmlFor="store_owner">Nome do Proprietário / Gestor principal *</label>
                <input
                  id="store_owner"
                  type="text"
                  placeholder="Ex: Carlos Roberto Mendes"
                  value={newStore.ownerName}
                  onChange={(e) => setNewStore({ ...newStore, ownerName: e.target.value })}
                  required
                  className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 focus:border-primary outline-none transition-all text-body-medium text-on-surface placeholder:text-on-surface-variant/40"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-caption font-semibold text-on-surface-variant mb-1 ml-1" htmlFor="store_email">Email / Login Master *</label>
                  <input
                    id="store_email"
                    type="text"
                    placeholder="Ex: carlos@pizzaria.com"
                    value={newStore.email}
                    onChange={(e) => setNewStore({ ...newStore, email: e.target.value })}
                    required
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 focus:border-primary outline-none transition-all text-body-medium text-on-surface placeholder:text-on-surface-variant/40 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-caption font-semibold text-on-surface-variant mb-1 ml-1" htmlFor="store_password">Senha de Acesso Master *</label>
                  <div className="flex gap-2">
                    <input
                      id="store_password"
                      type="text"
                      placeholder="Ex: 4819"
                      value={newStore.password}
                      onChange={(e) => setNewStore({ ...newStore, password: e.target.value })}
                      required
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2.5 focus:border-primary outline-none transition-all text-body-medium text-on-surface placeholder:text-on-surface-variant/40 font-mono"
                    />
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="px-3 bg-secondary-container text-on-secondary-container rounded-xl font-bold text-caption whitespace-nowrap hover:brightness-95 transition-all text-[11px]"
                    >
                      Gerar Senha
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-surface-container pt-4">
                <p className="text-caption font-bold text-on-surface mb-2">Serviços Habilitados de Início:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface-alt p-4 rounded-xl border border-outline-variant/30">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newStore.services.kiosk}
                      onChange={(e) => setNewStore({
                        ...newStore,
                        services: { ...newStore.services, kiosk: e.target.checked }
                      })}
                      className="w-5 h-5 rounded border-outline-variant text-secondary-dim focus:ring-secondary"
                    />
                    <span className="text-caption font-semibold text-on-surface">Totem de Autoatendimento</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newStore.services.advancedReports}
                      onChange={(e) => setNewStore({
                        ...newStore,
                        services: { ...newStore.services, advancedReports: e.target.checked }
                      })}
                      className="w-5 h-5 rounded border-outline-variant text-secondary-dim focus:ring-secondary"
                    />
                    <span className="text-caption font-semibold text-on-surface">Relatórios Financeiros</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newStore.services.unlimitedTables}
                      onChange={(e) => setNewStore({
                        ...newStore,
                        services: { ...newStore.services, unlimitedTables: e.target.checked }
                      })}
                      className="w-5 h-5 rounded border-outline-variant text-secondary-dim focus:ring-secondary"
                    />
                    <span className="text-caption font-semibold text-on-surface">Mesas Ilimitadas</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-surface-container">
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-brand-primary text-on-primary font-bold rounded-xl active:scale-[0.98] transition-all hover:brightness-95 text-caption text-center"
                >
                  Confirmar e Ativar Loja
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-5 py-3 border border-outline-variant rounded-xl text-on-surface font-semibold hover:bg-surface-variant transition-all text-caption"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={alertState.onConfirm}
      />
    </div>
  );
}
