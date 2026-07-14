export interface CaixaMovement {
  id: number;
  type: 'SANGRIA' | 'SUPRIMENTO';
  value: number;
  reason: string;
  time: string;
  operator: string;
}

export interface CaixaDeclared {
  money: number;
  credit: number;
  debit: number;
  pix: number;
  other: number;
  observation: string;
}

export interface CaixaSystem {
  money: number;
  credit: number;
  debit: number;
  pix: number;
  other: number;
}

export interface CaixaShift {
  id: number;
  status: 'OPEN' | 'CLOSED';
  shift: string; // Manhã, Tarde, Noite, etc.
  opener: string;
  closer?: string;
  startTime: string;
  endTime?: string;
  initialValue: number;
  movements: CaixaMovement[];
  declaredValues?: CaixaDeclared;
  systemValues?: CaixaSystem;
  difference?: number; // positive means sobra, negative means falta
}

// Global active caixa state
let activeCaixa: CaixaShift | null = null;

const CAIXA_STORAGE_KEY = 'food_pos_caixa_history';

const getPrefixedKey = (key: string) => {
  const storeId = localStorage.getItem('active_store_id');
  return storeId ? `${storeId}_${key}` : key;
};

export function getCaixaHistory(): CaixaShift[] {
  const data = localStorage.getItem(getPrefixedKey(CAIXA_STORAGE_KEY));
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

export function saveCaixaHistory(history: CaixaShift[]) {
  localStorage.setItem(getPrefixedKey(CAIXA_STORAGE_KEY), JSON.stringify(history));
}

export function getActiveCaixa(): CaixaShift | null {
  const history = getCaixaHistory();
  const active = history.find(c => c.status === 'OPEN');
  return active || null;
}

export function openCaixa(shift: string, initialValue: number, operatorName: string): CaixaShift {
  const history = getCaixaHistory();
  const active = history.find(c => c.status === 'OPEN');
  if (active) throw new Error("Caixa já está aberto");

  const newCaixa: CaixaShift = {
    id: Date.now(),
    status: 'OPEN',
    shift,
    opener: operatorName,
    startTime: new Date().toISOString(),
    initialValue,
    movements: []
  };

  history.push(newCaixa);
  saveCaixaHistory(history);
  return newCaixa;
}

export function addCaixaMovement(movement: Omit<CaixaMovement, 'id' | 'time'>): CaixaShift {
  const history = getCaixaHistory();
  const activeIndex = history.findIndex(c => c.status === 'OPEN');
  
  if (activeIndex === -1) throw new Error("Caixa não está aberto");

  const active = history[activeIndex];
  active.movements.push({
    ...movement,
    id: Date.now(),
    time: new Date().toISOString()
  });

  saveCaixaHistory(history);
  return active;
}

export function closeCaixa(declared: CaixaDeclared, system: CaixaSystem, operatorName: string): CaixaShift {
  const history = getCaixaHistory();
  const activeIndex = history.findIndex(c => c.status === 'OPEN');
  
  if (activeIndex === -1) throw new Error("Caixa não está aberto");

  const active = history[activeIndex];
  
  const declaredTotal = declared.money + declared.credit + declared.debit + declared.pix + declared.other;
  const systemTotal = system.money + system.credit + system.debit + system.pix + system.other;
  
  // Note: Initial value and suprimentos are typically added to system.money, sangrias are subtracted from system.money.
  const diff = declaredTotal - systemTotal;

  active.status = 'CLOSED';
  active.closer = operatorName;
  active.endTime = new Date().toISOString();
  active.declaredValues = declared;
  active.systemValues = system;
  active.difference = diff;

  saveCaixaHistory(history);
  return active;
}
