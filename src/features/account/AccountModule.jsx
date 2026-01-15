import { useMemo, useState } from 'react';
import { KeyRound, Save, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import * as api from '../../api.js';

export default function AccountModule() {
  const { user, logout } = useAuth();
  const username = user?.username || '';
  const userId = user?.id || user?._id || '';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const canSubmit = useMemo(() => {
    return (
      !!username &&
      !!userId &&
      currentPassword.length >= 1 &&
      newPassword.length >= 6 &&
      confirmPassword.length >= 6 &&
      newPassword === confirmPassword
    );
  }, [username, userId, currentPassword, newPassword, confirmPassword]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');

    if (!username || !userId) {
      setMessage('No se detectó tu usuario. Cierra sesión e inicia de nuevo.');
      return;
    }

    if (newPassword.length < 6) {
      setMessage('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('La confirmación no coincide.');
      return;
    }

    setSaving(true);
    try {
      // 1) Validar contraseña actual
      const loginRes = await api.loginUser(username, currentPassword);
      if (!loginRes?.success) {
        setMessage('Contraseña actual incorrecta.');
        return;
      }

      // 2) Actualizar contraseña
      await api.updateUserPassword(userId, newPassword);

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('✅ Contraseña actualizada. Recomendado: cerrar sesión e iniciar de nuevo.');
    } catch (err) {
      setMessage(`Error: ${err?.message || 'No se pudo actualizar la contraseña'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
          <KeyRound className="text-blue-600" size={20} />
          Mi Cuenta
        </h2>
        <p className="text-sm text-slate-600">
          Cambia tu contraseña de acceso.
        </p>

        <div className="mt-4 text-sm text-slate-700">
          <span className="font-bold">Usuario:</span> {username || '—'}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="password"
              placeholder="Contraseña actual"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="px-4 py-2 border rounded-lg"
              autoComplete="current-password"
              required
            />
            <div className="hidden md:block" />
            <input
              type="password"
              placeholder="Nueva contraseña (mínimo 6)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="px-4 py-2 border rounded-lg"
              autoComplete="new-password"
              required
              minLength={6}
            />
            <input
              type="password"
              placeholder="Confirmar nueva contraseña"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="px-4 py-2 border rounded-lg"
              autoComplete="new-password"
              required
              minLength={6}
            />
          </div>

          {message && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700">
              {message}
            </div>
          )}

          <div className="flex flex-col md:flex-row gap-3">
            <button
              type="submit"
              disabled={!canSubmit || saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-slate-400 flex items-center justify-center gap-2"
            >
              <Save size={16} />
              {saving ? 'Guardando…' : 'Guardar contraseña'}
            </button>

            <button
              type="button"
              onClick={logout}
              className="px-6 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 flex items-center justify-center gap-2"
              title="Recomendado después de cambiar contraseña"
            >
              <ShieldCheck size={16} />
              Cerrar sesión
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

