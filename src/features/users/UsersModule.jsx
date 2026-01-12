import { useState, useEffect } from 'react';
import { Edit, Trash2, Key } from 'lucide-react';
import * as api from '../../api.js';

export default function UsersModule() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({ 
    username: '', 
    password: '', 
    name: '', 
    role: 'vendedor', 
    email: '' 
  });
  const [creating, setCreating] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await api.getAllUsers();
      setUsers(data.map(u => ({ id: u._id || u.id, ...u })));
    } catch (error) {
      console.error('Error cargando usuarios:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.createUser(
        newUser.username,
        newUser.password,
        newUser.name,
        newUser.role,
        newUser.email
      );
      setNewUser({ username: '', password: '', name: '', role: 'vendedor', email: '' });
      loadUsers();
    } catch (error) {
      alert('Error creando usuario: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
    try {
      await api.deleteUser(userId);
      loadUsers();
    } catch (error) {
      alert('Error eliminando usuario: ' + error.message);
    }
  };

  const handleChangePassword = async (userId) => {
    const password = prompt('Ingresa la nueva contraseña (mínimo 6 caracteres):');
    if (!password || password.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    
    setChangingPassword(true);
    try {
      await api.updateUserPassword(userId, password);
      alert('Contraseña actualizada correctamente');
      setNewPassword('');
    } catch (error) {
      alert('Error actualizando contraseña: ' + error.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleUpdateUser = async (userId, updates) => {
    try {
      await api.updateUser(userId, updates);
      loadUsers();
      setEditingUser(null);
    } catch (error) {
      alert('Error actualizando usuario: ' + error.message);
    }
  };

  if (loading) {
    return <div className="text-center p-8">Cargando usuarios...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Formulario de creación */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-4">Crear Usuario</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Usuario"
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              className="px-4 py-2 border rounded-lg"
              required
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              className="px-4 py-2 border rounded-lg"
              required
            />
            <input
              type="text"
              placeholder="Nombre"
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              className="px-4 py-2 border rounded-lg"
              required
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="px-4 py-2 border rounded-lg"
            >
              <option value="vendedor">Vendedor</option>
              <option value="admin">Admin</option>
              <option value="user">Usuario</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={creating}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-slate-400"
          >
            {creating ? 'Creando...' : 'Crear Usuario'}
          </button>
        </form>
      </div>

      {/* Lista de usuarios */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h2 className="text-xl font-bold mb-4">Usuarios ({users.length})</h2>
        <div className="space-y-2">
          {users.map((user) => (
            <div key={user.id} className="flex justify-between items-center p-4 border rounded-lg hover:bg-slate-50">
              <div className="flex-1">
                <p className="font-bold">{user.name}</p>
                <p className="text-sm text-slate-600">{user.username} • {user.role}</p>
                {user.email && <p className="text-xs text-slate-500">{user.email}</p>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleChangePassword(user.id)}
                  disabled={changingPassword}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-slate-400 flex items-center gap-1"
                  title="Cambiar contraseña"
                >
                  <Key size={16} />
                  Contraseña
                </button>
                <button
                  onClick={() => handleDelete(user.id)}
                  className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 flex items-center gap-1"
                  title="Eliminar usuario"
                >
                  <Trash2 size={16} />
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

