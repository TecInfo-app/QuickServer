// LocalStorage Helper for QuickServe POS
import { doc, setDoc, collection, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';

let isSyncingFromFirestore = false;
let hasStartedSync = false;

export interface User {
  id: number;
  name: string;
  password?: string;
  role: string;
  meta: string;
  active: boolean;
  permissions?: string[];
}

export interface OrderItem {
  name: string;
  note: string;
  price: number;
  qty: number;
  complements?: { name: string; price: number }[];
}

export interface Table {
  id: number;
  status: 'ACTIVE' | 'CLOSED';
  elapsed: string;
  server: string;
  items: OrderItem[];
  noServiceTax?: boolean;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  paidOnline?: boolean;
  paymentMethod?: 'Dinheiro' | 'Cartão' | 'Pix';
}

export interface Product {
  id: number;
  name: string;
  category: string;
  stock: number;
  cost: number;
  price: number;
  isLow: boolean;
  isCombo?: boolean;
  minComplements?: number;
  maxComplements?: number;
  comboGroupCode?: string;
  parentGroupCode?: string;
  pdvCode?: string;
  isQuickTouch?: boolean;
  image?: string;
}

export interface Transaction {
  orderId: string;
  caixaId?: number; // Optional para retrocompatibilidade
  elapsed: string;
  itemsCount: number;
  total: number;
  method: 'Dinheiro' | 'Cartão' | 'Pix';
  cost: number;
  time?: string;
}

const INITIAL_USERS: User[] = [
  { id: 100, name: 'master', password: '1234', role: 'Gerente', meta: 'Acesso Master', active: true, permissions: ['/dashboard', '/tables', '/inventory', '/kiosk', '/reports', '/admin'] },
  { id: 1, name: 'Marcos Oliveira', password: '1234', role: 'Gerente', meta: 'Turno Noturno', active: true, permissions: ['/dashboard', '/tables', '/inventory', '/kiosk', '/reports', '/admin'] },
  { id: 2, name: 'Ana Paula Silva', password: '1234', role: 'Vendedor', meta: 'Turno Integral', active: true, permissions: ['/tables'] },
  { id: 3, name: 'Bruno Costa', password: '1234', role: 'Vendedor', meta: 'Turno Manhã', active: true, permissions: ['/tables'] },
  { id: 4, name: 'Carla Mendes', password: '1234', role: 'Gerente', meta: 'Turno Noite', active: true, permissions: ['/dashboard', '/tables', '/inventory', '/kiosk', '/reports', '/admin'] }
];

const INITIAL_PRODUCTS: Product[] = [
  { id: 11, name: 'Maminha Executiva 2 Pessoas', category: 'Pratos Principais', stock: 20, cost: 45.00, price: 89.90, isLow: false, isCombo: true, minComplements: 2, maxComplements: 4, comboGroupCode: '10', isQuickTouch: true, image: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80' },
  { id: 12, name: 'Arroz Branco de Acompanhamento', category: 'Petiscos', stock: 100, cost: 2.00, price: 0.00, isLow: false, parentGroupCode: '10' },
  { id: 13, name: 'Feijão Tropeiro Executivo', category: 'Petiscos', stock: 100, cost: 3.50, price: 5.00, isLow: false, parentGroupCode: '10' },
  { id: 14, name: 'Batata Rústica Frita', category: 'Petiscos', stock: 80, cost: 4.00, price: 0.00, isLow: false, parentGroupCode: '10' },
  { id: 15, name: 'Mandioca Frita na Manteiga', category: 'Petiscos', stock: 60, cost: 3.00, price: 6.50, isLow: false, parentGroupCode: '10' },
  { id: 1, name: 'Hambúrguer de Costela', category: 'Lanches', stock: 42, cost: 18.50, price: 34.90, isLow: false, isQuickTouch: true, image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80' },
  { id: 2, name: 'Refrigerante Cola 350ml', category: 'Bebidas', stock: 8, cost: 2.10, price: 6.00, isLow: true, isQuickTouch: true, image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=600&q=80' },
  { id: 3, name: 'Petit Gateau', category: 'Sobremesas', stock: 15, cost: 8.00, price: 22.00, isLow: false, isQuickTouch: true, image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=600&q=80' },
  { id: 4, name: 'Filé de Costela', category: 'Pratos Principais', stock: 24, cost: 15.00, price: 34.00, isLow: false },
  { id: 5, name: 'Coquetel Old Fashioned', category: 'Bebidas', stock: 30, cost: 5.50, price: 24.00, isLow: false },
  { id: 6, name: 'Pão de Alho Especial', category: 'Petiscos', stock: 40, cost: 2.50, price: 8.50, isLow: false },
  { id: 7, name: 'Taça de Vinho Malbec', category: 'Bebidas', stock: 18, cost: 4.00, price: 12.00, isLow: false },
  { id: 8, name: 'Pizza Margherita Grande', category: 'Pratos Principais', stock: 12, cost: 6.00, price: 15.50, isLow: false, isQuickTouch: true, image: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=600&q=80' },
  { id: 9, name: 'Fondant de Chocolate', category: 'Sobremesas', stock: 20, cost: 3.00, price: 9.00, isLow: false },
  { id: 10, name: 'Água Mineral Sem Gás', category: 'Bebidas', stock: 50, cost: 1.00, price: 4.50, isLow: false }
];

const INITIAL_TABLES: Table[] = [
  {
    id: 8,
    status: 'ACTIVE',
    elapsed: '45 min',
    server: 'Maria G.',
    items: [
      { name: 'Filé de Costela', note: 'Mal passado, com frita', price: 34.00, qty: 3 },
      { name: 'Coquetel Old Fashioned', note: 'Gelo duplo', price: 24.00, qty: 1 },
      { name: 'Pão de Alho Especial', note: '', price: 8.50, qty: 2 },
      { name: 'Taça de Vinho Malbec', note: '', price: 12.00, qty: 1 }
    ]
  },
  {
    id: 12,
    status: 'ACTIVE',
    elapsed: '12 min',
    server: 'Marcos Oliveira',
    items: [
      { name: 'Hambúrguer de Costela', note: 'Ao ponto', price: 34.90, qty: 2 },
      { name: 'Refrigerante Cola 350ml', note: 'Gelo e limão', price: 6.00, qty: 2 }
    ]
  },
  {
    id: 22,
    status: 'ACTIVE',
    elapsed: '5 min',
    server: 'Ana Paula Silva',
    items: [
      { name: 'Pão de Alho Especial', note: 'Extra queijo', price: 8.50, qty: 2 },
      { name: 'Água Mineral Sem Gás', note: 'Fria', price: 4.50, qty: 2 }
    ]
  },
  {
    id: 4,
    status: 'CLOSED',
    elapsed: '14:22',
    server: 'Carla Mendes',
    items: [
      { name: 'Pizza Margherita Grande', note: 'Borda recheada', price: 15.50, qty: 2 },
      { name: 'Taça de Vinho Malbec', note: '', price: 12.00, qty: 1 }
    ]
  }
];

const INITIAL_TRANSACTIONS: Transaction[] = [
  { orderId: '#8921', elapsed: '14:32', itemsCount: 3, total: 142.00, method: 'Dinheiro', cost: 42.00 },
  { orderId: '#8920', elapsed: '14:15', itemsCount: 1, total: 24.50, method: 'Cartão', cost: 7.20 },
  { orderId: '#8919', elapsed: '13:58', itemsCount: 5, total: 312.80, method: 'Pix', cost: 98.40 },
  { orderId: '#8918', elapsed: '13:45', itemsCount: 2, total: 68.00, method: 'Dinheiro', cost: 21.00 },
  { orderId: '#8917', elapsed: '12:10', itemsCount: 4, total: 198.50, method: 'Cartão', cost: 58.00 },
  { orderId: '#8916', elapsed: '11:45', itemsCount: 3, total: 110.00, method: 'Cartão', cost: 33.00 },
  { orderId: '#8915', elapsed: '11:15', itemsCount: 8, total: 420.00, method: 'Pix', cost: 112.00 },
  { orderId: '#8914', elapsed: '10:30', itemsCount: 2, total: 85.00, method: 'Dinheiro', cost: 25.00 },
  { orderId: '#8913', elapsed: '09:45', itemsCount: 3, total: 130.00, method: 'Cartão', cost: 38.00 },
  { orderId: '#8912', elapsed: '08:15', itemsCount: 12, total: 615.00, method: 'Dinheiro', cost: 180.00 }
];

export interface Store {
  id: string;
  name: string;
  ownerName: string;
  email: string;
  password: string;
  status: 'ACTIVE' | 'SUSPENDED';
  services: {
    kiosk: boolean;
    advancedReports: boolean;
    unlimitedTables: boolean;
  };
  createdAt: string;
}

const INITIAL_STORES: Store[] = [
  {
    id: 'store_teste_cia',
    name: 'Cia do Chopp (Teste)',
    ownerName: 'Cliente Cia do Chopp',
    email: 'master',
    password: '1234',
    status: 'ACTIVE',
    services: {
      kiosk: true,
      advancedReports: true,
      unlimitedTables: true
    },
    createdAt: new Date().toISOString()
  }
];

export function getPrefixedKey(baseKey: string): string {
  if (baseKey === 'qsp_stores' || baseKey === 'qsp_current_user' || baseKey === 'active_store_id') {
    return baseKey;
  }
  const storeId = localStorage.getItem('active_store_id');
  if (storeId) {
    return `${storeId}_${baseKey}`;
  }
  return baseKey;
}

export function getStoredStores(): Store[] {
  const data = localStorage.getItem('qsp_stores');
  if (!data) {
    localStorage.setItem('qsp_stores', JSON.stringify(INITIAL_STORES));
    return INITIAL_STORES;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return INITIAL_STORES;
  }
}

export function saveStores(stores: Store[]) {
  localStorage.setItem('qsp_stores', JSON.stringify(stores));
  window.dispatchEvent(new Event('qsp_database_updated'));
  
  if (!isSyncingFromFirestore) {
    stores.forEach(async (store) => {
      try {
        await setDoc(doc(db, 'stores', store.id), store);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `stores/${store.id}`);
      }
    });
  }
}

export function getActiveStoreConfig(): Store | null {
  const activeId = localStorage.getItem('active_store_id');
  if (!activeId) return null;
  const stores = getStoredStores();
  return stores.find(s => s.id === activeId) || null;
}

export function initDatabase() {
  // Ensure the central stores are initialized
  getStoredStores();

  const activeStoreId = localStorage.getItem('active_store_id');
  const isDemoStore = !activeStoreId || activeStoreId === 'store_teste_cia';

  if (!localStorage.getItem(getPrefixedKey('qsp_users'))) {
    if (isDemoStore) {
      localStorage.setItem(getPrefixedKey('qsp_users'), JSON.stringify(INITIAL_USERS));
    } else {
      const storeConfig = getActiveStoreConfig();
      const fallbackUser: User = {
        id: 100,
        name: storeConfig?.ownerName || 'master',
        password: storeConfig?.password || '1234',
        role: 'Gerente',
        meta: 'Proprietário',
        active: true,
        permissions: ['/dashboard', '/tables', '/commerce', '/inventory', '/kiosk', '/reports', '/admin']
      };
      localStorage.setItem(getPrefixedKey('qsp_users'), JSON.stringify([fallbackUser]));
    }
  }
  if (!localStorage.getItem(getPrefixedKey('qsp_inventory'))) {
    if (isDemoStore) {
      localStorage.setItem(getPrefixedKey('qsp_inventory'), JSON.stringify(INITIAL_PRODUCTS));
    } else {
      localStorage.setItem(getPrefixedKey('qsp_inventory'), JSON.stringify([]));
    }
  }
  if (!localStorage.getItem(getPrefixedKey('qsp_tables'))) {
    if (isDemoStore) {
      localStorage.setItem(getPrefixedKey('qsp_tables'), JSON.stringify(INITIAL_TABLES));
    } else {
      localStorage.setItem(getPrefixedKey('qsp_tables'), JSON.stringify([]));
    }
  }
  if (!localStorage.getItem(getPrefixedKey('qsp_transactions'))) {
    if (isDemoStore) {
      localStorage.setItem(getPrefixedKey('qsp_transactions'), JSON.stringify(INITIAL_TRANSACTIONS));
    } else {
      localStorage.setItem(getPrefixedKey('qsp_transactions'), JSON.stringify([]));
    }
  }
  if (!localStorage.getItem('qsp_current_user')) {
    if (isDemoStore) {
      localStorage.setItem('qsp_current_user', JSON.stringify(INITIAL_USERS[0]));
    } else {
      const storeConfig = getActiveStoreConfig();
      const fallbackUser: User = {
        id: 100,
        name: storeConfig?.ownerName || 'master',
        role: 'Gerente',
        meta: 'Proprietário',
        active: true,
        permissions: ['/dashboard', '/tables', '/commerce', '/inventory', '/kiosk', '/reports', '/admin']
      };
      localStorage.setItem('qsp_current_user', JSON.stringify(fallbackUser));
    }
  }
  startFirebaseSync();
}

// Users API
export function getStoredUsers(): User[] {
  initDatabase();
  const data = localStorage.getItem(getPrefixedKey('qsp_users'));
  return data ? JSON.parse(data) : INITIAL_USERS;
}

export function saveUsers(users: User[]) {
  const activeStoreId = localStorage.getItem('active_store_id') || 'store_teste_cia';
  localStorage.setItem(getPrefixedKey('qsp_users'), JSON.stringify(users));
  window.dispatchEvent(new Event('qsp_database_updated'));

  if (!isSyncingFromFirestore) {
    users.forEach(async (user) => {
      try {
        await setDoc(doc(db, `stores/${activeStoreId}/users`, user.id.toString()), user);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `stores/${activeStoreId}/users/${user.id}`);
      }
    });
  }
}

export function getCurrentUser(): User {
  initDatabase();
  const data = localStorage.getItem('qsp_current_user');
  return data ? JSON.parse(data) : INITIAL_USERS[0];
}

export function setCurrentUser(user: User) {
  localStorage.setItem('qsp_current_user', JSON.stringify(user));
}

// Inventory API
export function getStoredInventory(): Product[] {
  initDatabase();
  const data = localStorage.getItem(getPrefixedKey('qsp_inventory'));
  return data ? JSON.parse(data) : INITIAL_PRODUCTS;
}

export function saveInventory(products: Product[]) {
  const activeStoreId = localStorage.getItem('active_store_id') || 'store_teste_cia';
  localStorage.setItem(getPrefixedKey('qsp_inventory'), JSON.stringify(products));
  window.dispatchEvent(new Event('qsp_database_updated'));

  if (!isSyncingFromFirestore) {
    products.forEach(async (product) => {
      try {
        await setDoc(doc(db, `stores/${activeStoreId}/inventory`, product.id.toString()), product);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `stores/${activeStoreId}/inventory/${product.id}`);
      }
    });
  }
}

// Tables API
export function getStoredTables(): Table[] {
  initDatabase();
  const data = localStorage.getItem(getPrefixedKey('qsp_tables'));
  return data ? JSON.parse(data) : INITIAL_TABLES;
}

export function saveTables(tables: Table[]) {
  const activeStoreId = localStorage.getItem('active_store_id') || 'store_teste_cia';
  localStorage.setItem(getPrefixedKey('qsp_tables'), JSON.stringify(tables));
  window.dispatchEvent(new Event('qsp_database_updated'));

  if (!isSyncingFromFirestore) {
    tables.forEach(async (table) => {
      try {
        await setDoc(doc(db, `stores/${activeStoreId}/tables`, table.id.toString()), table);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `stores/${activeStoreId}/tables/${table.id}`);
      }
    });
  }
}

// Transactions / Reports API
export function getStoredTransactions(): Transaction[] {
  initDatabase();
  const data = localStorage.getItem(getPrefixedKey('qsp_transactions'));
  return data ? JSON.parse(data) : INITIAL_TRANSACTIONS;
}

export function saveTransactions(transactions: Transaction[]) {
  const activeStoreId = localStorage.getItem('active_store_id') || 'store_teste_cia';
  localStorage.setItem(getPrefixedKey('qsp_transactions'), JSON.stringify(transactions));
  window.dispatchEvent(new Event('qsp_database_updated'));

  if (!isSyncingFromFirestore) {
    transactions.forEach(async (transaction) => {
      const docId = transaction.orderId.replace('#', '');
      try {
        await setDoc(doc(db, `stores/${activeStoreId}/transactions`, docId), transaction);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `stores/${activeStoreId}/transactions/${docId}`);
      }
    });
  }
}

export function addTransaction(transaction: Transaction) {
  const transactions = getStoredTransactions();
  transactions.unshift(transaction);
  saveTransactions(transactions);
}

export interface AbacatePayConfig {
  apiKey: string;
}

export function getAbacatePayConfig(): AbacatePayConfig {
  const data = localStorage.getItem(getPrefixedKey('qsp_abacatepay_config'));
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      // ignore
    }
  }
  return { apiKey: '' };
}

export function saveAbacatePayConfig(config: AbacatePayConfig) {
  localStorage.setItem(getPrefixedKey('qsp_abacatepay_config'), JSON.stringify(config));
}

export function startFirebaseSync() {
  if (hasStartedSync) return;
  hasStartedSync = true;

  const activeStoreId = localStorage.getItem('active_store_id') || 'store_teste_cia';

  // 1. Sync global stores
  onSnapshot(collection(db, 'stores'), (snapshot) => {
    if (snapshot.empty) {
      // Seed Firestore with initial stores
      INITIAL_STORES.forEach(async (store) => {
        await setDoc(doc(db, 'stores', store.id), store);
      });
      return;
    }
    isSyncingFromFirestore = true;
    const stores: Store[] = [];
    snapshot.forEach((d) => {
      stores.push(d.data() as Store);
    });
    if (stores.length > 0) {
      localStorage.setItem('qsp_stores', JSON.stringify(stores));
      window.dispatchEvent(new Event('qsp_database_updated'));
    }
    isSyncingFromFirestore = false;
  }, (err) => {
    console.error('Firestore sync error for stores:', err);
  });

  // 2. Sync users
  onSnapshot(collection(db, `stores/${activeStoreId}/users`), (snapshot) => {
    if (snapshot.empty) {
      // Seed Firestore with initial users
      INITIAL_USERS.forEach(async (user) => {
        await setDoc(doc(db, `stores/${activeStoreId}/users`, user.id.toString()), user);
      });
      return;
    }
    isSyncingFromFirestore = true;
    const users: User[] = [];
    snapshot.forEach((d) => {
      users.push(d.data() as User);
    });
    localStorage.setItem(`${activeStoreId}_qsp_users`, JSON.stringify(users));
    window.dispatchEvent(new Event('qsp_database_updated'));
    isSyncingFromFirestore = false;
  }, (err) => {
    console.error('Firestore sync error for users:', err);
  });

  // 3. Sync inventory (products)
  onSnapshot(collection(db, `stores/${activeStoreId}/inventory`), (snapshot) => {
    if (snapshot.empty) {
      // Seed Firestore with initial products
      INITIAL_PRODUCTS.forEach(async (product) => {
        await setDoc(doc(db, `stores/${activeStoreId}/inventory`, product.id.toString()), product);
      });
      return;
    }
    isSyncingFromFirestore = true;
    const products: Product[] = [];
    snapshot.forEach((d) => {
      products.push(d.data() as Product);
    });
    localStorage.setItem(`${activeStoreId}_qsp_inventory`, JSON.stringify(products));
    window.dispatchEvent(new Event('qsp_database_updated'));
    isSyncingFromFirestore = false;
  }, (err) => {
    console.error('Firestore sync error for inventory:', err);
  });

  // 4. Sync tables (mesas)
  onSnapshot(collection(db, `stores/${activeStoreId}/tables`), (snapshot) => {
    if (snapshot.empty) {
      // Seed Firestore with initial tables
      INITIAL_TABLES.forEach(async (table) => {
        await setDoc(doc(db, `stores/${activeStoreId}/tables`, table.id.toString()), table);
      });
      return;
    }
    isSyncingFromFirestore = true;
    const tables: Table[] = [];
    snapshot.forEach((d) => {
      tables.push(d.data() as Table);
    });
    tables.sort((a, b) => a.id - b.id);
    localStorage.setItem(`${activeStoreId}_qsp_tables`, JSON.stringify(tables));
    window.dispatchEvent(new Event('qsp_database_updated'));
    isSyncingFromFirestore = false;
  }, (err) => {
    console.error('Firestore sync error for tables:', err);
  });

  // 5. Sync transactions
  onSnapshot(collection(db, `stores/${activeStoreId}/transactions`), (snapshot) => {
    if (snapshot.empty) {
      // Seed Firestore with initial transactions
      INITIAL_TRANSACTIONS.forEach(async (tx) => {
        const docId = tx.orderId.replace('#', '');
        await setDoc(doc(db, `stores/${activeStoreId}/transactions`, docId), tx);
      });
      return;
    }
    isSyncingFromFirestore = true;
    const transactions: Transaction[] = [];
    snapshot.forEach((d) => {
      transactions.push(d.data() as Transaction);
    });
    localStorage.setItem(`${activeStoreId}_qsp_transactions`, JSON.stringify(transactions));
    window.dispatchEvent(new Event('qsp_database_updated'));
    isSyncingFromFirestore = false;
  }, (err) => {
    console.error('Firestore sync error for transactions:', err);
  });
}
