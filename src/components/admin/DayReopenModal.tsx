import React, { useState, useEffect } from 'react';
import { X, Unlock, AlertCircle } from 'lucide-react';

interface DayReopenModalProps {
  isOpen: boolean;
  onClose: () => void;
  dateString: string;
  onConfirmReopen: (justification: string) => Promise<void>;
}

export const DayReopenModal: React.FC<DayReopenModalProps> = ({
  isOpen,
  onClose,
  dateString,
  onConfirmReopen,
}) => {
  const [justification, setJustification] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setJustification('');
    setError(null);
    setIsSubmitting(false);
  }, [isOpen, dateString]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!justification.trim() || justification.trim().length < 5) {
      setError('Veuillez fournir un motif valable (au moins 5 caractères).');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onConfirmReopen(justification.trim());
      onClose();
    } catch (err) {
      // Afficher tel quel le message d'erreur renvoyé par le serveur (en français)
      setError(err instanceof Error ? err.message : 'Erreur lors de la réouverture de la journée.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 animate-in fade-in duration-200">
      <div className="bg-[#121324] border border-white/10 w-full max-w-sm rounded-3xl p-5 shadow-2xl text-white relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-amber-600/20 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between pb-3 border-b border-white/10 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Unlock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-tight">Réouverture de journée</h2>
              <p className="text-[10px] text-slate-400">{dateString}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 pt-3">
          <p className="text-xs text-slate-300 leading-relaxed">
            La modification d'une journée déjà clôturée requiert obligatoirement une justification
            formelle. Cette action sera inscrite dans le journal d'audit immuable par le serveur.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">
              Justification obligatoire de la réouverture :
            </label>
            <textarea
              required
              rows={3}
              disabled={isSubmitting}
              value={justification}
              onChange={(e) => {
                setJustification(e.target.value);
                setError(null);
              }}
              placeholder="Ex: Rectification d'une erreur de saisie sur le solde final Vodacom..."
              className="w-full bg-[#0a0a14] border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="bg-red-950/65 border border-red-500/35 p-2.5 rounded-xl flex items-start gap-2 text-red-200 text-xs"
            >
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 active:scale-98 text-white text-xs font-bold rounded-xl shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2 transition disabled:opacity-50"
          >
            <Unlock className="w-4 h-4" />
            <span>
              {isSubmitting ? 'Réouverture serveur en cours...' : 'Autoriser la réouverture'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};
