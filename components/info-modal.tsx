'use client';

import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

type ModalType = 'info' | 'success' | 'warning' | 'error';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: ModalType;
}

export function InfoModal({ isOpen, onClose, title, message, type = 'info' }: InfoModalProps) {
  if (!isOpen) return null;

  const config = {
    info: {
      icon: Info,
      bgColor: 'bg-blue-100',
      iconColor: 'text-blue-600',
      borderColor: 'border-blue-200',
      btnColor: 'bg-blue-600 hover:bg-blue-700',
    },
    success: {
      icon: CheckCircle,
      bgColor: 'bg-green-100',
      iconColor: 'text-green-600',
      borderColor: 'border-green-200',
      btnColor: 'bg-green-600 hover:bg-green-700',
    },
    warning: {
      icon: AlertTriangle,
      bgColor: 'bg-yellow-100',
      iconColor: 'text-yellow-600',
      borderColor: 'border-yellow-200',
      btnColor: 'bg-yellow-600 hover:bg-yellow-700',
    },
    error: {
      icon: AlertCircle,
      bgColor: 'bg-red-100',
      iconColor: 'text-red-600',
      borderColor: 'border-red-200',
      btnColor: 'bg-red-600 hover:bg-red-700',
    },
  };

  const { icon: Icon, bgColor, iconColor, borderColor, btnColor } = config[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className={`${bgColor} ${borderColor} border-b px-4 py-3 flex items-center gap-3`}>
          <div className={`p-2 rounded-full bg-white/80`}>
            <Icon className={`h-5 w-5 ${iconColor}`} />
          </div>
          <h3 className="font-semibold text-gray-900 flex-1">{title}</h3>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/50 transition-colors"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
            {message}
          </p>
        </div>
        
        {/* Footer */}
        <div className="px-4 pb-4">
          <button
            onClick={onClose}
            className={`w-full py-2.5 text-white text-sm font-medium rounded-lg transition-colors ${btnColor}`}
            style={{ color: 'white' }}
          >
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}
