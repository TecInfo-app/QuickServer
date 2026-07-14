import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BadgeDollarSign, Utensils, PackageSearch, BarChart3, Settings, ReceiptText, RefreshCw, CheckCircle2 } from 'lucide-react';
import { getCurrentUser, getStoredTransactions, getStoredTables } from '../utils/db';

import CaixaOperations from '../components/caixa/CaixaOperations';
import { getActiveCaixa } from '../utils/caixa';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [totalSales, setTotalSales] = useState(0);
  const [activeTablesCount, setActiveTablesCount] = useState(0);
  const [totalTablesCount, setTotalTablesCount] = useState(20);

  useEffect(() => {
    const loadDashboard = () => {
      // Load dynamic user and live stats
      const current = getCurrentUser();
      setUser(current);

      const activeCaixa = getActiveCaixa();
      const transactions = getStoredTransactions();
      
      // Filter transactions by current shift if Caixa is open
      const shiftTransactions = activeCaixa 
        ? transactions.filter(tx => tx.caixaId === activeCaixa.id)
        : [];

      const salesSum = shiftTransactions.reduce((sum, tx) => sum + tx.total, 0);
      setTotalSales(salesSum);

      const tables = getStoredTables();
      const activeCount = tables.filter(t => t.status === 'ACTIVE').length;
      setActiveTablesCount(activeCount);
      setTotalTablesCount(tables.length > 20 ? tables.length : 20);
    };

    loadDashboard();

    window.addEventListener('qsp_database_updated', loadDashboard);
    return () => window.removeEventListener('qsp_database_updated', loadDashboard);
  }, []);

  // Format today's date in PT-BR
  const getFormattedDate = () => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'short' };
    const dateStr = new Date().toLocaleDateString('pt-BR', options);
    // Capitalize first letter
    return dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  };

  return (
    <>
      {/* Welcome Section */}
      <section className="mt-4 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-caption text-on-surface-variant">{getFormattedDate()}</p>
            <h2 className="text-headline-lg text-on-surface">Bem-vindo de volta, {user ? user.name : 'Operador'}</h2>
            <p className="text-body-lg text-on-surface-variant">Turno: {user ? user.meta : 'Bar Noturno'}</p>
          </div>
          <div className="h-14 w-14 rounded-full border-2 border-secondary overflow-hidden flex items-center justify-center bg-secondary text-white font-bold text-lg">
            {user && user.name ? user.name.slice(0, 2).toUpperCase() : 'MA'}
          </div>
        </div>
      </section>

      {/* Stats Overview */}
      <section className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-surface-container-lowest p-5 rounded-3xl card-shadow border border-surface-variant/30">
          <div className="flex items-center gap-2 mb-2">
            <BadgeDollarSign className="text-success fill-success/20" size={20} />
            <span className="text-caption text-on-surface-variant">Faturamento do Turno</span>
          </div>
          <p className="text-stat-value text-on-surface">R$ {totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        
        <div className="bg-surface-container-lowest p-5 rounded-3xl card-shadow border border-surface-variant/30">
          <div className="flex items-center gap-2 mb-2">
            <Utensils className="text-secondary fill-secondary/20" size={20} />
            <span className="text-caption text-on-surface-variant">Mesas Ativas</span>
          </div>
          <p className="text-stat-value text-on-surface">{activeTablesCount} / {totalTablesCount}</p>
        </div>
      </section>

      {/* Caixa Operations */}
      <CaixaOperations />

      {/* Action Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tables/Orders Card */}
        <Link 
          to="/tables"
          className="flex flex-col items-start p-6 rounded-[24px] bg-secondary text-on-secondary text-left card-shadow hover:brightness-95 transition-all duration-200 active:scale-[0.98] group overflow-hidden relative"
        >
          <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <Utensils size={120} />
          </div>
          <div className="bg-white/20 p-3 rounded-xl mb-4">
            <Utensils className="text-on-secondary" size={24} />
          </div>
          <h3 className="text-headline-md mb-1">Mesas e Comandas</h3>
          <p className="text-caption text-white/80">Gerencie o mapa de mesas e comandas em tempo real</p>
        </Link>

        {/* Product Inventory Card */}
        <Link 
          to="/inventory"
          className="flex flex-col items-start p-6 rounded-[24px] bg-primary text-on-primary text-left card-shadow hover:brightness-95 transition-all duration-200 active:scale-[0.98] group overflow-hidden relative"
        >
          <div className="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <PackageSearch size={120} />
          </div>
          <div className="bg-white/20 p-3 rounded-xl mb-4">
            <PackageSearch className="text-on-primary" size={24} />
          </div>
          <h3 className="text-headline-md mb-1">Painel de Estoque</h3>
          <p className="text-caption text-white/80">Controle de estoque, preços e menu</p>
        </Link>

        {/* Sales Reports Card */}
        <Link 
          to="/reports"
          className="flex flex-col items-start p-6 rounded-[24px] bg-surface-container-highest text-on-surface text-left card-shadow border border-surface-variant/50 hover:bg-surface-variant transition-all duration-200 active:scale-[0.98] group overflow-hidden relative"
        >
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
            <BarChart3 size={120} />
          </div>
          <div className="bg-tertiary-container/20 p-3 rounded-xl mb-4">
            <BarChart3 className="text-tertiary-container" size={24} />
          </div>
          <h3 className="text-headline-md mb-1">Relatórios de Vendas</h3>
          <p className="text-caption text-on-surface-variant">Lucro diário, métodos de pagamento e fluxo</p>
        </Link>

        {/* User Admin Card */}
        <Link 
          to="/admin"
          className="flex flex-col items-start p-6 rounded-[24px] bg-surface-container-highest text-on-surface text-left card-shadow border border-surface-variant/50 hover:bg-surface-variant transition-all duration-200 active:scale-[0.98] group overflow-hidden relative"
        >
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
            <Settings size={120} />
          </div>
          <div className="bg-outline-variant/30 p-3 rounded-xl mb-4">
            <Settings className="text-outline" size={24} />
          </div>
          <h3 className="text-headline-md mb-1 text-on-surface">Gerência e Equipe</h3>
          <p className="text-caption text-on-surface-variant">Cadastro de funcionários e controle de acessos</p>
        </Link>
      </section>

      {/* Quick Access / Recent Activities */}
      <section className="mt-10 mb-6">
        <h3 className="text-headline-md text-on-surface mb-4 px-1">Atividades Recentes</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-4 bg-surface-container-lowest p-4 rounded-2xl shadow-sm border border-surface-variant/20">
            <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center text-primary">
              <ReceiptText size={20} />
            </div>
            <div className="flex-grow">
              <p className="text-body-lg text-on-surface font-semibold">Novo Pedido #8241</p>
              <p className="text-caption text-on-surface-variant">Mesa 4 • 2 min atrás</p>
            </div>
            <p className="text-body-lg text-on-surface font-bold">R$ 42,50</p>
          </div>
          
          <div className="flex items-center gap-4 bg-surface-container-lowest p-4 rounded-2xl shadow-sm border border-surface-variant/20">
            <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-secondary">
              <RefreshCw size={20} />
            </div>
            <div className="flex-grow">
              <p className="text-body-lg text-on-surface font-semibold">Sincronização de Estoque</p>
              <p className="text-caption text-on-surface-variant">15 min atrás</p>
            </div>
            <CheckCircle2 className="text-success" size={24} />
          </div>
        </div>
      </section>
    </>
  );
}
