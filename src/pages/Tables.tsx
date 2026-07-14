import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Filter, Search } from 'lucide-react';
import { getStoredTables, saveTables, Table, getCurrentUser, getActiveStoreConfig } from '../utils/db';
import AlertModal from '../components/ui/AlertModal';

export default function Tables() {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();
  const [tables, setTables] = useState<Table[]>([]);
  const [tableNum, setTableNum] = useState('');
  const [sortBy, setSortBy] = useState<'id' | 'total'>('id');
  
  // Modais de transferência
  const [isTransferTableModalOpen, setIsTransferTableModalOpen] = useState(false);
  const [isTransferItemModalOpen, setIsTransferItemModalOpen] = useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');

  // Form states
  const [originTableNum, setOriginTableNum] = useState('');
  const [targetTableNum, setTargetTableNum] = useState('');
  const [selectedItemName, setSelectedItemName] = useState('');
  const [transferQty, setTransferQty] = useState(1);

  const triggerAlert = (msg: string) => {
    setAlertMessage(msg);
    setIsAlertModalOpen(true);
  };

  useEffect(() => {
    const loadTables = () => {
      setUser(getCurrentUser());
      setTables(getStoredTables());
    };

    loadTables();

    window.addEventListener('qsp_database_updated', loadTables);
    return () => window.removeEventListener('qsp_database_updated', loadTables);
  }, []);

  const activeTablesForTransfer = tables.filter(t => t.status === 'ACTIVE' && t.items.length > 0);
  const selectedOriginTableObj = tables.find(t => t.id === parseInt(originTableNum) && t.status === 'ACTIVE');
  const availableItems = selectedOriginTableObj ? selectedOriginTableObj.items : [];

  // Automatically update the selected item and reset transfer quantity when origin table changes
  useEffect(() => {
    if (availableItems.length > 0) {
      setSelectedItemName(availableItems[0].name);
      setTransferQty(1);
    } else {
      setSelectedItemName('');
      setTransferQty(1);
    }
  }, [originTableNum, tables]);

  const selectedItemObj = availableItems.find(i => i.name === selectedItemName);
  const maxAvailableQty = selectedItemObj ? selectedItemObj.qty : 1;

  const handleOpenTable = () => {
    const num = parseInt(tableNum);
    if (!num || isNaN(num)) {
      triggerAlert('Por favor, insira um número válido para a mesa.');
      return;
    }

    const activeCount = tables.filter(t => t.status === 'ACTIVE').length;
    const storeConfig = getActiveStoreConfig();
    const isUnlimited = storeConfig ? storeConfig.services?.unlimitedTables : true;

    const tExists = tables.find(t => t.id === num);
    if (tExists) {
      // If it exists but is closed, we reopen it keeping its items
      if (tExists.status === 'CLOSED') {
        if (!isUnlimited && activeCount >= 5) {
          triggerAlert('Limite de Assinatura Excedido! Seu plano contratado atual permite no máximo 5 mesas operando simultaneamente. Faça o upgrade de plano ou reative o addon no painel de administração central.');
          return;
        }
        const updatedTable = { ...tExists, status: 'ACTIVE' as const };
        const otherTables = tables.filter(t => t.id !== num);
        const updatedList = [updatedTable, ...otherTables];
        setTables(updatedList);
        saveTables(updatedList);
      }
      navigate(`/tables/${num}`);
    } else {
      // Create new
      if (!isUnlimited && activeCount >= 5) {
        triggerAlert('Limite de Assinatura Excedido! Seu plano contratado atual permite no máximo 5 mesas operando simultaneamente. Faça o upgrade de plano ou reative o addon no painel de administração central.');
        return;
      }
      const newTable: Table = {
        id: num,
        status: 'ACTIVE',
        elapsed: '0 min',
        server: 'Operador',
        items: []
      };

      const updated = [newTable, ...tables];
      setTables(updated);
      saveTables(updated);
      navigate(`/tables/${num}`);
    }
  };

  const openTransferTable = () => {
    setOriginTableNum('');
    setTargetTableNum('');
    setIsTransferTableModalOpen(true);
  };

  const openTransferItem = () => {
    setOriginTableNum('');
    setTargetTableNum('');
    setSelectedItemName('');
    setTransferQty(1);
    setIsTransferItemModalOpen(true);
  };

  const confirmTransferTable = () => {
    const originNum = parseInt(originTableNum);
    const targetNum = parseInt(targetTableNum);
    
    if (isNaN(originNum) || isNaN(targetNum)) {
      triggerAlert('Por favor, defina números de mesa válidos.');
      return;
    }

    if (originNum === targetNum) {
      triggerAlert('A mesa de origem e destino devem ser diferentes.');
      return;
    }

    const originTable = tables.find(t => t.id === originNum && t.status === 'ACTIVE');
    if (!originTable) {
      triggerAlert(`Mesa de origem ${originNum} não está ativa.`);
      return;
    }

    if (originTable.items.length === 0) {
      triggerAlert(`Mesa de origem ${originNum} não possui itens para transferir.`);
      return;
    }

    let targetTable = tables.find(t => t.id === targetNum);
    if (!targetTable) {
      // Create new active table
      targetTable = {
        id: targetNum,
        status: 'ACTIVE',
        elapsed: originTable.elapsed || '5 min',
        server: originTable.server || 'Operador',
        items: []
      };
    } else if (targetTable.status !== 'ACTIVE') {
      // Reopen table
      targetTable.status = 'ACTIVE';
      targetTable.elapsed = originTable.elapsed || '5 min';
      targetTable.items = [];
    }

    // Merge items from origin to target
    originTable.items.forEach(originItem => {
      const targetItem = targetTable.items.find(i => i.name === originItem.name);
      if (targetItem) {
        targetItem.qty += originItem.qty;
      } else {
        targetTable.items.push({ ...originItem });
      }
    });

    // Clear origin items and close it
    originTable.items = [];
    originTable.status = 'CLOSED';

    const otherTables = tables.filter(t => t.id !== originNum && t.id !== targetNum);
    const updatedTables = [originTable, targetTable, ...otherTables];

    setTables(updatedTables);
    saveTables(updatedTables);
    setIsTransferTableModalOpen(false);
    triggerAlert(`Mesa ${originNum} transferida por completo para Mesa ${targetNum}!`);
  };

  const confirmTransferItem = () => {
    const originNum = parseInt(originTableNum);
    const targetNum = parseInt(targetTableNum);
    const qty = transferQty;

    if (isNaN(originNum) || isNaN(targetNum) || !selectedItemName) {
      triggerAlert('Por favor, preencha todos os campos!');
      return;
    }

    if (originNum === targetNum) {
      triggerAlert('A mesa de origem e destino devem ser diferentes.');
      return;
    }

    const originTable = tables.find(t => t.id === originNum && t.status === 'ACTIVE');
    if (!originTable) {
      triggerAlert(`Mesa de origem ${originNum} não está ativa.`);
      return;
    }

    const originItemObj = originTable.items.find(i => i.name === selectedItemName);
    if (!originItemObj) {
      triggerAlert('Item não encontrado na mesa de origem.');
      return;
    }

    if (qty <= 0 || qty > originItemObj.qty) {
      triggerAlert(`Quantidade inválida! A quantidade máxima para transferência é de ${originItemObj.qty}.`);
      return;
    }

    let targetTable = tables.find(t => t.id === targetNum);
    if (!targetTable) {
      // Create new active table
      targetTable = {
        id: targetNum,
        status: 'ACTIVE',
        elapsed: '5 min',
        server: originTable.server || 'Operador',
        items: []
      };
    } else if (targetTable.status !== 'ACTIVE') {
      // Reopen table
      targetTable.status = 'ACTIVE';
      targetTable.elapsed = '5 min';
      targetTable.items = [];
    }

    // Subtract from origin table
    if (originItemObj.qty === qty) {
      originTable.items = originTable.items.filter(i => i.name !== selectedItemName);
    } else {
      originItemObj.qty -= qty;
    }

    // Add/merge to target table
    const targetItemObj = targetTable.items.find(i => i.name === selectedItemName);
    if (targetItemObj) {
      targetItemObj.qty += qty;
    } else {
      targetTable.items.push({
        name: selectedItemName,
        price: originItemObj.price,
        qty: qty,
        note: originItemObj.note
      });
    }

    // If origin table became empty, close it
    if (originTable.items.length === 0) {
      originTable.status = 'CLOSED';
    }

    const otherTables = tables.filter(t => t.id !== originNum && t.id !== targetNum);
    const updatedTables = [originTable, targetTable, ...otherTables];

    setTables(updatedTables);
    saveTables(updatedTables);
    setIsTransferItemModalOpen(false);
    triggerAlert(`Quantidade ${qty}x de ${selectedItemName} transferida com sucesso da Mesa ${originNum} para a Mesa ${targetNum}!`);
  };

  const toggleSort = () => {
    setSortBy(prev => prev === 'id' ? 'total' : 'id');
  };

  const getTableTotal = (table: Table) => {
    return table.items.reduce((sum, item) => sum + (item.price * item.qty), 0);
  };

  const activeTables = tables.filter(t => t.status === 'ACTIVE' && t.items.length > 0);
  const closedTables = tables.filter(t => t.status === 'CLOSED' && t.items.length > 0);
  const allDisplayTables = [...activeTables, ...closedTables];

  // Compute stats
  const activeCount = activeTables.length;
  const openRevenue = activeTables.reduce((sum, t) => sum + getTableTotal(t), 0);

  // Apply sorting
  const sortedDispaly = allDisplayTables.sort((a, b) => {
    if (sortBy === 'id') {
      return a.id - b.id;
    } else {
      return getTableTotal(b) - getTableTotal(a);
    }
  });

  return (
    <div className="max-w-md mx-auto">
      {/* Quick Entry Section */}
      <section className="mb-8 mt-4">
        <div className="bg-surface-container-lowest rounded-[24px] p-6 ambient-card border border-surface-variant/20">
          <h2 className="text-profile-title text-headline-md mb-4 text-on-surface">Acesso Direto</h2>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <input 
                type="number" 
                placeholder="Nº da Mesa (Ex: 5)" 
                value={tableNum}
                onChange={(e) => setTableNum(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleOpenTable()}
                className="w-full h-14 bg-surface-container-lowest border border-outline-variant rounded-[16px] px-4 text-body-lg focus:border-secondary focus:ring-2 focus:ring-secondary/20 transition-all outline-none text-on-surface"
              />
            </div>
            <button 
              onClick={handleOpenTable}
              className="bg-brand-primary text-on-primary font-bold px-6 h-14 rounded-[16px] hover:brightness-90 active:scale-95 transition-all text-sm uppercase tracking-wider"
            >
              Abrir
            </button>
          </div>
          {user?.name === 'master' && (
            <div className="flex gap-3 mt-3">
              <button 
                onClick={openTransferTable}
                className="flex-1 bg-secondary text-on-secondary font-bold px-4 py-2 rounded-[12px] hover:brightness-90 active:scale-95 transition-all text-xs uppercase tracking-wider"
              >
                Transf. Mesa
              </button>
              <button 
                onClick={openTransferItem}
                className="flex-1 bg-secondary text-on-secondary font-bold px-4 py-2 rounded-[12px] hover:brightness-90 active:scale-95 transition-all text-xs uppercase tracking-wider"
              >
                Transf. Item
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-surface-container-lowest p-4 rounded-[24px] ambient-card border-l-4 border-secondary shadow-sm">
          <p className="text-on-surface-variant text-caption uppercase tracking-wider">Mesas Ativas</p>
          <p className="text-stat-value text-secondary font-bold">{activeCount}</p>
        </div>
        {user?.role !== 'Vendedor' && (
          <div className="bg-surface-container-lowest p-4 rounded-[24px] ambient-card border-l-4 border-success shadow-sm">
            <p className="text-on-surface-variant text-caption uppercase tracking-wider">Faturam. Aberto</p>
            <p className="text-stat-value text-success font-bold">R$ {openRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        )}
      </div>

      {/* Active Tables List */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-headline-md text-on-surface font-bold">Comandas</h2>
          <button 
            onClick={toggleSort}
            className="text-secondary font-bold text-caption flex items-center gap-1 hover:bg-secondary/10 px-3 py-1.5 rounded-lg transition-all"
          >
            <Filter size={18} />
            ORDENAR: {sortBy === 'id' ? 'MESA' : 'MÁX. VALOR'}
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          {sortedDispaly.length === 0 ? (
            <div className="bg-surface-container-lowest p-8 rounded-[24px] text-center border text-on-surface-variant italic col-span-2">
              Nenhuma mesa ativa no momento. Digite um número acima para abrir uma mesa!
            </div>
          ) : (
            sortedDispaly.map((table) => {
              const total = getTableTotal(table);
              const isActive = table.status === 'ACTIVE';
              
              return (
                <Link 
                  key={table.id}
                  to={`/tables/${table.id}`}
                  className={`flex flex-col p-4 rounded-[24px] ambient-card hover:ring-2 hover:ring-primary/20 active:scale-[1.02] transition-all cursor-pointer border shadow-sm gap-3 ${isActive ? 'bg-surface-container-lowest border-surface-variant/30' : 'bg-surface-container border-surface-variant/50 opacity-80'}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                       <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isActive ? 'bg-secondary-container' : 'bg-surface-variant'}`}>
                        <span className={`text-body-lg font-extrabold ${isActive ? 'text-on-secondary-container' : 'text-on-surface-variant'}`}>
                          {table.id.toString().padStart(2, '0')}
                        </span>
                      </div>
                      <div>
                        <p className="text-body-lg text-on-surface font-semibold">
                          {table.id >= 1000 ? `Comanda #${table.id}` : `Mesa ${table.id.toString().padStart(2, '0')}`}
                        </p>
                        {table.paidOnline && (
                          <span className="mt-1 inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-lime-500/15 text-lime-600 dark:text-lime-400 text-[10px] font-black uppercase tracking-wider">
                            💰 Pix Pago Online
                          </span>
                        )}
                      </div>
                    </div>
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success text-[9px] font-bold uppercase tracking-tight">
                        <span className="w-1.5 h-1.5 rounded-full bg-success"></span>
                        Aberta
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-variant text-on-surface-variant text-[9px] font-bold uppercase tracking-tight">
                        Fechada
                      </span>
                    )}
                  </div>
                  
                  <div className="w-full flex items-end justify-between">
                     <p className="text-caption text-on-surface-variant">{isActive ? `Ativa há ${table.elapsed}` : 'Conta Fechada'}</p>
                     <p className={`text-headline-sm font-bold ${isActive ? 'text-on-surface' : 'text-on-surface-variant'}`}>R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>

      {/* Dynamic Action Illustration */}
      <div className="mt-8 mb-8 flex flex-col items-center justify-center text-center">
        <p className="text-caption text-on-surface-variant px-12 italic">
          Dica: Você pode reabrir qualquer mesa digitando o número dela no menu de Acesso Direto.
        </p>
      </div>

      {/* Transfer Table Modal */}
      {isTransferTableModalOpen && (
        <div className="fixed inset-0 bg-transparent/10 backdrop-blur-sm bg-black/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-surface p-6 rounded-2xl w-full max-w-sm border border-surface-variant/20 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <h2 className="text-xl font-bold mb-4 text-on-surface">Transferir Mesa Integras</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-on-surface-variant">Mesa de Origem</label>
                <input 
                  type="number"
                  placeholder="Nº da Mesa de Origem (Ex: 05)" 
                  className="w-full p-3 border rounded-xl bg-surface text-on-surface outline-none focus:ring-2 focus:ring-secondary/50" 
                  value={originTableNum} 
                  onChange={e => setOriginTableNum(e.target.value)} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-on-surface-variant">Mesa de Destino</label>
                <input 
                  type="number"
                  placeholder="Nº da Mesa de Destino (Ex: 15)" 
                  className="w-full p-3 border rounded-xl bg-surface text-on-surface outline-none focus:ring-2 focus:ring-secondary/50" 
                  value={targetTableNum} 
                  onChange={e => setTargetTableNum(e.target.value)} 
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setIsTransferTableModalOpen(false)} 
                className="flex-1 p-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest font-bold text-on-surface text-sm transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmTransferTable} 
                className="flex-1 p-3 rounded-xl bg-secondary hover:brightness-95 active:scale-95 text-white font-bold text-sm transition-all"
              >
                Transferir Tudo
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Transfer Item Modal */}
      {isTransferItemModalOpen && (
        <div className="fixed inset-0 bg-transparent/10 backdrop-blur-sm bg-black/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-surface p-6 rounded-2xl w-full max-w-sm border border-surface-variant/20 shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <h2 className="text-xl font-bold mb-4 text-on-surface">Transferir Item Específico</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-on-surface-variant">Mesa de Origem</label>
                <input 
                  type="number"
                  placeholder="Nº da Mesa de Origem (Ex: 05)" 
                  className="w-full p-3 border rounded-xl bg-surface text-on-surface outline-none focus:ring-2 focus:ring-secondary/50" 
                  value={originTableNum} 
                  onChange={e => setOriginTableNum(e.target.value)} 
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-on-surface-variant">Selecionar Produto</label>
                {availableItems.length === 0 ? (
                  <p className="text-sm italic text-on-surface-variant p-2 bg-surface-container rounded-lg">Digite o número de uma mesa de origem ativa com itens para listar produtos.</p>
                ) : (
                  <select 
                    className="w-full p-3 border rounded-xl bg-surface text-on-surface outline-none focus:ring-2 focus:ring-secondary/50"
                    value={selectedItemName}
                    onChange={e => setSelectedItemName(e.target.value)}
                  >
                    {availableItems.map(item => (
                      <option key={item.name} value={item.name}>
                        {item.name} (Max: {item.qty})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {selectedItemObj && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-on-surface-variant">Quantidade a Transferir</label>
                  <div className="flex items-center gap-3">
                    <button 
                      type="button"
                      disabled={transferQty <= 1}
                      onClick={() => setTransferQty(prev => Math.max(1, prev - 1))}
                      className="w-10 h-10 rounded-full border border-outline bg-surface-container hover:bg-surface-container-high transition-all flex items-center justify-center font-bold text-lg text-on-surface disabled:opacity-40"
                    >
                      -
                    </button>
                    <span className="w-12 text-center font-bold text-lg text-on-surface">
                      {transferQty}
                    </span>
                    <button 
                      type="button"
                      disabled={transferQty >= maxAvailableQty}
                      onClick={() => setTransferQty(prev => Math.min(maxAvailableQty, prev + 1))}
                      className="w-10 h-10 rounded-full border border-outline bg-surface-container hover:bg-surface-container-high transition-all flex items-center justify-center font-bold text-lg text-on-surface disabled:opacity-40"
                    >
                      +
                    </button>
                    <span className="text-xs text-on-surface-variant ml-auto font-medium">
                      Total na mesa: {maxAvailableQty}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-on-surface-variant">Mesa de Destino</label>
                <input 
                  type="number"
                  placeholder="Nº da Mesa de Destino (Ex: 15)" 
                  className="w-full p-3 border rounded-xl bg-surface text-on-surface outline-none focus:ring-2 focus:ring-secondary/50" 
                  value={targetTableNum} 
                  onChange={e => setTargetTableNum(e.target.value)} 
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setIsTransferItemModalOpen(false)} 
                className="flex-1 p-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest font-bold text-on-surface text-sm transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmTransferItem} 
                disabled={availableItems.length === 0}
                className="flex-1 p-3 rounded-xl bg-secondary hover:brightness-95 active:scale-95 text-white font-bold text-sm transition-all disabled:opacity-50"
              >
                Transferir Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      <AlertModal isOpen={isAlertModalOpen} message={alertMessage} onClose={() => setIsAlertModalOpen(false)} />
    </div>
  );
}
