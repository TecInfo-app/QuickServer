import { useState, useEffect, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Printer, Timer, PlusCircle, Search, X, Banknote, Check, Trash2 } from 'lucide-react';
import { 
  getStoredTables, 
  saveTables, 
  getStoredInventory, 
  saveInventory, 
  addTransaction, 
  getStoredUsers,
  Table, 
  OrderItem, 
  Product,
  getCurrentUser
} from '../utils/db';
import { getActiveCaixa } from '../utils/caixa';
import { getPrinterConfigs, sendToPrinter, printOrderTicket, getPrintServerUrl, getRestaurantName, getRestaurantDetails } from '../utils/printer';
import AlertModal from '../components/ui/AlertModal';

export default function TableDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [table, setTable] = useState<Table | null>(null);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [user, setUser] = useState<any>(null);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Dinheiro' | 'Cartão' | 'Pix'>('Dinheiro');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  const [cashReceived, setCashReceived] = useState<string>('');
  const [onCloseCallback, setOnCloseCallback] = useState<(() => void) | null>(null);

  // Estados para suportar multiplos pagamentos combinados na comanda
  const [partialPayments, setPartialPayments] = useState<{ method: 'Dinheiro' | 'Cartão' | 'Pix'; value: number }[]>([]);
  const [partialAmountInput, setPartialAmountInput] = useState<string>('');
  const [peopleCount, setPeopleCount] = useState<number>(1);

  const totalPartialSum = partialPayments.reduce((sum, p) => sum + p.value, 0);

  const openPaymentModal = () => {
    setPartialPayments([]);
    setPeopleCount(1);
    setPartialAmountInput(grandTotal.toFixed(2));
    setCashReceived('');
    setIsPaymentModalOpen(true);
  };

  // Modal alert states
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState('Aviso');
  const [alertMessage, setAlertMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  const triggerAlert = (message: string, title: string = 'Aviso') => {
    setAlertTitle(title);
    setAlertMessage(message);
    setConfirmAction(null);
    setOnCloseCallback(null);
    setIsAlertModalOpen(true);
  };

  const triggerAlertWithCallback = (message: string, title: string = 'Aviso', callback: () => void) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setConfirmAction(null);
    setOnCloseCallback(() => callback);
    setIsAlertModalOpen(true);
  };

  const triggerConfirm = (message: string, onConfirm: () => void, title: string = 'Confirmar Ação') => {
    setAlertTitle(title);
    setAlertMessage(message);
    setConfirmAction(() => onConfirm);
    setOnCloseCallback(null);
    setIsAlertModalOpen(true);
  };

  const tableNumber = id || '1';

  // State variables for adding items with Qty and Note
  const [selectedProductToAdd, setSelectedProductToAdd] = useState<Product | null>(null);
  const [itemAddQty, setItemAddQty] = useState(1);
  const [itemAddNote, setItemAddNote] = useState('');

  // Complements Selection State
  const [isComplementsOpen, setIsComplementsOpen] = useState(false);
  const [complementsTriggerProduct, setComplementsTriggerProduct] = useState<Product | null>(null);
  const [complementsOptionsList, setComplementsOptionsList] = useState<Product[]>([]);
  const [complementsQuantities, setComplementsQuantities] = useState<{ [id: number]: number }>({});
  const [complementsMinReq, setComplementsMinReq] = useState(0);
  const [complementsMaxAllowed, setComplementsMaxAllowed] = useState(5);

  // Cancel item states
  const [isSupervisorAuthOpen, setIsSupervisorAuthOpen] = useState(false);
  const [supervisorUser, setSupervisorUser] = useState('');
  const [supervisorPass, setSupervisorPass] = useState('');
  const [isCancelSelectorOpen, setIsCancelSelectorOpen] = useState(false);
  const [selectedCancelItemIndex, setSelectedCancelItemIndex] = useState<number>(-1);
  const [cancelQty, setCancelQty] = useState(1);
  const [cancelReason, setCancelReason] = useState('');

  // Discount states
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [tempDiscountType, setTempDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [tempDiscountValue, setTempDiscountValue] = useState<number>(0);

  // Auth callback flow state
  const [pendingAction, setPendingAction] = useState<'cancelItem' | 'toggleServiceTax' | 'applyDiscount' | 'removeDiscount' | null>(null);

  // Load table details and inventory catalog
  useEffect(() => {
    const loadTableData = () => {
      const tablesList = getStoredTables();
      let currentTable = tablesList.find(t => t.id === parseInt(tableNumber));
      
      // Auto-create active table if it doesn't exist
      if (!currentTable) {
        currentTable = {
          id: parseInt(tableNumber),
          status: 'ACTIVE',
          elapsed: '5 min',
          server: 'Operador Principal',
          items: []
        };
        const updated = [currentTable, ...tablesList];
        saveTables(updated);
      }
      
      setTable(currentTable);
      setInventory(getStoredInventory());
      setUser(getCurrentUser());
    };

    loadTableData();

    window.addEventListener('qsp_database_updated', loadTableData);
    return () => window.removeEventListener('qsp_database_updated', loadTableData);
  }, [tableNumber]);

  useEffect(() => {
    if (isPaymentModalOpen) {
      setCashReceived('');
    }
  }, [isPaymentModalOpen]);

  if (!table) {
    return <div className="p-8 text-center text-on-surface">Carregando detalhes da mesa...</div>;
  }

  const isComanda = table.id >= 1000;
  const hasNoServiceTax = table.noServiceTax !== undefined ? table.noServiceTax : isComanda;

  // Calculate receipt totals
  const subtotal = table.items.reduce((sum, item) => {
    const complementsTotal = item.complements?.reduce((cSum, c) => cSum + (c.price || 0), 0) || 0;
    return sum + ((item.price + complementsTotal) * item.qty);
  }, 0);
  const serviceTax = hasNoServiceTax ? 0 : (subtotal * 0.10);
  
  // Calculate discount
  let discountAmount = 0;
  if (table.discountType === 'percentage' && table.discountValue) {
    discountAmount = subtotal * (table.discountValue / 100);
  } else if (table.discountType === 'fixed' && table.discountValue) {
    discountAmount = table.discountValue;
  }
  discountAmount = Math.min(discountAmount, subtotal);
  const grandTotal = Math.max(0, subtotal + serviceTax - discountAmount);

  const handlePrint = () => {
    const padRight = (str: string, length: number) => {
      if (str.length > length) return str.slice(0, length);
      return str + ' '.repeat(length - str.length);
    };

    const padLeft = (str: string, length: number) => {
      if (str.length > length) return str.slice(0, length);
      return ' '.repeat(length - str.length) + str;
    };

    const formatPriceBR = (val: number) => {
      return val.toFixed(2).replace('.', ',');
    };

    const padDateTime = (date: Date) => {
      const p = (n: number) => n.toString().padStart(2, '0');
      return `${p(date.getDate())}/${p(date.getMonth() + 1)}/${date.getFullYear()} - ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
    };

    const now = new Date();
    let elapsedMinutes = 5;
    if (table?.elapsed) {
      const matchMin = table.elapsed.match(/(\d+)\s*min/);
      const matchHour = table.elapsed.match(/(\d+)\s*hora/);
      if (matchMin) elapsedMinutes = parseInt(matchMin[1]);
      if (matchHour) elapsedMinutes += parseInt(matchHour[1]) * 60;
    }
    const entradaDate = new Date(now.getTime() - elapsedMinutes * 60 * 1000);
    const hours = Math.floor(elapsedMinutes / 60);
    const minutes = elapsedMinutes % 60;
    const permanenciaStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;

    const seqNum = (Math.floor(Date.now() / 1000) % 100).toString().padStart(2, '0');
    
    // Look up Caixa Printer Config for Bobbin Choice
    const printerConfigs = getPrinterConfigs();
    const caixaPrinter = printerConfigs.find(p => p.sector.toLowerCase() === 'caixa');
    const is80 = !caixaPrinter || caixaPrinter.paperSize !== '58mm';
    const width = is80 ? 40 : 28;
    const divider = '-'.repeat(width);
    const eqDivider = '='.repeat(width);

    const restaurant = getRestaurantDetails();
    const pizzeriaName = restaurant.name;
    let headerLine = '';
    if (is80) {
      const seqStr = `Seq: ${seqNum}`;
      headerLine = pizzeriaName + ' '.repeat(Math.max(1, width - pizzeriaName.length - seqStr.length)) + seqStr;
    } else {
      headerLine = `${pizzeriaName}   Seq:${seqNum}`;
    }

    let receiptMessage = `${headerLine}\n`;
    if (restaurant.cnpj) receiptMessage += `CNPJ: ${restaurant.cnpj}\n`;
    if (restaurant.phone) receiptMessage += `TEL : ${restaurant.phone}\n`;
    if (restaurant.address) receiptMessage += `END : ${restaurant.address}\n`;
    if (restaurant.instagram) receiptMessage += `INS : ${restaurant.instagram}\n`;
    receiptMessage += `${eqDivider}\n`;
    const semValorFiscal = "SEM VALOR FISCAL";
    const centerSpaces = ' '.repeat(Math.max(0, Math.floor((width - semValorFiscal.length) / 2)));
    receiptMessage += `${centerSpaces}${semValorFiscal}\n`;
    receiptMessage += `${eqDivider}\n`;
    
    if (is80) {
      const formatDate80 = (date: Date) => {
        const p = (n: number) => n.toString().padStart(2, '0');
        return `${p(date.getDate())}/${p(date.getMonth() + 1)}/${date.getFullYear()} - ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
      };
      receiptMessage += `Entrada       : ${formatDate80(entradaDate)}\n`;
      receiptMessage += `Saida         : ${formatDate80(now)}\n`;
      receiptMessage += `Permanencia   : ${permanenciaStr}\n`;
      receiptMessage += `Func.Abr.     : ${(user?.name || table?.server || '172').toUpperCase().slice(0, 8)}\n`;
    } else {
      const formatDate58 = (date: Date) => {
        const p = (n: number) => n.toString().padStart(2, '0');
        return `${p(date.getDate())}/${p(date.getMonth() + 1)}/${date.getFullYear()}-${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
      };
      receiptMessage += `Entrada: ${formatDate58(entradaDate)}\n`;
      receiptMessage += `Saida  : ${formatDate58(now)}\n`;
      receiptMessage += `Permanencia: ${permanenciaStr}\n`;
      receiptMessage += `Func.Abr.: ${(user?.name || table?.server || '12').toUpperCase().slice(0, 8)}\n`;
    }
    receiptMessage += `${divider}\n`;
    
    // Mesa line with large font tag
    if (is80) {
      receiptMessage += `[GRANDE]     -> MESA : ${tableNumber}\n`;
    } else {
      receiptMessage += `[GRANDE]    MESA: ${tableNumber}\n`;
    }
    receiptMessage += `${divider}\n`;

    // Item Headers & Line Printing Loop
    if (is80) {
      receiptMessage += `ITEM DE CONSUMO    QTD    V.UNI    TOTAL\n`;
      receiptMessage += `${divider}\n`;
    } else {
      receiptMessage += `ITEM       QT  V.UNI  TOTAL\n`;
      receiptMessage += `${divider}\n`;
    }
    
    if (!table || table.items.length === 0) {
      receiptMessage += `NENHUM CONSUMO NO MOMENTO.\n\n`;
    } else {
      table.items.forEach((item) => {
        const complementsCost = item.complements?.reduce((sum, c) => sum + (c.price || 0), 0) || 0;
        const totalUnit = item.price + complementsCost;
        const itemSubtotal = totalUnit * item.qty;

        if (is80) {
          // 80mm logic: abbreviated name to 19 chars, perfectly aligned with total length of 40
          const shortenedName = item.name.length > 19 ? item.name.slice(0, 19).trim() : item.name;
          const namePart = shortenedName.padEnd(19);
          const qtyStr = item.qty.toString().padStart(3);
          const unitStr = formatPriceBR(totalUnit).padStart(9);
          const totalStr = formatPriceBR(itemSubtotal).padStart(9);
          receiptMessage += `${namePart} ${qtyStr} ${unitStr} ${totalStr}\n`;
        } else {
          // 58mm logic: abbreviated name to 10 chars, perfectly aligned with total length of 27 to prevent wrapping
          const shortenedName = item.name.length > 10 ? item.name.slice(0, 10).trim() : item.name;
          const namePart = shortenedName.padEnd(10);
          const qtyStr = item.qty.toString().padStart(2);
          const unitStr = formatPriceBR(totalUnit).padStart(6);
          const totalStr = formatPriceBR(itemSubtotal).padStart(6);
          receiptMessage += `${namePart} ${qtyStr} ${unitStr} ${totalStr}\n`;
        }
      });
    }
    
    if (is80) {
      receiptMessage += `${divider}\n`;
    } else {
      receiptMessage += `${divider}\n`;
    }

    receiptMessage += `SUB-TOTAL: ${formatPriceBR(subtotal)}\n`;
    receiptMessage += `GORJETA SUGERIDA: ${formatPriceBR(serviceTax)}\n`;
    if (discountAmount > 0) {
      receiptMessage += `DESCONTO: -${formatPriceBR(discountAmount)}\n`;
    }
    receiptMessage += `\n`;
    
    if (is80) {
      receiptMessage += `[GRANDE]  A PAGAR  :  ${formatPriceBR(grandTotal)}\n`;
    } else {
      receiptMessage += `[GRANDE]A PAGAR : ${formatPriceBR(grandTotal)}\n`;
    }
    
    if (peopleCount > 1) {
      const devStr = `DIVISAO POR ${peopleCount}:`;
      const devVal = `${formatPriceBR(grandTotal / peopleCount)} POR PESSOA`;
      const remaining = width - devVal.length;
      const formattedDev = remaining <= devStr.length ? `${devStr} ${devVal}` : devStr.padEnd(remaining) + devVal;
      receiptMessage += `${formattedDev}\n`;
    }
    receiptMessage += `${divider}\n`;
    
    // Pessoa and Media stats line
    if (is80) {
      const pStr80 = `PESSOA(S)  : ${peopleCount}`;
      const mStr80 = `MEDIA    : ${formatPriceBR(grandTotal / peopleCount)}`;
      const spaces80 = ' '.repeat(Math.max(1, width - pStr80.length - mStr80.length));
      receiptMessage += `${pStr80}${spaces80}${mStr80}\n`;
    } else {
      const pStr58 = `PESSOA(S): ${peopleCount}`;
      const mStr58 = `MEDIA: ${formatPriceBR(grandTotal / peopleCount)}`;
      const spaces58 = ' '.repeat(Math.max(1, width - pStr58.length - mStr58.length));
      receiptMessage += `${pStr58}${spaces58}${mStr58}\n`;
    }
    receiptMessage += `${divider}\n`;

    // Quantidade and Itens stats line
    const totalQty = table ? table.items.reduce((sum, item) => sum + item.qty, 0) : 0;
    if (is80) {
      const qStr80 = `QUANTIDADE: ${totalQty}`;
      const iStr80 = `ITENS: ${table?.items?.length || 0}`;
      const spaces2_80 = ' '.repeat(Math.max(1, width - qStr80.length - iStr80.length));
      receiptMessage += `${qStr80}${spaces2_80}${iStr80}\n`;
    } else {
      const qStr58 = `QUANTIDADE: ${totalQty}`;
      const iStr58 = `ITENS: ${table?.items?.length || 0}`;
      const spaces2_58 = ' '.repeat(Math.max(1, width - qStr58.length - iStr58.length));
      receiptMessage += `${qStr58}${spaces2_58}${iStr58}\n`;
    }
    
    if (is80) {
      receiptMessage += `${divider}\n`;
      const opStr = `--- OPERADOR: ${(user?.name || table?.server || '129').toUpperCase().substring(0, 6)}     TERM:APOIO004 ---`;
      const opCenter = opStr.padStart(Math.max(opStr.length, Math.floor((width + opStr.length) / 2))).padEnd(width);
      receiptMessage += `${opCenter}\n`;
      receiptMessage += `5-PRG\n`;
      if (restaurant.footerMessage) {
        receiptMessage += `${divider}\n`;
        receiptMessage += `${restaurant.footerMessage.toUpperCase()}\n`;
      }
      receiptMessage += `${eqDivider}\n`;
    } else {
      if (restaurant.footerMessage) {
        receiptMessage += `${divider}\n`;
        receiptMessage += `${restaurant.footerMessage.toUpperCase()}\n`;
        receiptMessage += `${eqDivider}\n`;
      }
    }
    
    // Always convert to uppercase and ensure exactly 5 training newlines (leaving other tags untouched)
    let finalReceipt = receiptMessage.toUpperCase();
    if (!finalReceipt.endsWith('\n\n\n\n\n')) {
      finalReceipt = finalReceipt.trimEnd() + '\n\n\n\n\n';
    }
    
    // Always call sendToPrinter to generate the .txt file download
    sendToPrinter('Caixa', finalReceipt);
  };

  // Add product item to table from search menu
  const handleAddItemClick = (product: Product) => {
    setSelectedProductToAdd(product);
    setItemAddQty(1);
    setItemAddNote('');
  };

  const handleConfirmAddItem = () => {
    if (!selectedProductToAdd) return;

    if (itemAddQty <= 0) {
      triggerAlert('A quantidade deve ser maior do que zero.', 'Erro');
      return;
    }

    // Check if item triggers complements (only if explicitly marked as a combined item)
    if (selectedProductToAdd.isCombo) {
      const targetGroup = selectedProductToAdd.comboGroupCode;
      const associatedComplements = targetGroup 
        ? inventory.filter(p => p.parentGroupCode === targetGroup && p.id !== selectedProductToAdd.id)
        : [];

      if (associatedComplements.length > 0) {
        // Open complements selection flow
        setComplementsTriggerProduct(selectedProductToAdd);
        setComplementsOptionsList(associatedComplements);
        
        setComplementsMinReq(selectedProductToAdd.minComplements ?? 0);
        setComplementsMaxAllowed(selectedProductToAdd.maxComplements ?? 5);
        
        // Initialize quantities to 0
        const initialQtys: { [id: number]: number } = {};
        associatedComplements.forEach(comp => {
          initialQtys[comp.id] = 0;
        });
        setComplementsQuantities(initialQtys);
        
        setIsComplementsOpen(true);
        setSelectedProductToAdd(null);
        return;
      }
    }

    const note = itemAddNote.trim();
    const updatedItems = [...table.items];
    const existingIndex = updatedItems.findIndex(i => i.name === selectedProductToAdd.name && i.note === note && (!i.complements || i.complements.length === 0));

    if (existingIndex >= 0) {
      updatedItems[existingIndex].qty += itemAddQty;
    } else {
      updatedItems.push({
        name: selectedProductToAdd.name,
        price: selectedProductToAdd.price,
        qty: itemAddQty,
        note: note,
        complements: []
      });
    }

    const updatedTable: Table = {
      ...table,
      status: 'ACTIVE',
      items: updatedItems
    };

    const prodName = selectedProductToAdd.name;
    const prodCategory = selectedProductToAdd.category;

    // Save back to db
    const tablesList = getStoredTables();
    const updatedList = tablesList.map(t => t.id === table.id ? updatedTable : t);
    saveTables(updatedList);
    setTable(updatedTable);

    // Call printing helper
    printOrderTicket(tableNumber, prodName, itemAddQty, note, prodCategory);

    setSelectedProductToAdd(null);
    triggerAlert(`Adicionado: ${itemAddQty}x ${prodName} com sucesso!`, 'Sucesso');
  };

  const handleConfirmComplements = () => {
    if (!complementsTriggerProduct) return;

    const selectedTotal = Object.values(complementsQuantities).reduce((s: number, q: number) => s + q, 0);

    if (selectedTotal < complementsMinReq) {
      triggerAlert(`Selecione no mínimo ${complementsMinReq} complementos. (Selecionado atualmente: ${selectedTotal})`, 'Validação');
      return;
    }
    if (selectedTotal > complementsMaxAllowed) {
      triggerAlert(`Selecione no máximo ${complementsMaxAllowed} complementos. (Selecionado atualmente: ${selectedTotal})`, 'Validação');
      return;
    }

    const complementsToStore: { name: string; price: number }[] = [];
    Object.entries(complementsQuantities).forEach(([prodIdStr, qty]) => {
      const qtyNum = Number(qty);
      if (qtyNum > 0) {
        const prod = inventory.find(p => p.id === Number(prodIdStr));
        if (prod) {
          complementsToStore.push({
            name: `${prod.name} (${qtyNum}x)`,
            price: prod.price * qtyNum
          });
        }
      }
    });

    const note = itemAddNote.trim();
    const updatedItems = [...table.items];

    updatedItems.push({
      name: complementsTriggerProduct.name,
      price: complementsTriggerProduct.price,
      qty: itemAddQty,
      note: note,
      complements: complementsToStore
    });

    const updatedTable: Table = {
      ...table,
      status: 'ACTIVE',
      items: updatedItems
    };

    const prodName = complementsTriggerProduct.name;
    const prodCategory = complementsTriggerProduct.category;

    // Save back to db
    const tablesList = getStoredTables();
    const updatedList = tablesList.map(t => t.id === table.id ? updatedTable : t);
    saveTables(updatedList);
    setTable(updatedTable);

    // Call printing helper listing complements
    let customNote = note;
    if (complementsToStore.length > 0) {
      const complementsStr = complementsToStore.map(c => {
        const lastParenOpen = c.name.lastIndexOf('(');
        const lastParenClose = c.name.lastIndexOf(')');
        if (lastParenOpen !== -1 && lastParenClose !== -1 && lastParenOpen < lastParenClose) {
          const namePart = c.name.substring(0, lastParenOpen).trim();
          const qtyPart = c.name.substring(lastParenOpen + 1, lastParenClose);
          return `(${qtyPart}) ${namePart}`;
        }
        return `• ${c.name}`;
      }).join('\n');
      customNote = customNote ? `${customNote}\nAcomp:\n${complementsStr}` : `Acomp:\n${complementsStr}`;
    }
    printOrderTicket(tableNumber, prodName, itemAddQty, customNote, prodCategory);

    // Reset complements state
    setIsComplementsOpen(false);
    setComplementsTriggerProduct(null);
    setComplementsOptionsList([]);
    setComplementsQuantities({});
    triggerAlert(`Adicionado: ${itemAddQty}x ${prodName} com seus acompanhamentos com sucesso!`, 'Sucesso');
  };

  // Cancel Table Item Flow
  const handleStartCancelItem = () => {
    if (table.items.length === 0) {
      triggerAlert('Não há itens na mesa para cancelar.', 'Aviso');
      return;
    }

    setCancelReason('');
    if (user && (user.name === 'master' || user.role === 'Gerente')) {
      setIsCancelSelectorOpen(true);
      setSelectedCancelItemIndex(0);
      setCancelQty(1);
    } else {
      setPendingAction('cancelItem');
      setSupervisorUser('');
      setSupervisorPass('');
      setIsSupervisorAuthOpen(true);
    }
  };

  const handleConfirmCancelItem = () => {
    if (selectedCancelItemIndex === -1 || !table.items[selectedCancelItemIndex]) {
      triggerAlert('Por favor, selecione um item válido.', 'Erro');
      return;
    }

    if (!cancelReason.trim()) {
      triggerAlert('Por favor, digite o motivo do cancelamento / estorno.', 'Aviso');
      return;
    }

    const targetItem = table.items[selectedCancelItemIndex];
    if (cancelQty <= 0 || cancelQty > targetItem.qty) {
      triggerAlert(`Quantidade inválida! Máximo de ${targetItem.qty} unidades.`, 'Erro');
      return;
    }

    // Deduct quantity or remove
    const updatedItems = [...table.items];
    if (cancelQty === targetItem.qty) {
      updatedItems.splice(selectedCancelItemIndex, 1);
    } else {
      updatedItems[selectedCancelItemIndex] = {
        ...targetItem,
        qty: targetItem.qty - cancelQty
      };
    }

    const updatedTable: Table = {
      ...table,
      items: updatedItems
    };

    const tablesList = getStoredTables();
    const updatedList = tablesList.map(t => t.id === table.id ? updatedTable : t);
    saveTables(updatedList);
    setTable(updatedTable);

    setIsCancelSelectorOpen(false);

    // Build cancel voucher adjusted to 32 columns with 5 trail lines
    let cancelReceipt = `================================\n`;
    cancelReceipt += `COMPROVANTE DE CANCELAMENTO/ESTO\n`;
    cancelReceipt += `================================\n\n`;
    cancelReceipt += `Mesa: ${tableNumber}\n`;
    cancelReceipt += `Produto: ${targetItem.name.slice(0,19).trim()}\n`;
    cancelReceipt += `Qtd Estornada: ${cancelQty} un\n`;
    cancelReceipt += `V.Unitario: R$ ${targetItem.price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
    cancelReceipt += `Total Estornado: R$ ${(targetItem.price * cancelQty).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n`;
    cancelReceipt += `Motivo: ${cancelReason.trim()}\n\n`;
    cancelReceipt += `Autoriz: ${user?.name?.slice(0,10) || supervisorUser?.slice(0,10) || 'Gerente'}\n`;
    cancelReceipt += `Data: ${new Date().toLocaleString('pt-BR')}\n`;
    cancelReceipt += `================================\n`;
    cancelReceipt += `\n\n\n\n\n`; // Adiciona 5 linhas em branco para possibilitar o corte manual sem cortar o texto

    // Clear cancelReason
    setCancelReason('');

    sendToPrinter('Caixa', cancelReceipt);
  };

  // Toggle 10% service tax
  const handleToggleServiceTax = () => {
    if (user && (user.name === 'master' || user.role === 'Gerente')) {
      executeToggleServiceTax();
    } else {
      setPendingAction('toggleServiceTax');
      setSupervisorUser('');
      setSupervisorPass('');
      setIsSupervisorAuthOpen(true);
    }
  };

  const executeToggleServiceTax = () => {
    const updatedTable: Table = {
      ...table,
      noServiceTax: !hasNoServiceTax
    };

    const tablesList = getStoredTables();
    const updatedList = tablesList.map(t => t.id === table.id ? updatedTable : t);
    saveTables(updatedList);
    setTable(updatedTable);

    triggerAlert(
      updatedTable.noServiceTax 
        ? 'Taxa de serviço de 10% removida com sucesso para esta conta.' 
        : 'Taxa de serviço de 10% adicionada à conta.', 
      'Sucesso'
    );
  };

  // Discount Handlers
  const handleApplyDiscount = () => {
    if (user && (user.name === 'master' || user.role === 'Gerente')) {
      executeOpenDiscountModal();
    } else {
      setPendingAction('applyDiscount');
      setSupervisorUser('');
      setSupervisorPass('');
      setIsSupervisorAuthOpen(true);
    }
  };

  const executeOpenDiscountModal = () => {
    setTempDiscountType(table.discountType || 'percentage');
    setTempDiscountValue(table.discountValue || 0);
    setIsDiscountModalOpen(true);
  };

  const confirmApplyDiscount = () => {
    if (tempDiscountValue < 0) {
      triggerAlert('O desconto não pode ser um valor negativo.', 'Erro');
      return;
    }

    if (tempDiscountType === 'percentage' && tempDiscountValue > 100) {
      triggerAlert('O desconto em porcentagem não pode ser maior do que 100%.', 'Erro');
      return;
    }

    if (tempDiscountType === 'fixed' && tempDiscountValue > subtotal) {
      triggerAlert(`O desconto não pode ser maior do que o subtotal de R$ ${subtotal.toFixed(2)}.`, 'Erro');
      return;
    }

    const updatedTable: Table = {
      ...table,
      discountType: tempDiscountType,
      discountValue: tempDiscountValue
    };

    const tablesList = getStoredTables();
    const updatedList = tablesList.map(t => t.id === table.id ? updatedTable : t);
    saveTables(updatedList);
    setTable(updatedTable);

    setIsDiscountModalOpen(false);
    triggerAlert('Desconto aplicado com sucesso!', 'Sucesso');
  };

  const handleRemoveDiscount = () => {
    if (user && (user.name === 'master' || user.role === 'Gerente')) {
      executeRemoveDiscount();
    } else {
      setPendingAction('removeDiscount');
      setSupervisorUser('');
      setSupervisorPass('');
      setIsSupervisorAuthOpen(true);
    }
  };

  const executeRemoveDiscount = () => {
    const updatedTable: Table = {
      ...table,
      discountType: undefined,
      discountValue: undefined
    };

    const tablesList = getStoredTables();
    const updatedList = tablesList.map(t => t.id === table.id ? updatedTable : t);
    saveTables(updatedList);
    setTable(updatedTable);

    triggerAlert('Desconto removido com sucesso.', 'Sucesso');
  };

  // Supervisor Authentication verify
  const handleSupervisorAuthSubmit = (e: FormEvent) => {
    e.preventDefault();
    const users = getStoredUsers();
    const match = users.find(u => 
      u.name.toLowerCase() === supervisorUser.trim().toLowerCase() && 
      u.password === supervisorPass && 
      (u.role === 'Gerente' || u.name === 'master')
    );

    if (!match) {
      triggerAlert('Credenciais inválidas ou usuário sem permissão de Gerência.', 'Acesso Negado');
      return;
    }

    setIsSupervisorAuthOpen(false);

    if (pendingAction === 'cancelItem') {
      setIsCancelSelectorOpen(true);
      setSelectedCancelItemIndex(0);
      setCancelQty(1);
      setCancelReason('');
    } else if (pendingAction === 'toggleServiceTax') {
      executeToggleServiceTax();
    } else if (pendingAction === 'applyDiscount') {
      executeOpenDiscountModal();
    } else if (pendingAction === 'removeDiscount') {
      executeRemoveDiscount();
    }

    setPendingAction(null);
  };

  // Process checkout payment
  const handleCheckoutPayment = () => {
    if (table.items.length === 0) {
      triggerAlert('Não é possível fechar a conta de uma mesa sem itens consumidos.');
      return;
    }

    let finalPaymentsToRegister: { method: 'Dinheiro' | 'Cartão' | 'Pix'; value: number }[] = [];
    const totalPartialSum = partialPayments.reduce((sum, p) => sum + p.value, 0);

    if (table.paidOnline) {
      finalPaymentsToRegister = [{ method: 'Pix', value: grandTotal }];
    } else if (partialPayments.length > 0) {
      if (totalPartialSum < grandTotal - 0.01) {
        triggerAlert(`O valor total informado (R$ ${totalPartialSum.toFixed(2)}) é menor que o valor a pagar (R$ ${grandTotal.toFixed(2)}).`, 'Aviso');
        return;
      }
      
      const change = Math.max(0, totalPartialSum - grandTotal);
      
      if (change > 0) {
        let changeRemaining = change;
        finalPaymentsToRegister = partialPayments.map(p => {
          if (p.method === 'Dinheiro' && changeRemaining > 0) {
            const deduct = Math.min(p.value, changeRemaining);
            changeRemaining -= deduct;
            return { ...p, value: p.value - deduct };
          }
          return p;
        }).filter(p => p.value > 0);
      } else {
        finalPaymentsToRegister = partialPayments;
      }
    } else {
      let parsedCashReceived = grandTotal;
      if (paymentMethod === 'Dinheiro') {
        const pReceived = parseFloat(cashReceived);
        if (!cashReceived.trim() || isNaN(pReceived)) {
          triggerAlert('Por favor, informe o valor recebido.', 'Aviso');
          return;
        }
        if (pReceived < grandTotal) {
          triggerAlert(`O valor recebido de R$ ${pReceived.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} é menor que o valor a pagar de R$ ${grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`, 'Aviso');
          return;
        }
        parsedCashReceived = pReceived;
      }
      finalPaymentsToRegister = [{ method: paymentMethod, value: grandTotal }];
    }

    // Capture payment
    const now = new Date();
    const formattedTime = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const elapsedText = `Paga às ${formattedTime}`;

    // Update table in db (Clear items and mark as CLOSED, so it is fully paid and cleared)
    const updatedTable: Table = {
      id: table.id,
      status: 'CLOSED',
      elapsed: '0 min',
      server: 'Operador',
      items: []
    };

    const tablesList = getStoredTables();
    const updatedList = tablesList.map(t => t.id === table.id ? updatedTable : t);
    saveTables(updatedList);

    // Reduce stocks in inventory based on items ordered & selected complements
    const currentInventory = getStoredInventory();
    const updatedInventory = currentInventory.map(product => {
      let consumedQty = 0;
      table.items.forEach(item => {
        if (item.name === product.name) {
          consumedQty += item.qty;
        }
        if (item.complements && item.complements.length > 0) {
          item.complements.forEach(comp => {
            if (comp.name.startsWith(product.name)) {
              const rMatch = comp.name.match(/\((\d+)x\)/);
              const multiplier = rMatch ? parseInt(rMatch[1]) : 1;
              consumedQty += multiplier * item.qty;
            }
          });
        }
      });

      if (consumedQty > 0) {
        const nextStock = Math.max(0, product.stock - consumedQty);
        return {
          ...product,
          stock: nextStock,
          isLow: nextStock <= 10
        };
      }
      return product;
    });
    saveInventory(updatedInventory);

    // Estimate cost of sold items (approx 40% of standard price for reporting metrics)
    const transactionCost = table.items.reduce((sum, item) => {
      const complementsCost = item.complements?.reduce((cSum, comp) => cSum + (comp.price || 0), 0) || 0;
      return sum + ((item.price + complementsCost) * 0.4 * item.qty);
    }, 0);

    const activeCaixa = getActiveCaixa();
    const caixaId = activeCaixa ? activeCaixa.id : undefined;

    // Register Transactions (one per payment slice for clean reporting breakdown)
    finalPaymentsToRegister.forEach((p, idx) => {
      const peso = grandTotal > 0 ? (p.value / grandTotal) : 1;
      const proportionalCost = parseFloat((transactionCost * peso).toFixed(2));

      addTransaction({
        orderId: `#M${table.id}${Math.floor(Math.random() * 900 + 100)}${finalPaymentsToRegister.length > 1 ? `-${idx + 1}` : ''}`,
        caixaId,
        elapsed: formattedTime,
        itemsCount: Math.ceil(table.items.reduce((sum, i) => sum + i.qty, 0) * peso),
        total: p.value,
        method: p.method,
        cost: proportionalCost,
        time: now.toISOString()
      });
    });

    // Build receipt layout helpers
    const padRight = (str: string, length: number) => {
      if (str.length > length) return str.slice(0, length);
      return str + ' '.repeat(length - str.length);
    };
    const padLeft = (str: string, length: number) => {
      if (str.length > length) return str.slice(0, length);
      return ' '.repeat(length - str.length) + str;
    };

    const formatLine = (col1: string, col2: string, col3: string, col4: string) => {
      const c1 = padRight(col1, 15);
      const c2 = padLeft(col2, 3);
      const c3 = padLeft(col3, 9);
      const c4 = padLeft(col4, 10);
      return `${c1} ${c2} ${c3} ${c4}`;
    };

    const formatTotalLine = (label: string, value: string) => {
      const neededSpaces = 40 - label.length - value.length;
      if (neededSpaces > 0) {
        return `${label}${' '.repeat(neededSpaces)}${value}`;
      }
      return `${label} ${value}`;
    };

    // Build the checkout receipt text block with image style
    const formatPriceBR = (val: number) => {
      return val.toFixed(2).replace('.', ',');
    };

    const padDateTime = (date: Date) => {
      const p = (n: number) => n.toString().padStart(2, '0');
      return `${p(date.getDate())}/${p(date.getMonth() + 1)}/${date.getFullYear()} - ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
    };

    let elapsedMinutes = 5;
    if (table?.elapsed) {
      const matchMin = table.elapsed.match(/(\d+)\s*min/);
      const matchHour = table.elapsed.match(/(\d+)\s*hora/);
      if (matchMin) elapsedMinutes = parseInt(matchMin[1]);
      if (matchHour) elapsedMinutes += parseInt(matchHour[1]) * 60;
    }
    const entradaDate = new Date(now.getTime() - elapsedMinutes * 60 * 1000);
    const hours = Math.floor(elapsedMinutes / 60);
    const minutes = elapsedMinutes % 60;
    const permanenciaStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`;

    const seqNum = (Math.floor(Date.now() / 1000) % 1000).toString().padStart(3, '0');
    const restaurant = getRestaurantDetails();
    const pizzeriaName = restaurant.name;
    const seqStr = `Seq: ${seqNum}`;
    const headerLine = pizzeriaName + ' '.repeat(Math.max(1, 32 - pizzeriaName.length - seqStr.length)) + seqStr;

    let paymentReceipt = `${headerLine}\n`;
    if (restaurant.cnpj) paymentReceipt += `CNPJ: ${restaurant.cnpj}\n`;
    if (restaurant.phone) paymentReceipt += `TEL : ${restaurant.phone}\n`;
    if (restaurant.address) paymentReceipt += `END : ${restaurant.address}\n`;
    if (restaurant.instagram) paymentReceipt += `INS : ${restaurant.instagram}\n`;
    paymentReceipt += `================================\n`;
    paymentReceipt += `    COMPROVANTE DE PAGAMENTO    \n`;
    paymentReceipt += `        SEM VALOR FISCAL        \n`;
    paymentReceipt += `================================\n`;
    paymentReceipt += `Entrada    : ${padDateTime(entradaDate)}\n`;
    paymentReceipt += `Saida      : ${padDateTime(now)}\n`;
    paymentReceipt += `Permanencia: ${permanenciaStr}\n`;
    paymentReceipt += `Func.Abr.  : ${(user?.name || table?.server || '3').toUpperCase().slice(0, 8)}\n`;
    paymentReceipt += `--------------------------------\n`;
    
    const mesaStr = `--> MESA : ${tableNumber}`;
    const mesaPadded = ' '.repeat(Math.max(0, Math.floor((32 - mesaStr.length) / 2))) + mesaStr;
    paymentReceipt += `${mesaPadded}\n`;
    paymentReceipt += `--------------------------------\n`;
    paymentReceipt += `${padRight('Produto', 13)} ${padLeft('Qtd', 3)} ${padLeft('Unit', 6)} ${padLeft('Total', 6)}\n`;
    paymentReceipt += `--------------------------------\n`;

    table.items.forEach((item) => {
      const complementsCost = item.complements?.reduce((sum, c) => sum + (c.price || 0), 0) || 0;
      const totalUnit = item.price + complementsCost;
      const itemSubtotal = totalUnit * item.qty;

      // Limit the item name length inside the 13-character description field
      const namePart = item.name.length > 13 ? item.name.slice(0, 12) + '…' : item.name;
      
      const itemLine = `${padRight(namePart, 13)} ${padLeft(item.qty.toString(), 3)} ${padLeft(formatPriceBR(totalUnit), 6)} ${padLeft(formatPriceBR(itemSubtotal), 6)}`;
      paymentReceipt += itemLine + '\n';

      if (item.complements && item.complements.length > 0) {
        item.complements.forEach(comp => {
          const compName = `+${comp.name}`;
          const compNamePart = compName.length > 13 ? compName.slice(0, 12) + '…' : compName;
          const compLine = `${padRight(compNamePart, 13)} ${padLeft('', 3)} ${padLeft(formatPriceBR(comp.price || 0), 6)} ${padLeft('', 6)}`;
          paymentReceipt += compLine + '\n';
        });
      }
    });

    paymentReceipt += `--------------------------------\n`;
    paymentReceipt += `Sub-Total: ${formatPriceBR(subtotal)}\n`;
    paymentReceipt += `GORJETA: ${formatPriceBR(serviceTax)}\n`;
    if (discountAmount > 0) {
      paymentReceipt += `DESCONTO: -${formatPriceBR(discountAmount)}\n`;
    }
    paymentReceipt += `\n`;
    paymentReceipt += `A PAGAR: ${formatPriceBR(grandTotal)}\n`;
    if (peopleCount > 1) {
      paymentReceipt += `--------------------------------\n`;
      paymentReceipt += `CONTA DIVIDIDA POR: ${peopleCount} PESSOAS\n`;
      paymentReceipt += `VALOR POR PESSOA  : R$ ${formatPriceBR(grandTotal / peopleCount)}\n`;
    }
    
    // Formas de pagamento detalhadas ou mista
    if (partialPayments.length > 0) {
      paymentReceipt += `--------------------------------\n`;
      paymentReceipt += `FORMAS DIGITADAS:\n`;
      partialPayments.forEach(p => {
        paymentReceipt += `${p.method.padEnd(10)}: R$ ${formatPriceBR(p.value)}\n`;
      });
      if (totalPartialSum > grandTotal) {
        paymentReceipt += `RECEBIDO  : R$ ${formatPriceBR(totalPartialSum)}\n`;
        paymentReceipt += `TROCO     : R$ ${formatPriceBR(totalPartialSum - grandTotal)}\n`;
      }
    } else {
      paymentReceipt += `PAGTO: ${paymentMethod.substring(0, 12).toUpperCase()}\n`;
      if (paymentMethod === 'Dinheiro') {
        const pReceived = parseFloat(cashReceived) || grandTotal;
        paymentReceipt += `RECEBIDO: ${formatPriceBR(pReceived)}\n`;
        const trocoVal = Math.max(0, pReceived - grandTotal);
        paymentReceipt += `TROCO   : ${formatPriceBR(trocoVal)}\n`;
      }
    }

    paymentReceipt += `--------------------------------\n`;

    const totalQty = table.items.reduce((sum, item) => sum + item.qty, 0);
    paymentReceipt += `Qtd Itens: ${totalQty} | Média: ${formatPriceBR(grandTotal)}\n`;
    paymentReceipt += `--------------------------------\n`;
    paymentReceipt += `Op: ${(user?.name || table?.server || '130').toUpperCase().substring(0, 6)} | Term:SRV\n`;
    paymentReceipt += `5-prg\n`;
    if (restaurant.footerMessage) {
      paymentReceipt += `--------------------------------\n`;
      paymentReceipt += `${restaurant.footerMessage.toUpperCase()}\n`;
    }
    paymentReceipt += `================================\n`;
    paymentReceipt += `\n\n\n\n\n`; // Adiciona 5 linhas em branco para possibilitar o corte manual sem cortar o texto

    setIsPaymentModalOpen(false);

    // Call sendToPrinter which now downloads the standard .txt file automatically
    sendToPrinter('Caixa', paymentReceipt);

    // Redireciona imediatamente para o salão / mesas sem popups de pré-visualização!
    navigate('/tables');
  };

  // Clear or reset all items in the table
  const handleClearTable = () => {
    if (user.role === 'Vendedor') {
      triggerAlert('Acesso negado: Apenas Gerente ou Caixa podem limpar mesas.');
      return;
    }
    triggerConfirm(
      'Deseja realmente limpar todos os itens da comanda desta mesa?',
      () => {
        const updatedTable: Table = {
          ...table,
          status: 'CLOSED', // Change status to CLOSED to "close" the table
          items: []
        };
        
        const tablesList = getStoredTables();
        const updatedList = tablesList.map(t => t.id === table.id ? updatedTable : t);
        saveTables(updatedList);
        setTable(updatedTable);
        navigate('/tables');
      },
      'Confirmar Limpeza'
    );
  };

  // Filter products in catalog
  const categories: string[] = ['Todos', ...Array.from<string>(new Set(inventory.map(p => p.category)))];
  const filteredProducts = inventory.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          product.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (product.pdvCode && product.pdvCode.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'Todos' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="max-w-container-max mx-auto space-y-6 md:pb-24 pb-44">
      {/* Top Header Overrides specifically for this view */}
      <header className="fixed top-0 left-0 w-full z-50 bg-surface dark:bg-surface-dim shadow-sm flex items-center justify-between px-margin-mobile md:px-margin-page h-16">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/tables')}
            aria-label="Voltar para Mesas" 
            className="active:scale-95 transition-transform text-primary p-2 hover:bg-surface-variant rounded-full"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-headline-lg-mobile md:text-headline-lg font-bold text-primary">
            {parseInt(tableNumber || '') >= 1000 ? `Comanda #${tableNumber}` : `Mesa ${tableNumber}`}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {table.items.length > 0 && (
            <button 
              onClick={handleClearTable} 
              className="text-error font-semibold text-xs border border-error/30 hover:bg-error/10 px-3 py-1.5 rounded-lg transition-all"
            >
              Limpar Pedidos
            </button>
          )}
          <button 
            onClick={() => setIsClosingModalOpen(true)}
            title="Imprimir Cupom"
            className="active:scale-95 transition-transform text-primary p-2 hover:bg-surface-variant transition-colors duration-200 rounded-full"
          >
            <Printer size={24} />
          </button>
        </div>
      </header>

      {/* Table Status Card */}
      <section className="bg-surface-container-lowest rounded-xl p-6 flex justify-between items-center card-shadow mt-4 border border-surface-variant/20 shadow-sm">
        <div>
          <p className="text-caption text-on-surface-variant mb-1">
            Status: <span className={table.status === 'ACTIVE' ? "text-success font-bold" : "text-on-surface-variant font-bold"}>
              {table.status === 'ACTIVE' ? 'EM ATENDIMENTO' : 'FECHADA'}
            </span>
          </p>
          <div className="flex items-center gap-2">
            <Timer className="text-secondary" size={20} />
            <span className="text-body-lg font-semibold">{parseInt(tableNumber || '') >= 1000 ? 'Comanda aberta' : 'Mesa aberta'} ({table.elapsed})</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-caption text-on-surface-variant mb-1">Operador</p>
          <p className="text-body-lg font-semibold">{table.server || 'Maria G.'}</p>
        </div>
      </section>

      {/* Consumed Items List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-headline-md text-on-surface font-bold">Consumo da Mesa</h2>
          <div className="flex items-center gap-2">
            {table.items.length > 0 && (
              <button 
                onClick={handleStartCancelItem}
                className="text-error font-semibold text-xs border border-error/30 hover:bg-error/10 px-3 py-1.5 rounded-lg active:scale-95 transition-all cursor-pointer"
              >
                Cancelar Item
              </button>
            )}
            <span className="text-caption bg-secondary-container text-on-secondary-container px-2.5 py-0.5 rounded-full font-bold">
              {table.items.reduce((sum, item) => sum + item.qty, 0)} Itens
            </span>
          </div>
        </div>
        
        {table.items.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-xl p-8 text-center italic text-on-surface-variant border border-dashed border-outline-variant">
            Nenhum item consumido ainda nesta mesa. Clique em "Adicionar Item" abaixo para registrar compras!
          </div>
        ) : (
          <div className="bg-surface-container-lowest rounded-xl overflow-hidden card-shadow border border-surface-variant/20">
            {table.items.map((item, index) => (
              <div 
                key={index}
                className={`flex items-center p-4 border-b border-surface-container ${index % 2 === 1 ? 'bg-surface-container-low/20' : ''}`}
              >
                <div className="w-10 h-10 rounded-lg bg-primary-container/10 flex items-center justify-center text-primary-container mr-4">
                  <span className="font-extrabold text-sm text-secondary">{index + 1}</span>
                </div>
                <div className="flex-grow">
                  <h3 className="text-body-lg font-semibold">{item.name}</h3>
                  {item.complements && item.complements.length > 0 && (
                    <div className="mt-1 pl-3 border-l-2 border-brand-secondary/40 space-y-0.5">
                      {item.complements.map((comp, cIdx) => (
                        <p key={cIdx} className="text-xs text-on-surface-variant font-medium">
                          <span className="text-brand-secondary">➔</span> {comp.name} {comp.price > 0 ? `(+R$ ${comp.price.toFixed(2)})` : ''}
                        </p>
                      ))}
                    </div>
                  )}
                  {item.note && <p className="text-caption text-error font-medium italic mt-1 bg-error-container/5 px-2 py-0.5 rounded inline-block">Obs: {item.note}</p>}
                </div>
                <div className="text-right">
                  {(() => {
                    const complementsCost = item.complements?.reduce((sum, c) => sum + (c.price || 0), 0) || 0;
                    const unitTotal = item.price + complementsCost;
                    const rowTotal = unitTotal * item.qty;
                    return (
                      <>
                        <p className="text-body-lg font-bold">R$ {rowTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <p className="text-caption text-on-surface-variant">Qtd: {item.qty} x R$ {unitTotal.toFixed(2)}</p>
                      </>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bill Calculations */}
      <section className="bg-surface-container-lowest rounded-xl p-6 space-y-3 card-shadow border border-surface-variant/20 shadow-sm">
        <div className="flex justify-between items-center text-on-surface-variant">
          <span className="text-body-lg">Subtotal consumido</span>
          <span className="text-body-lg font-semibold">R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
        
        <div className="flex justify-between items-center text-on-surface-variant">
          <div className="flex items-center gap-2">
            <span className="text-body-lg">Taxa de Serviço Opcional (10%)</span>
            <button 
              onClick={handleToggleServiceTax}
              className={`text-[11px] px-2 py-0.5 rounded font-bold transition-all border ${
                hasNoServiceTax 
                  ? 'bg-error-container/10 text-error border-error/20 hover:bg-error-container/20' 
                  : 'bg-secondary/10 text-secondary border-secondary/20 hover:bg-secondary/20'
              }`}
            >
              {hasNoServiceTax ? 'Isento (Reativar)' : 'Remover Taxa'}
            </button>
          </div>
          <span className={`text-body-lg font-semibold ${hasNoServiceTax ? 'line-through text-on-surface-variant/40' : ''}`}>
            R$ {(subtotal * 0.10).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* Discount Summary Row */}
        <div className="flex justify-between items-center text-on-surface-variant">
          <div className="flex items-center gap-2">
            <span className="text-body-lg">Desconto na Conta</span>
            <button 
              onClick={handleApplyDiscount}
              className={`text-[11px] px-2 py-0.5 rounded font-bold transition-all border ${
                table.discountValue && table.discountValue > 0 
                  ? 'bg-success/15 text-success border-success/30 hover:bg-success/25' 
                  : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'
              }`}
            >
              {table.discountValue && table.discountValue > 0 ? 'Alterar' : 'Aplicar Desconto'}
            </button>
            {table.discountValue && table.discountValue > 0 && (
              <button
                onClick={handleRemoveDiscount}
                className="text-[11px] text-error font-semibold hover:underline ml-1 cursor-pointer"
              >
                Excluir
              </button>
            )}
          </div>
          <span className="text-body-lg font-semibold text-success">
            {discountAmount > 0 
              ? `- R$ ${discountAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${table.discountType === 'percentage' ? `${table.discountValue}%` : 'Fixo'})`
              : 'R$ 0,00'}
          </span>
        </div>

        <div className="receipt-dashed pt-4 flex justify-between items-center mt-2 border-t">
          <span className="text-headline-md text-on-surface font-extrabold text-xl">Total Geral</span>
          <span className="text-stat-value text-primary font-bold text-2xl">R$ {grandTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
        </div>
      </section>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-20 md:bottom-0 left-0 w-full bg-surface-container-high dark:bg-surface-container-highest p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] rounded-t-xl z-50 md:pl-64">
        <div className="max-w-container-max mx-auto flex gap-4">
          <button 
            onClick={() => {
              if (table && table.status === 'CLOSED') {
                triggerConfirm(
                  'Esta mesa está FECHADA. Deseja reabrir a mesa?',
                  () => {
                    const updatedTable: Table = {
                      ...table,
                      status: 'ACTIVE'
                    };
                    const tablesList = getStoredTables();
                    const updatedList = tablesList.map(t => t.id === table.id ? updatedTable : t);
                    saveTables(updatedList);
                    setTable(updatedTable);
                    
                    setSearchQuery('');
                    setSelectedCategory('Todos');
                    setIsSelectionModalOpen(true);
                  },
                  'Reabrir Mesa'
                );
              } else {
                setSearchQuery('');
                setSelectedCategory('Todos');
                setIsSelectionModalOpen(true);
              }
            }}
            className="flex-1 bg-brand-secondary text-on-secondary py-4 px-6 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer"
          >
            <PlusCircle size={20} />
            Adicionar Item
          </button>
          
          {user && (user.role === 'Gerente' || user.role === 'Caixa' || user.name === 'master') && (
            <button 
              onClick={() => table.items.length > 0 ? openPaymentModal() : triggerAlert('Adicione algum item antes de finalizar a venda!')}
              className={`flex-[1.5] py-4 px-6 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg cursor-pointer ${
                table.items.length > 0 ? 'bg-brand-primary text-on-primary' : 'bg-surface-dim text-on-surface-variant/50 cursor-not-allowed'
              }`}
            >
              <Banknote size={20} />
              Fechar Conta / Pagar
            </button>
          )}
        </div>
      </div>

      {/* Search/Selection Overlay for Adding Products */}
      {isSelectionModalOpen && (
        <div 
          className="fixed inset-0 bg-[#111827]/75 z-[60] flex items-end sm:items-center justify-center transition-opacity duration-300 pointer-events-auto p-4"
          onClick={() => setIsSelectionModalOpen(false)}
        >
          <div 
            className="bg-surface w-full max-w-lg rounded-2xl h-[85vh] sm:h-[75vh] overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom border border-surface-variant/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-margin-mobile border-b border-surface-container flex items-center justify-between shrink-0">
              <h2 className="text-headline-md font-bold text-on-surface">Menu de Produtos</h2>
              <button 
                className="p-2 rounded-full hover:bg-surface-variant transition-colors text-on-surface-variant cursor-pointer"
                onClick={() => setIsSelectionModalOpen(false)}
              >
                <X size={24} />
              </button>
            </div>
            
            {/* Search Bar */}
            <div className="p-margin-mobile pb-2 shrink-0">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar produtos em tempo real..." 
                  className="w-full pl-12 pr-4 py-3 bg-surface-container-lowest border border-outline-variant rounded-xl focus:outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary transition-all text-on-surface"
                />
              </div>
            </div>

            {/* Categories Chips */}
            <div className="px-margin-mobile pt-3 pb-1 flex gap-2 overflow-x-auto no-scrollbar scroll-smooth shrink-0 border-b border-surface-variant/40 bg-surface-container-lowest">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-5 py-2.5 rounded-t-xl font-bold whitespace-nowrap text-sm cursor-pointer transition-all shrink-0 flex items-center gap-2 border-b-2 ${
                    selectedCategory === cat 
                      ? 'bg-primary/10 text-primary border-primary' 
                      : 'bg-transparent text-on-surface-variant border-transparent hover:bg-surface-variant/30 hover:text-on-surface'
                  }`}
                >
                  {cat === 'Todos' ? '📋 Todos' : 
                   cat.toLowerCase().includes('bebida') ? '🍺 ' + cat :
                   cat.toLowerCase().includes('lanche') ? '🍔 ' + cat :
                   cat.toLowerCase().includes('sobremesa') ? '🍰 ' + cat :
                   cat.toLowerCase().includes('prato') ? '🍽️ ' + cat :
                   cat.toLowerCase().includes('petisco') ? '🍟 ' + cat :
                   '🏷️ ' + cat}
                </button>
              ))}
            </div>

            {/* Items List */}
            <div className="flex-grow overflow-y-auto p-margin-mobile space-y-3">
              {filteredProducts.length === 0 ? (
                <div className="p-8 text-center text-on-surface-variant italic">
                  Nenhum produto cadastrado encontrado nesta categoria.
                </div>
              ) : (
                filteredProducts.map((product) => (
                  <button 
                    key={product.id}
                    onClick={() => handleAddItemClick(product)}
                    className="w-full flex items-center p-3 rounded-xl border border-surface-variant/40 hover:border-secondary active:bg-secondary-container/10 transition-all text-left bg-surface-container-lowest cursor-pointer"
                  >
                    <div className="w-12 h-12 rounded-lg bg-secondary-container/10 text-secondary flex items-center justify-center font-bold text-xl mr-4 shrink-0">
                      R$
                    </div>
                    <div className="flex-grow">
                      <p className="text-body-lg font-bold text-on-surface leading-snug">{product.name}</p>
                      <p className="text-caption text-on-surface-variant mt-0.5">Categoria: {product.category} • Estoque: {product.stock} un</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-secondary hover:brightness-95">R$ {product.price.toFixed(2)}</span>
                      <div className="w-8 h-8 rounded-full bg-secondary text-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all shrink-0">
                        <PlusCircle size={20} />
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer for Overlay */}
            <div className="p-margin-mobile border-t border-surface-container bg-surface-container-low">
              <button 
                onClick={() => setIsSelectionModalOpen(false)}
                className="w-full bg-brand-primary text-on-primary py-4 rounded-xl font-bold active:scale-95 transition-transform hover:brightness-95 uppercase tracking-wider cursor-pointer"
              >
                Concluir Adições
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Add Qty & Optional Note Modal */}
      {selectedProductToAdd && (
        <div 
          className="fixed inset-0 bg-[#111827]/75 z-[70] flex items-center justify-center p-4 transition-opacity duration-300 pointer-events-auto shadow-2xl"
          onClick={() => setSelectedProductToAdd(null)}
        >
          <div 
            className="bg-surface w-full max-w-sm rounded-[24px] overflow-hidden p-6 border border-surface-variant/20 animate-in fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-headline-md font-bold text-on-surface pr-4">{selectedProductToAdd.name}</h3>
              <button 
                onClick={() => setSelectedProductToAdd(null)}
                className="p-1 rounded-full hover:bg-surface-variant text-on-surface-variant cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <p className="text-caption text-on-surface-variant mb-4">Estoque disponível: <strong className="text-secondary">{selectedProductToAdd.stock} un</strong> • R$ {selectedProductToAdd.price.toFixed(2)}/un</p>

            <div className="space-y-4">
              {/* Quantity Adjuster */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-on-surface-variant">Quantidade</label>
                <div className="flex items-center justify-center bg-surface-container rounded-xl p-1 gap-2 border border-surface-variant">
                  <button
                    type="button"
                    onClick={() => setItemAddQty(prev => Math.max(1, prev - 1))}
                    className="w-11 h-11 rounded-lg bg-surface flex items-center justify-center text-primary font-bold text-xl active:scale-90 transition-transform cursor-pointer hover:bg-surface-variant"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={itemAddQty}
                    onChange={(e) => setItemAddQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="flex-1 text-center font-extrabold text-lg bg-transparent border-none text-on-surface outline-none focus:ring-0 focus:border-none"
                    min="1"
                  />
                  <button
                    type="button"
                    onClick={() => setItemAddQty(prev => prev + 1)}
                    className="w-11 h-11 rounded-lg bg-surface flex items-center justify-center text-primary font-bold text-xl active:scale-90 transition-transform cursor-pointer hover:bg-surface-variant"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Note Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-on-surface-variant">Observação / Instruções (Opcional)</label>
                <textarea
                  placeholder="Ex: sem cebola, gelo e limão, mal passado..."
                  value={itemAddNote}
                  onChange={(e) => setItemAddNote(e.target.value)}
                  className="w-full p-3 bg-surface-container-lowest border border-outline-variant rounded-xl outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary transition-all text-on-surface text-body-lg resize-none h-20"
                  maxLength={120}
                />
              </div>

              {/* Confirm Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={handleConfirmAddItem}
                  className="w-full bg-brand-primary text-on-primary py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-95 active:scale-98 transition-all tracking-wide text-sm uppercase cursor-pointer"
                >
                  <Check size={18} />
                  Adicionar R$ {(selectedProductToAdd.price * itemAddQty).toFixed(2)}
                </button>
                
                <button
                  onClick={() => setSelectedProductToAdd(null)}
                  className="w-full py-3 bg-transparent text-on-surface-variant font-bold text-sm text-center hover:bg-surface-variant/30 rounded-xl cursor-pointer"
                >
                  Voltar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complements Selection Modal */}
      {isComplementsOpen && complementsTriggerProduct && (
        <div 
          className="fixed inset-0 bg-[#111827]/75 z-[70] flex items-center justify-center p-4 transition-opacity duration-300 pointer-events-auto shadow-2xl animate-in fade-in"
          onClick={() => {
            setIsComplementsOpen(false);
            setComplementsTriggerProduct(null);
          }}
        >
          <div 
            className="bg-surface w-full max-w-md rounded-[24px] overflow-hidden p-6 border border-surface-variant/20 shadow-2xl flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b pb-3 mb-4 shrink-0">
              <div>
                <span className="text-[11px] bg-brand-secondary/15 text-brand-secondary px-2.5 py-0.5 rounded font-extrabold uppercase select-none">
                  Acompanhamentos Opcionais
                </span>
                <h3 className="text-headline-md font-bold text-on-surface mt-1 pr-4">
                  {complementsTriggerProduct.name}
                </h3>
              </div>
              <button 
                onClick={() => {
                  setIsComplementsOpen(false);
                  setComplementsTriggerProduct(null);
                }}
                className="p-1 rounded-full hover:bg-surface-variant text-on-surface-variant cursor-pointer self-start"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-4 bg-surface-container p-3.5 rounded-xl border border-surface-variant/50 shrink-0">
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Regra de seleção para este grupo:
                <br />
                • Mínimo necessário: <strong className="text-primary">{complementsMinReq} porção(ões)</strong>
                <br />
                • Máximo permitido: <strong className="text-secondary">{complementsMaxAllowed} porção(ões)</strong>
                <br />
                • Total selecionado: <strong className="font-extrabold text-on-surface bg-surface px-2 py-0.5 rounded border ml-1">
                  {Object.values(complementsQuantities).reduce((s: number, q: number) => s + q, 0)} / {complementsMaxAllowed}
                </strong>
              </p>
            </div>

            {/* List of Complements */}
            <div className="space-y-3 overflow-y-auto mb-6 pr-1 grow">
              {complementsOptionsList.map(comp => {
                const currentQty = complementsQuantities[comp.id] || 0;
                return (
                  <div 
                    key={comp.id}
                    className="flex justify-between items-center bg-surface-container-low hover:bg-surface-container p-3 rounded-xl border border-surface-variant/30 transition-all select-none"
                  >
                    <div className="pr-2">
                      <p className="font-bold text-body-medium text-on-surface">{comp.name}</p>
                      <p className="text-caption text-on-surface-variant font-medium">
                        {comp.price > 0 ? `+ R$ ${comp.price.toFixed(2)}` : 'Incluso/Grátis'} 
                        {comp.stock <= 10 && <span className="text-warning ml-1.5">• {comp.stock} em estoque</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setComplementsQuantities(prev => ({
                            ...prev,
                            [comp.id]: Math.max(0, (prev[comp.id] || 0) - 1)
                          }));
                        }}
                        className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center text-primary font-bold active:scale-90 transition-transform cursor-pointer hover:bg-surface-variant border border-outline-variant shadow-sm"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-extrabold text-body-lg text-on-surface">
                        {currentQty}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const totalSelected = Object.values(complementsQuantities).reduce((s: number, q: number) => s + q, 0);
                          if (totalSelected >= complementsMaxAllowed) {
                            triggerAlert(`Você já atingiu o limite máximo de ${complementsMaxAllowed} acompanhamentos!`, 'Limite Máximo');
                            return;
                          }
                          setComplementsQuantities(prev => ({
                            ...prev,
                            [comp.id]: (prev[comp.id] || 0) + 1
                          }));
                        }}
                        className="w-9 h-9 rounded-lg bg-surface flex items-center justify-center text-primary font-bold active:scale-90 transition-transform cursor-pointer hover:bg-surface-variant border border-outline-variant shadow-sm"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Note & CTA Buttons */}
            <div className="space-y-3 shrink-0 pt-2 border-t">
              <button
                onClick={handleConfirmComplements}
                className="w-full bg-brand-primary text-on-primary py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-95 active:scale-98 transition-all tracking-wide text-sm uppercase cursor-pointer"
              >
                <Check size={18} />
                Adicionar com Acompanhamentos
              </button>
              
              <button
                onClick={() => {
                  setIsComplementsOpen(false);
                  setComplementsTriggerProduct(null);
                }}
                className="w-full py-2.5 bg-transparent text-on-surface-variant font-bold text-sm text-center hover:bg-surface-variant/30 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supervisor Credentials Modal */}
      {isSupervisorAuthOpen && (
        <div 
          className="fixed inset-0 bg-[#111827]/75 z-[80] flex items-center justify-center p-4 transition-opacity duration-300 pointer-events-auto"
          onClick={() => {
            setIsSupervisorAuthOpen(false);
            setPendingAction(null);
          }}
        >
          <form 
            onSubmit={handleSupervisorAuthSubmit}
            className="bg-surface w-full max-w-sm rounded-[24px] overflow-hidden p-6 border border-surface-variant/20 shadow-2xl animate-in fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-headline-md font-bold text-on-surface flex items-center gap-2">
                🔑 Autorização Gerencial
              </h3>
              <button 
                type="button"
                onClick={() => {
                  setIsSupervisorAuthOpen(false);
                  setPendingAction(null);
                }}
                className="p-1 rounded-full hover:bg-surface-variant text-on-surface-variant cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
            
            <p className="text-caption text-on-surface-variant mb-4">Esta operação requer privilégios de usuário **Gerente** ou **master**.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-on-surface-variant">Nome de Usuário</label>
                <input
                  type="text"
                  placeholder="Ex: master"
                  value={supervisorUser}
                  onChange={(e) => setSupervisorUser(e.target.value)}
                  className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-xl outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary transition-all text-on-surface"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-on-surface-variant">Senha (Password)</label>
                <input
                  type="password"
                  placeholder="Seu código pin/senha"
                  value={supervisorPass}
                  onChange={(e) => setSupervisorPass(e.target.value)}
                  className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-xl outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary transition-all text-on-surface font-mono"
                  required
                />
              </div>

              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  className="w-full bg-brand-primary text-on-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-95 active:scale-98 transition-all tracking-wide text-xs uppercase cursor-pointer"
                >
                  <Check size={16} />
                  Confirmar Acesso
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setIsSupervisorAuthOpen(false);
                    setPendingAction(null);
                  }}
                  className="w-full py-3 bg-transparent text-on-surface-variant font-bold text-xs text-center hover:bg-surface-variant/30 rounded-xl cursor-pointer"
                >
                  Voltar
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Select Item to Cancel Modal */}
      {isCancelSelectorOpen && (
        <div 
          className="fixed inset-0 bg-[#111827]/75 z-[70] flex items-center justify-center p-4 transition-opacity duration-300 pointer-events-auto"
          onClick={() => setIsCancelSelectorOpen(false)}
        >
          <div 
            className="bg-surface w-full max-w-sm rounded-[24px] overflow-hidden p-6 border border-surface-variant/20 shadow-2xl animate-in fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-headline-md font-bold text-error flex items-center gap-1">
                🚫 Cancelar Item
              </h3>
              <button 
                onClick={() => setIsCancelSelectorOpen(false)}
                className="p-1 rounded-full hover:bg-surface-variant text-on-surface-variant cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-on-surface-variant">Selecione o produto consomido</label>
                <select
                  value={selectedCancelItemIndex}
                  onChange={(e) => {
                    const idx = parseInt(e.target.value);
                    setSelectedCancelItemIndex(idx);
                    setCancelQty(1);
                  }}
                  className="w-full h-12 px-3 bg-surface border border-outline-variant rounded-xl outline-none focus:ring-2 focus:ring-secondary/50 text-on-surface font-semibold"
                >
                  {table.items.map((it, idx) => (
                    <option key={idx} value={idx}>
                      {it.name} {it.note ? `(${it.note})` : ''} - Unidades: {it.qty}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCancelItemIndex !== -1 && table.items[selectedCancelItemIndex] && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-on-surface-variant">
                    Quantidade de unidades a cancelar
                  </label>
                  <div className="flex items-center justify-center bg-surface-container rounded-xl p-1 gap-2 border border-surface-variant">
                    <button
                      type="button"
                      onClick={() => setCancelQty(prev => Math.max(1, prev - 1))}
                      className="w-11 h-11 rounded-lg bg-surface flex items-center justify-center text-primary font-bold text-xl active:scale-90 transition-transform cursor-pointer hover:bg-surface-variant"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={cancelQty}
                      onChange={(e) => {
                        const max = table.items[selectedCancelItemIndex]?.qty || 1;
                        setCancelQty(Math.min(max, Math.max(1, parseInt(e.target.value) || 1)));
                      }}
                      className="flex-1 text-center font-extrabold text-lg bg-transparent border-none text-on-surface outline-none focus:ring-0"
                      min="1"
                      max={table.items[selectedCancelItemIndex]?.qty || 1}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const max = table.items[selectedCancelItemIndex]?.qty || 1;
                        setCancelQty(prev => Math.min(max, prev + 1));
                      }}
                      className="w-11 h-11 rounded-lg bg-surface flex items-center justify-center text-primary font-bold text-xl active:scale-90 transition-transform cursor-pointer hover:bg-surface-variant"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-[11px] text-on-surface-variant text-center mt-1">
                    Há {table.items[selectedCancelItemIndex]?.qty} unidades registradas na mesa.
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Motivo do Cancelamento
                </label>
                <textarea
                  placeholder="Digite o motivo do cancelamento... (Ex: Erro de digitação, cliente desistiu)"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full text-sm p-3 bg-surface border border-outline-variant rounded-xl outline-none focus:ring-2 focus:ring-error h-20 resize-none text-on-surface"
                  required
                />
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={handleConfirmCancelItem}
                  className="w-full bg-error text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-95 active:scale-98 transition-all tracking-wide text-xs uppercase cursor-pointer"
                >
                  <X size={16} />
                  Confirmar Estorno / Cancelamento
                </button>
                
                <button
                  onClick={() => setIsCancelSelectorOpen(false)}
                  className="w-full py-2.5 bg-transparent text-on-surface-variant font-bold text-xs text-center hover:bg-surface-variant/30 rounded-xl cursor-pointer"
                >
                  Voltar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Discount Admin Modal */}
      {isDiscountModalOpen && (
        <div 
          className="fixed inset-0 bg-[#111827]/75 z-[70] flex items-center justify-center p-4 transition-opacity duration-300 pointer-events-auto"
          onClick={() => setIsDiscountModalOpen(false)}
        >
          <div 
            className="bg-surface w-full max-w-sm rounded-[24px] overflow-hidden p-6 border border-surface-variant/20 shadow-2xl animate-in fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-headline-md font-bold text-on-surface flex items-center gap-2">
                🏷️ Aplicar Desconto
              </h3>
              <button 
                onClick={() => setIsDiscountModalOpen(false)}
                className="p-1 rounded-full hover:bg-surface-variant text-on-surface-variant cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-caption text-on-surface-variant mb-4">Especifique o desconto em Valor Fixo (R$) ou em Porcentagem (%).</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-on-surface-variant">Modo do Desconto</label>
                <div className="grid grid-cols-2 gap-2 bg-surface-container p-1 rounded-xl border border-surface-variant">
                  <button
                    type="button"
                    onClick={() => setTempDiscountType('percentage')}
                    className={`py-2 px-3 font-semibold text-xs rounded-lg transition-all cursor-pointer ${
                      tempDiscountType === 'percentage' 
                        ? 'bg-primary text-on-primary font-bold shadow-sm' 
                        : 'text-on-surface-variant hover:bg-surface-variant/40'
                    }`}
                  >
                    Porcentagem (%)
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setTempDiscountType('fixed')}
                    className={`py-2 px-3 font-semibold text-xs rounded-lg transition-all cursor-pointer ${
                      tempDiscountType === 'fixed' 
                        ? 'bg-primary text-on-primary font-bold shadow-sm' 
                        : 'text-on-surface-variant hover:bg-surface-variant/40'
                    }`}
                  >
                    Valor Fixo (R$)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1 text-on-surface-variant">
                  {tempDiscountType === 'percentage' ? 'Valor do Desconto em %' : 'Valor do Desconto em R$'}
                </label>
                <input
                  type="number"
                  placeholder={tempDiscountType === 'percentage' ? '10' : '15.00'}
                  step="any"
                  value={tempDiscountValue === 0 ? '' : tempDiscountValue}
                  onChange={(e) => setTempDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full h-11 px-3 bg-surface border border-outline-variant rounded-xl outline-none focus:ring-2 focus:ring-secondary/50 focus:border-secondary transition-all text-on-surface font-semibold text-lg"
                  min="0"
                />
              </div>

              {/* Calculation Preview */}
              <div className="bg-surface-container Low p-3 rounded-lg border border-dashed border-outline-variant text-[11px] text-on-surface-variant space-y-1">
                <div className="flex justify-between">
                  <span>Subtotal da comanda:</span>
                  <span>R$ {subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-success">
                  <span>Desconto calculado:</span>
                  <span>
                    - R${' '}
                    {(tempDiscountType === 'percentage' 
                      ? subtotal * (tempDiscountValue / 100) 
                      : tempDiscountValue
                    ).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={confirmApplyDiscount}
                  className="w-full bg-brand-primary text-on-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-95 active:scale-98 transition-all tracking-wide text-xs uppercase cursor-pointer"
                >
                  <Check size={16} />
                  Confirmar Desconto
                </button>
                
                <button
                  type="button"
                  onClick={() => setIsDiscountModalOpen(false)}
                  className="w-full py-2.5 bg-transparent text-on-surface-variant font-bold text-xs text-center hover:bg-surface-variant/30 rounded-xl cursor-pointer"
                >
                  Voltar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Closing / Print Info Modal */}
      {isClosingModalOpen && (
        <div 
          className="fixed inset-0 bg-[#111827]/75 z-[60] flex items-center justify-center p-4 transition-opacity duration-300 pointer-events-auto"
          onClick={() => setIsClosingModalOpen(false)}
        >
          <div 
            className="bg-surface w-full max-w-md max-h-[90vh] overflow-y-auto no-scrollbar rounded-3xl p-6 shadow-2xl border border-surface-variant/20 animate-in fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b pb-3 mb-4 sticky top-0 bg-surface z-10">
              <h3 className="text-headline-md font-bold text-on-surface font-sans">Fechar Conta - Mesa {tableNumber}</h3>
              <button 
                onClick={() => setIsClosingModalOpen(false)}
                className="text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/50 p-2 rounded-full transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-body-lg text-on-surface-variant">
                <span>Subtotal comanda:</span>
                <span className="font-bold text-on-surface">R$ {subtotal.toFixed(2)}</span>
              </div>
              {!hasNoServiceTax && (
                <div className="flex justify-between text-body-lg text-on-surface-variant">
                  <span>Taxa de serviço (10%):</span>
                  <span className="font-bold text-on-surface">R$ {serviceTax.toFixed(2)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-body-lg text-success">
                  <span>Desconto ({table.discountType === 'percentage' ? `${table.discountValue}%` : 'Fixo'}):</span>
                  <span className="font-bold">- R$ {discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t text-headline-sm font-extrabold receipt-dashed">
                <span className="text-primary">VALOR A PAGAR:</span>
                <span className="text-primary text-xl">R$ {grandTotal.toFixed(2)}</span>
              </div>

              {/* Split Bill Calculator */}
              <div className="pt-4 border-t border-dashed border-outline-variant/50 space-y-3">
                <div className="flex justify-between items-center text-body-medium font-bold text-on-surface">
                  <span className="flex items-center gap-1.5 text-on-surface-variant font-sans text-sm">
                    🧑‍🤝‍🧑 Pessoas na mesa:
                  </span>
                  <div className="flex items-center gap-1.5 bg-surface-container rounded-xl p-1 border border-outline-variant/40">
                    <button
                      type="button"
                      onClick={() => {
                        setPeopleCount(prev => {
                          const next = Math.max(1, prev - 1);
                          // Synchronize with payment modal input if empty/initial
                          setPartialAmountInput((grandTotal / next).toFixed(2));
                          return next;
                        });
                      }}
                      className="w-8 h-8 rounded-lg bg-surface hover:bg-surface-variant flex items-center justify-center text-base font-extrabold cursor-pointer border border-outline-variant/30 text-on-surface transition-all active:scale-95"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={peopleCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        const next = isNaN(val) || val < 1 ? 1 : val;
                        setPeopleCount(next);
                        // Synchronize with payment modal input if empty/initial
                        setPartialAmountInput((grandTotal / next).toFixed(2));
                      }}
                      className="w-10 text-center bg-transparent border-0 font-bold py-1 text-sm text-on-surface focus:outline-none focus:ring-0 focus:border-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPeopleCount(prev => {
                          const next = prev + 1;
                          // Synchronize with payment modal input if empty/initial
                          setPartialAmountInput((grandTotal / next).toFixed(2));
                          return next;
                        });
                      }}
                      className="w-8 h-8 rounded-lg bg-surface hover:bg-surface-variant flex items-center justify-center text-base font-extrabold cursor-pointer border border-outline-variant/30 text-on-surface transition-all active:scale-95"
                    >
                      +
                    </button>
                  </div>
                </div>

                {peopleCount > 1 && (
                  <div className="flex justify-between items-center text-sm font-extrabold bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-amber-600 dark:text-amber-400 animate-in fade-in duration-200">
                    <span className="font-sans">Dividido por pessoa ({peopleCount}x):</span>
                    <span className="font-mono text-base font-sans font-extrabold">R$ {(grandTotal / peopleCount).toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2">
              <button 
                onClick={() => {
                  handlePrint();
                  const tablesList = getStoredTables();
                  const tIndex = tablesList.findIndex(t => t.id === parseInt(tableNumber));
                  if (tIndex >= 0) {
                    tablesList[tIndex].status = 'CLOSED';
                    saveTables(tablesList);
                    setTable({ ...tablesList[tIndex] });
                  }
                  setIsClosingModalOpen(false);
                }}
                className="w-full py-4 bg-brand-primary text-on-primary rounded-xl font-bold tracking-wide shadow-[0_4px_12px_rgba(255,107,0,0.3)] hover:brightness-110 active:scale-95 transition-all outline-none flex justify-center items-center gap-2 cursor-pointer"
              >
                <Printer size={20} />
                Fechar Mesa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Checkout Modal */}
      {isPaymentModalOpen && (
        <div 
          className="fixed inset-0 bg-[#111827]/75 z-[60] flex items-center justify-center p-4 transition-opacity duration-300 pointer-events-auto"
          onClick={() => setIsPaymentModalOpen(false)}
        >
          <div 
            className="bg-surface w-full max-w-md rounded-3xl overflow-hidden p-6 shadow-2xl border border-surface-variant/20 animate-in fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-headline-md font-bold text-on-surface font-sans">Fechar Conta - Mesa {tableNumber}</h3>
              <button 
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1 rounded-full hover:bg-surface-variant text-on-surface-variant cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Bill Summary */}
            <div className="bg-surface-container-low p-4 rounded-xl mb-4 space-y-2">
              <div className="flex justify-between text-body-lg">
                <span className="text-on-surface-variant">Subtotal comanda:</span>
                <span className="font-bold text-on-surface">R$ {subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-body-lg">
                <span className="text-on-surface-variant">Taxa de serviço (10%):</span>
                <span className={`font-bold text-on-surface ${hasNoServiceTax ? 'line-through text-on-surface-variant/50' : ''}`}>
                  R$ {(subtotal * 0.10).toFixed(2)}
                </span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-body-lg text-success">
                  <span>Desconto ({table.discountType === 'percentage' ? `${table.discountValue}%` : 'Fixo'}):</span>
                  <span className="font-bold">- R$ {discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t text-headline-sm font-extrabold receipt-dashed">
                <span className="text-primary">VALOR A PAGAR:</span>
                <span className="text-primary text-xl">R$ {grandTotal.toFixed(2)}</span>
              </div>

              {/* Split Bill Calculator */}
              {!table.paidOnline && (
                <>
                  <div className="flex justify-between items-center pt-2 border-t border-outline-variant/30 text-body-medium font-bold">
                    <span className="text-on-surface-variant flex items-center gap-1.5">
                      🧑‍🤝‍🧑 Pessoas na mesa:
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPeopleCount(prev => {
                            const next = Math.max(1, prev - 1);
                            if (partialPayments.length === 0) {
                              setPartialAmountInput((grandTotal / next).toFixed(2));
                            }
                            return next;
                          });
                        }}
                        className="w-8 h-8 rounded-lg bg-surface-variant/40 hover:bg-surface-variant flex items-center justify-center text-sm font-extrabold cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={peopleCount}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          const next = isNaN(val) || val < 1 ? 1 : val;
                          setPeopleCount(next);
                          if (partialPayments.length === 0) {
                            setPartialAmountInput((grandTotal / next).toFixed(2));
                          }
                        }}
                        className="w-12 text-center bg-surface border border-outline-variant rounded-lg font-bold py-1 text-sm text-on-surface [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPeopleCount(prev => {
                            const next = prev + 1;
                            if (partialPayments.length === 0) {
                              setPartialAmountInput((grandTotal / next).toFixed(2));
                            }
                            return next;
                          });
                        }}
                        className="w-8 h-8 rounded-lg bg-surface-variant/40 hover:bg-surface-variant flex items-center justify-center text-sm font-extrabold cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  
                  {peopleCount > 1 && (
                    <div className="flex justify-between items-center text-sm text-amber-500 font-extrabold bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 animate-in fade-in duration-200">
                      <span>Dividido por pessoa ({peopleCount}x):</span>
                      <span>R$ {(grandTotal / peopleCount).toFixed(2)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Payment List (if splitting) */}
            {partialPayments.length > 0 && (
              <div className="bg-surface-container-low p-4 rounded-xl mb-4 space-y-2 border border-dashed border-outline-variant">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">Parcelas Lançadas</p>
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto no-scrollbar">
                  {partialPayments.map((p, index) => (
                    <div key={index} className="flex justify-between items-center text-sm bg-surface px-3 py-2 rounded-lg border border-outline-variant/30">
                      <div className="flex items-center gap-2 font-semibold text-on-surface">
                        <span>{p.method === 'Dinheiro' ? '💵' : p.method === 'Cartão' ? '💳' : '📱'}</span>
                        <span>{p.method}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-primary">R$ {p.value.toFixed(2)}</span>
                        <button
                          onClick={() => {
                            const updated = partialPayments.filter((_, i) => i !== index);
                            setPartialPayments(updated);
                            const newRest = grandTotal - updated.reduce((sum, item) => sum + item.value, 0);
                            setPartialAmountInput(Math.max(0, newRest).toFixed(2));
                          }}
                          className="text-error hover:bg-error/10 p-1 rounded-full transition-colors cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between pt-2 border-t border-dashed border-outline-variant text-xs font-bold">
                  <span className="text-on-surface-variant">Lançado: R$ {totalPartialSum.toFixed(2)}</span>
                  <span className={grandTotal - totalPartialSum <= 0 ? 'text-success' : 'text-error'}>
                    {grandTotal - totalPartialSum <= 0 
                      ? `Troco: R$ ${Math.abs(grandTotal - totalPartialSum).toFixed(2)}` 
                      : `Restante: R$ ${(grandTotal - totalPartialSum).toFixed(2)}`
                    }
                  </span>
                </div>
              </div>
            )}

            {/* Launch Portion Form */}
            {table.paidOnline ? (
              <div className="bg-lime-500/10 border border-lime-500/20 text-lime-600 dark:text-lime-400 p-4 rounded-2xl flex flex-col gap-1.5 text-center font-bold mb-6 mt-4">
                <span className="text-base flex items-center justify-center gap-1.5">💰 Pago Online via Pix</span>
                <span className="text-xs text-on-surface-variant font-normal leading-relaxed">Este pedido foi pago integralmente pelo cliente no Totem de Autoatendimento usando a integração Abacate Pay.</span>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-outline-variant/50 mb-6 bg-surface-container-lowest">
                <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-3">Lançar Pagamento / Parcela</p>
                
                {/* Selector */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {(['Dinheiro', 'Cartão', 'Pix'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPaymentMethod(method)}
                      className={`py-2 px-1 rounded-lg border font-bold text-xs flex flex-col items-center justify-center transition-all cursor-pointer ${
                        paymentMethod === method 
                          ? 'border-brand-primary bg-primary-container/10 text-primary ring-1 ring-primary' 
                          : 'border-outline-variant text-on-surface-variant bg-surface hover:bg-surface-variant/20'
                      }`}
                    >
                      <span>{method === 'Dinheiro' ? '💵' : method === 'Cartão' ? '💳' : '📱'} {method}</span>
                    </button>
                  ))}
                </div>

                {/* Value Input */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-3 text-xs text-on-surface-variant font-bold">R$</span>
                    <input
                      type="number"
                      step="any"
                      value={partialAmountInput}
                      onChange={(e) => setPartialAmountInput(e.target.value)}
                      placeholder="Valor"
                      className="w-full h-11 pl-8 pr-3 bg-none border border-outline-variant rounded-xl outline-none focus:ring-1 focus:ring-primary focus:border-primary text-sm font-semibold text-on-surface"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const parsed = parseFloat(partialAmountInput);
                      if (isNaN(parsed) || parsed <= 0) {
                        triggerAlert('Por favor, digite um valor válido para lançar.');
                        return;
                      }
                      
                      const nextPayments = [...partialPayments, { method: paymentMethod, value: parsed }];
                      setPartialPayments(nextPayments);
                      
                      const newSum = nextPayments.reduce((sum, p) => sum + p.value, 0);
                      const remaining = Math.max(0, grandTotal - newSum);
                      setPartialAmountInput(remaining.toFixed(2));
                    }}
                    className="bg-brand-secondary text-on-secondary hover:brightness-95 px-3 rounded-xl font-bold text-xs cursor-pointer flex items-center justify-center whitespace-nowrap"
                  >
                    + Lançar Parcela
                  </button>
                </div>

                {/* Dinheiro cash calculation */}
                {paymentMethod === 'Dinheiro' && partialPayments.length === 0 && (
                  <div className="mt-3 pt-2 border-t border-dashed border-outline-variant flex flex-col gap-1 text-xs">
                    <label className="text-on-surface-variant font-bold uppercase tracking-wider">Troco Rápido (Opcional):</label>
                    <input
                      type="number"
                      step="any"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder="Digite quanto dinheiro o cliente entregou"
                      className="w-full h-9 px-3 bg-surface border border-outline-variant rounded-lg outline-none focus:ring-1 focus:ring-primary text-xs"
                    />
                    {cashReceived && !isNaN(parseFloat(cashReceived)) && (
                      <div className="flex justify-between items-center font-bold text-2xs mt-1">
                        <span className="text-on-surface-variant">Resultado:</span>
                        <span className={parseFloat(cashReceived) >= grandTotal ? 'text-success' : 'text-error'}>
                          {parseFloat(cashReceived) >= grandTotal 
                            ? `Troco: R$ ${(parseFloat(cashReceived) - grandTotal).toFixed(2)}` 
                            : `Falta: R$ ${(grandTotal - parseFloat(cashReceived)).toFixed(2)}`
                          }
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Complete Buttons */}
            <div className="space-y-2">
              {table.paidOnline ? (
                <button
                  onClick={handleCheckoutPayment}
                  className="w-full bg-lime-500 hover:bg-lime-600 text-black py-4 rounded-xl font-bold flex items-center justify-center gap-2 active:scale-98 hover:scale-[1.01] transition-all tracking-wide text-sm uppercase cursor-pointer"
                >
                  <Check size={18} />
                  Dar Baixa no Pedido (Pix Pago)
                </button>
              ) : partialPayments.length > 0 ? (
                <button
                  onClick={handleCheckoutPayment}
                  disabled={totalPartialSum < grandTotal - 0.01}
                  className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all tracking-wide text-sm uppercase cursor-pointer ${
                    totalPartialSum >= grandTotal - 0.01
                      ? 'bg-brand-primary text-on-primary hover:brightness-95 active:scale-98'
                      : 'bg-surface-dim text-on-surface-variant/40 cursor-not-allowed'
                  }`}
                >
                  <Check size={18} />
                  {totalPartialSum >= grandTotal - 0.01 
                    ? `Finalizar Recebimento (R$ ${totalPartialSum.toFixed(2)})` 
                    : `Falta lançar R$ ${(grandTotal - totalPartialSum).toFixed(2)}`
                  }
                </button>
              ) : (
                <button
                  onClick={handleCheckoutPayment}
                  className="w-full bg-brand-primary text-on-primary py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:brightness-95 active:scale-98 transition-all tracking-wide text-sm uppercase cursor-pointer"
                >
                  <Check size={18} />
                  Confirmar e Receber R$ {grandTotal.toFixed(2)}
                </button>
              )}
              
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="w-full py-3 bg-transparent text-on-surface-variant font-bold text-sm text-center hover:bg-surface-variant/30 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Alert / Confirm Modal */}
      <AlertModal 
        isOpen={isAlertModalOpen} 
        title={alertTitle}
        message={alertMessage} 
        onClose={() => {
          setIsAlertModalOpen(false);
          if (onCloseCallback) {
            onCloseCallback();
            setOnCloseCallback(null);
          }
        }} 
        onConfirm={confirmAction || undefined}
      />
    </div>
  );
}
