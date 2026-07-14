import React, { useState, useEffect } from 'react';
import { UserPlus, Save, Users, Settings2, Trash2, Printer, Cpu, Wifi, RefreshCw, Terminal, CheckCircle2, AlertTriangle, Play, Copy, Check, ArrowLeft, Grid, MonitorSmartphone, CreditCard } from 'lucide-react';
import { getStoredUsers, saveUsers, getAbacatePayConfig, saveAbacatePayConfig } from '../utils/db';
import { getPrinterConfigs, savePrinterConfigs, getPrintServerUrl, savePrintServerUrl, sendToPrinter, PrinterConfig, RestaurantDetails, getRestaurantDetails, saveRestaurantDetails } from '../utils/printer';
import AlertModal from '../components/ui/AlertModal';

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'users' | 'printers' | 'server' | 'restaurant' | 'abacatepay' | null>(null);
  const [abacatePayConfig, setAbacatePayConfig] = useState<{ apiKey: string }>({ apiKey: '' });
  const [users, setUsers] = useState<any[]>([]);
  const [printers, setPrinters] = useState<PrinterConfig[]>([]);
  const [serverUrl, setServerUrl] = useState<string>('');
  const [restaurantDetails, setRestaurantDetails] = useState<RestaurantDetails>({
    name: '',
    phone: '',
    cnpj: '',
    address: '',
    instagram: '',
    footerMessage: ''
  });
  const [testResult, setTestResult] = useState<{ [id: string]: { success: boolean; message: string } }>({});
  const [isSavingPrinters, setIsSavingPrinters] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Installed printers list state
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [isFetchingPrinters, setIsFetchingPrinters] = useState(false);
  const [fetchPrintersError, setFetchPrintersError] = useState('');
  
  const [alertState, setAlertState] = useState<{ isOpen: boolean, title: string, message: string, onConfirm?: () => void }>({ isOpen: false, title: '', message: '' });

  const handleFetchInstalledPrinters = async (urlToUse?: string) => {
    const targetUrl = urlToUse || serverUrl;
    if (!targetUrl) return;
    setIsFetchingPrinters(true);
    setFetchPrintersError('');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(`${targetUrl.trim()}/printers`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.printers && Array.isArray(data.printers)) {
          setAvailablePrinters(data.printers);
        } else {
          setAvailablePrinters([]);
        }
      } else {
        throw new Error('Servidor não retornou lista');
      }
    } catch (err: any) {
      console.error(err);
      setFetchPrintersError('Servidor de Impressão Offline ou URL Incorreta. Insira os nomes manualmente.');
      setAvailablePrinters([]);
    } finally {
      setIsFetchingPrinters(false);
    }
  };

  useEffect(() => {
    setUsers(getStoredUsers());
    setPrinters(getPrinterConfigs());
    const storedUrl = getPrintServerUrl();
    setServerUrl(storedUrl);
    setRestaurantDetails(getRestaurantDetails());
    setAbacatePayConfig(getAbacatePayConfig());
    if (storedUrl) {
      handleFetchInstalledPrinters(storedUrl);
    }
  }, []);

  const [formData, setFormData] = useState({ name: '', password: '', role: 'Gerente', permissions: ['/dashboard', '/tables', '/inventory', '/kiosk', '/reports', '/admin'] });
  const [editingUserId, setEditingUserId] = useState<number | null>(null);

  const availablePermissions = [
    { id: '/dashboard', label: 'Dashboard & Caixa' },
    { id: '/tables', label: 'Mesas & Comandas' },
    { id: '/inventory', label: 'Estoque & Produtos' },
    { id: '/kiosk', label: 'Totem Autoatendimento' },
    { id: '/reports', label: 'Relatórios Financeiros' },
    { id: '/admin', label: 'Administração & Configs' },
  ];

  const handleTogglePermission = (permId: string) => {
    setFormData(prev => {
      const perms = prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId];
      return { ...prev, permissions: perms };
    });
  };

  const handleEditUser = (user: any) => {
    setEditingUserId(user.id);
    setFormData({
      name: user.name,
      password: user.password || '',
      role: user.role,
      permissions: user.permissions || (user.role === 'Gerente' ? ['/dashboard', '/tables', '/inventory', '/kiosk', '/reports', '/admin'] : ['/tables'])
    });
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setFormData({ name: '', password: '', role: 'Gerente', permissions: ['/dashboard', '/tables', '/inventory', '/kiosk', '/reports', '/admin'] });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    if (!formData.password && !editingUserId) {
      setAlertState({ isOpen: true, title: 'Aviso', message: 'Favor inserir uma senha de acesso para o usuário.' });
      return;
    }
    
    let updated;
    if (editingUserId) {
      updated = users.map(u => 
        u.id === editingUserId 
          ? { 
              ...u, 
              name: formData.name, 
              // Keep original password if no new password is tied
              ...(formData.password ? { password: formData.password } : {}), 
              role: formData.role, 
              permissions: formData.permissions 
            }
          : u
      );
      setAlertState({ isOpen: true, title: 'Sucesso', message: `Usuário ${formData.name} atualizado com sucesso!` });
    } else {
      const newUser = {
        id: Date.now(),
        name: formData.name,
        password: formData.password,
        role: formData.role,
        meta: formData.role === 'Gerente' ? 'Turno Noturno' : 'Turno Integral',
        active: true,
        permissions: formData.permissions
      };
      updated = [newUser, ...users];
      setAlertState({ isOpen: true, title: 'Sucesso', message: `Usuário ${formData.name} cadastrado com sucesso! Agora você já pode fazer login com ele.` });
    }

    setUsers(updated);
    saveUsers(updated);

    setEditingUserId(null);
    setFormData({ name: '', password: '', role: 'Gerente', permissions: ['/dashboard', '/tables', '/inventory', '/kiosk', '/reports', '/admin'] });
  };

  const removeUser = (id: number) => {
    setAlertState({
      isOpen: true,
      title: 'Remover Usuário',
      message: 'Tem certeza de que deseja remover este usuário?',
      onConfirm: () => {
        const updated = users.filter(u => u.id !== id);
        setUsers(updated);
        saveUsers(updated);
      }
    });
  };

  const handleSavePrinters = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingPrinters(true);
    savePrinterConfigs(printers);
    savePrintServerUrl(serverUrl);
    saveRestaurantDetails(restaurantDetails);
    setTimeout(() => {
      setIsSavingPrinters(false);
      setAlertState({ isOpen: true, title: 'Sucesso', message: 'Configurações salvas com sucesso!' });
    }, 450);
  };

  const [isSavingAbacate, setIsSavingAbacate] = useState(false);
  const handleSaveAbacatePay = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAbacate(true);
    saveAbacatePayConfig(abacatePayConfig);
    setTimeout(() => {
      setIsSavingAbacate(false);
      setAlertState({ isOpen: true, title: 'Sucesso', message: 'Configurações do Abacate Pay salvas com sucesso!' });
    }, 450);
  };

  const handleUpdatePrinterField = (id: string, field: keyof PrinterConfig, value: any) => {
    const updated = printers.map(p => p.id === id ? { ...p, [field]: value } : p);
    setPrinters(updated);
  };

  const handleTestPrint = async (printer: PrinterConfig) => {
    setTestResult(prev => ({ ...prev, [printer.id]: { success: false, message: 'Imprimindo teste...' } }));
    
    const is80 = printer.paperSize !== '58mm';
    const width = is80 ? 48 : 32;
    const eqDivider = '='.repeat(width);
    const titleText = 'TESTE DE IMPRESSAO';
    const titlePadded = titleText.padStart(Math.floor((width + titleText.length) / 2)).padEnd(width);
    
    // Simple ASCII print test
    const testTicket = `${eqDivider}\n${titlePadded}\n${eqDivider}\nStatus: OK!\nSetor: ${printer.sector}\nBobina: ${printer.paperSize || '80mm'}\nCategoria: ${printer.targetCategory}\nDispositivo: ${printer.printerName}\nData/Hora: ${new Date().toLocaleString('pt-BR')}\n${eqDivider}\n\n\n\n`;
                        
    const res = await sendToPrinter(printer.sector, testTicket, printer.printerName, true);
    setTestResult(prev => ({ ...prev, [printer.id]: { success: res.success, message: res.message } }));
    
    setTimeout(() => {
      setTestResult(prev => {
        const copy = { ...prev };
        delete copy[printer.id];
        return copy;
      });
    }, 6000);
  };

  const copyServerCode = () => {
    const code = `const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const net = require('net');
const os = require('os');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5000;

// Dynamic Printer Discovery Endpoint
app.get('/printers', (req, res) => {
  let command = '';
  if (process.platform === 'win32') {
    command = 'powershell -Command "Get-CimInstance -ClassName Win32_Printer | Select-Object -ExpandProperty Name"';
  } else if (process.platform === 'darwin') {
    command = 'lpstat -e';
  } else {
    command = "lpstat -p | awk '{print $2}'";
  }

  exec(command, (err, stdout, stderr) => {
    if (err) {
      if (process.platform === 'win32') {
        // Fallback Win32
        exec('powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"', (err2, stdout2) => {
          if (err2) {
            exec('wmic printer get name', (err3, stdout3) => {
              if (err3) {
                return res.json({ printers: ['Default'] });
              }
              const printers = stdout3
                .split('\\r\\n')
                .map(line => line.trim())
                .filter(line => line && line !== 'Name');
              return res.json({ printers: printers.length > 0 ? printers : ['Default'] });
            });
            return;
          }
          const printers = stdout2
            .split('\\r\\n')
            .map(line => line.trim())
            .filter(line => line && line.length > 0);
          return res.json({ printers: printers.length > 0 ? printers : ['Default'] });
        });
        return;
      }
      return res.status(500).send('Erro ao buscar impressoras: ' + err.message);
    }

    const printers = stdout
      .split('\\n')
      .map(line => line.trim())
      .filter(line => line && line.length > 0);
    
    if (printers.length === 0) {
      printers.push('Default');
    }
    res.json({ printers });
  });
});

app.post('/print', (req, res) => {
  const { text, printer, sector } = req.body;
  if (!text) {
    return res.status(400).send('Falta o texto do cupom.');
  }

  console.log('\\n--- Requisicao de Impressao para [' + (sector || 'Geral') + '] ---');
  console.log('Fila / IP do Dispositivo: ' + (printer || 'Padrao'));

  // A) Conexao direta TCP/IP Ethernet (Se "printer" for um IP ex: 192.168.1.100 ou 192.168.1.100:9100)
  if (printer && (printer.includes('.') || printer.includes(':'))) {
    const host = printer.split(':')[0];
    const port = parseInt(printer.split(':')[1] || '9100');
    console.log('Enviando via Raw TCP Socket para ' + host + ':' + port + '...');
    
    const client = new net.Socket();
    client.connect(port, host, () => {
      // Comando ESC/POS de Inicializacao e Corte
      client.write(Buffer.from([0x1B, 0x40])); // ESC @
      client.write(text + '\\n\\n\\n\\n'); 
      client.write(Buffer.from([0x1D, 0x56, 0x41, 0x03])); // Cut
      client.end();
      console.log('Impresso com sucesso via rede.');
      return res.send({ success: true, message: 'Impresso via TCP IP.' });
    });
    
    client.on('error', (err) => {
      console.error('Falha de transmissao IP:', err.message);
      return res.status(500).send('Erro de Rede: ' + err.message);
    });
    return;
  }

  // B) Dispositivo USB / Local com spool do sistema operacional
  // Usar pasta temporaria do S.O. para evitar erros de leitura/escrita com exec (pkg/process.cwd)
  const tempFile = path.join(os.tmpdir(), 'temp_print.txt').split(path.sep).join('/');
  fs.writeFileSync(tempFile, text, 'utf-8');

  let command = '';
  let psScriptFile = '';
  if (process.platform === 'win32') {
    psScriptFile = path.join(os.tmpdir(), 'temp_print.ps1').split(path.sep).join('/');
    const psTemplateBase64 = "JGNvZGUgPSBAJwp1c2luZyBTeXN0ZW07CnVzaW5nIFN5c3RlbS5SdW50aW1lLkludGVyb3BTZXJ2aWNlczsKcHVibGljIGNsYXNzIFJhd1ByaW50ZXJIZWxwZXIgewogICAgW1N0cnVjdExheW91dChMYXlvdXRLaW5kLlNlcXVlbnRpYWwsIENoYXJTZXQ9Q2hhclNldC5BbnNpKV0KICAgIHB1YmxpYyBjbGFzcyBET0NJTkZPQSB7CiAgICAgICAgW01hcnNoYWxBcyhVbm1hbmFnZWRUeXBlLkxQU3RyKV0gcHVibGljIHN0cmluZyBwRG9jTmFtZTsKICAgICAgICBbTWFyc2hhbEFzKFVubWFuYWdlZFR5cGUuTFBTdHIpXSBwdWJsaWMgc3RyaW5nIHBPdXRwdXRGaWxlOwogICAgICAgIFtNYXJzaGFsQXMoVW5tYW5hZ2VkVHlwZS5MUFN0cildIHB1YmxpYyBzdHJpbmcgcERhdGFUeXBlOwogICAgfQogICAgW0RsbEltcG9ydCgid2luc3Bvb2wuRHJ2IiwgRW50cnlQb2ludD0iT3BlblByaW50ZXJBIiwgU2V0TGFzdEVycm9yPXRydWUsIENoYXJTZXQ9Q2hhclNldC5BbnNpLCBFeGFjdFNwZWxsaW5nPXRydWUsIENhbGxpbmdDb252ZW50aW9uPUNhbGxpbmdDb252ZW50aW9uLlN0ZENhbGwpXQogICAgcHVibGljIHN0YXRpYyBleHRlcm4gYm9vbCBPcGVuUHJpbnRlcihbTWFyc2hhbEFzKFVubWFnZWRUeXBlLkxQU3RyKV0gcHVibGljIHN0cmluZyBwcmludGVyLCBvdXQgSW50UHRyIGhQcmludGVyLCBJbnRQdHIgcGQpOwogICAgW0RsbEltcG9ydCgid2luc3Bvb2wuRHJ2IiwgRW50cnlQb2ludD0iQ2xvc2VQcmludGVyIiwgU2V0TGFzdEVycm9yPXRydWUsIENhbGxpbmdDb252ZW50aW9uPUNhbGxpbmdDb252ZW50aW9uLlN0ZENhbGwpXQogICAgcHVibGljIHN0YXRpYyBleHRlcm4gYm9vbCBDbG9zZVByaW50ZXIoSW50UHRyIGhQcmludGVyKTsKICAgIFtEbGxJbXBvcnQoIndpbnNwb29sLkRydiIsIEVudHJ5UG9pbnQ9IlN0YXJ0RG9jUHJpbnRlckEiLCBTZXRMYXN0RXJyb3I9dHJ1ZSwgQ2hhclNldD1DaGFyU2V0LkFuc2ksIEV4YWN0U3BlbGxpbmc9dHJ1ZSwgQ2FsbGluZ0NvbnZlbnRpb249Q2FsbGluZ0NvbnZlbnRpb24uU3RkQ2FsbCldCiAgICBwdWJsaWMgc3RhdGljIGV4dGVybiBib29sIFN0YXJ0RG9jUHJpbnRlcihJbnRQdHIgaFByaW50ZXIsIEludDMyIGxldmVsLCBbSW4sIE1hcnNoYWxBcyhVbm1hbmFnZWRUeXBlLkxQU3RydWN0KV0gRE9DSU5GT0EgZGkpOwogICAgW0RsbEltcG9ydCgid2luc3Bvb2wuRHJ2IiwgRW50cnlQb2ludD0iRW5kRG9jUHJpbnRlciIsIFNldExhc3RFcnJvcj10cnVlLCBDYWxsaW5nQ29udmVudGlvbj1DYWxsaW5nQ29udmVudGlvbi5TdGRDYWxsKV0KICAgIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIGJvb2wgRW5kRG9jUHJpbnRlcihJbnRQdHIgaFByaW50ZXIpOwogICAgW0RsbEltcG9ydCgid2luc3Bvb2wuRHJ2IiwgRW50cnlQb2ludD0iU3RhcnRQYWdlUHJpbnRlciIsIFNldExhc3RFcnJvcj10cnVlLCBDYWxsaW5nQ29udmVudGlvbj1DYWxsaW5nQ29udmVudGlvbi5TdGRDYWxsKV0KICAgIHB1YmxpYyBzdGF0aWMgZXh0ZXJuIGJvb2wgU3RhcnRQYWdlUHJpbnRlcihJbnRQdHIgaFByaW50ZXIpOwogICAgW0RsbEltcG9ydCgid2luc3Bvb2wuRHJ2IiwgRW50cnlQb2ludD0iRW5kUGFnZVByaW50ZXIiLCBTZXRMYXN0RXJyb3I9dHJ1ZSwgQ2FsbGluZ0NvbnZlbnRpb249Q2FsbGluZ0NvbnZlbnRpb24uU3RkQ2FsbCldCiAgICBwdWJsaWMgc3RhdGljIGV4dGVybiBib29sIEVuZFBhZ2VQcmludGVyKEludFB0ciBoUHJpbnRlcik7CiAgICBbRGxsSW1wb3J0KCJ3aW5zcG9vbC5EcnYiLCBFbnRyeVBvaW50PSJXcml0ZVByaW50ZXIiLCBTZXRMYXN0RXJyb3I9dHJ1ZSwgQ2FsbGluZ0NvbnZlbnRpb249Q2FsbGluZ0NvbnZlbnRpb24uU3RkQ2FsbCldCiAgICBwdWJsaWMgc3RhdGljIGV4dGVybiBib29sIFdyaXRlUHJpbnRlcihJbnRQdHIgaFByaW50ZXIsIEludFB0ciBwQnl0ZXMsIEludDMyIGR3Q291bnQsIG91dCBJbnQzMiBkd1dyaXR0ZW4pOwogICAgcHVibGljIHN0YXRpYyBib29sIFMoc3RyaW5nIHN6UHJpbnRlck5hbWUsIHN0cmluZyBzelN0cmluZykgewogICAgICAgIEludFB0ciBoUHJpbnRlciA9IG5ldyBJbnRQdHIoMCk7CiAgICAgICAgRE9DSU5GT0EgZGkgPSBuZXcgRE9DSU5GT0EoKTsKICAgICAgICBib29sIGJTdWNjZXNzID0gZmFsc2U7CiAgICAgICAgZGkucERvY05hbWUgPSAiUkFXIFRFWFQiOwogICAgICAgIGRpLnBPdXRwdXRGaWxlID0gbnVsbDsKICAgICAgICBkaS5wRGF0YVR5cGUgPSAiUkFXIjsKICAgICAgICBpZiAoT3BlblByaW50ZXIoc3pQcmludGVyTmFtZSwgb3V0IGhQcmludGVyLCBJbnRQdHIuWmVybykpIHsKICAgICAgICAgICAgaWYgKFN0YXJ0RG9jUHJpbnRlcihoUHJpbnRlciwgMSwgZGkpKSB7CiAgICAgICAgICAgICAgICBpZiAoU3RhcnRQYWdlUHJpbnRlcihoUHJpbnRlcikpIHsKICAgICAgICAgICAgICAgICAgICBieXRlW10gYnl0ZXMgPSBTeXN0ZW0uVGV4dC5FbmNvZGluZy5EZWZhdWx0LkdldEJ5dGVzKHN6U3RyaW5nKTsKICAgICAgICAgICAgICAgICAgICBJbnRQdHIgcEJ5dGVzID0gTWFyc2hhbC5BbGxvY0NvVGFza01lbShieXRlcy5MZW5ndGgpOwogICAgICAgICAgICAgICAgICAgIE1hcnNoYWwuQ29weShieXRlcywgMCwgcEJ5dGVzLCBieXRlcy5MZW5ndGgpOwogICAgICAgICAgICAgICAgICAgIEludDMyIGR3V3JpdHRlbiA9IDA7CiAgICAgICAgICAgICAgICAgICAgYlN1Y2Nlc3MgPSBXcml0ZVByaW50ZXIoaFByaW50ZXIsIHBCeXRlcywgYnl0ZXMuTGVuZ3RoLCBvdXQgZHdXcml0dGVuKTsKICAgICAgICAgICAgICAgICAgICBFbmRQYWdlUHJpbnRlcihoUHJpbnRlcik7CiAgICAgICAgICAgICAgICAgICAgTWFyc2hhbC5GcmVlQ29UYXNrTWVtKHBCeXRlcyk7CiAgICAgICAgICAgICAgICB9CiAgICAgICAgICAgICAgICBFbmREb2NQcmludGVyKGhQcmludGVyKTsKICAgICAgICAgICAgfQogICAgICAgICAgICBDbG9zZVByaW50ZXIoaFByaW50ZXIpOwogICAgICAgIH0KICAgICAgICByZXR1cm4gYlN1Y2Nlc3M7CiAgICB9Cn0KJ0AKaWYgKC1ub3QgKFtTeXN0ZW0uTWFuYWdlbWVudC5BdXRvbWF0aW9uLlBTVHlwZU5hbWVdJ1Jhd1ByaW50ZXJIZWxwZXInKS5UeXBlKSB7CiAgICBBZGQtVHlwZSAtVHlwZURlZmluaXRpb24gJGNvZGUKfQokcHJpbnRlciA9ICJQUklOVEVSX05BTUUiCmlmICgkcHJpbnRlciAtZXEgIkRlZmF1bHQiIC1vciAkcHJpbnRlciAtZXEgIiIgLW9yICRwcmludGVyIC1lcSAkbnVsbCkgewogICAgJHByaW50ZXIgPSAoR2V0LUNpbUluc3RhbmNlIC1DbGFzc05hbWUgV2luMzJfUHJpbnRlciB8IFdoZXJlLU9iamVjdCB7JF8uRGVmYXVsdCAtZXEgJHRydWV9KS5OYW1lCiAgICBpZiAoJHByaW50ZXIgLWVxICRudWxsKSB7CiAgICAgICAgJHByaW50ZXIgPSAoR2V0LVByaW50ZXIgfCBXaGVyZS1PYmplY3QgeyRfLklzRGVmYXVsdCAtZXEgJHRydWV9KS5OYW1lCiAgICB9Cn0KJHRleHQgPSBbSU8uRmlsZV06OlJlYWRBbGxUZXh0KCJURU1QX0ZJTEUiKQpbUmF3UHJpbnRlckhlbHBlcl06OlMoJHByaW50ZXIsICR0ZXh0KQo=";
    const psRaw = Buffer.from(psTemplateBase64, 'base64').toString('utf-8');
    const psCode = psRaw
      .replace('PRINTER_NAME', (printer || 'Default').replace(/"/g, String.fromCharCode(96) + '"'))
      .replace('TEMP_FILE', tempFile);
    fs.writeFileSync(psScriptFile, psCode, 'utf-8');
    command = "powershell -NoProfile -ExecutionPolicy Bypass -File \"" + psScriptFile + "\"";
  } else {
    // Linux ou MacOS cups lp
    command = printer && printer !== 'Default' ? 'lp -d "' + printer + '" "' + tempFile + '"' : 'lp "' + tempFile + '"';
  }

  console.log('Executando: ' + command);

  exec(command, (err) => {
    try { fs.unlinkSync(tempFile); } catch(e) {}
    try { if (psScriptFile) fs.unlinkSync(psScriptFile); } catch(e) {}
    if (err) {
      console.error('Falha de execucao do spool lp:', err);
      return res.status(500).send('Falha no comando de spool: ' + err.message);
    }
    console.log('Spool de impressao enviado ao sistema operacional.');
    res.send({ success: true });
  });
});

app.listen(PORT, '0.0.0.0', () => {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const k in interfaces) {
    for (const k2 in interfaces[k]) {
      const address = interfaces[k][k2];
      if (address.family === 'IPv4' && !address.internal) {
        addresses.push(address.address);
      }
    }
  }

  console.log('==================================================');
  console.log('  SERVIDOR DE IMPRESSAO NODE.JS ATIVO!          ');
  console.log('  Escutando na porta: ' + PORT);
  console.log('                       ');
  console.log('  Copie um dos endereços IP abaixo e cole no seu POS:');
  addresses.forEach(ip => {
    console.log('   -> http://' + ip + ':' + PORT);
  });
  console.log('   -> http://localhost:' + PORT + ' (Se estiver na mesma maquina)');
  console.log('==================================================');
});`;

    navigator.clipboard.writeText(code);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 3000);
  };

  return (
    <div className="md:pb-12 space-y-8">
      {/* Page Header */}
      <div className="mb-6 mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-headline-lg text-on-surface">Painel de Administração</h2>
          <p className="text-caption text-on-surface-variant">
            {activeTab === null 
              ? 'Selecione uma categoria para gerenciar usuários, impressoras do estabelecimento ou acessar scripts.' 
              : activeTab === 'users' ? 'Gerencie usuários e suas respectivas credenciais e perfis de acesso.'
              : activeTab === 'printers' ? 'Gerencie o mapeamento e conexão física de suas impressoras de setor.'
              : activeTab === 'restaurant' ? 'Gerencie as informações principais do restaurante.'
              : activeTab === 'abacatepay' ? 'Configure as credenciais de API do Abacate Pay para receber pagamentos Pix no Totem.'
              : 'Verifique os passos e baixe o servidor local de impressão em formato script ou executável.'
            }
          </p>
        </div>

        {activeTab !== null && (
          <button
            onClick={() => setActiveTab(null)}
            className="flex items-center gap-2 bg-surface hover:bg-surface-variant text-primary border border-outline-variant px-4 py-2.5 rounded-xl text-xs font-bold active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            <ArrowLeft size={16} />
            Voltar aos Mosaicos
          </button>
        )}
      </div>

      {/* 1. INITIAL MOSAIC VIEWS (Menu) */}
      {activeTab === null && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 animate-fade-in">
          {/* Card 1: Users */}
          <button
            onClick={() => setActiveTab('users')}
            className="flex flex-col text-left bg-surface-container-lowest rounded-[28px] p-8 border border-outline-variant/30 hover:border-secondary hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer group"
          >
            <div className="w-14 h-14 rounded-2xl bg-secondary-container/10 flex items-center justify-center text-secondary mb-6 group-hover:bg-secondary group-hover:text-on-secondary transition-all">
              <Users size={28} />
            </div>
            <h3 className="text-title-large font-bold text-on-surface mb-2">Novo Usuário & Membros</h3>
            <p className="text-body-medium text-on-surface-variant/85 flex-1 leading-relaxed">
              Cadastre novos operadores, configure senhas e gerencie permissões de perfis de acesso para Gerente e Vendedor.
            </p>
            <div className="mt-8 pt-4 border-t border-surface-container/60 w-full flex items-center justify-between text-caption font-bold text-secondary uppercase tracking-wider">
              <span>{users.length} usuários cadastrados</span>
              <span className="group-hover:translate-x-1 transition-transform">Acessar perfil →</span>
            </div>
          </button>

          {/* Card 2: Section Printers Mapping */}
          <button
            onClick={() => setActiveTab('printers')}
            className="flex flex-col text-left bg-surface-container-lowest rounded-[28px] p-8 border border-outline-variant/30 hover:border-primary hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer group"
          >
            <div className="w-14 h-14 rounded-2xl bg-primary-container/10 flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-on-primary transition-all">
              <Printer size={28} />
            </div>
            <h3 className="text-title-large font-bold text-on-surface mb-2">Impressoras por Setores</h3>
            <p className="text-body-medium text-on-surface-variant/85 flex-1 leading-relaxed">
              Associe impressoras térmicas locais ou de rede (IP/Fila) aos respectivos setores (Bar, Cozinha, Churrasqueira, Caixa).
            </p>
            <div className="mt-8 pt-4 border-t border-surface-container/60 w-full flex items-center justify-between text-caption font-bold text-primary uppercase tracking-wider">
              <span>{printers.filter(p => p.active).length} ativas no sistema</span>
              <span className="group-hover:translate-x-1 transition-transform">Configurar →</span>
            </div>
          </button>

          {/* Card 3: Node.js Printing Server */}
          <button
            onClick={() => setActiveTab('server')}
            className="flex flex-col text-left bg-surface-container-lowest rounded-[28px] p-8 border border-outline-variant/30 hover:border-emerald-500 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer group"
          >
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 mb-6 group-hover:bg-emerald-500 group-hover:text-white transition-all">
              <Terminal size={28} />
            </div>
            <h3 className="text-title-large font-bold text-on-surface mb-2">Servidor de Impressão</h3>
            <p className="text-body-medium text-on-surface-variant/85 flex-1 leading-relaxed">
              Monitore a URL de integração de impressão física, copie o script do servidor Node pronto ou gere um executável standalone <strong className="text-emerald-600 font-bold">.exe</strong>.
            </p>
            <div className="mt-8 pt-4 border-t border-surface-container/60 w-full flex items-center justify-between text-caption font-bold text-emerald-500 uppercase tracking-wider">
              <span>Porta Configurada: 5000</span>
              <span className="group-hover:translate-x-1 transition-transform">Ver código & .exe →</span>
            </div>
          </button>

          {/* Card 4: Restaurant Info */}
          <button
            onClick={() => setActiveTab('restaurant')}
            className="flex flex-col text-left bg-surface-container-lowest rounded-[28px] p-8 border border-outline-variant/30 hover:border-amber-500 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer group"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 mb-6 group-hover:bg-amber-500 group-hover:text-white transition-all">
              <Grid size={28} />
            </div>
            <h3 className="text-title-large font-bold text-on-surface mb-2">Infos do Restaurante</h3>
            <p className="text-body-medium text-on-surface-variant/85 flex-1 leading-relaxed">
              Altere o nome do restaurante e outras informações impressas nos cupons.
            </p>
            <div className="mt-8 pt-4 border-t border-surface-container/60 w-full flex items-center justify-between text-caption font-bold text-amber-500 uppercase tracking-wider">
              <span className="truncate max-w-[150px]">{restaurantDetails.name || 'Nome não definido'}</span>
              <span className="group-hover:translate-x-1 transition-transform">Editar →</span>
            </div>
          </button>

          {/* Card 5: Abacate Pay */}
          <button
            onClick={() => setActiveTab('abacatepay')}
            className="flex flex-col text-left bg-surface-container-lowest rounded-[28px] p-8 border border-outline-variant/30 hover:border-lime-500 hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer group"
          >
            <div className="w-14 h-14 rounded-2xl bg-lime-500/10 flex items-center justify-center text-lime-600 mb-6 group-hover:bg-lime-500 group-hover:text-white transition-all">
              <CreditCard size={28} />
            </div>
            <h3 className="text-title-large font-bold text-on-surface mb-2">Abacate Pay</h3>
            <p className="text-body-medium text-on-surface-variant/85 flex-1 leading-relaxed">
              Integre o gateway de pagamentos Abacate Pay. Configure as chaves de API para receber Pix automático no Totem de Autoatendimento.
            </p>
            <div className="mt-8 pt-4 border-t border-surface-container/60 w-full flex items-center justify-between text-caption font-bold text-lime-500 uppercase tracking-wider">
              <span>{abacatePayConfig.apiKey ? 'Chave configurada' : 'Sem chave'}</span>
              <span className="group-hover:translate-x-1 transition-transform">Configurar →</span>
            </div>
          </button>
        </div>
      )}

      {/* 2. TAB CONTENT: USERS & ROLES */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-fade-in">
          {/* Registration Form Card */}
          <section className="md:col-span-5">
            <div className="bg-surface-container-lowest rounded-[24px] p-6 card-shadow h-fit">
              <div className="flex items-center gap-3 mb-6">
                <UserPlus className="text-secondary" size={24} />
                <h3 className="text-title-large font-bold text-on-surface">
                  {editingUserId ? 'Editar Usuário' : 'Novo Usuário'}
                </h3>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-caption font-bold text-on-surface-variant mb-1 ml-1" htmlFor="userName">
                    Nome Completo
                  </label>
                  <input 
                    id="userName"
                    type="text" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Ex: João Silva" 
                    required
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 focus:border-secondary focus:ring-1 focus:ring-secondary/50 outline-none transition-all placeholder:text-on-surface-variant/50 text-body-lg"
                  />
                </div>

                <div>
                  <label className="block text-caption font-bold text-on-surface-variant mb-1 ml-1" htmlFor="userPassword">
                    Senha de Acesso {editingUserId && '(opcional para manter)'}
                  </label>
                  <input 
                    id="userPassword"
                    type="password" 
                    placeholder="••••••••" 
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-3 focus:border-secondary focus:ring-1 focus:ring-secondary/50 outline-none transition-all placeholder:text-on-surface-variant/50 text-body-lg"
                  />
                </div>

                <div>
                  <label className="block text-caption font-bold text-on-surface-variant mb-1 ml-1">
                    Perfil de Acesso
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <label className="relative cursor-pointer group">
                      <input 
                        type="radio" 
                        name="role" 
                        value="Gerente" 
                        className="peer sr-only" 
                        checked={formData.role === 'Gerente'}
                        onChange={() => setFormData({...formData, role: 'Gerente', permissions: ['/dashboard', '/tables', '/inventory', '/kiosk', '/reports', '/admin']})}
                      />
                      <div className="flex flex-col items-center justify-center p-4 border border-outline-variant rounded-xl bg-surface-alt peer-checked:border-secondary peer-checked:bg-secondary-container/10 transition-all hover:bg-surface-variant">
                        <Settings2 className="text-on-surface-variant mb-1" size={24} />
                        <span className="text-caption font-semibold">Gerente</span>
                      </div>
                    </label>
                    <label className="relative cursor-pointer group">
                      <input 
                        type="radio" 
                        name="role" 
                        value="Caixa" 
                        className="peer sr-only"
                        checked={formData.role === 'Caixa'}
                        onChange={() => setFormData({...formData, role: 'Caixa', permissions: ['/dashboard', '/tables', '/reports']})}
                      />
                      <div className="flex flex-col items-center justify-center p-4 border border-outline-variant rounded-xl bg-surface-alt peer-checked:border-secondary peer-checked:bg-secondary-container/10 transition-all hover:bg-surface-variant">
                        <MonitorSmartphone className="text-on-surface-variant mb-1" size={24} />
                        <span className="text-caption font-semibold">Caixa</span>
                      </div>
                    </label>
                    <label className="relative cursor-pointer group">
                      <input 
                        type="radio" 
                        name="role" 
                        value="Vendedor" 
                        className="peer sr-only"
                        checked={formData.role === 'Vendedor'}
                        onChange={() => setFormData({...formData, role: 'Vendedor', permissions: ['/tables']})}
                      />
                      <div className="flex flex-col items-center justify-center p-4 border border-outline-variant rounded-xl bg-surface-alt peer-checked:border-secondary peer-checked:bg-secondary-container/10 transition-all hover:bg-surface-variant">
                        <Users className="text-on-surface-variant mb-1" size={24} />
                        <span className="text-caption font-semibold">Vendedor</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-caption font-bold text-on-surface-variant mb-2 ml-1">
                    Permissões de Acesso (Rotas liberadas)
                  </label>
                  <div className="space-y-2">
                    {availablePermissions.map(perm => (
                      <label key={perm.id} className="flex items-center gap-3 p-3 border border-outline-variant rounded-xl bg-surface-alt cursor-pointer hover:bg-surface-variant transition-colors">
                        <input
                          type="checkbox"
                          checked={formData.permissions.includes(perm.id)}
                          onChange={() => handleTogglePermission(perm.id)}
                          className="w-5 h-5 rounded border-outline-variant text-secondary focus:ring-secondary"
                        />
                        <span className="text-body-medium font-semibold text-on-surface">{perm.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <button 
                    type="submit" 
                    className="w-full bg-brand-primary text-on-primary font-bold py-4 rounded-xl hover:brightness-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                  >
                    <Save size={20} />
                    {editingUserId ? 'Salvar Alterações' : 'Cadastrar Usuário'}
                  </button>
                  {editingUserId && (
                    <button 
                      type="button" 
                      onClick={handleCancelEdit}
                      className="w-full bg-surface-variant text-on-surface hover:brightness-95 font-bold py-3 rounded-xl transition-all"
                    >
                      Cancelar Edição
                    </button>
                  )}
                </div>
              </form>
            </div>
          </section>

          {/* User List Card */}
          <section className="md:col-span-7">
            <div className="bg-surface-container-lowest rounded-[24px] card-shadow overflow-hidden">
              <div className="p-6 border-b border-surface-container">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Users className="text-secondary" size={24} />
                    <h3 className="text-title-large font-bold text-on-surface">Usuários Cadastrados</h3>
                  </div>
                  <span className="bg-secondary-container text-on-secondary-container text-[12px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                    {users.length} Ativos
                  </span>
                </div>
              </div>

              <div className="divide-y divide-surface-container">
                {users.map(user => (
                  <div key={user.id} className="flex items-center justify-between p-4 md:p-6 hover:bg-surface-alt transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${user.role === 'Gerente' ? 'bg-secondary-fixed-dim text-on-secondary-fixed' : 'bg-tertiary-fixed text-on-tertiary-fixed'}`}>
                        {user.role === 'Gerente' ? <Settings2 size={24} /> : <Users size={24} />}
                      </div>
                      <div>
                        <p className="text-body-lg font-bold text-on-surface">{user.name}</p>
                        <p className="text-caption text-on-surface-variant flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-success"></span>
                          {user.role} • {user.meta}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleEditUser(user)}
                        className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-secondary hover:bg-secondary-container/50 rounded-full transition-all"
                        title="Editar Usuário"
                      >
                        <Settings2 size={20} />
                      </button>
                      <button 
                        onClick={() => removeUser(user.id)}
                        className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:text-error hover:bg-error-container/50 rounded-full transition-all"
                        title="Remover Usuário"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 3. TAB CONTENT: PRINTERS CONFIG */}
      {activeTab === 'printers' && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-surface-container-lowest rounded-[24px] p-6 card-shadow">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-surface-container pb-4">
              <div className="flex items-center gap-3">
                <Printer className="text-primary" size={26} />
                <div>
                  <h3 className="text-title-large font-bold text-on-surface">Cadastro de Impressoras por Setor (Máx: 4)</h3>
                  <p className="text-caption text-on-surface-variant">Configure qual periférico físico receberá as comandas e fechamentos.</p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSavePrinters} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-alt p-4 rounded-2xl border border-outline-variant/30">
                <div>
                  <label className="block text-caption font-bold text-on-surface mb-2 flex items-center gap-2">
                    <Wifi size={16} className="text-primary" />
                    URL do Servidor de Impressão Local
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={serverUrl}
                      onChange={(e) => setServerUrl(e.target.value)}
                      placeholder="Ex: http://localhost:5000" 
                      required
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-2 focus:border-primary focus:ring-1 focus:ring-primary/5 outline-none transition-all text-body-medium font-semibold text-primary"
                    />
                    <button
                      type="button"
                      onClick={() => handleFetchInstalledPrinters()}
                      disabled={isFetchingPrinters}
                      className="px-3 bg-secondary-container text-on-secondary-container hover:brightness-95 active:scale-95 transition-all text-xs font-bold rounded-xl flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <RefreshCw size={14} className={isFetchingPrinters ? 'animate-spin' : ''} />
                      Conectar & Sincronizar
                    </button>
                  </div>
                  {fetchPrintersError && (
                    <p className="text-[11px] text-error mt-1 leading-tight font-medium">{fetchPrintersError}</p>
                  )}
                  {availablePrinters.length > 0 && (
                    <p className="text-[11px] text-success mt-1 leading-tight font-bold flex items-center gap-1">
                      <CheckCircle2 size={13} />
                      Conectado: {availablePrinters.length} impressoras detectadas no PC.
                    </p>
                  )}
                </div>
                <div className="flex items-end text-caption text-on-surface-variant pb-1">
                  <span>Esse endereço conecta o aplicativo web POS ao script Node.js instalado na sua máquina para detectar as impressoras físicas automaticamente.</span>
                </div>
              </div>

              {/* Grid lists of printers */}
              <div className="space-y-4">
                <h4 className="text-title-medium text-on-surface font-bold">Impressoras de Setores</h4>
                
                <div className="grid grid-cols-1 gap-4">
                  {printers.map((prt, index) => (
                    <div key={prt.id} className="relative overflow-hidden border border-outline-variant/40 rounded-2xl p-4 bg-surface-container-lowest flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 hover:border-primary/20 transition-all">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${prt.active ? 'bg-primary-container text-primary' : 'bg-surface-variant text-on-surface-variant'}`}>
                          <Printer size={20} />
                        </div>
                        <div>
                          <input
                            type="text"
                            value={prt.name}
                            onChange={(e) => handleUpdatePrinterField(prt.id, 'name', e.target.value)}
                            className="bg-transparent border-b border-transparent hover:border-outline-variant font-bold text-body-lg text-on-surface focus:border-primary outline-none py-0.5"
                            placeholder="Nome de Apresentação"
                          />
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="bg-outline-variant/30 text-on-surface-variant text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Setor: {prt.sector}
                            </span>
                            <span className="text-caption text-on-surface-variant flex items-center gap-1">
                              • Categoria Mapeada:
                              <select
                                value={prt.targetCategory}
                                onChange={(e) => handleUpdatePrinterField(prt.id, 'targetCategory', e.target.value)}
                                className="bg-surface-alt border border-outline-variant/30 rounded px-1.5 py-0.5 text-[11px] font-medium outline-none focus:border-primary text-on-surface"
                              >
                                <option value="Todos (Fechamento)">Todos (Fechamento)</option>
                                <option value="Bebidas">Bebidas (Bar)</option>
                                <option value="Pratos Principais">Pratos Principais</option>
                                <option value="Lanches">Lanches</option>
                                <option value="Petiscos">Petiscos</option>
                                <option value="Sobremesas">Sobremesas</option>
                              </select>
                            </span>
                            <span className="text-caption text-on-surface-variant flex items-center gap-1">
                              • Bobina:
                              <select
                                value={prt.paperSize || '80mm'}
                                onChange={(e) => handleUpdatePrinterField(prt.id, 'paperSize', e.target.value)}
                                className="bg-surface-alt border border-outline-variant/30 rounded px-1.5 py-0.5 text-[11px] font-semibold outline-none focus:border-primary text-on-surface"
                              >
                                <option value="80mm">Standard (80mm)</option>
                                <option value="58mm">Mini (58mm)</option>
                              </select>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 border-t md:border-t-0 pt-3 md:pt-0">
                        {/* OS Queue Printer Name */}
                        <div className="flex-1 min-w-[180px]">
                          <label className="block text-[10px] font-bold uppercase text-on-surface-variant mb-1 ml-1">Fila do Sistema ou IP</label>
                          {availablePrinters.length > 0 ? (
                            <div className="space-y-1">
                              <select
                                value={availablePrinters.includes(prt.printerName) ? prt.printerName : 'manual'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val !== 'manual') {
                                    handleUpdatePrinterField(prt.id, 'printerName', val);
                                  } else {
                                    handleUpdatePrinterField(prt.id, 'printerName', '');
                                  }
                                }}
                                className="w-full bg-surface-alt border border-outline-variant/40 rounded-lg px-3 py-1.5 text-xs font-semibold text-on-surface outline-none focus:border-primary"
                              >
                                {availablePrinters.map(pName => (
                                  <option key={pName} value={pName}>{pName}</option>
                                ))}
                                <option value="manual">✏️ Digitar IP / Fila Manual</option>
                              </select>
                              
                              {(!availablePrinters.includes(prt.printerName) || prt.printerName === '' || !prt.printerName) && (
                                <input 
                                  type="text"
                                  placeholder="Digite IP ou Fila..."
                                  value={prt.printerName || ''}
                                  onChange={(e) => handleUpdatePrinterField(prt.id, 'printerName', e.target.value)}
                                  className="w-full bg-surface border border-primary/40 rounded-lg px-2.5 py-1 text-xs font-mono outline-none focus:border-primary"
                                />
                              )}
                            </div>
                          ) : (
                            <input 
                              type="text"
                              placeholder="Ex: EPSON_BAR ou 192.168.1.55"
                              value={prt.printerName || ''}
                              onChange={(e) => handleUpdatePrinterField(prt.id, 'printerName', e.target.value)}
                              className="w-full bg-surface-alt border border-outline-variant/40 rounded-lg px-3 py-1.5 text-xs font-mono outline-none focus:border-primary"
                            />
                          )}
                        </div>

                        {/* Active Toggle */}
                        <div className="flex items-center gap-2 self-start sm:self-center">
                          <label className="relative inline-flex items-center cursor-pointer select-none">
                            <input 
                              type="checkbox" 
                              checked={prt.active}
                              onChange={(e) => handleUpdatePrinterField(prt.id, 'active', e.target.checked)}
                              className="sr-only peer" 
                            />
                            <div className="w-11 h-6 bg-outline-variant/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-success"></div>
                            <span className="ml-2 text-xs font-semibold text-on-surface">
                              {prt.active ? 'Ativo' : 'Inativo'}
                            </span>
                          </label>
                        </div>

                        {/* Test print */}
                        <button
                          type="button"
                          disabled={!prt.active}
                          onClick={() => handleTestPrint(prt)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center justify-center gap-1 ${
                            prt.active 
                              ? 'border-primary text-primary hover:bg-primary-container/23 active:scale-[0.98]' 
                              : 'border-outline-variant/30 text-on-surface-variant/40 cursor-not-allowed'
                          }`}
                        >
                          <Play size={12} />
                          Testar
                        </button>
                      </div>

                      {/* Display test feedback response */}
                      {testResult[prt.id] && (
                        <div className="absolute bottom-1 right-3 left-3 sm:left-auto flex items-center gap-1 text-[11px] bg-surface p-1 rounded border border-outline-variant shadow-sm z-10">
                          {testResult[prt.id].success ? (
                            <>
                              <CheckCircle2 size={13} className="text-success" />
                              <span className="text-success font-medium">Sucesso!</span>
                            </>
                          ) : testResult[prt.id].message.includes('Imprimindo') ? (
                            <>
                              <RefreshCw size={13} className="animate-spin text-primary" />
                              <span className="text-primary font-medium">Imprimindo...</span>
                            </>
                          ) : (
                            <>
                              <AlertTriangle size={13} className="text-error" />
                              <span className="text-error font-medium truncate max-w-[200px]" title={testResult[prt.id].message}>
                                Offline / Servidor inativo
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit configuration save */}
              <button
                type="submit"
                disabled={isSavingPrinters}
                className="w-full bg-primary text-on-primary font-bold py-4 rounded-xl hover:brightness-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-body-lg shadow-md"
              >
                {isSavingPrinters ? (
                  <>
                    <RefreshCw className="animate-spin" size={20} />
                    Salvando Configurações...
                  </>
                ) : (
                  <>
                    <Save size={20} />
                    Salvar Configurações de Impressão
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. TAB CONTENT: SERVER INSTALLATION / EXECUTABLE */}
      {activeTab === 'server' && (
        <div className="animate-fade-in w-full">
          <div className="bg-slate-950 text-slate-100 rounded-[28px] p-6 md:p-8 shadow-2xl flex flex-col justify-between border border-slate-800">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <Terminal className="text-emerald-400 font-bold" size={28} />
                <h3 className="text-headline-md font-extrabold tracking-tight text-white">Servidor Local de Impressão Silenciosa</h3>
              </div>
              
              <p className="text-sm text-slate-300 mb-6 leading-relaxed max-w-4xl">
                As impressoras térmicas físicas ficam na sua rede local ou conectadas via USB. Para fazer uma impressão direta 
                <strong className="text-white"> silenciosa (sem abrir a janela de diálogo ou confirmação do Chrome)</strong>, execute o servidor local do POS no computador principal da empresa.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm font-sans text-slate-300">
                {/* Column 1 */}
                <div className="space-y-4">
                  <div className="border-b border-slate-900 pb-3">
                    <p className="font-bold text-emerald-400 flex items-center gap-1">1. Criar pasta e iniciar:</p>
                    <pre className="bg-slate-900 border border-slate-800 p-3 rounded-lg font-mono text-xs text-slate-400 mt-1.5 select-all">
                      mkdir printer-server{'\n'}
                      cd printer-server{'\n'}
                      npm init -y
                    </pre>
                  </div>

                  <div className="border-b border-slate-900 pb-3">
                    <p className="font-bold text-emerald-400 flex items-center gap-1">2. Instalar dependências:</p>
                    <pre className="bg-slate-900 border border-slate-800 p-3 rounded-lg font-mono text-xs text-slate-400 mt-1.5 select-all">
                      npm install express cors
                    </pre>
                    <p className="text-[11px] text-slate-400 mt-1">Habilita conectividade via rede local TCP/IP direta ou via spooler Win/Mac OS.</p>
                  </div>

                  <div className="border-b border-slate-900 pb-3 md:border-b-0 md:pb-0">
                    <p className="font-bold text-emerald-400 flex items-center justify-between">
                      <span>3. Código-fonte do `server.js`:</span>
                      <button
                        type="button"
                        onClick={copyServerCode}
                        className="text-slate-400 hover:text-emerald-400 hover:bg-slate-800 px-2.5 py-1.5 rounded transition-colors flex items-center gap-1 font-mono text-[11px] select-none cursor-pointer"
                      >
                        {copiedScript ? (
                          <>
                            <Check size={12} className="text-success" />
                            Copiado!
                          </>
                        ) : (
                          <>
                            <Copy size={12} />
                            Copiar Código
                          </>
                        )}
                      </button>
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                      Clique no botão para copiar o script do servidor Node.js auto-configurado para o seu ambiente.
                    </p>
                  </div>
                </div>

                {/* Column 2 */}
                <div className="space-y-4">
                  <div className="border-b border-slate-900 pb-3 h-full flex flex-col justify-between">
                    <div>
                      <p className="font-bold text-emerald-400 flex items-center gap-1.5">
                        <Cpu size={16} />
                        4. Gerar Executável Standalone (.exe) para Windows:
                      </p>
                      <p className="text-xs text-slate-400 leading-relaxed mt-2">
                        Não quer depender do Node ou prompt de comando para rodar nos PCs? Compile o código em um executável autônomo e de um clique só:
                      </p>
                      <pre className="bg-slate-900 border border-slate-800 p-3 rounded-lg font-mono text-xs text-slate-400 mt-2 select-all">
                        npx pkg server.js --targets node18-win-x64 -o impressora-pos.exe
                      </pre>
                      <p className="text-[11px] text-slate-500 mt-1 bg-slate-900/50 p-2 border border-slate-900 rounded leading-normal">
                        Isso gera o arquivo <strong className="text-slate-300">impressora-pos.exe</strong> de forma nativa. Basta movê-lo para qualquer máquina Windows e clicar duas vezes para ativá-lo!
                      </p>
                    </div>

                    <div className="mt-4 pt-4 border-t border-slate-900">
                      <div className="flex flex-col gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={18} className="text-success flex-shrink-0" />
                          <p className="text-xs text-slate-400 leading-normal">
                            Após ativar, informe as credenciais de IP e sincronize sua lista para controle preciso dos setores.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB CONTENT: RESTAURANT INFOS */}
      {activeTab === 'restaurant' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-fade-in">
          <section className="md:col-span-8 lg:col-span-6">
            <div className="bg-surface-container-lowest rounded-[24px] p-6 card-shadow">
              <div className="flex items-center gap-3 mb-6">
                <Grid className="text-amber-500" size={24} />
                <div>
                  <h3 className="text-title-large text-on-surface font-bold">Informações do Estabelecimento</h3>
                  <p className="text-body-medium text-on-surface-variant">
                    Estes dados são exibidos nos cupons impressos e outras áreas do sistema.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-caption font-bold text-on-surface mb-2">
                    Nome do Restaurante / Estabelecimento
                  </label>
                  <input 
                    type="text"
                    value={restaurantDetails.name || ''}
                    onChange={(e) => setRestaurantDetails({...restaurantDetails, name: e.target.value})}
                    placeholder="Ex: VENTISETTE PIZZ." 
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 outline-none transition-all text-body-medium font-semibold text-on-surface"
                  />
                  <p className="text-xs text-on-surface-variant mt-1.5 ml-1">
                    Este nome aparecerá no cabeçalho do recibo de pagamento. Limite de preferência a 20 caracteres para ficar alinhado.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-caption font-bold text-on-surface mb-2">
                      Telefone / Contato
                    </label>
                    <input 
                      type="text"
                      value={restaurantDetails.phone || ''}
                      onChange={(e) => setRestaurantDetails({...restaurantDetails, phone: e.target.value})}
                      placeholder="Ex: (11) 98765-4321" 
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 outline-none transition-all text-body-medium font-semibold text-on-surface"
                    />
                  </div>
                  <div>
                    <label className="block text-caption font-bold text-on-surface mb-2">
                      CNPJ (Opcional)
                    </label>
                    <input 
                      type="text"
                      value={restaurantDetails.cnpj || ''}
                      onChange={(e) => setRestaurantDetails({...restaurantDetails, cnpj: e.target.value})}
                      placeholder="Ex: 00.000.000/0001-00" 
                      className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 outline-none transition-all text-body-medium font-semibold text-on-surface"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-caption font-bold text-on-surface mb-2">
                    Endereço Completo
                  </label>
                  <input 
                    type="text"
                    value={restaurantDetails.address || ''}
                    onChange={(e) => setRestaurantDetails({...restaurantDetails, address: e.target.value})}
                    placeholder="Ex: Av. Paulista, 1000 - São Paulo/SP" 
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 outline-none transition-all text-body-medium font-semibold text-on-surface"
                  />
                </div>

                <div>
                  <label className="block text-caption font-bold text-on-surface mb-2">
                    Instagram / Redes Sociais
                  </label>
                  <input 
                    type="text"
                    value={restaurantDetails.instagram || ''}
                    onChange={(e) => setRestaurantDetails({...restaurantDetails, instagram: e.target.value})}
                    placeholder="Ex: @seurestaurante" 
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 outline-none transition-all text-body-medium font-semibold text-on-surface"
                  />
                </div>

                <div>
                  <label className="block text-caption font-bold text-on-surface mb-2">
                    Mensagem de Rodapé do Cupom
                  </label>
                  <input 
                    type="text"
                    value={restaurantDetails.footerMessage || ''}
                    onChange={(e) => setRestaurantDetails({...restaurantDetails, footerMessage: e.target.value})}
                    placeholder="Ex: Obrigado pela preferência! Volte sempre." 
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 outline-none transition-all text-body-medium font-semibold text-on-surface"
                  />
                  <p className="text-xs text-on-surface-variant mt-1.5 ml-1">
                    Esta mensagem aparecerá no final dos boletos de pagamentos impressos.
                  </p>
                </div>
                
                <div className="pt-4 border-t border-outline-variant/30 flex justify-end">
                  <button
                    onClick={handleSavePrinters}
                    disabled={isSavingPrinters}
                    className="bg-amber-500 text-white rounded-xl px-6 py-2.5 font-bold hover:bg-amber-600 active:scale-95 transition-all text-sm flex items-center gap-2"
                  >
                    <Save size={18} />
                    {isSavingPrinters ? 'Salvando...' : 'Salvar Informações'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* 6. TAB CONTENT: ABACATE PAY CONFIGS */}
      {activeTab === 'abacatepay' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 animate-fade-in">
          <section className="md:col-span-8 lg:col-span-6">
            <div className="bg-surface-container-lowest rounded-[24px] p-6 card-shadow">
              <div className="flex items-center gap-3 mb-6">
                <CreditCard className="text-lime-500" size={24} />
                <div>
                  <h3 className="text-title-large text-on-surface font-bold">Configuração Abacate Pay</h3>
                  <p className="text-body-medium text-on-surface-variant">
                    Configure as credenciais de API para habilitar pagamentos Pix online transparente no Totem.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-lime-500/10 border border-lime-500/20 rounded-2xl p-4 text-on-surface">
                  <h4 className="text-sm font-bold text-lime-600 mb-1 flex items-center gap-1.5">
                    <CheckCircle2 size={16} /> Como funciona o fluxo de pagamentos?
                  </h4>
                  <ul className="text-xs text-on-surface-variant space-y-1.5 list-disc pl-4 leading-relaxed">
                    <li><strong>Pix Online Transparente:</strong> O cliente visualiza o QR Code dinâmico do Pix diretamente na tela do Totem de Autoatendimento. O pagamento é processado pela API e, assim que compensado, a comanda ganha um <strong className="text-primary font-bold">ícone de Sifrão (💰)</strong> no Caixa para identificação visual imediata. O atendente apenas dá baixa no sistema.</li>
                    <li><strong>Dinheiro ou Cartão:</strong> O cliente finaliza o pedido no Totem e é direcionado ao Caixa para efetuar o pagamento presencial. Quando o atendente der baixa, o pedido do Totem é liberado para a tela de acompanhamento.</li>
                  </ul>
                </div>

                <div>
                  <label className="block text-caption font-bold text-on-surface mb-2">
                    Chave de API Token (API Key)
                  </label>
                  <input 
                    type="password"
                    value={abacatePayConfig.apiKey || ''}
                    onChange={(e) => setAbacatePayConfig({ apiKey: e.target.value })}
                    placeholder="Ex: abc_prod_..." 
                    className="w-full bg-surface border border-outline-variant rounded-xl px-4 py-3 focus:border-lime-500 focus:ring-1 focus:ring-lime-500/20 outline-none transition-all text-body-medium font-semibold text-on-surface"
                  />
                  <p className="text-xs text-on-surface-variant mt-1.5 ml-1 leading-relaxed">
                    Você pode obter seu token de produção ou sandbox acessando o painel de desenvolvedor no site do <strong>Abacate Pay</strong> (Configurações &gt; API &gt; Criar Nova Chave de API).
                  </p>
                </div>

                <div className="pt-4 border-t border-outline-variant/30 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      if (!abacatePayConfig.apiKey) {
                        setAlertState({ isOpen: true, title: 'Insira uma chave', message: 'Por favor, insira uma Chave de API antes de testar.' });
                        return;
                      }
                      setAlertState({ isOpen: true, title: 'Teste de Conexão', message: 'Conexão com a API do Abacate Pay verificada com sucesso (Simulação)!' });
                    }}
                    type="button"
                    className="border border-outline-variant text-on-surface hover:bg-surface-variant rounded-xl px-5 py-2.5 font-bold active:scale-95 transition-all text-sm flex items-center gap-2 cursor-pointer"
                  >
                    <Play size={16} className="text-lime-500" />
                    Testar Conexão
                  </button>

                  <button
                    onClick={handleSaveAbacatePay}
                    disabled={isSavingAbacate}
                    className="bg-lime-500 text-black rounded-xl px-6 py-2.5 font-bold hover:bg-lime-600 active:scale-95 transition-all text-sm flex items-center gap-2 cursor-pointer"
                  >
                    <Save size={18} />
                    {isSavingAbacate ? 'Salvando...' : 'Salvar Configurações'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
      
      <AlertModal 
        isOpen={alertState.isOpen}
        title={alertState.title}
        message={alertState.message}
        onConfirm={alertState.onConfirm}
        onClose={() => setAlertState({ isOpen: false, title: '', message: '', onConfirm: undefined })}
      />
    </div>
  );
}

