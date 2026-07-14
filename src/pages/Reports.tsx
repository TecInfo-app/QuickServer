import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Vault, Plus, Minus, ArrowRightLeft, Printer, AlertCircle } from 'lucide-react';
import { cn } from '../components/layout/Layout';
import { getStoredTransactions, Transaction, getActiveStoreConfig } from '../utils/db';
import { getCaixaHistory } from '../utils/caixa';
import { printCaixaShiftReport, getRestaurantDetails } from '../utils/printer';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import AlertModal from '../components/ui/AlertModal';

export default function Reports() {
  const storeConfig = getActiveStoreConfig();
  const hasAdvancedReports = storeConfig ? storeConfig.services?.advancedReports : true;

  if (!hasAdvancedReports) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-brand-primary rounded-full blur-[100px]" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-brand-primary rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 max-w-md w-full bg-surface-container-lowest border border-outline-variant/30 p-8 rounded-[32px] shadow-lg">
          <div className="w-16 h-16 bg-brand-primary/10 text-brand-primary flex items-center justify-center rounded-2xl mx-auto mb-6">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-headline-md font-bold text-on-surface mb-2">Relatórios Avançados</h2>
          <p className="text-body-lg text-on-surface-variant leading-relaxed mb-4">
            O módulo complementar de <strong>Relatórios Financeiros e DRE</strong> não está habilitado para o seu estabelecimento (<strong>{storeConfig?.name || 'Sua Loja'}</strong>).
          </p>

          <div className="bg-surface-alt p-4 rounded-xl text-left border border-outline-variant/30 mb-6 font-mono text-[11px] text-on-surface-variant/90 leading-tight">
            <p className="font-bold text-on-surface mb-1 text-[11px]">🛠️ DETALHES:</p>
            <p>• Loja: {storeConfig?.name}</p>
            <p>• ID do Ingress: {storeConfig?.id}</p>
            <p>• Recurso correspondente: finance_advanced_reports</p>
            <p>• Status: RESTRITO / PLANO BÁSICO</p>
          </div>

          <p className="text-caption text-on-surface-variant/80 mb-6">
            Fale com o suporte da administração central para realizar o upgrade de sua assinatura e liberar painéis de rentabilidade!
          </p>

          <div className="space-y-2">
            <a
              href="mailto:suporte@quickserve.com?subject=Ativacao%20de%20Modulo%20Financeiro"
              className="block w-full py-3 bg-brand-primary text-on-primary font-bold rounded-xl active:scale-[0.98] transition-all hover:brightness-95 text-center text-caption"
            >
              Contactar Administração Central
            </a>
          </div>
        </div>
      </div>
    );
  }

  const [activeTab, setActiveTab] = useState<'summary' | 'detailed' | 'cash'>('summary');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [displayCount, setDisplayCount] = useState(6);
  const [alertState, setAlertState] = useState({ isOpen: false, message: '', title: 'Aviso' });

  // Date and payment filters
  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [startDate, setStartDate] = useState<string>(() => getLocalDateString(new Date()));
  const [endDate, setEndDate] = useState<string>(() => getLocalDateString(new Date()));
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('Todos');

  // Cash Register States
  const [cashFlow, setCashFlow] = useState<{type: 'Abertura' | 'Sangria' | 'Suprimento', amount: number, time: string, note: string}[]>([
    { type: 'Abertura', amount: 150.00, time: '08:30', note: 'Troco inicial da gaveta' }
  ]);
  const [flowType, setFlowType] = useState<'Sangria' | 'Suprimento'>('Suprimento');
  const [flowAmount, setFlowAmount] = useState<number>(0);
  const [flowNote, setFlowNote] = useState<string>('');

  useEffect(() => {
    setTransactions(getStoredTransactions());
  }, []);

  // Filter transactions by date
  const dateFilteredTransactions = transactions.filter(tx => {
    if (!tx.time) return false;
    const datePart = tx.time.substring(0, 10);
    return datePart >= startDate && datePart <= endDate;
  });

  // Filter caixas by date
  const isCaixaWithinRange = (caixa: any) => {
    if (!caixa.startTime) return false;
    const startPart = caixa.startTime.substring(0, 10);
    return startPart >= startDate && startPart <= endDate;
  };

  const filteredCaixas = getCaixaHistory().filter(isCaixaWithinRange);

  // Fully filtered transactions for Transações tab (payment method filter)
  const fullyFilteredTransactions = dateFilteredTransactions.filter(tx => {
    if (selectedPaymentMethod === 'Todos') return true;
    return tx.method === selectedPaymentMethod;
  });

  // Sum metrics
  const totalSales = dateFilteredTransactions.reduce((sum, tx) => sum + tx.total, 0);
  const totalCost = dateFilteredTransactions.reduce((sum, tx) => sum + tx.cost, 0);
  const profit = totalSales - totalCost;

  // Payments breakdown
  const cashTotal = dateFilteredTransactions.filter(tx => tx.method === 'Dinheiro').reduce((sum, tx) => sum + tx.total, 0);
  const cardTotal = dateFilteredTransactions.filter(tx => tx.method === 'Cartão').reduce((sum, tx) => sum + tx.total, 0);
  const pixTotal = dateFilteredTransactions.filter(tx => tx.method === 'Pix').reduce((sum, tx) => sum + tx.total, 0);

  const getPercentage = (value: number) => {
    if (totalSales <= 0) return 0;
    return Math.round((value / totalSales) * 100);
  };

  const getFormattedDate = () => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'short' };
    const dateStr = new Date().toLocaleDateString('pt-BR', options);
    return dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  };

  const handleAddCashFlow = () => {
    if (flowAmount <= 0) return;
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setCashFlow([...cashFlow, { type: flowType, amount: flowAmount, time, note: flowNote }]);
    setFlowAmount(0);
    setFlowNote('');
  };

  // Cash summary calculations
  const totalEntradas = cashFlow.filter(f => f.type === 'Suprimento' || f.type === 'Abertura').reduce((acc, f) => acc + f.amount, 0) + cashTotal;
  const totalSaidas = cashFlow.filter(f => f.type === 'Sangria').reduce((acc, f) => acc + f.amount, 0);
  const saldoCaixaReal = totalEntradas - totalSaidas;

  // Chart Mocks
  const lineChartData = [
    { time: '18h', total: 150 },
    { time: '19h', total: 420 },
    { time: '20h', total: 680 },
    { time: '21h', total: 1250 },
    { time: '22h', total: 950 },
    { time: '23h', total: 540 },
  ];

  const pieChartData = [
    { name: 'Bebidas', value: 400 },
    { name: 'Lanches', value: 300 },
    { name: 'Porções', value: 300 },
    { name: 'Sobremesas', value: 100 },
  ];
  const COLORS = ['#2dd4bf', '#fbbf24', '#f87171', '#818cf8'];

  const handleLoadMore = () => {
    if (displayCount >= transactions.length) {
      // Mock append another historic order for visual fullness
      const randomId = `#8${Math.floor(Math.random() * 900 + 100)}`;
      const mockTx: Transaction = {
        orderId: randomId,
        elapsed: '07:45',
        itemsCount: Math.floor(Math.random() * 3 + 1),
        total: parseFloat((Math.random() * 80 + 20).toFixed(2)),
        method: Math.random() > 0.5 ? 'Pix' : 'Dinheiro',
        cost: 15.00,
        time: new Date().toISOString()
      };
      const updated = [...transactions, mockTx];
      setTransactions(updated);
      // save back optionally if desired, but state is okay for mockup
    }
    setDisplayCount(prev => prev + 4);
    setAlertState({ isOpen: true, title: 'Buscando', message: 'Buscando mais transações consolidadas no caixa...' });
  };

  const exportActiveReportToPDF = () => {
    const restaurant = getRestaurantDetails();
    const formattedStartDate = startDate.split('-').reverse().join('/');
    const formattedEndDate = endDate.split('-').reverse().join('/');
    
    let reportTitle = '';
    let reportContentHTML = '';
    
    if (activeTab === 'summary') {
      reportTitle = 'Resumo Geral do Período';
      reportContentHTML = `
        <div class="metric-grid">
          <div class="metric-card primary">
            <div class="label">Vendas Brutas</div>
            <div class="num">R$ ${totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
          </div>
          <div class="metric-card">
            <div class="label">Ticket Médio</div>
            <div class="num">R$ ${(dateFilteredTransactions.length > 0 ? (totalSales / dateFilteredTransactions.length) : 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <div style="font-size: 11px; margin-top: 5px; color: #64748b;">${dateFilteredTransactions.length} Comandas</div>
          </div>
          <div class="metric-card">
            <div class="label">Lucro Líquido</div>
            <div class="num" style="color: #16a34a;">R$ ${profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <div style="font-size: 11px; margin-top: 5px; color: #64748b;">Custos: R$ ${totalCost.toFixed(2)}</div>
          </div>
        </div>

        <div class="section-title">Distribuição por Forma de Pagamento</div>
        <table>
          <thead>
            <tr>
              <th>Forma de Pagamento</th>
              <th style="text-align: right;">Total Recebido</th>
              <th style="text-align: right;">Representação (%)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Dinheiro</td>
              <td style="text-align: right;">R$ ${cashTotal.toFixed(2)}</td>
              <td style="text-align: right;">${getPercentage(cashTotal)}%</td>
            </tr>
            <tr>
              <td>Cartão</td>
              <td style="text-align: right;">R$ ${cardTotal.toFixed(2)}</td>
              <td style="text-align: right;">${getPercentage(cardTotal)}%</td>
            </tr>
            <tr>
              <td>Pix / Digital</td>
              <td style="text-align: right;">R$ ${pixTotal.toFixed(2)}</td>
              <td style="text-align: right;">${getPercentage(pixTotal)}%</td>
            </tr>
            <tr class="total-row">
              <td>Total Geral</td>
              <td style="text-align: right;">R$ ${totalSales.toFixed(2)}</td>
              <td style="text-align: right;">100%</td>
            </tr>
          </tbody>
        </table>
      `;
    } else if (activeTab === 'cash') {
      reportTitle = 'Controle de Caixa e Fechamento de Turnos';
      
      let caixasRowsHTML = '';
      if (filteredCaixas.length === 0) {
        caixasRowsHTML = `<div style="text-align: center; padding: 20px; color: #64748b;">Nenhum turno de caixa registrado neste período fiscal.</div>`;
      } else {
        filteredCaixas.forEach(caixa => {
          const sysTotal = caixa.systemValues ? (caixa.systemValues.money + caixa.systemValues.credit + caixa.systemValues.debit + caixa.systemValues.pix + caixa.systemValues.other) : 0;
          const decTotal = caixa.declaredValues ? (caixa.declaredValues.money + caixa.declaredValues.credit + caixa.declaredValues.debit + caixa.declaredValues.pix + caixa.declaredValues.other) : 0;
          const diffVal = caixa.difference !== undefined ? caixa.difference : 0;
          const diffLabel = diffVal >= 0 ? `<span style="color: #16a34a;">Sobra: R$ ${diffVal.toFixed(2)}</span>` : `<span style="color: #dc2626;">Falta: R$ ${Math.abs(diffVal).toFixed(2)}</span>`;
          
          caixasRowsHTML += `
            <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; margin-bottom: 20px; background: #fff;">
              <div style="display: flex; justify-content: space-between; font-weight: bold; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px; margin-bottom: 10px;">
                <span>Turno: ${caixa.shift} (${caixa.status === 'OPEN' ? 'ABERTO' : 'FECHADO'})</span>
                <span>${diffLabel}</span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; font-size: 12px; margin-bottom: 10px;">
                <div>
                  <strong>Abertura:</strong> ${new Date(caixa.startTime).toLocaleString('pt-BR')}<br/>
                  <strong>Operador Abr:</strong> ${caixa.opener}<br/>
                  <strong>Fundo de Caixa Inicial:</strong> R$ ${caixa.initialValue.toFixed(2)}
                </div>
                <div>
                  <strong>Fechamento:</strong> ${caixa.endTime ? new Date(caixa.endTime).toLocaleString('pt-BR') : 'N/A'}<br/>
                  <strong>Operador Fec:</strong> ${caixa.closer || caixa.opener || 'N/A'}
                </div>
              </div>
              
              ${caixa.systemValues && caixa.declaredValues ? `
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; background: #f8fafc; padding: 10px; border-radius: 6px; font-size: 11px;">
                <div>
                  <strong style="color: #475569;">SISTEMA (VENDAS REGISTRADAS)</strong><br/>
                  Dinheiro: R$ ${caixa.systemValues.money.toFixed(2)} | Pix: R$ ${caixa.systemValues.pix.toFixed(2)}<br/>
                  Cartões: R$ ${(caixa.systemValues.credit + caixa.systemValues.debit).toFixed(2)} | Outros: R$ ${caixa.systemValues.other.toFixed(2)}<br/>
                  <strong>Total Sistema: R$ ${sysTotal.toFixed(2)}</strong>
                </div>
                <div>
                  <strong style="color: #475569;">FÍSICO (VALOR DECLARADO)</strong><br/>
                  Dinheiro: R$ ${caixa.declaredValues.money.toFixed(2)} | Pix: R$ ${caixa.declaredValues.pix.toFixed(2)}<br/>
                  Cartões: R$ ${(caixa.declaredValues.credit + caixa.declaredValues.debit).toFixed(2)} | Outros: R$ ${caixa.declaredValues.other.toFixed(2)}<br/>
                  <strong>Total Declarado: R$ ${decTotal.toFixed(2)}</strong>
                </div>
              </div>
              ` : ''}

              ${caixa.declaredValues?.observation ? `
                <div class="comment-box" style="margin-top: 10px; font-size: 11px;">
                  <strong>Observação:</strong> ${caixa.declaredValues.observation}
                </div>
              ` : ''}
            </div>
          `;
        });
      }
      
      reportContentHTML = `
        <div class="section-title">Turnos Registrados</div>
        <div>
          ${caixasRowsHTML}
        </div>
      `;
    } else {
      reportTitle = 'Extrato Consolidado de Transações';
      
      let txsHTML = '';
      if (fullyFilteredTransactions.length === 0) {
        txsHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px;">Nenhuma transação encontrada para os filtros selecionados.</td></tr>`;
      } else {
        fullyFilteredTransactions.forEach(tx => {
          txsHTML += `
            <tr>
              <td>Pedido ${tx.orderId}</td>
              <td>${new Date(tx.time).toLocaleDateString('pt-BR')} ${tx.elapsed || ''}</td>
              <td>${tx.itemsCount} ${tx.itemsCount === 1 ? 'item' : 'itens'}</td>
              <td><span class="pill" style="background: ${tx.method === 'Dinheiro' ? '#dcfce7; color: #15803d;' : tx.method === 'Cartão' ? '#fef3c7; color: #b45309;' : '#e0f2fe; color: #0369a1;'}">${tx.method}</span></td>
              <td style="text-align: right; font-weight: bold;">R$ ${tx.total.toFixed(2)}</td>
            </tr>
          `;
        });
      }
      
      reportContentHTML = `
        <div class="pills-container">
          <span class="pill">Meio de Pagamento: ${selectedPaymentMethod}</span>
          <span class="pill" style="background: #f1f5f9; color: #475569;">Filtrados: ${fullyFilteredTransactions.length} registros</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Identificação</th>
              <th>Data / Hora</th>
              <th>Volume Itens</th>
              <th>Forma Pagto</th>
              <th style="text-align: right;">Valor Total</th>
            </tr>
          </thead>
          <tbody>
            ${txsHTML}
            <tr class="total-row">
              <td colspan="4" style="font-weight: bold;">Faturamento Total Filtrado</td>
              <td style="text-align: right; font-weight: bold;">R$ ${fullyFilteredTransactions.reduce((sum, t) => sum + t.total, 0).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      `;
    }

    const htmlLayout = `
      <html>
        <head>
          <title>${reportTitle}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
              margin: 30px;
              color: #1e293b;
              font-size: 13px;
              line-height: 1.5;
              background-color: #ffffff;
            }
            .header {
              border-bottom: 2px solid #0f172a;
              padding-bottom: 15px;
              margin-bottom: 20px;
            }
            .header-top {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
            }
            .restaurant-name {
              font-size: 20px;
              font-weight: 800;
              color: #0f172a;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .report-name {
              font-size: 16px;
              font-weight: 700;
              color: #0284c7;
              margin-top: 5px;
            }
            .restaurant-meta {
              font-size: 11px;
              color: #475569;
              margin-top: 4px;
              line-height: 1.4;
            }
            .meta-box {
              background: #f8fafc;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 12px 16px;
              margin-bottom: 25px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 12px;
            }
            .meta-item {
              display: flex;
              flex-direction: column;
            }
            .meta-label {
              font-size: 10px;
              text-transform: uppercase;
              color: #64748b;
              font-weight: 700;
              letter-spacing: 0.5px;
            }
            .meta-val {
              font-size: 13px;
              font-weight: 700;
              color: #0f172a;
              margin-top: 2px;
            }
            .section-title {
              font-size: 14px;
              font-weight: 800;
              color: #0f172a;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 6px;
              margin-top: 20px;
              margin-bottom: 15px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .metric-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 15px;
              margin-bottom: 25px;
            }
            .metric-card {
              border: 1px solid #e2e8f0;
              border-radius: 8px;
              padding: 15px;
              background-color: #ffffff;
            }
            .metric-card.primary {
              border-color: #0ea5e9;
              background-color: #f0f9ff;
            }
            .metric-card .label {
              font-size: 11px;
              color: #64748b;
              font-weight: 700;
              text-transform: uppercase;
            }
            .metric-card .num {
              font-size: 22px;
              font-weight: 800;
              color: #0f172a;
              margin-top: 5px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 25px;
              font-size: 12px;
            }
            th {
              background: #f1f5f9;
              color: #334155;
              font-weight: 700;
              text-align: left;
              padding: 10px 12px;
              border-bottom: 2px solid #cbd5e1;
              text-transform: uppercase;
              font-size: 10.5px;
              letter-spacing: 0.5px;
            }
            td {
              padding: 10px 12px;
              border-bottom: 1px solid #e2e8f0;
              color: #334155;
            }
            tr:nth-child(even) td {
              background: #f8fafc;
            }
            .total-row td {
              font-weight: bold;
              background: #f1f5f9 !important;
              color: #0f172a;
              border-top: 2px solid #94a3b8;
              border-bottom: 2px solid #94a3b8;
            }
            .pill {
              font-weight: 700;
              padding: 3px 8px;
              border-radius: 9999px;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              display: inline-block;
            }
            .comment-box {
              border-left: 3px solid #0ea5e9;
              background: #f8fafc;
              padding: 8px 12px;
              font-style: italic;
              border-radius: 0 4px 4px 0;
            }
            .footer {
              text-align: center;
              font-size: 11px;
              color: #64748b;
              margin-top: 60px;
              border-top: 1px solid #e2e8f0;
              padding-top: 15px;
            }
            @media print {
              body {
                margin: 20px;
                background-color: #fff;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-top">
              <div>
                <div class="restaurant-name">${restaurant.name || 'QUICKSERVE POS'}</div>
                <div class="report-name">${reportTitle}</div>
                <div class="restaurant-meta">
                  ${restaurant.cnpj ? `CNPJ: ${restaurant.cnpj} &bull; ` : ''}
                  ${restaurant.phone ? `Tel: ${restaurant.phone} &bull; ` : ''}
                  ${restaurant.address ? `End: ${restaurant.address}` : ''}
                </div>
              </div>
              <div style="font-size: 11px; text-align: right; color: #64748b;">
                <strong>Gerado em:</strong><br/>
                ${new Date().toLocaleString('pt-BR')}
              </div>
            </div>
          </div>

          <div class="meta-box">
            <div class="meta-item">
              <span class="meta-label">Período Fiscal Selecionado</span>
              <span class="meta-val">De ${formattedStartDate} até ${formattedEndDate}</span>
            </div>
            <div class="meta-item" style="text-align: right;">
              <span class="meta-label">Canal de Emissão</span>
              <span class="meta-val">Módulo Financeiro Retaguarda</span>
            </div>
          </div>

          ${reportContentHTML}

          <div class="footer">
            <p>Relatório Financeiro Corporativo - Gerado pelo Sistema de Gestão QuickServe POS - Ponto de Venda Inteligente</p>
            <p style="font-size: 9px; margin-top: 5px; color: #94a3b8;">Documento sem Validade Fiscal</p>
          </div>
          
          <script>
            window.addEventListener('load', () => {
              setTimeout(() => {
                window.print();
              }, 300);
            });
          </script>
        </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.top = '-10000px';
    iframe.style.left = '-10000px';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(htmlLayout);
      doc.close();
    }

    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 60000);
  };

  return (
    <div className="max-w-container-max mx-auto md:pb-12 space-y-6 overflow-hidden">
      {/* Date Filter Section */}
      <section className="mb-6 mt-4">
        <div className="bg-surface-container-lowest rounded-xl p-5 card-shadow flex flex-col md:flex-row md:items-center justify-between gap-4 border border-surface-variant/20 shadow-sm">
          <div className="flex flex-col">
            <span className="text-caption text-on-surface-variant font-bold text-sm">Filtro de Período Fiscal</span>
            <span className="text-xl text-on-surface font-extrabold mt-1">
              De {startDate.split('-').reverse().join('/')} até {endDate.split('-').reverse().join('/')}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex flex-col">
              <label htmlFor="startDateInput" className="text-[11px] font-bold text-on-surface-variant tracking-wider uppercase mb-1">Data Inicial</label>
              <input
                id="startDateInput"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-surface-variant text-on-surface-variant px-3 py-2 rounded-lg border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/40 font-bold text-sm cursor-pointer"
              />
            </div>
            <div className="flex flex-col">
              <label htmlFor="endDateInput" className="text-[11px] font-bold text-on-surface-variant tracking-wider uppercase mb-1">Data Final</label>
              <input
                id="endDateInput"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-surface-variant text-on-surface-variant px-3 py-2 rounded-lg border border-outline-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/40 font-bold text-sm cursor-pointer"
              />
            </div>
            <button
              onClick={exportActiveReportToPDF}
              className="flex items-center gap-2 bg-brand-primary text-on-primary hover:brightness-95 px-4 h-[38px] rounded-lg font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-sm self-end"
              title="Exportar Relatório Ativo em PDF"
            >
              <Printer size={14} />
              Exportar PDF ({activeTab === 'summary' ? 'Resumo' : activeTab === 'cash' ? 'Caixa' : 'Transações'})
            </button>
          </div>
        </div>
      </section>

      {/* Tabbed Interface */}
      <nav aria-label="Abas de Relatório" className="flex border-b border-outline-variant mb-6">
        <button 
          onClick={() => setActiveTab('summary')}
          className={cn(
            "flex-1 py-3 text-center transition-colors border-b-2",
            activeTab === 'summary' 
              ? "font-bold text-primary border-primary" 
              : "font-semibold text-on-surface-variant border-transparent hover:text-primary"
          )}
        >
          Resumo Geral
        </button>
        <button 
          onClick={() => setActiveTab('cash')}
          className={cn(
            "flex-1 py-3 text-center transition-colors border-b-2",
            activeTab === 'cash' 
              ? "font-bold text-primary border-primary" 
              : "font-semibold text-on-surface-variant border-transparent hover:text-primary"
          )}
        >
          Controle de Caixa
        </button>
        <button 
          onClick={() => setActiveTab('detailed')}
          className={cn(
            "flex-1 py-3 text-center transition-colors border-b-2",
            activeTab === 'detailed' 
              ? "font-bold text-primary border-primary" 
              : "font-semibold text-on-surface-variant border-transparent hover:text-primary"
          )}
        >
          Transações
        </button>
      </nav>

      {/* Content Area */}
      {activeTab === 'summary' ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          {/* Metric Cards: Bento Style */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="col-span-2 lg:col-span-2 bg-surface-container-lowest p-6 rounded-[24px] card-shadow border border-surface-variant/20 shadow-sm">
              <p className="text-caption text-on-surface-variant mb-1">Vendas Brutas (Período)</p>
              <h2 className="text-stat-value text-primary font-extrabold text-3xl">R$ {totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
              <div className="mt-2 flex items-center text-success gap-1">
                <TrendingUp size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">+12% em relação a ontem</span>
              </div>
            </div>
            
            <div className="bg-surface-container-lowest p-5 rounded-[24px] card-shadow border border-surface-variant/20 flex flex-col justify-center">
              <p className="text-caption text-on-surface-variant mb-1">Ticket Médio (Período)</p>
              <h3 className="text-headline-md text-on-surface font-bold">R$ {dateFilteredTransactions.length > 0 ? (totalSales / dateFilteredTransactions.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}</h3>
              <p className="text-[10px] text-on-surface-variant uppercase font-bold mt-1 tracking-wider">{dateFilteredTransactions.length} Comandas</p>
            </div>
            
            <div className="bg-surface-container-lowest p-5 rounded-[24px] card-shadow border border-surface-variant/20 flex flex-col justify-center">
              <p className="text-caption text-on-surface-variant mb-1">Lucro Líquido</p>
              <h3 className="text-headline-md text-success font-bold">R$ {profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
              <p className="text-[10px] text-on-surface-variant uppercase font-bold mt-1 tracking-wider">Custos: R$ {totalCost.toFixed(2)}</p>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="bg-surface-container-lowest p-6 rounded-[24px] card-shadow border border-surface-variant/20">
            <h4 className="text-headline-md text-on-surface mb-6 font-bold">Distribuição por Forma de Pagamento</h4>
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-success"></span>
                    Dinheiro
                  </span>
                  <span className="font-bold text-on-surface">R$ {cashTotal.toFixed(2)} ({getPercentage(cashTotal)}%)</span>
                </div>
                <div className="w-full bg-surface-container rounded-full h-2">
                  <div className="bg-success h-2 rounded-full transition-all duration-500" style={{ width: `${getPercentage(cashTotal)}%` }}></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-brand-secondary"></span>
                    Cartão
                  </span>
                  <span className="font-bold text-on-surface">R$ {cardTotal.toFixed(2)} ({getPercentage(cardTotal)}%)</span>
                </div>
                <div className="w-full bg-surface-container rounded-full h-2">
                  <div className="bg-brand-secondary h-2 rounded-full transition-all duration-500" style={{ width: `${getPercentage(cardTotal)}%` }}></div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="flex items-center gap-2 font-semibold">
                    <span className="w-2.5 h-2.5 rounded-full bg-info-indigo"></span>
                    Pix / Digital
                  </span>
                  <span className="font-bold text-on-surface">R$ {pixTotal.toFixed(2)} ({getPercentage(pixTotal)}%)</span>
                </div>
                <div className="w-full bg-surface-container rounded-full h-2">
                  <div className="bg-info-indigo h-2 rounded-full transition-all duration-500" style={{ width: `${getPercentage(pixTotal)}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Chart Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Sales Chart */}
            <div className="bg-surface-container-lowest p-6 rounded-[24px] card-shadow border border-surface-variant/20">
              <h4 className="text-headline-md text-on-surface mb-6 font-bold">Faturamento Acumulado (Hoje)</h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineChartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(val) => `R$ ${val}`} />
                    <Tooltip 
                      formatter={(value) => [`R$ ${value}`, 'Faturamento']} 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} 
                    />
                    <Line type="monotone" dataKey="total" stroke="#0ea5e9" strokeWidth={4} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Categories Chart */}
            <div className="bg-surface-container-lowest p-6 rounded-[24px] card-shadow border border-surface-variant/20">
              <h4 className="text-headline-md text-on-surface mb-6 font-bold">Vendas por Categoria</h4>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      cx="50%"
                      cy="45%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => [`R$ ${value}`, 'Total']}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'cash' ? (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest p-6 rounded-[24px] card-shadow border border-surface-variant/20">
            <h4 className="text-headline-md text-on-surface mb-6 font-bold flex items-center gap-2">
              <Vault size={24} className="text-primary" /> Relatório de Turnos do Caixa
            </h4>
            <div className="space-y-4">
              {filteredCaixas.slice().reverse().map((caixa, idx) => (
                <div key={idx} className="p-4 bg-surface-container-low rounded-xl border border-surface-variant/30 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-body-lg">
                        Turno: {caixa.shift} {caixa.status === 'OPEN' ? '(Aberto)' : '(Fechado)'}
                      </h4>
                      <p className="text-caption text-on-surface-variant">
                        Aberto por: {caixa.opener} em {new Date(caixa.startTime).toLocaleString('pt-BR')}
                      </p>
                      {caixa.status === 'CLOSED' && (
                        <p className="text-caption text-on-surface-variant">
                          Fechado por: {caixa.closer} em {new Date(caixa.endTime!).toLocaleString('pt-BR')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => {
                          printCaixaShiftReport(caixa);
                          alert(`Relatório do Turno (${caixa.shift}) enviado para a impressora!`);
                        }}
                        className="flex items-center gap-1.5 bg-brand-primary text-on-primary hover:brightness-95 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm"
                        title="Reimprimir Comprovante de Turno"
                      >
                        <Printer size={12} />
                        Reimprimir
                      </button>
                      <div className="text-right">
                        {caixa.difference !== undefined && (
                          <p className={`font-bold text-body-lg ${caixa.difference >= 0 ? 'text-success' : 'text-error'}`}>
                            {caixa.difference >= 0 ? 'Sobra: ' : 'Falta: '}
                            R$ {Math.abs(caixa.difference).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {caixa.status === 'CLOSED' && caixa.systemValues && caixa.declaredValues && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4 text-sm bg-surface-container p-4 rounded-lg border border-outline-variant/30">
                      <div>
                        <p className="text-on-surface-variant font-bold mb-1">Registrado (Sistema)</p>
                        <p className="font-bold mb-2">Total: R$ {(caixa.systemValues.money + caixa.systemValues.credit + caixa.systemValues.debit + caixa.systemValues.pix + caixa.systemValues.other).toFixed(2)}</p>
                        <ul className="text-caption text-on-surface-variant space-y-0.5">
                          <li>Dinheiro: R$ {caixa.systemValues.money.toFixed(2)}</li>
                          <li>Crédito: R$ {caixa.systemValues.credit.toFixed(2)}</li>
                          <li>Débito: R$ {caixa.systemValues.debit.toFixed(2)}</li>
                          <li>Pix: R$ {caixa.systemValues.pix.toFixed(2)}</li>
                          <li>Outros: R$ {caixa.systemValues.other.toFixed(2)}</li>
                        </ul>
                      </div>
                      <div>
                        <p className="text-on-surface-variant font-bold mb-1">Informado (Físico)</p>
                        <p className="font-bold mb-2">Total: R$ {(caixa.declaredValues.money + caixa.declaredValues.credit + caixa.declaredValues.debit + caixa.declaredValues.pix + caixa.declaredValues.other).toFixed(2)}</p>
                        <ul className="text-caption text-on-surface-variant space-y-0.5">
                          <li>Dinheiro: R$ {caixa.declaredValues.money.toFixed(2)}</li>
                          <li>Crédito: R$ {caixa.declaredValues.credit.toFixed(2)}</li>
                          <li>Débito: R$ {caixa.declaredValues.debit.toFixed(2)}</li>
                          <li>Pix: R$ {caixa.declaredValues.pix.toFixed(2)}</li>
                          <li>Outros: R$ {caixa.declaredValues.other.toFixed(2)}</li>
                        </ul>
                      </div>
                      <div className="md:col-span-2 space-y-2 text-caption">
                        <div>
                          <p className="text-on-surface-variant font-bold mb-1">Observações Operador</p>
                          <p className="border-l-2 border-primary pl-2 bg-surface p-1 rounded min-h-[40px] italic">
                            {caixa.declaredValues.observation || "Nenhuma..."}
                          </p>
                        </div>
                        {caixa.movements.length > 0 && (
                          <div>
                            <p className="text-on-surface-variant font-bold mb-1">Movimentações Extras (Refletidas em "Dinheiro (Sistema)")</p>
                            <ul>
                              <li className="flex justify-between border-b border-outline-variant/30 py-0.5 font-bold">
                                <span>Abertura</span>
                                <span className="text-success">R$ {caixa.initialValue.toFixed(2)}</span>
                              </li>
                              {caixa.movements.map((m, i) => (
                                <li key={i} className="flex justify-between border-b border-outline-variant/30 py-0.5">
                                  <span>{m.type} ({m.reason})</span>
                                  <span className={m.type === 'SUPRIMENTO' ? 'text-success' : 'text-error'}>R$ {m.value.toFixed(2)}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {filteredCaixas.length === 0 && (
                 <p className="text-center text-on-surface-variant p-6">Nenhum turno de caixa registrado neste período fiscal.</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest rounded-[24px] card-shadow overflow-hidden border border-surface-variant/20 shadow-sm">
            <div className="p-4 bg-surface-container/30 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-on-surface">
              <span className="font-semibold">Filtro de Forma de Pagamento</span>
              <div className="flex items-center gap-1.5 bg-surface-container rounded-xl p-1 border border-outline-variant/40 self-start">
                {['Todos', 'Dinheiro', 'Cartão', 'Pix'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setSelectedPaymentMethod(m)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                      selectedPaymentMethod === m
                        ? "bg-brand-primary text-on-primary shadow-sm"
                        : "text-on-surface-variant hover:bg-surface-variant/60"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="divide-y divide-surface-container">
              {fullyFilteredTransactions.slice(0, displayCount).map((tx, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between hover:bg-surface-variant/20 cursor-pointer transition-colors" id={`tx-item-${tx.orderId.replace('#', '')}`}>
                  <div className="flex flex-col">
                    <span className="font-bold text-on-surface text-body-lg">Pedido {tx.orderId}</span>
                    <span className="text-caption text-on-surface-variant italic">{tx.elapsed} • {tx.itemsCount} {tx.itemsCount === 1 ? 'item comprado' : 'itens comprados'} • {new Date(tx.time).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-on-surface text-body-lg">R$ {tx.total.toFixed(2)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase mt-1 ${
                      tx.method === 'Dinheiro' ? 'bg-success/15 text-success' : tx.method === 'Cartão' ? 'bg-brand-secondary/15 text-brand-secondary' : 'bg-info-indigo/15 text-info-indigo'
                    }`}>
                      {tx.method}
                    </span>
                  </div>
                </div>
              ))}
              
              {fullyFilteredTransactions.length === 0 && (
                <p className="text-center text-on-surface-variant p-10 font-medium">Nenhuma transação encontrada de acordo com os filtros selecionados.</p>
              )}
            </div>
            
            {fullyFilteredTransactions.length > displayCount && (
              <button 
                onClick={handleLoadMore}
                className="w-full py-4 bg-surface-container-high hover:bg-surface-variant transition-colors text-primary font-bold text-caption text-center uppercase tracking-widest text-xs border-t"
              >
                Carregar Mais Transações
              </button>
            )}
          </div>
        </div>
      )}

      <AlertModal 
        isOpen={alertState.isOpen} 
        title={alertState.title} 
        message={alertState.message} 
        onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))} 
      />
    </div>
  );
}
