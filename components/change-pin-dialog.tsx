'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Eye, EyeOff, KeyRound } from 'lucide-react';

interface ChangePinDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export function ChangePinDialog({ isOpen, onClose, userId }: ChangePinDialogProps) {
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showOldPin, setShowOldPin] = useState(false);
  const [showNewPin, setShowNewPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handlePinInput = (value: string, setter: (val: string) => void) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 4);
    setter(cleaned);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPin.length !== 4) {
      setError('PIN baru harus 4 digit');
      return;
    }

    if (newPin !== confirmPin) {
      setError('Konfirmasi PIN tidak cocok');
      return;
    }

    if (newPin === oldPin) {
      setError('PIN baru tidak boleh sama dengan PIN lama');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, oldPin, newPin }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        onClose();
        resetForm();
      }, 1500);
    } catch (err) {
      setError('Terjadi kesalahan');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setOldPin('');
    setNewPin('');
    setConfirmPin('');
    setError('');
    setSuccess(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-md w-full shadow-xl">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-green-600" />
            <h2 className="text-lg font-semibold">Ganti PIN</h2>
          </div>
          <button
            onClick={() => { onClose(); resetForm(); }}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded text-sm">
              PIN berhasil diubah!
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PIN Lama
            </label>
            <div className="relative">
              <input
                type={showOldPin ? 'text' : 'password'}
                value={oldPin}
                onChange={(e) => handlePinInput(e.target.value, setOldPin)}
                className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-center text-2xl tracking-widest font-mono"
                placeholder="****"
                inputMode="numeric"
                maxLength={4}
                required
                disabled={success}
              />
              <button
                type="button"
                onClick={() => setShowOldPin(!showOldPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showOldPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PIN Baru (4 digit)
            </label>
            <div className="relative">
              <input
                type={showNewPin ? 'text' : 'password'}
                value={newPin}
                onChange={(e) => handlePinInput(e.target.value, setNewPin)}
                className="w-full px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-center text-2xl tracking-widest font-mono"
                placeholder="****"
                inputMode="numeric"
                maxLength={4}
                required
                disabled={success}
              />
              <button
                type="button"
                onClick={() => setShowNewPin(!showNewPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNewPin ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Konfirmasi PIN Baru
            </label>
            <input
              type="password"
              value={confirmPin}
              onChange={(e) => handlePinInput(e.target.value, setConfirmPin)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 text-center text-2xl tracking-widest font-mono"
              placeholder="****"
              inputMode="numeric"
              maxLength={4}
              required
              disabled={success}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { onClose(); resetForm(); }}
              className="flex-1"
              disabled={loading}
            >
              Batal
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-green-600 hover:bg-green-700"
              disabled={loading || success}
            >
              {loading ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
