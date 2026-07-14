import React from 'react';

interface AlertModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
}

export default function AlertModal({ 
  isOpen, 
  title = 'Aviso', 
  message, 
  onClose, 
  onConfirm, 
  confirmText = 'OK', 
  cancelText = 'Cancelar' 
}: AlertModalProps) {
  if (!isOpen) return null;

  const isReceipt = title.toLowerCase().includes('imprimir') || 
                    title.toLowerCase().includes('comprovante') || 
                    title.toLowerCase().includes('cupom') ||
                    message.includes('====') ||
                    message.includes('----');

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className={`bg-surface p-6 rounded-2xl w-full ${isReceipt ? 'max-w-lg' : 'max-w-sm'} shadow-xl border border-surface-variant/20 animate-in fade-in zoom-in-95 duration-150`}>
        <h2 className="text-xl font-bold mb-4 text-on-surface">{title}</h2>
        
        {isReceipt ? (
          <div className="bg-surface-container-low p-4 rounded-xl border border-surface-variant/30 mb-6 font-mono text-[11px] sm:text-xs text-on-surface text-left whitespace-pre-wrap overflow-x-auto leading-relaxed break-all">
            {message}
          </div>
        ) : (
          <p className="text-on-surface-variant mb-6 text-sm whitespace-pre-line">{message}</p>
        )}
        
        <div className="flex gap-3">
          {onConfirm ? (
            <>
              <button 
                onClick={onClose} 
                className="flex-1 p-3 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-semibold transition-all"
              >
                {cancelText}
              </button>
              <button 
                onClick={() => {
                  onConfirm();
                  onClose();
                }} 
                className="flex-1 p-3 rounded-xl bg-primary text-on-primary font-bold hover:brightness-95 active:scale-95 transition-all"
              >
                {confirmText}
              </button>
            </>
          ) : (
            <button 
              onClick={onClose} 
              className="w-full p-3 rounded-xl bg-primary text-on-primary font-bold hover:brightness-95 active:scale-95 transition-all"
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
