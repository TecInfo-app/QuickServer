import React, { useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Lock } from 'lucide-react';
import { getActiveCaixa, addCaixaMovement, closeCaixa } from '../../utils/caixa';
import { getCurrentUser, getStoredTransactions } from '../../utils/db';
import { printCaixaShiftReport } from '../../utils/printer';
import CaixaOverlay from './CaixaOverlay';

export default function CaixaOperations() {
  const [modalType, setModalType] = useState<'' | 'SANGRIA' | 'SUPRIMENTO' | 'FECHAR'>('');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');

  const [declared, setDeclared] = useState({ money: '', credit: '', debit: '', pix: '', other: '', observation: '' });
  const [showOverlayAsModal, setShowOverlayAsModal] = useState(false);

  const activeCaixa = getActiveCaixa();
  
  if (!activeCaixa) {
    return (
      <>
        <section className="mb-8 p-6 bg-surface-container-low rounded-[24px] border border-outline-variant/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="text-headline-md font-bold text-on-surface mb-2">Caixa Fechado</h3>
            <p className="text-body-lg text-on-surface-variant">O caixa está fechado no momento. Abra o caixa para usar os recursos financeiros.</p>
          </div>
          <button 
            onClick={() => setShowOverlayAsModal(true)}
            className="bg-primary text-on-primary font-bold py-3 px-6 rounded-xl hover:brightness-95 transition-all"
          >
            Abrir Caixa
          </button>
        </section>

        {showOverlayAsModal && (
          <div className="fixed inset-0 z-[60]">
            <CaixaOverlay onOpen={() => {
              setShowOverlayAsModal(false);
              window.location.reload();
            }} />
          </div>
        )}
      </>
    );
  }

  const handleMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (modalType !== 'SANGRIA' && modalType !== 'SUPRIMENTO') return;

    const val = parseFloat(value.replace(',', '.'));
    if (isNaN(val) || val <= 0) return;

    addCaixaMovement({
      type: modalType,
      value: val,
      reason,
      operator: getCurrentUser()?.name || 'Operador'
    });

    setModalType('');
    setValue('');
    setReason('');
    alert(`${modalType} registrada com sucesso!`);
  };

  const calculateSystemValues = () => {
    const transactions = getStoredTransactions().filter(t => t.caixaId === activeCaixa.id);
    let money = activeCaixa.initialValue;
    let credit = 0;
    let debit = 0;
    let pix = 0;
    let other = 0;

    activeCaixa.movements.forEach(m => {
      if (m.type === 'SUPRIMENTO') money += m.value;
      if (m.type === 'SANGRIA') money -= m.value;
    });

    transactions.forEach(t => {
      if (t.method === 'Dinheiro') money += t.total;
      else if (t.method === 'Cartão') credit += t.total; // Treating Cartão as credit generically unless debit specified
      else if (t.method === 'Pix') pix += t.total;
      else other += t.total;
    });

    return { money, credit, debit, pix, other };
  };

  const handleClose = (e: React.FormEvent) => {
    e.preventDefault();
    
    const declaredValues = {
      money: parseFloat(declared.money.replace(',', '.')) || 0,
      credit: parseFloat(declared.credit.replace(',', '.')) || 0,
      debit: parseFloat(declared.debit.replace(',', '.')) || 0,
      pix: parseFloat(declared.pix.replace(',', '.')) || 0,
      other: parseFloat(declared.other.replace(',', '.')) || 0,
      observation: declared.observation
    };

    const systemValues = calculateSystemValues();

    try {
      const closedShift = closeCaixa(declaredValues, systemValues, getCurrentUser()?.name || 'Operador');
      printCaixaShiftReport(closedShift).catch(err => console.error(err));
      alert('Caixa fechado com sucesso! Relatório de Turno enviado para impressão.');
      window.location.reload();
    } catch (e) {
      alert('Erro ao fechar caixa');
    }
  };

  return (
    <>
      <section className="mb-8 p-4 bg-surface-container-low rounded-[24px]">
        <h3 className="text-headline-md font-bold mb-4">Operações de Caixa</h3>
        <div className="grid grid-cols-3 gap-4">
          <button onClick={() => setModalType('SANGRIA')} className="flex flex-col items-center justify-center p-4 rounded-xl bg-error-container text-on-error-container font-bold hover:brightness-95 transition-all">
            <ArrowDownCircle size={32} className="mb-2" />
            Sangria
          </button>
          <button onClick={() => setModalType('SUPRIMENTO')} className="flex flex-col items-center justify-center p-4 rounded-xl bg-success-container/70 text-success font-bold hover:brightness-95 transition-all">
            <ArrowUpCircle size={32} className="mb-2" />
            Suprimento
          </button>
          <button onClick={() => setModalType('FECHAR')} className="flex flex-col items-center justify-center p-4 rounded-xl bg-surface-variant text-on-surface hover:brightness-95 transition-all">
            <Lock size={32} className="mb-2" />
            <span className="font-bold">Fechar Caixa</span>
          </button>
        </div>
      </section>

      {/* Modal for Sangria / Suprimento */}
      {(modalType === 'SANGRIA' || modalType === 'SUPRIMENTO') && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface p-6 rounded-3xl w-full max-w-md">
            <h3 className="text-title-large font-bold mb-4">Registrar {modalType}</h3>
            <form onSubmit={handleMovement} className="space-y-4">
              <div>
                <label className="block text-caption font-bold mb-1">Valor (R$)</label>
                <input 
                  type="number" step="0.01" min="0" required
                  value={value} onChange={e => setValue(e.target.value)}
                  className="w-full border p-3 rounded-xl focus:border-primary outline-none bg-surface-container-lowest"
                />
              </div>
              <div>
                <label className="block text-caption font-bold mb-1">Motivo / Justificativa</label>
                <input 
                  type="text" required
                  value={reason} onChange={e => setReason(e.target.value)}
                  className="w-full border p-3 rounded-xl focus:border-primary outline-none bg-surface-container-lowest"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setModalType('')} className="flex-1 py-3 bg-surface-variant rounded-xl font-bold">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-bold">Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Fechamento */}
      {modalType === 'FECHAR' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-surface p-6 rounded-3xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-title-large font-bold mb-4">Fechamento de Caixa Cego</h3>
            <p className="text-body text-on-surface-variant mb-6">Conte a gaveta e informe os valores físicos exatos.</p>
            <form onSubmit={handleClose} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-caption font-bold mb-1">Dinheiro (R$)</label>
                  <input type="number" step="0.01" min="0" value={declared.money} onChange={e => setDeclared({...declared, money: e.target.value})} className="w-full border p-3 rounded-xl focus:border-primary outline-none bg-surface-container-lowest" />
                </div>
                <div>
                  <label className="block text-caption font-bold mb-1">Cartão de Crédito (R$)</label>
                  <input type="number" step="0.01" min="0" value={declared.credit} onChange={e => setDeclared({...declared, credit: e.target.value})} className="w-full border p-3 rounded-xl focus:border-primary outline-none bg-surface-container-lowest" />
                </div>
                <div>
                  <label className="block text-caption font-bold mb-1">Cartão de Débito (R$)</label>
                  <input type="number" step="0.01" min="0" value={declared.debit} onChange={e => setDeclared({...declared, debit: e.target.value})} className="w-full border p-3 rounded-xl focus:border-primary outline-none bg-surface-container-lowest" />
                </div>
                <div>
                  <label className="block text-caption font-bold mb-1">Pix (R$)</label>
                  <input type="number" step="0.01" min="0" value={declared.pix} onChange={e => setDeclared({...declared, pix: e.target.value})} className="w-full border p-3 rounded-xl focus:border-primary outline-none bg-surface-container-lowest" />
                </div>
                <div>
                  <label className="block text-caption font-bold mb-1">Outros / Vouchers (R$)</label>
                  <input type="number" step="0.01" min="0" value={declared.other} onChange={e => setDeclared({...declared, other: e.target.value})} className="w-full border p-3 rounded-xl focus:border-primary outline-none bg-surface-container-lowest" />
                </div>
              </div>
              <div className="pt-2">
                <label className="block text-caption font-bold mb-1">Observações Finais</label>
                <textarea rows={2} value={declared.observation} onChange={e => setDeclared({...declared, observation: e.target.value})} className="w-full border p-3 rounded-xl focus:border-primary outline-none bg-surface-container-lowest" />
              </div>
              
              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setModalType('')} className="flex-1 py-3 bg-surface-variant rounded-xl font-bold">Voltar</button>
                <button type="submit" className="flex-1 py-3 bg-error text-onError rounded-xl font-bold">Encerrar Turno</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
