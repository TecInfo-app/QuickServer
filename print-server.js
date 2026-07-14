const express = require('express');
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

// 1. ROTA: Buscar impressoras
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
        exec('powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"', (err2, stdout2) => {
          if (err2) {
            exec('wmic printer get name', (err3, stdout3) => {
              if (err3) return res.json({ printers: ['Default'] });
              const printers = stdout3.split('\r\n').map(l => l.trim()).filter(l => l && l !== 'Name');
              return res.json({ printers: printers.length > 0 ? printers : ['Default'] });
            });
            return;
          }
          const printers = stdout2.split('\r\n').map(l => l.trim()).filter(l => l);
          return res.json({ printers: printers.length > 0 ? printers : ['Default'] });
        });
        return;
      }
      return res.status(500).send('Erro ao buscar impressoras: ' + err.message);
    }

    const printers = stdout.split('\n').map(l => l.trim()).filter(l => l);
    if (printers.length === 0) printers.push('Default');
    res.json({ printers });
  });
});

// 2. ROTA: Impressão com Forçamento de Largura Total
app.post('/print', (req, res) => {
  const { text, printer, sector } = req.body;
  if (!text) {
    return res.status(400).send('Falta o texto do cupom.');
  }

  console.log('\n--- Requisicao de Impressao para [' + (sector || 'Geral') + '] ---');
  console.log('Fila / IP do Dispositivo: ' + (printer || 'Padrao'));

  // A) Conexão direta TCP/IP Ethernet (Por exemplo: 192.168.1.100 ou 192.168.1.100:9100)
  // Se contiver barras (\ ou /) é uma impressora de rede compartilhada via spooler (ex: \\192.168.1.202\IMPRESSORA)
  const isNetworkPath = printer && (printer.includes('\\') || printer.includes('/'));
  const isDirectIP = printer && (printer.includes('.') || printer.includes(':')) && !isNetworkPath;

  if (isDirectIP) {
    const host = printer.split(':')[0];
    const port = parseInt(printer.split(':')[1] || '9100');
    console.log('Enviando via Socket para ' + host + ':' + port + '...');
    
    const client = new net.Socket();
    client.connect(port, host, () => {
      client.write(Buffer.from([0x1B, 0x40])); // Inicializa
      client.write(text + '\n\n\n\n\n'); 
      client.write(Buffer.from([0x1D, 0x56, 0x41, 0x03])); // Guilhotina
      client.end();
      return res.send({ success: true, message: 'Impresso via TCP IP.' });
    });
    
    client.on('error', (err) => {
      console.error('Falha de transmissão IP:', err.message);
      return res.status(500).send('Erro de Rede: ' + err.message);
    });
    return;
  }

  // B) Dispositivo USB / Local (Modificado para evitar o esmagamento centralizado)
  const tempFile = path.join(os.tmpdir(), `ticket_${Date.now()}.txt`);
  
  // Gravamos apenas o texto limpo com o avanço de linhas necessário
  fs.writeFileSync(tempFile, text + '\n\n\n\n\r\n', 'utf-8');

  let command = '';
  if (process.platform === 'win32') {
    const printerName = printer && printer !== 'Default' ? printer : '';
    
    if (printerName) {
      // Método Alternativo 1: Envia diretamente em RAW para a fila ignorando margens do Windows
      command = `notepad.exe /pt "${tempFile}" "${printerName}"`;
    } else {
      command = `notepad.exe /p "${tempFile}"`;
    }
  } else {
    command = printer && printer !== 'Default' ? `lp -d "${printer}" "${tempFile}"` : `lp "${tempFile}"`;
  }

  console.log('Executando comando físico: ' + command);

  exec(command, (err) => {
    // Exclui o rascunho temporário após 5 segundos
    setTimeout(() => {
      try { fs.unlinkSync(tempFile); } catch(e) {}
    }, 5000);

    if (err) {
      console.error('Erro no método principal, tentando fallback via Powershell:', err);
      // Fallback em caso de erro no comando principal
      if (process.platform === 'win32') {
         const pName = printer && printer !== 'Default' ? ` -Name '${printer}'` : '';
         const fallbackCmd = `powershell -Command "Get-Content -Path '${tempFile}' | Out-Printer${pName}"`;
         exec(fallbackCmd, (err2) => {
             if (err2) return res.status(500).send('Falha em todos os métodos locais.');
             return res.send({ success: true, note: 'Impresso via Fallback' });
         });
         return;
      }
      return res.status(500).send('Falha no comando de spool: ' + err.message);
    }
    console.log('Sucesso: Comando enviado para a impressora local.');
    res.send({ success: true });
  });
});

// 3. Inicialização do Servidor
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
});
