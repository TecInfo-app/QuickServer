import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, Smartphone, Check, ChevronRight, Search, Plus, Minus, FileText, ArrowLeft, Send, CheckCircle2, Flame, Loader2, Utensils, AlertCircle } from 'lucide-react';
import { getStoredInventory, getStoredTables, saveTables, Product, Table, getActiveStoreConfig, getPrefixedKey, getAbacatePayConfig } from '../utils/db';
import { printOrderTicket } from '../utils/printer';
import AlertModal from '../components/ui/AlertModal';

// Structure of Kiosk Orders awaiting confirmation or active
export interface DraftKioskOrder {
  id: string; // 4 digits e.g. "8142"
  customerName: string;
  customerPhone: string;
  items: {
    product: Product;
    qty: number;
    note: string;
  }[];
  status: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'PAID';
  time: string;
  paidOnline?: boolean;
  paymentMethod?: 'Dinheiro' | 'Cartão' | 'Pix';
}

const STORAGE_DRAFTS_KEY = 'qsp_draft_kiosk_orders';
const getDraftsKey = () => getPrefixedKey(STORAGE_DRAFTS_KEY);

const CATEGORY_IMAGES: { [key: string]: string } = {
  'Todos': 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=600&q=80',
  'Lanches': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
  'Bebidas': 'https://images.unsplash.com/photo-1497534446932-c925b458314e?auto=format&fit=crop&w=600&q=80',
  'Sobremesas': 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=600&q=80',
  'Pratos Principais': 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
  'Petiscos': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80',
  'Pizza': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
  'Pizzas': 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80',
  'Burgers': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
  'Hamburgers': 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
  'Porções': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80'
};

const getCategoryImage = (cat: string, productsList: Product[]) => {
  if (CATEGORY_IMAGES[cat]) return CATEGORY_IMAGES[cat];
  const itemWithImage = productsList.find(p => p.category === cat && p.image);
  if (itemWithImage && itemWithImage.image) return itemWithImage.image;
  return 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=600&q=80';
};

export default function Kiosk() {
  const location = useLocation();
  const navigate = useNavigate();

  const storeConfig = getActiveStoreConfig();
  const isKioskEnabled = storeConfig ? storeConfig.services.kiosk : true;

  if (!isKioskEnabled) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-error rounded-full blur-[100px]" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-error rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 max-w-sm w-full bg-surface-container-lowest border border-error/20 p-8 rounded-[32px] shadow-lg">
          <div className="w-16 h-16 bg-error/10 text-error flex items-center justify-center rounded-2xl mx-auto mb-6">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-headline-md font-bold text-on-surface mb-2">Assinatura Exigida</h2>
          <p className="text-body-lg text-on-surface-variant leading-relaxed mb-4">
            O serviço de <strong>Totem Autoatendimento (Kiosk)</strong> não está habilitado para a assinatura do seu estabelecimento (<strong>{storeConfig?.name || 'Sua Loja'}</strong>).
          </p>

          <div className="bg-surface-alt p-4 rounded-xl text-left border border-outline-variant/30 mb-6 font-mono text-[11px] text-on-surface-variant/90 leading-tight">
            <p className="font-bold text-on-surface mb-1 text-[11px]">🛠️ DETALHES DA ASSINATURA:</p>
            <p>• Loja: {storeConfig?.name}</p>
            <p>• ID: {storeConfig?.id}</p>
            <p>• Recurso correspondente: totem_kiosk</p>
            <p>• Status: RESTRITO / ATUALIZE SEU PLANO</p>
          </div>

          <p className="text-caption text-on-surface-variant/80 mb-6">
            Para ativar este recurso, fale com a administração central do sistema SaaS POS.
          </p>

          <div className="space-y-2">
            <a
              href="mailto:suporte@quickserve.com?subject=Ativacao%20de%20Totem"
              className="block w-full py-3 bg-brand-primary text-on-primary font-bold rounded-xl active:scale-[0.98] transition-all hover:brightness-95 text-center text-caption"
            >
              Contactar Administração central
            </a>
            <button
              onClick={() => navigate('/login')}
              className="block w-full py-3.5 bg-surface hover:bg-surface-variant border border-outline-variant text-on-surface font-semibold rounded-xl text-caption"
            >
              Voltar ao Login
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Detect if we are in the mobile tracking screen
  const params = new URLSearchParams(location.search);
  const trackId = params.get('track');

  // General inventory & categories
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Cart State (Kiosk Screen)
  const [cart, setCart] = useState<{ product: Product; qty: number; note: string }[]>([]);
  const [tempNoteProduct, setTempNoteProduct] = useState<Product | null>(null);
  const [productNote, setProductNote] = useState('');

  // Checkout flows
  const [checkoutStep, setCheckoutStep] = useState<'kiosk' | 'contact_form' | 'payment_method' | 'qr_code'>('kiosk');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'Dinheiro' | 'Cartão' | 'Pix'>('Pix');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [abacatePayUrl, setAbacatePayUrl] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [createdComandaId, setCreatedComandaId] = useState<string>('');
  
  // AbacatePay Key configuration check
  const apConfig = getAbacatePayConfig();
  const abacatePayKeyConfigured = !!apConfig?.apiKey;

  // Alert modal state
  const [alertState, setAlertState] = useState({ isOpen: false, title: '', message: '' });

  // Load Inventory
  useEffect(() => {
    const loadKioskInventory = () => {
      const list = getStoredInventory();
      // Filter out items that are marked as quicktouch
      const kioskList = list.filter(p => !!p.isQuickTouch);
      setProducts(kioskList);

      const cats = Array.from(new Set(kioskList.map(p => p.category)));
      setCategories(['Todos', ...cats]);
    };

    loadKioskInventory();

    window.addEventListener('qsp_database_updated', loadKioskInventory);
    return () => window.removeEventListener('qsp_database_updated', loadKioskInventory);
  }, []);

  // Fullscreen lock on first interaction
  useEffect(() => {
    const handleUserInteraction = () => {
      const elem = document.documentElement as any;
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch((err: any) => {
          console.warn(`Fullscreen error: ${err.message}`);
        });
      }
      document.removeEventListener('click', handleUserInteraction);
    };
    document.addEventListener('click', handleUserInteraction);
    return () => document.removeEventListener('click', handleUserInteraction);
  }, []);

  // Secure Totem / Lock active session context to Cliente Totem role
  useEffect(() => {
    const currentUser = localStorage.getItem('qsp_current_user');
    if (currentUser) {
      try {
        const parsed = JSON.parse(currentUser);
        if (parsed.role !== 'Cliente') {
          const kioskUser = {
            id: 990,
            name: "Cliente Totem",
            role: "Cliente",
            meta: "Autoatendimento",
            active: true,
            permissions: ["/kiosk"]
          };
          localStorage.setItem('qsp_current_user', JSON.stringify(kioskUser));
          window.dispatchEvent(new Event('qsp_database_updated'));
        }
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // Sync Draft Order State for QR code page updates
  const [currentKioskDraft, setCurrentKioskDraft] = useState<DraftKioskOrder | null>(null);
  useEffect(() => {
    if (checkoutStep === 'qr_code' && createdComandaId) {
      const interval = setInterval(() => {
        const stored = localStorage.getItem(getDraftsKey());
        if (stored) {
          const drafts = JSON.parse(stored) as DraftKioskOrder[];
          const match = drafts.find(d => d.id === createdComandaId);
          if (match) {
            setCurrentKioskDraft(match);
            // If order status is confirmed or prepares, automatically go to a finish greeting!
            if (match.status !== 'PENDING_CONFIRMATION') {
              // Wait a little bit or show success
            }
          }
        }
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [checkoutStep, createdComandaId]);

  // Handle cart calculations
  const totalCartValue = cart.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  const totalCartItemsCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const triggerAlert = (title: string, message: string) => {
    setAlertState({ isOpen: true, title, message });
  };

  const handleAddToCart = (product: Product) => {
    if (product.stock <= 0) {
      triggerAlert('Sem Estoque', 'Este produto acabou no momento. Escolha outra delícia!');
      return;
    }
    setCart(prev => {
      const exists = prev.find(item => item.product.id === product.id);
      if (exists) {
        if (exists.qty + 1 > product.stock) {
          triggerAlert('Limite de Estoque', `Temos apenas ${product.stock} unidades em estoque.`);
          return prev;
        }
        return prev.map(item => item.product.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { product, qty: 1, note: '' }];
    });
  };

  const handleRemoveOneFromCart = (productId: number) => {
    setCart(prev => {
      const exists = prev.find(item => item.product.id === productId);
      if (!exists) return prev;
      if (exists.qty === 1) {
        return prev.filter(item => item.product.id !== productId);
      }
      return prev.map(item => item.product.id === productId ? { ...item, qty: item.qty - 1 } : item);
    });
  };

  const handleOpenNoteModal = (product: Product) => {
    const existingCartItem = cart.find(c => c.product.id === product.id);
    setTempNoteProduct(product);
    setProductNote(existingCartItem?.note || '');
  };

  const handleSaveNote = () => {
    if (!tempNoteProduct) return;
    setCart(prev => {
      const exists = prev.find(item => item.product.id === tempNoteProduct.id);
      if (exists) {
        return prev.map(item => item.product.id === tempNoteProduct.id ? { ...item, note: productNote } : item);
      } else {
        return [...prev, { product: tempNoteProduct, qty: 1, note: productNote }];
      }
    });
    setTempNoteProduct(null);
    setProductNote('');
  };

  const handleFinishKioskSelection = () => {
    if (cart.length === 0) {
      triggerAlert('Carrinho Vazio', 'Escolha pelo menos 1 item para prosseguir com seu pedido!');
      return;
    }
    setCheckoutStep('contact_form');
  };

  const handleConfirmContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) {
      triggerAlert('Dados Obrigatórios', 'Por favor, informe seu Nome e Celular para podermos preparar seu pedido.');
      return;
    }

    // Generate Comanda ID
    const randomComanda = Math.floor(1000 + Math.random() * 9000).toString();
    setCreatedComandaId(randomComanda);

    const newDraft: DraftKioskOrder = {
      id: randomComanda,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      items: cart.map(item => ({
        product: item.product,
        qty: item.qty,
        note: item.note
      })),
      status: 'PENDING_CONFIRMATION',
      time: new Date().toISOString(),
      paymentMethod: selectedPaymentMethod
    };

    // Save Draft in storage
    const stored = localStorage.getItem(getDraftsKey());
    const list: DraftKioskOrder[] = stored ? JSON.parse(stored) : [];
    list.unshift(newDraft);
    localStorage.setItem(getDraftsKey(), JSON.stringify(list));

    setCurrentKioskDraft(newDraft);
    setCheckoutStep('payment_method');
  };

  const handleConfirmPaymentSelection = async () => {
    if (!createdComandaId || !currentKioskDraft) return;

    // Update draft with chosen payment method
    const stored = localStorage.getItem(getDraftsKey());
    const list: DraftKioskOrder[] = stored ? JSON.parse(stored) : [];
    const updated = list.map(d => {
      if (d.id === createdComandaId) {
        return {
          ...d,
          paymentMethod: selectedPaymentMethod,
          status: 'PENDING_CONFIRMATION' as const
        };
      }
      return d;
    });
    localStorage.setItem(getDraftsKey(), JSON.stringify(updated));

    // Update active draft state
    const finalDraft = {
      ...currentKioskDraft,
      paymentMethod: selectedPaymentMethod,
      status: 'PENDING_CONFIRMATION' as const
    };
    setCurrentKioskDraft(finalDraft);

    if (selectedPaymentMethod === 'Pix') {
      setCheckoutStep('qr_code');
      await handlePayWithAbacatePay(true);
    } else {
      setCheckoutStep('qr_code');
    }
  };

  const handleRestartKiosk = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setCreatedComandaId('');
    setCurrentKioskDraft(null);
    setCheckoutStep('kiosk');
    setAbacatePayUrl('');
  };

  // MOBILE CLIENT PORTAL SIMULATION / TRACKING VIEW
  const [mobileOrder, setMobileOrder] = useState<DraftKioskOrder | null>(null);
  const [sysTableMatch, setSysTableMatch] = useState<Table | null>(null);
  const [autoProgressTimer, setAutoProgressTimer] = useState<string>('');

  // Sync Mobile State
  const syncMobileData = () => {
    if (!trackId) return;
    const stored = localStorage.getItem(getDraftsKey());
    if (!stored) return;
    const drafts = JSON.parse(stored) as DraftKioskOrder[];
    const match = drafts.find(d => d.id === trackId);
    if (match) {
      setMobileOrder(match);
      
      // Let's also check if this table exists in active system tables (to verify cashier payment)
      const sysTables = getStoredTables();
      const activeTable = sysTables.find(t => t.id === parseInt(trackId) && t.status === 'ACTIVE');
      setSysTableMatch(activeTable || null);

      // If missing from running active tables AND draft was previously confirmed, it means cash finalized it!
      if (!activeTable && (match.status === 'CONFIRMED' || match.status === 'PREPARING' || match.status === 'READY')) {
        // Update draft status to PAID
        const updated = drafts.map(d => d.id === trackId ? { ...d, status: 'PAID' as const } : d);
        localStorage.setItem(getDraftsKey(), JSON.stringify(updated));
        setMobileOrder({ ...match, status: 'PAID' });
      }
    }
  };

  useEffect(() => {
    if (trackId) {
      syncMobileData();
      const mobInterval = setInterval(syncMobileData, 2000);
      return () => clearInterval(mobInterval);
    }
  }, [trackId]);

  // Handle automatic confirmation of online paid orders
  useEffect(() => {
    const paidOnlineParam = params.get('paidOnline') === 'true';
    if (trackId && paidOnlineParam) {
      const stored = localStorage.getItem(getDraftsKey());
      if (stored) {
        const drafts = JSON.parse(stored) as DraftKioskOrder[];
        const matchIndex = drafts.findIndex(d => d.id === trackId);
        if (matchIndex !== -1 && drafts[matchIndex].status === 'PENDING_CONFIRMATION') {
          const match = drafts[matchIndex];
          
          // Confirm order with paidOnline: true!
          const updatedDrafts = drafts.map((d, idx) => 
            idx === matchIndex 
              ? { ...d, status: 'CONFIRMED' as const, paidOnline: true } 
              : d
          );
          localStorage.setItem(getDraftsKey(), JSON.stringify(updatedDrafts));
          
          // Insert into system's active table
          const activeTables = getStoredTables();
          if (!activeTables.some(t => t.id === parseInt(trackId))) {
            const newComandaTable: Table = {
              id: parseInt(trackId),
              status: 'ACTIVE',
              elapsed: '1 min',
              server: `Totem: ${match.customerName}`,
              noServiceTax: true,
              paidOnline: true, // Mark table as paid online!
              items: match.items.map(item => ({
                name: item.product.name,
                note: item.note ? `${item.note} [Cliente]` : 'Ped. Totem',
                price: item.product.price,
                qty: item.qty
              }))
            };
            const newTablesList = [newComandaTable, ...activeTables];
            saveTables(newTablesList);
          }

          // Trigger printer!
          match.items.forEach(item => {
            printOrderTicket(
              `Comanda #${trackId}`, 
              item.product.name, 
              item.qty, 
              `${item.note || ''} (Cli: ${match.customerName})`, 
              item.product.category
            );
          });

          // Sync mobile order state
          setMobileOrder({ ...match, status: 'CONFIRMED', paidOnline: true });
          
          triggerAlert('Pagamento Recebido!', 'Seu pagamento online via Pix foi confirmado com sucesso! Seu pedido foi enviado para a cozinha.');
          
          // Clean the query param from URL bar for cleaner UI
          const newParams = new URLSearchParams(window.location.search);
          newParams.delete('paidOnline');
          const newSearch = newParams.toString();
          const newUrl = `${window.location.pathname}${newSearch ? '?' + newSearch : ''}`;
          window.history.replaceState({}, '', newUrl);
        }
      }
    }
  }, [trackId, params]);

  const handlePayWithAbacatePay = async (isFromTotem = false) => {
    const orderToPay = isFromTotem ? currentKioskDraft : mobileOrder;
    if (!orderToPay) return;
    
    const config = getAbacatePayConfig();
    if (!config.apiKey) {
      triggerAlert('Credenciais ausentes', 'A chave de API do AbacatePay não foi configurada no painel administrativo.');
      return;
    }

    setIsCreatingCheckout(true);
    try {
      const productsList = orderToPay.items.map((item, index) => ({
        externalId: `${item.product.id}-${index}`,
        name: item.product.name,
        quantity: item.qty,
        price: Math.round(item.product.price * 100) // In cents!
      }));

      const body = {
        frequency: 'ONE_TIME',
        methods: ['PIX'],
        products: productsList,
        items: productsList, // fallback matching items vs products
        returnUrl: `${window.location.origin}/kiosk?track=${orderToPay.id}&paidOnline=true`,
        completionUrl: `${window.location.origin}/kiosk?track=${orderToPay.id}&paidOnline=true`,
        customer: {
          name: orderToPay.customerName,
          cellphone: orderToPay.customerPhone,
          email: 'cliente-totem@quickserve.com'
        }
      };

      const response = await fetch('https://api.abacatepay.com/v1/billing/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || 'Falha na resposta da API');
      }

      const resData = await response.json();
      const checkoutUrl = resData.data?.url || resData.url || resData.data?.paymentUrl;
      if (checkoutUrl) {
        if (isFromTotem) {
          setAbacatePayUrl(checkoutUrl);
        } else {
          window.location.href = checkoutUrl;
        }
      } else {
        throw new Error('URL de pagamento não encontrada no retorno.');
      }
    } catch (e) {
      console.error('Erro AbacatePay:', e);
      // Fallback url for simulation
      const fallbackUrl = `${window.location.origin}/kiosk?track=${orderToPay.id}&paidOnline=true`;
      if (isFromTotem) {
        setAbacatePayUrl(fallbackUrl);
      } else {
        triggerAlert(
          'Ambiente de Testes / Simulação 🥑',
          'Como estamos no ambiente de visualização, simulamos o redirecionamento seguro para o checkout do Abacate Pay! Clique em Confirmar para concluir a simulação do Pix.'
        );
        setTimeout(() => {
          window.location.href = fallbackUrl;
        }, 2500);
      }
    } finally {
      setIsCreatingCheckout(false);
    }
  };

  const handleSimulatePixApproval = () => {
    if (!createdComandaId || !currentKioskDraft) return;

    const stored = localStorage.getItem(getDraftsKey());
    const drafts = stored ? (JSON.parse(stored) as DraftKioskOrder[]) : [];
    
    const updatedDrafts = drafts.map(d => 
      d.id === createdComandaId 
        ? { ...d, status: 'CONFIRMED' as const, paidOnline: true } 
        : d
    );
    localStorage.setItem(getDraftsKey(), JSON.stringify(updatedDrafts));
    
    const activeTables = getStoredTables();
    if (!activeTables.some(t => t.id === parseInt(createdComandaId))) {
      const newComandaTable: Table = {
        id: parseInt(createdComandaId),
        status: 'ACTIVE',
        elapsed: '1 min',
        server: `Totem: ${currentKioskDraft.customerName}`,
        noServiceTax: true,
        paidOnline: true,
        items: currentKioskDraft.items.map(item => ({
          name: item.product.name,
          note: item.note ? `${item.note} [Cliente]` : 'Ped. Totem',
          price: item.product.price,
          qty: item.qty
        }))
      };
      saveTables([newComandaTable, ...activeTables]);
    }

    currentKioskDraft.items.forEach(item => {
      printOrderTicket(
        `Comanda #${createdComandaId}`, 
        item.product.name, 
        item.qty, 
        `${item.note || ''} (Cli: ${currentKioskDraft.customerName})`, 
        item.product.category
      );
    });

    setCurrentKioskDraft({ ...currentKioskDraft, status: 'CONFIRMED', paidOnline: true });
    triggerAlert('Pix Confirmado!', 'Pagamento online via Pix aprovado! Pedido enviado para a cozinha.');
  };

  const handleSimulateCashierApproval = () => {
    if (!createdComandaId || !currentKioskDraft) return;

    const stored = localStorage.getItem(getDraftsKey());
    const drafts = stored ? (JSON.parse(stored) as DraftKioskOrder[]) : [];
    
    const updatedDrafts = drafts.map(d => 
      d.id === createdComandaId 
        ? { ...d, status: 'CONFIRMED' as const } 
        : d
    );
    localStorage.setItem(getDraftsKey(), JSON.stringify(updatedDrafts));
    
    const activeTables = getStoredTables();
    if (!activeTables.some(t => t.id === parseInt(createdComandaId))) {
      const newComandaTable: Table = {
        id: parseInt(createdComandaId),
        status: 'ACTIVE',
        elapsed: '1 min',
        server: `Totem: ${currentKioskDraft.customerName}`,
        noServiceTax: true,
        items: currentKioskDraft.items.map(item => ({
          name: item.product.name,
          note: item.note ? `${item.note} [Cliente]` : 'Ped. Totem',
          price: item.product.price,
          qty: item.qty
        }))
      };
      saveTables([newComandaTable, ...activeTables]);
    }

    currentKioskDraft.items.forEach(item => {
      printOrderTicket(
        `Comanda #${createdComandaId}`, 
        item.product.name, 
        item.qty, 
        `${item.note || ''} (Cli: ${currentKioskDraft.customerName})`, 
        item.product.category
      );
    });

    setCurrentKioskDraft({ ...currentKioskDraft, status: 'CONFIRMED' });
    triggerAlert('Confirmado!', 'O pagamento foi confirmado e o pedido foi enviado para a cozinha com sucesso!');
  };

  // Simulated Auto preparation state updates to show off the status tracker!
  useEffect(() => {
    if (mobileOrder && mobileOrder.status !== 'PENDING_CONFIRMATION' && mobileOrder.status !== 'PAID') {
      const stored = localStorage.getItem(getDraftsKey());
      if (!stored) return;
      const drafts = JSON.parse(stored) as DraftKioskOrder[];

      // Confirm -> Preparing simulation
      if (mobileOrder.status === 'CONFIRMED') {
        const prepareTimer = setTimeout(() => {
          const updated = drafts.map(d => d.id === trackId ? { ...d, status: 'PREPARING' as const } : d);
          localStorage.setItem(getDraftsKey(), JSON.stringify(updated));
          setAutoProgressTimer('preparing');
          triggerAlert('Status Atualizado', 'Seu pedido começou a ser preparado pela cozinha! 🍳🍔');
        }, 12000); // 12 seconds
        return () => clearTimeout(prepareTimer);
      }

      // Preparing -> Ready simulation
      if (mobileOrder.status === 'PREPARING') {
        const readyTimer = setTimeout(() => {
          const updated = drafts.map(d => d.id === trackId ? { ...d, status: 'READY' as const } : d);
          localStorage.setItem(getDraftsKey(), JSON.stringify(updated));
          setAutoProgressTimer('ready');
          triggerAlert('Pronto para Retirada! 🍕', 'Delícia! Seu pedido já está pronto no balcão. Apresente seu ID Comanda ao caixa para realizar o pagamento!');
        }, 15000); // 15 seconds
        return () => clearTimeout(readyTimer);
      }
    }
  }, [mobileOrder?.status]);

  const handleMobileConfirmOrder = () => {
    if (!mobileOrder) return;
    const stored = localStorage.getItem(getDraftsKey());
    if (!stored) return;
    const drafts = JSON.parse(stored) as DraftKioskOrder[];

    // 1. Update draft status
    const updatedDrafts = drafts.map(d => d.id === trackId ? { ...d, status: 'CONFIRMED' as const } : d);
    localStorage.setItem(getDraftsKey(), JSON.stringify(updatedDrafts));
    setMobileOrder({ ...mobileOrder, status: 'CONFIRMED' });

    // 2. Insert into system's active table/orders so that cashier can find and close it!
    const activeTables = getStoredTables();
    
    // Check if comanda already exists in system to avoid duplication
    if (!activeTables.some(t => t.id === parseInt(trackId!))) {
      const newComandaTable: Table = {
        id: parseInt(trackId!),
        status: 'ACTIVE',
        elapsed: '1 min',
        server: `Totem: ${mobileOrder.customerName}`,
        noServiceTax: true,
        items: mobileOrder.items.map(item => ({
          name: item.product.name,
          note: item.note ? `${item.note} [Cliente]` : 'Ped. Totem',
          price: item.product.price,
          qty: item.qty
        }))
      };
      
      const newTablesList = [newComandaTable, ...activeTables];
      saveTables(newTablesList);
    }

    // 3. Trigger printing! Send a ticket to each targeted printer
    mobileOrder.items.forEach(item => {
      printOrderTicket(
        `Comanda #${trackId}`, 
        item.product.name, 
        item.qty, 
        `${item.note || ''} (Cli: ${mobileOrder.customerName})`, 
        item.product.category
      );
    });

    triggerAlert('Sucesso!', 'Pedido enviado para a cozinha com sucesso! Acompanhe o progresso nesta tela.');
  };

  // Build the QR Code URL
  const qrCodeUrl = `${window.location.origin}/kiosk?track=${createdComandaId}`;
  const qrImageSrc = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrCodeUrl)}`;

  // Filtered list based on Search and Tabs
  const filteredProducts = products.filter(p => {
    const matchCat = selectedCategory === 'Todos' || p.category === selectedCategory;
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        p.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCat && matchSearch;
  });

  // ————————————————————————————————————————————————————————————
  // RENDER INTERACTIVE MOBILE CLIENT PHONE PORTAL
  // ————————————————————————————————————————————————————————————
  if (trackId) {
    if (!mobileOrder) {
      return (
        <div className="min-h-screen bg-surface-container flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle size={48} className="text-error mb-4" />
          <h1 className="text-headline-md font-bold mb-2 text-on-surface">Pedido não Encontrado</h1>
          <p className="text-on-surface-variant max-w-sm mb-6">Esta comanda pode ter sido apagada ou o link está incorreto.</p>
          <button 
            onClick={() => navigate('/kiosk')}
            className="px-6 py-2 bg-brand-primary text-on-primary font-bold rounded-lg"
          >
            Voltar ao Totem
          </button>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-900 text-white flex justify-center py-4 px-2 select-none font-sans">
        <div className="w-full max-w-[420px] bg-slate-800 rounded-[35px] border-8 border-slate-700 shadow-2xl flex flex-col overflow-hidden relative" style={{ minHeight: '80vh' }}>
          
          {/* Simulated Speaker / Status Bar */}
          <div className="h-6 bg-slate-900 flex justify-between items-center px-6">
            <span className="text-[10px] font-bold text-slate-400">12:00</span>
            <div className="w-20 h-4 bg-black rounded-b-xl pr-1.5 flex items-center justify-end">
              <div className="w-2 h-2 rounded-full bg-slate-800"></div>
            </div>
            <span className="text-[10px] font-bold text-slate-400">⚡ 100%</span>
          </div>

          {/* Core Mobile Header */}
          <header className="p-4 bg-slate-905 border-b border-slate-700/60 flex items-center gap-3">
            <Utensils className="text-emerald-400" size={22} />
            <div>
              <h1 className="font-extrabold text-sm tracking-wide text-slate-100 uppercase">Acompanhar Comanda</h1>
              <span className="text-[11px] text-slate-400 font-bold">QuickServe Totem</span>
            </div>
            <span className="ml-auto bg-slate-700 px-2.5 py-1 rounded-full text-xs font-black text-slate-250">
              #{mobileOrder.id}
            </span>
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            
            {/* Header greeting customer */}
            <div className="text-center p-4 bg-slate-750/30 rounded-2xl border border-slate-700/40">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">Cliente do Balcão</p>
              <h2 className="text-lg font-black text-emerald-400 mt-1">{mobileOrder.customerName}</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">{mobileOrder.customerPhone}</p>
            </div>

            {/* ORDER STATUS LEDGER SECTION */}
            <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-700/60 space-y-4">
              <h3 className="font-bold text-xs tracking-wider uppercase text-slate-400">Status do seu Pedido</h3>
              
              <div className="space-y-6 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-700">
                
                {/* Step 1: Wait confirmation */}
                <div className="relative">
                  <div className={`absolute -left-6 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold ${mobileOrder.status === 'PENDING_CONFIRMATION' ? 'bg-amber-500 text-slate-950 animate-pulse' : 'bg-emerald-500 text-slate-950'}`}>
                    {mobileOrder.status !== 'PENDING_CONFIRMATION' ? '✓' : '1'}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Escaneado & Criado</h4>
                    <p className="text-xs text-slate-400">Seu pedido foi registrado no terminal de autoatendimento.</p>
                  </div>
                </div>

                {/* Step 2: Confirmed in Kitchen */}
                <div className="relative">
                  <div className={`absolute -left-6 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                    mobileOrder.status === 'PENDING_CONFIRMATION' ? 'bg-slate-800 text-slate-500' :
                    mobileOrder.status === 'CONFIRMED' ? 'bg-amber-500 text-slate-950 animate-pulse' : 'bg-emerald-500 text-slate-950'
                  }`}>
                    {mobileOrder.status !== 'PENDING_CONFIRMATION' && mobileOrder.status !== 'CONFIRMED' ? '✓' : '2'}
                  </div>
                  <div>
                    <h4 className={`font-bold text-sm ${mobileOrder.status === 'PENDING_CONFIRMATION' ? 'text-slate-500' : 'text-white'}`}>
                      Pedido Confirmado
                    </h4>
                    <p className="text-xs text-slate-400">Aguardando início do preparo dos produtos.</p>
                  </div>
                </div>

                {/* Step 3: Kitchen Preparing */}
                <div className="relative">
                  <div className={`absolute -left-6 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                    (mobileOrder.status === 'PENDING_CONFIRMATION' || mobileOrder.status === 'CONFIRMED') ? 'bg-slate-800 text-slate-500' :
                    mobileOrder.status === 'PREPARING' ? 'bg-amber-500 text-slate-950 animate-pulse' : 'bg-emerald-500 text-slate-950'
                  }`}>
                    {mobileOrder.status === 'READY' || mobileOrder.status === 'PAID' ? '✓' : '3'}
                  </div>
                  <div>
                    <h4 className={`font-bold text-sm ${(mobileOrder.status === 'PENDING_CONFIRMATION' || mobileOrder.status === 'CONFIRMED') ? 'text-slate-500' : 'text-white'}`}>
                      Em Preparação <span className={mobileOrder.status === 'PREPARING' ? "inline" : "hidden"}>🔥</span>
                    </h4>
                    <p className="text-xs text-slate-400">Seus itens estão sendo preparados na cozinha.</p>
                  </div>
                </div>

                {/* Step 4: Ready for pickup */}
                <div className="relative">
                  <div className={`absolute -left-6 w-4.5 h-4.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                    mobileOrder.status === 'READY' ? 'bg-emerald-500 text-slate-950 animate-bounce' :
                    mobileOrder.status === 'PAID' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-500'
                  }`}>
                    {mobileOrder.status === 'PAID' ? '✓' : '4'}
                  </div>
                  <div>
                    <h4 className={`font-bold text-sm ${mobileOrder.status === 'READY' ? 'text-emerald-400 font-extrabold' : mobileOrder.status === 'PAID' ? 'text-white' : 'text-slate-500'}`}>
                      Pronto para Retirada! 🎉
                    </h4>
                    <p className="text-xs text-slate-400">Dirija-se ao caixa do balcão e informe o código da comanda para pagar e retirar!</p>
                  </div>
                </div>

              </div>

            </div>

            {/* ORDER ITEMS SUMMARY */}
            <div className="p-4 bg-slate-900/60 rounded-2xl border border-slate-700/60 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-700/80 pb-2">
                <span className="font-bold text-xs uppercase text-slate-400">Itens Selecionados</span>
                <span className="text-xs text-slate-400">{mobileOrder.items.length} itens</span>
              </div>
              <div className="space-y-3 divide-y divide-slate-700/40">
                {mobileOrder.items.map((item, idx) => (
                  <div key={idx} className="pt-2 flex justify-between gap-3 text-xs">
                    <div>
                      <p className="font-bold">{item.qty}x {item.product.name}</p>
                      {item.note && <p className="text-[10px] text-amber-300/80 italic mt-0.5">Obs: "{item.note}"</p>}
                    </div>
                    <span className="font-bold text-slate-300">R$ {(item.product.price * item.qty).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-700/80 pt-3 flex justify-between items-center font-black">
                <span className="text-xs text-slate-400 uppercase">Valor Total</span>
                <span className="text-base text-emerald-400">R$ {mobileOrder.items.reduce((sum, item) => sum + item.product.price * item.qty, 0).toFixed(2)}</span>
              </div>
            </div>

          </div>

          {/* ACTION FOOTER */}
          <footer className="p-4 bg-slate-900 border-t border-slate-700 flex flex-col gap-3">
            {mobileOrder.status === 'PENDING_CONFIRMATION' && (
              <>
                {abacatePayKeyConfigured && (
                  <button
                    onClick={handlePayWithAbacatePay}
                    disabled={isCreatingCheckout}
                    className="w-full bg-lime-500 hover:bg-lime-600 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black py-4 rounded-xl shadow-lg shadow-lime-500/20 active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer animate-pulse"
                  >
                    {isCreatingCheckout ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        GERANDO PIX ONLINE...
                      </>
                    ) : (
                      <>
                        <Smartphone size={16} />
                        PAGAR ONLINE COM PIX (ABACATEPAY) 🥑
                      </>
                    )}
                  </button>
                )}
                
                <button
                  onClick={handleMobileConfirmOrder}
                  className={`w-full ${
                    abacatePayKeyConfigured 
                      ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700' 
                      : 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/20'
                  } font-black py-3.5 rounded-xl active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer`}
                >
                  <CheckCircle2 size={16} />
                  {abacatePayKeyConfigured ? 'CONFIRMAR & PAGAR PRESENCIAL NO CAIXA 💵' : 'CONFIRMAR MEU PEDIDO NA COZINHA 🤝'}
                </button>
              </>
            )}

            {mobileOrder.status === 'CONFIRMED' && (
              <div className="flex items-center gap-2.5 justify-center p-3.5 bg-indigo-500/10 rounded-xl border border-indigo-500/35">
                <Loader2 className="animate-spin text-indigo-400" size={16} />
                <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-widest text-center">
                  {mobileOrder.paidOnline ? '✓ Pago Online • Enviado à Cozinha' : 'Aguardando Cozinha Aceitar'}
                </span>
              </div>
            )}

            {mobileOrder.status === 'PREPARING' && (
              <div className="flex items-center gap-2 justify-center p-3.5 bg-amber-500/10 rounded-xl border border-amber-500/35 text-center">
                <Flame className="animate-pulse text-amber-500" size={18} />
                <span className="text-[11px] font-extrabold text-amber-300 uppercase tracking-widest">Sua Refeição Está Sendo Preparada! 🔥</span>
              </div>
            )}

            {mobileOrder.status === 'READY' && (
              <div className="bg-emerald-500/10 rounded-xl border border-emerald-500/30 p-3.5 text-center flex flex-col gap-1.5 align-middle">
                <span className="text-xs font-black text-emerald-450 uppercase tracking-wide">Pronto para Consumo! 🍔🥤</span>
                <span className="text-[11px] text-slate-300">
                  {mobileOrder.paidOnline 
                    ? 'Este pedido já está pago! Basta retirar no balcão apresentando sua Comanda.'
                    : `Informe o número Comanda #${mobileOrder.id} ao operador no caixa do balcão para pagar e levar.`
                  }
                </span>
              </div>
            )}

            {mobileOrder.status === 'PAID' && (
              <div className="bg-slate-850 rounded-xl border border-slate-700 p-4 text-center">
                <span className="text-emerald-400 font-extrabold text-xs block mb-1">✓ PEDIDO PAGO E INTEGRADO</span>
                <span className="text-[10px] text-slate-400">Obrigado pela preferência e pelas compras no QuickServe! Tenha um excelente apetite.</span>
              </div>
            )}

            <div className="text-[9px] text-slate-500 text-center uppercase tracking-widest">
              QuickServe PDV &bull; CNPJ Proprietário
            </div>
          </footer>

        </div>

        {/* Display Alert Modal if open */}
        {alertState.isOpen && (
          <AlertModal
            isOpen={alertState.isOpen}
            title={alertState.title}
            message={alertState.message}
            onClose={() => setAlertState({ ...alertState, isOpen: false })}
          />
        )}
      </div>
    );
  }

  // ————————————————————————————————————————————————————————————
  // RENDER MAIN STANDALONE TOTEM KIOSK SCREEN
  // ————————————————————————————————————————————————————————————
  return (
    <div className="min-h-screen bg-surface text-on-surface select-none font-sans flex flex-col relative">
      
      {/* Top Welcome Title */}
      <header className="bg-surface-container-low border-b border-surface-variant/40 px-6 py-4 flex justify-between items-center shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            🎯
          </div>
          <div>
            <h1 className="text-title-large font-black text-primary uppercase tracking-tight">Totem QuickTouch</h1>
            <p className="text-xs text-on-surface-variant leading-none">Autoatendimento do Balcão</p>
          </div>
        </div>
        <div className="flex gap-2">
          {checkoutStep !== 'kiosk' && (
            <button
              onClick={handleRestartKiosk}
              className="px-5 py-2.5 bg-surface-container hover:bg-surface-variant rounded-xl font-bold text-xs text-on-surface-variant transition-all hover:scale-105"
            >
              Voltar ao Cardápio
            </button>
          )}
        </div>
      </header>

      {/* RENDER STEPS */}
      {checkoutStep === 'kiosk' && (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* CATEGORY SELECTOR COLUMN (Left on desktop, Top on mobile) */}
          <aside className="w-full md:w-64 bg-surface-container-lowest border-b md:border-b-0 md:border-r border-surface-variant/30 py-3 md:py-6 overflow-x-auto md:overflow-y-auto flex md:flex-col gap-2 md:gap-0 md:space-y-2.5 px-3 md:px-0 no-scrollbar flex-shrink-0">
            <h2 className="hidden md:block px-6 text-[11px] uppercase tracking-wider font-bold text-on-surface-variant/80 mb-2">Categorias</h2>
            {categories.map((cat, idx) => {
              const catImg = getCategoryImage(cat, products);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`md:mx-3 py-2 md:py-3 px-3 md:px-4 rounded-xl text-left transition-all flex items-center gap-2 md:gap-3 border flex-shrink-0 ${
                    selectedCategory === cat 
                      ? 'bg-secondary-container/20 border-secondary text-primary font-black shadow-xs' 
                      : 'border-transparent text-on-surface-variant hover:bg-surface-variant/40'
                  }`}
                >
                  <div className="w-6 h-6 md:w-8 md:h-8 rounded-lg overflow-hidden flex-shrink-0 bg-surface-variant">
                    <img src={catImg} alt={cat} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </div>
                  <span className="text-xs font-bold whitespace-nowrap">{cat === 'Todos' ? 'Menu Completo' : cat}</span>
                </button>
              );
            })}
          </aside>

          {/* MAIN PRODUCT GRID */}
          <main className="flex-1 flex flex-col p-4 md:p-6 overflow-hidden bg-surface-variant/5">
            
            {/* Search items bar */}
            <div className="relative mb-6">
              <Search className="absolute left-4 top-3.5 text-on-surface-variant/60" size={18} />
              <input
                type="text"
                placeholder="Qual delícia você quer saborear hoje? Procure aqui..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 pl-12 pr-4 rounded-xl border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-on-surface-variant/40 outline-none focus:ring-2 focus:ring-secondary/20 transition-all text-sm font-semibold"
              />
            </div>

            {/* List products & category cards */}
            <div className="flex-1 overflow-y-auto pr-2 pb-24 space-y-8">
              
              {/* Category card grid when showing "Todos" */}
              {selectedCategory === 'Todos' && !searchTerm && (
                <div className="hidden md:block space-y-4">
                  <h3 className="text-xs font-extrabold uppercase tracking-widest text-on-surface-variant/80 flex items-center gap-2">
                    <span>📂 Toque em uma categoria para navegar</span>
                  </h3>
                  <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {categories.filter(c => c !== 'Todos').map((cat, idx) => {
                      const catProducts = products.filter(p => p.category === cat && p.isQuickTouch);
                      const count = catProducts.length;
                      const catImg = getCategoryImage(cat, products);
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className="relative h-28 rounded-2xl overflow-hidden shadow-xs border border-surface-variant/30 hover:border-surface-variant transition-all hover:scale-[1.03] active:scale-95 text-left group cursor-pointer"
                        >
                          <img 
                            src={catImg} 
                            alt={cat}
                            referrerPolicy="no-referrer"
                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent flex flex-col justify-end p-3.5">
                            <span className="text-white font-black text-xs uppercase tracking-wide leading-none">{cat}</span>
                            <span className="text-slate-300 text-[10px] mt-1 font-semibold">{count} {count === 1 ? 'produto' : 'produtos'}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Header banner when a specific category is selected */}
              {selectedCategory !== 'Todos' && (
                <div className="relative h-36 rounded-3xl overflow-hidden border border-surface-variant/30 shadow-xs flex items-center animate-scale">
                  <img 
                    src={getCategoryImage(selectedCategory, products)} 
                    alt={selectedCategory}
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 w-full h-full object-cover filter brightness-[0.45]"
                  />
                  <div className="relative z-10 px-6 w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <span className="bg-primary/25 text-white border border-white/20 font-bold uppercase tracking-widest text-[9px] px-2.5 py-0.5 rounded-full">
                        Categoria Selecionada
                      </span>
                      <h2 className="text-xl font-black text-white mt-1 uppercase tracking-tight">{selectedCategory}</h2>
                      <p className="text-[11px] text-slate-300 font-semibold">Mostrando produtos da seção {selectedCategory}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedCategory('Todos')}
                      className="self-start sm:self-auto px-4 py-2 bg-white/15 hover:bg-white/25 active:scale-95 text-white font-bold text-xs rounded-xl backdrop-blur-xs flex items-center gap-1.5 transition-all cursor-pointer border border-white/10 uppercase tracking-wider animate-pulse"
                    >
                      <ArrowLeft size={14} />
                      Ver Todas
                    </button>
                  </div>
                </div>
              )}

              {/* Title for the Products Grid */}
              <div className="flex items-center justify-between pt-2 border-t border-outline-variant/30">
                <h3 className="text-sm font-extrabold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                  <span>🍔 Cardápio de Produtos</span>
                </h3>
                <span className="text-xs text-on-surface-variant/70 font-semibold">{filteredProducts.length} itens encontrados</span>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="text-center py-20 bg-surface-container-low/30 rounded-3xl border border-dashed border-outline-variant/60">
                  <AlertCircle size={44} className="mx-auto text-on-surface-variant/40 mb-3" />
                  <p className="font-bold text-on-surface">Nenhum produto QuickTouch cadastrado nesta seção</p>
                  <p className="text-xs text-on-surface-variant mt-1.5 max-w-sm mx-auto">Cadastre novos produtos no Painel de Estoque e lembre-se de marcar a caixa "Venda no Balcão (QuickTouch)" e adicionar uma foto!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 animate-scale">
                  {filteredProducts.map(product => {
                    const cartItem = cart.find(c => c.product.id === product.id);
                    return (
                      <div 
                        key={product.id}
                        className={`bg-surface-container-lowest rounded-3xl border overflow-hidden transition-all flex flex-col ${
                          cartItem 
                            ? 'ring-2 ring-secondary border-secondary/40 shadow-md scale-[1.01]' 
                            : 'border-surface-variant/50 hover:shadow-sm'
                        }`}
                      >
                        {/* Photo overlay */}
                        <div className="relative h-44 bg-surface-variant flex items-center justify-center overflow-hidden">
                          {product.image ? (
                            <img 
                              src={product.image} 
                              alt={product.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-4xl">🍔</span>
                          )}
                          {cartItem && (
                            <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-secondary text-on-secondary flex items-center justify-center font-black text-sm shadow-md animate-scale">
                              {cartItem.qty}
                            </div>
                          )}
                          <div className="absolute bottom-3 left-3 bg-black/65 backdrop-blur-xs px-2.5 py-1 rounded-full text-[10px] uppercase font-bold text-white tracking-widest">
                            {product.category}
                          </div>
                        </div>

                        {/* Title details */}
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div className="space-y-1">
                            <h3 className="font-bold text-on-surface leading-tight text-body-lg group-hover:text-primary transition-colors">
                              {product.name}
                            </h3>
                            <p className="text-xs text-on-surface-variant leading-tight">Estoque disponível: {product.stock} un</p>
                          </div>

                          <div className="mt-4 flex items-center justify-between">
                            <p className="text-secondary font-black text-xl">
                              R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                            
                            {/* Quantity selection panel */}
                            {cartItem ? (
                              <div className="flex items-center gap-1.5 bg-surface-container rounded-xl p-1 border border-outline-variant/55">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOneFromCart(product.id)}
                                  className="w-8 h-8 rounded-lg bg-surface hover:bg-surface-variant text-on-surface flex items-center justify-center transition-all cursor-pointer font-bold"
                                >
                                  <Minus size={14} />
                                </button>
                                <span className="text-xs font-extrabold w-6 text-center text-on-surface">
                                  {cartItem.qty}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleAddToCart(product)}
                                  className="w-8 h-8 rounded-lg bg-surface hover:bg-surface-variant text-on-surface flex items-center justify-center transition-all cursor-pointer font-bold"
                                >
                                  <Plus size={14} />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleAddToCart(product)}
                                className="px-4 py-2 bg-brand-primary text-on-primary rounded-xl font-bold text-xs uppercase tracking-wider hover:brightness-95 active:scale-95 transition-all cursor-pointer"
                              >
                                Adicionar
                              </button>
                            )}
                          </div>

                          {/* Notes/Observation Trigger */}
                          <div className="mt-3 pt-3 border-t border-outline-dashed border-outline-variant/40 flex justify-between items-center">
                            <span className="text-[10px] text-on-surface-variant truncate max-w-[150px]">
                              {cartItem?.note ? `Obs: "${cartItem.note}"` : 'Sem observações'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenNoteModal(product)}
                              className="text-[10px] font-bold text-primary hover:underline flex items-center gap-1"
                            >
                              <FileText size={11} />
                              {cartItem?.note ? 'Editar Obs.' : 'Adicionar Obs.'}
                            </button>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* FLOATING CART SUMMARY (BOTTOM) */}
            {cart.length > 0 && (
              <div className="absolute bottom-6 left-6 right-6 md:left-72 bg-secondary text-on-secondary py-4 px-6 rounded-3xl flex items-center justify-between shadow-lg ring-4 ring-secondary/20 z-60 animate-up">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-white font-extrabold text-lg relative">
                    <ShoppingCart size={22} />
                    <span className="absolute -top-1.5 -right-1.5 bg-error text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-md">
                      {totalCartItemsCount}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-xs text-white/80">Meu Carrinho de Pedidos</p>
                    <p className="font-black text-xl text-white">R$ {totalCartValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={handleRestartKiosk}
                    type="button"
                    className="px-5 py-2.5 bg-black/15 hover:bg-black/25 rounded-xl font-bold text-xs text-white transition-all cursor-pointer"
                  >
                    Limpar Carrinho
                  </button>
                  <button
                    onClick={handleFinishKioskSelection}
                    type="button"
                    className="bg-white text-secondary hover:bg-slate-50 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
                  >
                    Confirmar & Avançar
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

          </main>
        </div>
      )}

      {/* STEP 2: REGISTER CONTACT FORM */}
      {checkoutStep === 'contact_form' && (
        <div className="flex-1 flex items-center justify-center bg-surface-variant/15 p-6 animate-scale">
          <div className="w-full max-w-lg bg-surface-container-lowest rounded-3xl border border-surface-variant/40 shadow-xl p-8 space-y-6">
            
            <div className="text-center space-y-2">
              <span className="text-3xl">👤</span>
              <h2 className="text-headline-medium font-black text-primary">Identifique seu Pedido</h2>
              <p className="text-body-medium text-on-surface-variant">Por favor, insira seus dados básicos de contato para que possamos imprimir e iniciar o preparo da sua comanda fiscal no balcão.</p>
            </div>

            <form onSubmit={handleConfirmContact} className="space-y-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant ml-1">Seu Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Seu Nome (Ex: João Silva)"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-outline-variant bg-surface-container text-on-surface placeholder:text-on-surface-variant/30 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/50 font-bold"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant ml-1">Seu Telefone / WhatsApp</label>
                <input
                  type="tel"
                  required
                  placeholder="Ex: (11) 98765-4321"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-outline-variant bg-surface-container text-on-surface placeholder:text-on-surface-variant/30 outline-none focus:border-secondary focus:ring-1 focus:ring-secondary/50 font-bold"
                />
              </div>

              {/* Order total info during checkout */}
              <div className="p-4 bg-surface-container rounded-2xl flex justify-between items-center text-xs text-on-surface-variant border border-outline-variant/30 font-medium">
                <span>Contém {totalCartItemsCount} itens no carrinho</span>
                <span>Total: <strong className="text-sm font-black text-secondary">R$ {totalCartValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCheckoutStep('kiosk')}
                  className="flex-1 py-3 bg-surface-container text-on-surface hover:bg-surface-variant transition-colors rounded-xl font-bold text-sm"
                >
                  Voltar ao Cardápio
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-brand-primary text-on-primary hover:brightness-95 transition-all rounded-xl font-extrabold text-sm uppercase tracking-wider flex items-center justify-center gap-1"
                >
                  Confirmar Contato
                  <Send size={15} />
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* STEP 3: PAYMENT METHOD SELECTION */}
      {checkoutStep === 'payment_method' && (
        <div className="flex-1 flex items-center justify-center bg-surface-variant/15 p-6 animate-scale">
          <div className="w-full max-w-xl bg-surface-container-lowest rounded-[32px] border border-surface-variant/40 shadow-xl p-8 space-y-6">
            
            <div className="text-center space-y-2">
              <span className="text-4xl block animate-bounce">💳</span>
              <h2 className="text-headline-medium font-black text-primary">Forma de Pagamento</h2>
              <p className="text-body-medium text-on-surface-variant">Como você deseja realizar o pagamento do seu pedido?</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Option Pix Online */}
              <button
                type="button"
                onClick={() => setSelectedPaymentMethod('Pix')}
                className={`p-5 rounded-2xl border text-center flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${
                  selectedPaymentMethod === 'Pix' 
                    ? 'bg-lime-500/10 border-lime-500 ring-2 ring-lime-500/20' 
                    : 'border-surface-variant/50 hover:bg-surface-variant/30'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-lime-500/20 text-lime-600 dark:text-lime-400 flex items-center justify-center text-xl font-bold">
                  🥑
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-on-surface">Pix Online</h3>
                  <p className="text-[10px] text-on-surface-variant/70 leading-tight mt-1">Aprovação automática na tela do totem</p>
                </div>
              </button>

              {/* Option Cartão */}
              <button
                type="button"
                onClick={() => setSelectedPaymentMethod('Cartão')}
                className={`p-5 rounded-2xl border text-center flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${
                  selectedPaymentMethod === 'Cartão' 
                    ? 'bg-primary/10 border-primary ring-2 ring-primary/20' 
                    : 'border-surface-variant/50 hover:bg-surface-variant/30'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-primary/20 text-primary flex items-center justify-center text-xl font-bold">
                  💳
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-on-surface">Cartão no Caixa</h3>
                  <p className="text-[10px] text-on-surface-variant/70 leading-tight mt-1">Pague no balcão usando maquininha</p>
                </div>
              </button>

              {/* Option Dinheiro */}
              <button
                type="button"
                onClick={() => setSelectedPaymentMethod('Dinheiro')}
                className={`p-5 rounded-2xl border text-center flex flex-col items-center justify-center gap-3 transition-all cursor-pointer ${
                  selectedPaymentMethod === 'Dinheiro' 
                    ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20' 
                    : 'border-surface-variant/50 hover:bg-surface-variant/30'
                }`}
              >
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xl font-bold">
                  💵
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-on-surface">Dinheiro no Caixa</h3>
                  <p className="text-[10px] text-on-surface-variant/70 leading-tight mt-1">Pague em dinheiro físico para o atendente</p>
                </div>
              </button>

            </div>

            <div className="p-4 bg-surface-container rounded-2xl space-y-2.5 text-xs text-on-surface-variant">
              <div className="flex justify-between font-bold text-on-surface pb-1.5 border-b border-outline-variant/50">
                <span>Total do Pedido:</span>
                <span className="text-secondary font-black text-sm">R$ {totalCartValue.toFixed(2)}</span>
              </div>
              {selectedPaymentMethod === 'Pix' && (
                <p className="leading-tight text-[11px]">⚡ <strong>Pix Online:</strong> Geraremos uma cobrança via AbacatePay. Você poderá escanear o QR Code de pagamento diretamente aqui na tela do totem.</p>
              )}
              {selectedPaymentMethod === 'Cartão' && (
                <p className="leading-tight text-[11px]">💳 <strong>Cartão:</strong> Seu pedido será registrado como "Aguardando Confirmação". Dirija-se ao caixa para pagar na maquininha física e liberar a preparação.</p>
              )}
              {selectedPaymentMethod === 'Dinheiro' && (
                <p className="leading-tight text-[11px]">💵 <strong>Dinheiro:</strong> Seu pedido será registrado como "Aguardando Confirmação". Vá ao caixa, efetue o pagamento em dinheiro físico e o atendente liberará o pedido.</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCheckoutStep('contact_form')}
                className="flex-1 py-3 bg-surface-container hover:bg-surface-variant text-on-surface font-bold rounded-xl text-xs transition-all active:scale-[0.98] uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer border border-outline-variant/60"
              >
                <ArrowLeft size={14} />
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmPaymentSelection}
                disabled={isCreatingCheckout}
                className="flex-1 py-3 bg-brand-primary text-on-primary font-black rounded-xl text-xs shadow-md transition-all active:scale-[0.98] hover:brightness-95 uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isCreatingCheckout ? (
                  <>
                    <Loader2 className="animate-spin" size={14} />
                    Processando...
                  </>
                ) : (
                  <>
                    Finalizar Pedido
                    <Check size={14} />
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* STEP 4: QR CODE & SIMULATE CONFIRMATION */}
      {checkoutStep === 'qr_code' && (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 text-white p-6 animate-scale">
          <div className="w-full max-w-xl bg-slate-850 rounded-[30px] border border-slate-700/60 p-8 space-y-6 text-center shadow-2xl relative">
            
            <div className="space-y-1">
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-widest text-[9.5px] px-3 py-1 rounded-full">
                Módulo Balcão Totem
              </span>
              
              {selectedPaymentMethod === 'Pix' ? (
                <>
                  <h2 className="text-2xl font-black text-white mt-1">Efetue o Pagamento Pix</h2>
                  <p className="text-slate-400 text-xs max-w-md mx-auto">Escaneie o QR Code abaixo com o aplicativo de pagamentos do seu banco para pagar com Pix. Assim que confirmado, seu pedido começará a ser preparado!</p>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-black text-white mt-1">Pedido Enviado ao Caixa!</h2>
                  <p className="text-slate-400 text-xs max-w-md mx-auto">Dirija-se ao caixa e informe o número de sua comanda <strong className="text-amber-400 font-bold">#{createdComandaId}</strong> para realizar o pagamento (em {selectedPaymentMethod === 'Cartão' ? 'Cartão' : 'Dinheiro'}) e liberar a preparação na cozinha.</p>
                </>
              )}
            </div>

            {/* QR Code Container */}
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-3xl w-60 h-60 mx-auto flex items-center justify-center shadow-lg relative border-4 border-slate-700">
                {selectedPaymentMethod === 'Pix' ? (
                  isCreatingCheckout ? (
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-800">
                      <Loader2 className="animate-spin text-lime-600" size={32} />
                      <span className="text-xs font-bold text-slate-500">Gerando Pix...</span>
                    </div>
                  ) : abacatePayUrl ? (
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(abacatePayUrl)}`} 
                      alt="QR Code Pix"
                      className="w-full h-full"
                    />
                  ) : (
                    <div className="text-slate-500 text-xs font-semibold p-4 text-center">
                      Falha ao carregar o Pix Online. Use o simulador abaixo.
                    </div>
                  )
                ) : (
                  <img 
                    src={qrImageSrc} 
                    alt="QR Code de Rastreamento"
                    className="w-full h-full"
                  />
                )}
              </div>
              
              {selectedPaymentMethod === 'Pix' ? (
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                  🥑 Pix via AbacatePay
                </p>
              ) : (
                <div className="space-y-1">
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                    📱 Escaneie para Acompanhar pelo Celular
                  </p>
                  <p className="text-[10px] text-slate-500">Você pode escanear para ver o status em tempo real enquanto espera!</p>
                </div>
              )}
            </div>

            {/* Comanda details */}
            <div className="p-4 bg-slate-800 rounded-2xl border border-slate-700/60 max-w-sm mx-auto">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-extrabold">Seu Número de Comanda</p>
              <p className="text-2xl font-black text-emerald-400 mt-1">#{createdComandaId}</p>
              <p className="text-[10px] text-slate-400 mt-1.5 font-bold uppercase">Forma de Pagamento: <span className="text-white">{selectedPaymentMethod === 'Pix' ? '⚡ Pix Online' : selectedPaymentMethod === 'Cartão' ? '💳 Cartão no Caixa' : '💵 Dinheiro no Caixa'}</span></p>
            </div>

            {/* INTEGRATED DEVELOPER SIMULATOR */}
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl max-w-md mx-auto space-y-2.5">
              <p className="text-[11px] font-bold text-emerald-300">⚙ Ambiente de Demonstração / Simulador de Fluxo</p>
              
              {selectedPaymentMethod === 'Pix' ? (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleSimulatePixApproval}
                    className="px-4 py-2 bg-lime-500 hover:bg-lime-600 text-slate-950 rounded-xl font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all uppercase tracking-wide"
                  >
                    <CheckCircle2 size={14} />
                    Simular Pagamento Pix (Aprovar)
                  </button>
                  {abacatePayUrl && (
                    <a
                      href={abacatePayUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-lime-400 hover:underline block font-semibold"
                    >
                      Abrir Tela de Pagamento do Abacate Pay 🔗
                    </a>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={handleSimulateCashierApproval}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all uppercase tracking-wide"
                  >
                    <CheckCircle2 size={14} />
                    Simular Confirmação de Recebimento no Caixa
                  </button>
                  
                  <div className="pt-2 border-t border-emerald-500/10">
                    <a
                      href={qrCodeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-650 text-white rounded-xl font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all uppercase tracking-wide w-full"
                    >
                      <Smartphone size={13} />
                      Abrir Rastreamento de Pedido no Celular 🔗
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* LIVE SYNC STATUS INDICATOR */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-center gap-2 text-xs">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></div>
              <span className="text-slate-300 font-medium">
                {currentKioskDraft?.status === 'PENDING_CONFIRMATION' ? (
                  selectedPaymentMethod === 'Pix' 
                    ? 'Aguardando pagamento Pix online...' 
                    : 'Aguardando recebimento e confirmação no caixa...'
                ) : (
                  `✓ Pedido Confirmado! Enviando comanda #${createdComandaId}...`
                )}
              </span>
            </div>

            {currentKioskDraft && currentKioskDraft.status !== 'PENDING_CONFIRMATION' && (
              <div className="absolute inset-0 bg-slate-900/95 rounded-[30px] flex flex-col items-center justify-center p-8 space-y-4 z-70 animate-scale">
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/35 flex items-center justify-center text-emerald-400 text-3xl font-bold animate-bounce">
                  ✓
                </div>
                <h3 className="text-2xl font-black text-white">Estupendo! Pedido Confirmado 🤝</h3>
                <p className="text-slate-400 text-xs max-w-sm font-medium">Seu pedido foi aceito pelo estabelecimento! O ticket de preparo foi enviado às impressoras de setor e sua comanda já está ativa.</p>
                
                <div className="p-4 bg-slate-800 rounded-2xl text-center border border-slate-705 w-full max-w-xs">
                  <span className="text-[10px] text-slate-400 block uppercase tracking-wide font-medium">Número Comanda para Retirada</span>
                  <span className="text-3xl font-black text-emerald-400 mt-1 block">#{createdComandaId}</span>
                </div>

                <div className="bg-white p-2.5 rounded-2xl shadow-md border-2 border-slate-700 mx-auto mt-2">
                  <img 
                    src={qrImageSrc} 
                    alt="QR Code de Rastreamento"
                    className="w-28 h-28"
                  />
                </div>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider -mt-1.5">Escaneie para acompanhar pelo celular</p>

                <div className="pt-2 flex flex-col sm:flex-row gap-3 w-full max-w-sm justify-center">
                  <a
                    href={`${window.location.origin}/kiosk?track=${createdComandaId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl font-bold text-xs uppercase tracking-wide inline-flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700"
                  >
                    <Smartphone size={14} />
                    Acompanhar no Celular
                  </a>
                  <button
                    type="button"
                    onClick={handleRestartKiosk}
                    className="px-5 py-2.5 bg-brand-primary hover:brightness-95 text-white font-bold rounded-xl text-xs uppercase tracking-wide"
                  >
                    Fazer Novo Pedido
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Note Observação Dialogue Modal */}
      {tempNoteProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-100 p-4">
          <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl border border-surface-variant/40 p-6 space-y-4">
            <h3 className="font-bold text-headline-small text-on-surface flex items-center gap-2">
              <span>✍ Adicionar Observações</span>
            </h3>
            <p className="text-xs text-on-surface-variant">Escreva observações especiais como "sem maionese", "fatiado", "bem passado", etc. para o item: <strong className="text-primary font-bold">{tempNoteProduct.name}</strong></p>
            <textarea
              rows={3}
              value={productNote}
              onChange={(e) => setProductNote(e.target.value)}
              placeholder="Ex: sem cebola e molho à parte"
              className="w-full px-3 py-2 border rounded-xl outline-none focus:ring-1 focus:ring-secondary/50 bg-surface-container text-on-surface text-sm border-outline-variant"
            />
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setTempNoteProduct(null)}
                className="px-4 py-2 rounded-lg font-bold text-xs text-on-surface-variant hover:bg-surface-variant"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleSaveNote}
                className="px-5 py-2.5 bg-brand-primary text-on-primary rounded-lg font-bold text-xs shadow-xs"
              >
                Salvar Nota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Display Alert Modal if open */}
      {alertState.isOpen && (
        <AlertModal
          isOpen={alertState.isOpen}
          title={alertState.title}
          message={alertState.message}
          onClose={() => setAlertState({ ...alertState, isOpen: false })}
        />
      )}

    </div>
  );
}
