import { useState, useEffect } from 'react';
import { Edit, Trash2, Key } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext.jsx';
import * as api from '../../api.js';

export default function UsersModule() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newUser, setNewUser] = useState({ 
    username: '', 
    password: '', 
    name: '', 
    role: 'vendedor', 
    email: '',
    region: '' 
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
    
    // Validación: rol usuarios solo puede crear vendedores
    if (isUsuariosRole && newUser.role !== 'vendedor') {
      alert('Solo puedes crear usuarios con perfil de vendedor');
      return;
    }
    
    setCreating(true);
    try {
      // Validar que regionales tenga región asignada
      if (newUser.role === 'regionales' && !newUser.region) {
        alert('Los usuarios regionales deben tener una región asignada');
        return;
      }
      
      await api.createUser(
        newUser.username,
        newUser.password,
        newUser.name,
        newUser.role,
        newUser.email,
        newUser.region
      );
      setNewUser({ username: '', password: '', name: '', role: 'vendedor', email: '', region: '' });
      loadUsers();
    } catch (error) {
      alert('Error creando usuario: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (userId) => {
    // Rol usuarios solo puede eliminar vendedores
    if (isUsuariosRole) {
      const userToDelete = users.find(u => u.id === userId);
      if (userToDelete && userToDelete.role !== 'vendedor') {
        alert('Solo puedes eliminar usuarios con perfil de vendedor');
        return;
      }
    }
    
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
    try {
      await api.deleteUser(userId);
      loadUsers();
    } catch (error) {
      alert('Error eliminando usuario: ' + error.message);
    }
  };

  const handleChangePassword = async (userId) => {
    // Rol usuarios solo puede cambiar contraseñas de vendedores
    if (isUsuariosRole) {
      const userToModify = users.find(u => u.id === userId);
      if (userToModify && userToModify.role !== 'vendedor') {
        alert('Solo puedes cambiar contraseñas de usuarios con perfil de vendedor');
        return;
      }
    }
    
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

  // El rol director y mesa_control no pueden crear usuarios
  // El rol usuarios puede crear usuarios pero solo vendedores
  const canCreateUsers = currentUser?.role === 'admin' || currentUser?.role === 'admin_general' || currentUser?.role === 'usuarios';
  const isUsuariosRole = currentUser?.role === 'usuarios';
  const isMesaControlRole = currentUser?.role === 'mesa_control';

  return (
    <div className="space-y-4">
      {/* Formulario de creación - Solo para admin y rol usuarios */}
      {canCreateUsers && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold mb-4">Crear Usuario</h2>
          {isUsuariosRole && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800">
                ℹ️ <strong>Permisos limitados:</strong> Solo puedes crear, modificar y eliminar usuarios con perfil de <strong>Vendedor</strong>.
              </p>
            </div>
          )}
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
              onChange={(e) => {
                const newRole = e.target.value;
                setNewUser({ ...newUser, role: newRole, region: newRole === 'regionales' ? newUser.region : '' });
              }}
              className="px-4 py-2 border rounded-lg"
              disabled={isUsuariosRole}
            >
              <option value="vendedor">Vendedor</option>
              {!isUsuariosRole && (
                <>
                  <option value="admin">Admin</option>
                  <option value="user">Usuario</option>
                  <option value="director">Director</option>
                  <option value="usuarios">Usuarios</option>
                  <option value="mesa_control">Mesa de Control</option>
                  <option value="regionales">Regionales</option>
                </>
              )}
            </select>
            {newUser.role === 'regionales' && (
              <select
                value={newUser.region}
                onChange={(e) => setNewUser({ ...newUser, region: e.target.value })}
                className="px-4 py-2 border rounded-lg"
                required
              >
                <option value="">Selecciona una región</option>
                <option value="NORESTE">NORESTE</option>
                <option value="OCCIDENTE">OCCIDENTE</option>
                <option value="PACIFICO">PACIFICO</option>
                <option value="SURESTE">SURESTE</option>
                <option value="METROPOLITANA">METROPOLITANA</option>
              </select>
            )}
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
      )}

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
                {/* Rol usuarios solo puede cambiar contraseña de vendedores */}
                {/* Mesa_control NO puede cambiar contraseñas ni eliminar usuarios */}
                {!isMesaControlRole && (!isUsuariosRole || user.role === 'vendedor') && (
                  <button
                    onClick={() => handleChangePassword(user.id)}
                    disabled={changingPassword}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-slate-400 flex items-center gap-1"
                    title="Cambiar contraseña"
                  >
                    <Key size={16} />
                    Contraseña
                  </button>
                )}
                {/* Rol usuarios solo puede eliminar vendedores */}
                {/* Mesa_control NO puede eliminar usuarios */}
                {!isMesaControlRole && (!isUsuariosRole || user.role === 'vendedor') && (
                  <button
                    onClick={() => handleDelete(user.id)}
                    className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 flex items-center gap-1"
                    title="Eliminar usuario"
                  >
                    <Trash2 size={16} />
                    Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

