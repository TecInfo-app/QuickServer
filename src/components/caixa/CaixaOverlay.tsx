import React, { useState } from 'react';
import { getActiveCaixa, openCaixa } from '../../utils/caixa';
import { getCurrentUser } from '../../utils/db';
import { LockKeyhole, Search, LockOpen } from 'lucide-react';

export default function CaixaOverlay({ onOpen }: { onOpen: () => void }) {
  const [initialValue, setInitialValue] = useState<string>('');
  const [shift, setShift] = useState<string>('Manhã / Almoço');
  const user = getCurrentUser();

  const handleOpen = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(initialValue.replace(',', '.'));
    if (isNaN(val)) return;

    try {
      openCaixa(shift, val, user?.name || 'Operador');
      onOpen(); // Trigger re-render to remove overlay
    } catch (e) {
      alert("Erro ao abrir caixa");
    }
  };

  return (
    <div className="fixed inset-0 bg-surface/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest p-8 rounded-3xl md:w-[480px] w-full card-shadow border border-outline-variant/30 text-center relative">
        <div className="w-20 h-20 bg-error-container/20 text-error rounded-full flex items-center justify-center mx-auto mb-6">
          <LockKeyhole size={40} />
        </div>
        <h2 className="text-headline-md font-bold text-on-surface mb-2">Caixa Fechado</h2>
        <p className="text-body-lg text-on-surface-variant mb-6">
          O sistema de PDV está bloqueado. Para iniciar as vendas e emitir comandas, abra o caixa informando o troco inicial.
        </p>

        <form onSubmit={handleOpen} className="space-y-4 text-left">
          <div>
            <label className="block text-caption font-bold text-on-surface-variant mb-1 ml-1">Turno</label>
            <select 
              value={shift} 
              onChange={e => setShift(e.target.value)}
              className="w-full bg-surface text-on-surface border border-outline-variant p-4 rounded-xl focus:border-secondary outline-none transition-all appearance-none font-medium"
            >
              <option value="Manhã / Almoço">Manhã / Almoço</option>
              <option value="Tarde">Tarde</option>
              <option value="Noite">Noite</option>
              <option value="Madrugada">Madrugada</option>
            </select>
          </div>
          <div>
            <label className="block text-caption font-bold text-on-surface-variant mb-1 ml-1">Valor de Abertura (Troco em Caixa)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">R$</span>
              <input 
                type="number" 
                step="0.01"
                min="0"
                required
                value={initialValue}
                onChange={e => setInitialValue(e.target.value)}
                placeholder="0.00"
                className="w-full bg-surface text-on-surface border border-outline-variant p-4 pl-12 rounded-xl focus:border-secondary outline-none transition-all font-medium"
              />
            </div>
          </div>
          <button 
            type="submit"
            className="w-full bg-primary text-on-primary font-bold py-4 rounded-xl hover:brightness-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2"
          >
            <LockOpen size={20} />
            Abrir Caixa e Iniciar
          </button>
        </form>
      </div>
    </div>
  );
}
