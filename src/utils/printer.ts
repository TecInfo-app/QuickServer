// Printer Helper for QuickServe POS
import { Product } from './db';
import { CaixaShift } from './caixa';

export interface PrinterConfig {
  id: string;
  name: string;
  sector: string; // e.g., 'Caixa', 'Bar', 'Churrasqueira', 'Cozinha'
  targetCategory: string; // e.g. 'Bebidas', 'Lanches', 'Petiscos'
  printerName: string; // OS system printer name, e.g. 'EPSON TM-T20'
  active: boolean;
  paperSize?: '58mm' | '80mm';
}

const STORAGE_KEY = 'qsp_printers_v2';
const SERVER_URL_KEY = 'qsp_print_server_url';
const RESTAURANT_NAME_KEY = 'qsp_restaurant_name';

const getPrefixedKey = (key: string) => {
  const storeId = localStorage.getItem('active_store_id');
  return storeId ? `${storeId}_${key}` : key;
};

const DEFAULT_PRINTERS: PrinterConfig[] = [
  { id: '1', name: 'Impressora do Caixa', sector: 'Caixa', targetCategory: 'Todos (Fechamento)', printerName: 'Impressora_Caixa', active: false, paperSize: '80mm' },
  { id: '2', name: 'Impressora do Bar', sector: 'Bar', targetCategory: 'Bebidas', printerName: 'Impressora_Bar', active: false, paperSize: '80mm' },
  { id: '3', name: 'Impressora da Churrasqueira', sector: 'Churrasqueira', targetCategory: 'Pratos Principais', printerName: 'Impressora_Churrasco', active: false, paperSize: '80mm' },
  { id: '4', name: 'Impressora da Cozinha', sector: 'Cozinha', targetCategory: 'Lanches', printerName: 'Impressora_Cozinha', active: false, paperSize: '80mm' }
];

export function getPrinterConfigs(): PrinterConfig[] {
  const stored = localStorage.getItem(getPrefixedKey(STORAGE_KEY));
  if (!stored) {
    localStorage.setItem(getPrefixedKey(STORAGE_KEY), JSON.stringify(DEFAULT_PRINTERS));
    return DEFAULT_PRINTERS;
  }
  try {
    const parsed = JSON.parse(stored) as PrinterConfig[];
    let hasMigration = false;
    const migrated = parsed.map(p => {
      if (!p.paperSize) {
        hasMigration = true;
        return { ...p, paperSize: '80mm' as const };
      }
      return p;
    });
    if (hasMigration) {
      localStorage.setItem(getPrefixedKey(STORAGE_KEY), JSON.stringify(migrated));
    }
    return migrated;
  } catch (e) {
    return DEFAULT_PRINTERS;
  }
}

export function savePrinterConfigs(configs: PrinterConfig[]) {
  localStorage.setItem(getPrefixedKey(STORAGE_KEY), JSON.stringify(configs));
}

export function getPrintServerUrl(): string {
  return localStorage.getItem(getPrefixedKey(SERVER_URL_KEY)) || 'http://localhost:5000';
}

export function savePrintServerUrl(url: string) {
  localStorage.setItem(getPrefixedKey(SERVER_URL_KEY), url);
}

export interface RestaurantDetails {
  name: string;
  phone?: string;
  cnpj?: string;
  address?: string;
  instagram?: string;
  footerMessage?: string;
}

const RESTAURANT_DETAILS_KEY = 'qsp_restaurant_details_v3';

export function getRestaurantDetails(): RestaurantDetails {
  const stored = localStorage.getItem(getPrefixedKey(RESTAURANT_DETAILS_KEY));
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      // Ignora erro
    }
  }
  return {
    name: localStorage.getItem(getPrefixedKey(RESTAURANT_NAME_KEY)) || 'VENTISETTE PIZZ.',
    phone: '',
    cnpj: '',
    address: '',
    instagram: '',
    footerMessage: 'OBRIGADO PELA PREFERENCIA!'
  };
}

export function saveRestaurantDetails(details: RestaurantDetails) {
  localStorage.setItem(getPrefixedKey(RESTAURANT_DETAILS_KEY), JSON.stringify(details));
  localStorage.setItem(getPrefixedKey(RESTAURANT_NAME_KEY), details.name);
}

export function getRestaurantName(): string {
  return getRestaurantDetails().name;
}

export function saveRestaurantName(name: string) {
  const details = getRestaurantDetails();
  details.name = name;
  saveRestaurantDetails(details);
}

export function printTextDirectly(text: string) {
  const iframe = document.createElement('iframe');
  
  // Esconde o iframe
  iframe.style.position = 'absolute';
  iframe.style.top = '-10000px';
  iframe.style.left = '-10000px';
  iframe.style.width = '0px';
  iframe.style.height = '0px';
  
  document.body.appendChild(iframe);
  
  const doc = iframe.contentWindow?.document;
  if (doc) {
    doc.open();
    doc.write(`
      <html>
        <head>
          <title>Comanda</title>
          <style>
            @page { 
              margin: 0; 
            } 
            body, html { 
              margin: 0; 
              padding: 0; 
              width: 100%;
              background: white;
              color: #000;
              font-weight: bold;
            } 
            pre { 
              margin: 0; 
              padding: 2px;
              white-space: pre-wrap; 
              word-break: break-all; /* Força quebra de linha em vez de esticar a página */
              font-family: "Courier New", Courier, monospace; 
              font-size: 14px; 
              line-height: 1.2;
              font-weight: bold;
              color: #000; 
            }
          </style>
        </head>
        <body>
          <pre>${text}</pre>
        </body>
      </html>
    `);
    doc.close();
    
    // Aguarda o iframe renderizar e então abre o gerenciador de impressão nativo
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      
      // Limpeza após o diálogo de impressão (10 segundos para dar tempo)
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 10000);
    };

    // Fallback caso a carga demore demais ou o onload não dispare
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) {
            document.body.removeChild(iframe);
          }
        }, 10000);
      }
    }, 1000);
  }
}

/**
 * Sends a silent print request to the local Node.js print server.
 * Uses fallback standard output / alert if server is not running or inactive.
 */
export async function sendToPrinter(
  sector: string, 
  text: string, 
  deviceName?: string, 
  isTest?: boolean
): Promise<{ success: boolean; message: string }> {
  const configs = getPrinterConfigs();
  const serverUrl = getPrintServerUrl();
  
  // Convert text to uppercase and normalize characters before POST
  const upperText = text.toUpperCase();
  const normalizedText = upperText
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[^\x20-\x7E\r\n]/g, ""); // remove qualquer outro caracter nao standard ASCII

  // Find printer config for the sector
  const config = configs.find(p => p.sector.toLowerCase() === sector.toLowerCase());
  
  // Se for um teste ou se a config estiver ativa, prossegue para tentar enviar silenciosamente.
  // Caso contrário (não ativo e não é teste), abre o gerenciador nativo.
  if (!isTest && (!config || !config.active)) {
    // Fallback: Abre o gerenciador de impressão nativo caso não tenha impressoa configurada para o setor 
    printTextDirectly(upperText);
    return { 
      success: false, 
      message: `Impressão silenciosa inativa para o setor: ${sector}. Apenas janela do navegador aberta.` 
    };
  }

  const finalPrinterName = deviceName || config?.printerName || 'Default';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 seconds timeout

    const response = await fetch(`${serverUrl}/print`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: normalizedText,
        printer: finalPrinterName,
        sector: sector
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return { success: true, message: `Cupom enviado com sucesso para a impressora do/a ${sector} (${finalPrinterName}).` };
    } else {
      // Falhou na rede local, tenta no navegador apenas se NÃO for um teste
      if (!isTest) {
        printTextDirectly(text);
      }
      const errorText = await response.text();
      return { success: false, message: `Erro no servidor de impressão: ${errorText}` };
    }
  } catch (error: any) {
    // Falhou por timeout ou servidor caido, tenta no navegador apenas se NÃO for um teste
    if (!isTest) {
      printTextDirectly(text);
    }

    return { 
      success: false, 
      message: `Não foi possível conectar ao servidor de impressão em ${serverUrl}. ${isTest ? 'Verifique se ele está rodando.' : 'O cupom foi exibido na tela.'}` 
    };
  }
}

/**
 * Automap item added to its corresponding sector and send order print ticket
 */
export async function printOrderTicket(tableName: string, itemName: string, qty: number, note: string, productCategory: string) {
  const configs = getPrinterConfigs();
  
  // Find printer config with matching category
  const config = configs.find(p => 
    p.active && 
    (p.targetCategory.toLowerCase() === productCategory.toLowerCase() || 
     (productCategory.toLowerCase() === 'petiscos' && p.sector.toLowerCase() === 'cozinha'))
  );

  if (!config || !config.active) return; // Silent if no active printer for this category

  const is80 = config.paperSize !== '58mm';
  const width = is80 ? 48 : 32;
  const divider = '-'.repeat(width);
  const eqDivider = '='.repeat(width);

  // Ajuste do layout da comanda para se adequar a bobinas menores de impressoras térmicas (Ex: 58mm = 32 colunas, 80mm = 48 colunas)
  let ticket = `${eqDivider}\n`;
  
  // Exact Cia do Chopp Mesa header formats
  if (is80) {
    ticket += `[GRANDE]     -> MESA : ${tableName}\n`;
  } else {
    ticket += `[GRANDE]        MESA: ${tableName}\n`;
  }
  
  ticket += `${eqDivider}\n`;
  ticket += `SETOR : ${config.sector.toUpperCase()}\n`;
  ticket += `DATA  : ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}\n`;
  ticket += `${divider}\n\n`;
  
  const qtyColWidth = 6;
  const prodColWidth = width - qtyColWidth;
  
  ticket += `${'QTD'.padEnd(qtyColWidth)}${'PRODUTO'.padEnd(prodColWidth)}\n`;
  ticket += `${'---'.padEnd(qtyColWidth)}${'-'.repeat(prodColWidth)}\n`;
  
  const qtyStr = `${qty}x`.padEnd(qtyColWidth);
  const truncatedItemName = itemName.length > prodColWidth ? itemName.slice(0, prodColWidth) : itemName;
  ticket += `${qtyStr}${truncatedItemName}\n`;
  
  if (note) {
    ticket += `\nOBS:\n${note}\n`;
  }
  ticket += `\n${divider}\n`;
  
  const brandText = 'QuickServe Producao';
  const brandPad = Math.max(0, Math.floor((width - brandText.length) / 2));
  ticket += `${' '.repeat(brandPad)}${brandText}\n`;
  ticket += `${eqDivider}\n`;
  
  let finalTicket = ticket.toUpperCase();
  if (!finalTicket.endsWith('\n\n\n\n\n')) {
    finalTicket = finalTicket.trimEnd() + '\n\n\n\n\n';
  }

  await sendToPrinter(config.sector, finalTicket, config.printerName);
}

export async function printCaixaShiftReport(caixa: CaixaShift) {
  const restaurant = getRestaurantDetails();
  const pizzeriaName = restaurant.name.toUpperCase();
  const width = 32; // Normal safe width for thermal printers (58mm/80mm)
  const eqDivider = '='.repeat(width);
  const divider = '-'.repeat(width);

  let r = '';
  r += `${pizzeriaName}\n`;
  if (restaurant.cnpj) r += `CNPJ: ${restaurant.cnpj}\n`;
  if (restaurant.phone) r += `TEL : ${restaurant.phone}\n`;
  if (restaurant.address) r += `END : ${restaurant.address.toUpperCase()}\n`;
  r += `${eqDivider}\n`;
  r += `       FECHAMENTO DE TURNO      \n`;
  r += `            DE CAIXA            \n`;
  r += `${eqDivider}\n`;
  r += `TURNO: ${caixa.shift.toUpperCase()}\n`;
  r += `STATUS: ${caixa.status === 'OPEN' ? 'ABERTO' : 'FECHADO'}\n`;
  r += `OPERADOR ABR: ${caixa.opener.toUpperCase()}\n`;
  r += `ABERTURA: ${new Date(caixa.startTime).toLocaleString('pt-BR')}\n`;
  if (caixa.status === 'CLOSED' && caixa.endTime) {
    r += `OPERADOR FEC: ${(caixa.closer || caixa.opener).toUpperCase()}\n`;
    r += `FECHAMENTO: ${new Date(caixa.endTime).toLocaleString('pt-BR')}\n`;
  }
  r += `${divider}\n`;
  r += `VALOR INICIAL: R$ ${caixa.initialValue.toFixed(2)}\n`;
  
  if (caixa.systemValues) {
    const totalSys = caixa.systemValues.money + caixa.systemValues.credit + caixa.systemValues.debit + caixa.systemValues.pix + caixa.systemValues.other;
    r += `${divider}\n`;
    r += `REGISTRADO (SISTEMA):\n`;
    r += `DINHEIRO : R$ ${caixa.systemValues.money.toFixed(2)}\n`;
    r += `CREDITO  : R$ ${caixa.systemValues.credit.toFixed(2)}\n`;
    r += `DEBITO   : R$ ${caixa.systemValues.debit.toFixed(2)}\n`;
    r += `PIX      : R$ ${caixa.systemValues.pix.toFixed(2)}\n`;
    r += `OUTROS   : R$ ${caixa.systemValues.other.toFixed(2)}\n`;
    r += `TOTAL SYS: R$ ${totalSys.toFixed(2)}\n`;
  }

  if (caixa.declaredValues) {
    const totalDec = caixa.declaredValues.money + caixa.declaredValues.credit + caixa.declaredValues.debit + caixa.declaredValues.pix + caixa.declaredValues.other;
    r += `${divider}\n`;
    r += `INFORMADO (FISICO):\n`;
    r += `DINHEIRO : R$ ${caixa.declaredValues.money.toFixed(2)}\n`;
    r += `CREDITO  : R$ ${caixa.declaredValues.credit.toFixed(2)}\n`;
    r += `DEBITO   : R$ ${caixa.declaredValues.debit.toFixed(2)}\n`;
    r += `PIX      : R$ ${caixa.declaredValues.pix.toFixed(2)}\n`;
    r += `OUTROS   : R$ ${caixa.declaredValues.other.toFixed(2)}\n`;
    r += `TOTAL FIS: R$ ${totalDec.toFixed(2)}\n`;
  }

  if (caixa.difference !== undefined) {
    r += `${divider}\n`;
    r += `${caixa.difference >= 0 ? 'SOBRA' : 'FALTA'} NO CAIXA: R$ ${Math.abs(caixa.difference).toFixed(2)}\n`;
  }

  if (caixa.movements && caixa.movements.length > 0) {
    r += `${divider}\n`;
    r += `MOVIMENTACOES DE CAIXA:\n`;
    caixa.movements.forEach(m => {
      r += `${m.type}: R$ ${m.value.toFixed(2)}\n`;
      r += ` - MOTIVO: ${m.reason.toUpperCase()}\n`;
    });
  }

  if (caixa.declaredValues?.observation) {
    r += `${divider}\n`;
    r += `OBS: ${caixa.declaredValues.observation.toUpperCase()}\n`;
  }

  r += `${eqDivider}\n`;
  r += `RELATORIO EMITIDO EM:\n`;
  r += `${new Date().toLocaleString('pt-BR')}\n`;
  r += `\n\n\n\n\n`;

  await sendToPrinter('caixa', r);
}

