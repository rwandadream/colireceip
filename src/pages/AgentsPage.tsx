import { useState, useEffect } from 'react';
import {
  UserCog,
  Plus,
  Search,
  Edit,
  Trash2,
  Power,
  KeyRound,
  Phone,
  Shield,
  CheckCircle2,
  XCircle,
  Save,
} from 'lucide-react';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  logActivity,
} from '../lib/data';
import type { User, UserRole } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Badge, EmptyState, Skeleton } from '../components/ui/Badge';
import { Input, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Modal, ConfirmModal } from '../components/ui/Modal';
import { formatDate } from '../lib/format';

export function AgentsPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    role: '' as UserRole | '',
    password: '',
    active: true,
  });

  const loadUsers = async () => {
    const data = await getUsers();
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filtered = users.filter((u) => {
    const text = `${u.full_name} ${u.phone}`.toLowerCase();
    const matchesSearch = !search || text.includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const openCreate = () => {
    setEditUser(null);
    setForm({ full_name: '', phone: '', role: '', password: '', active: true });
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditUser(u);
    setForm({ full_name: u.full_name, phone: u.phone || '', role: u.role, password: '', active: u.active });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.full_name || !form.phone || !form.role || (!editUser && !form.password)) return;
    setSaving(true);
    if (editUser) {
      const updates: Partial<User> = {
        full_name: form.full_name,
        phone: form.phone,
        role: form.role,
        active: form.active,
      };
      if (form.password) updates.password = form.password;
      await updateUser(editUser.id, updates);
      await logActivity(currentUser?.id || '', currentUser?.full_name || '', `a modifié l'agent ${form.full_name}`, 'user', editUser.id, '');
    } else {
      const newUser = await createUser({
        ...form,
        role: form.role as UserRole,
        active: true,
      });
      await logActivity(currentUser?.id || '', currentUser?.full_name || '', `a créé le compte ${form.full_name}`, 'user', newUser.id, '');
    }
    setSaving(false);
    setModalOpen(false);
    loadUsers();
  };

  const handleToggleActive = async (u: User) => {
    await updateUser(u.id, { active: !u.active });
    await logActivity(currentUser?.id || '', currentUser?.full_name || '', `${!u.active ? 'a réactivé' : 'a désactivé'} l'agent ${u.full_name}`, 'user', u.id, '');
    loadUsers();
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    await deleteUser(userToDelete.id);
    await logActivity(currentUser?.id || '', currentUser?.full_name || '', `a supprimé l'agent ${userToDelete.full_name}`, 'user', userToDelete.id, '');
    loadUsers();
  };

  const handleResetPassword = async () => {
    if (!userToReset || !newPassword) return;
    await updateUser(userToReset.id, { password: newPassword });
    await logActivity(currentUser?.id || '', currentUser?.full_name || '', `a réinitialisé le mot de passe de ${userToReset.full_name}`, 'user', userToReset.id, '');
    setResetOpen(false);
    setNewPassword('');
    setUserToReset(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Gestion des Utilisateurs & Agents
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {users.length} comptes enregistrés dans le système
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} /> Nouveau compte
        </Button>
      </div>

      {/* Toolbar */}
      <Card className="p-3">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex-1 w-full">
            <Input
              placeholder="Rechercher par nom ou numéro de téléphone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={<Search size={16} />}
            />
          </div>
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full sm:w-48"
          >
            <option value="all">Tous les rôles</option>
            <option value="admin">Directeurs</option>
            <option value="agent">Agents</option>
          </Select>
        </div>
      </Card>

      {/* User Data Table */}
      {loading ? (
        <Card className="p-4 space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserCog size={32} />}
            title="Aucun utilisateur trouvé"
            action={<Button onClick={openCreate}><Plus size={16} /> Nouveau compte</Button>}
          />
        </Card>
      ) : (
        <div className="data-table-container">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Téléphone</th>
                  <th>Rôle</th>
                  <th>Statut</th>
                  <th>Créé le</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${u.role === 'admin' ? 'bg-accent-100 dark:bg-accent-950/80 text-accent-700 dark:text-accent-300' : 'bg-brand-100 dark:bg-brand-950/80 text-brand-700 dark:text-brand-300'}`}>
                          {u.full_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white truncate">
                          {u.full_name}
                        </span>
                      </div>
                    </td>

                    <td>
                      {u.phone ? (
                        <span className="flex items-center gap-1.5 font-medium text-xs text-slate-700 dark:text-slate-300">
                          <Phone size={12} className="text-slate-400" /> {u.phone}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    <td>
                      {u.role === 'admin' ? (
                        <Badge className="bg-accent-100 text-accent-700 dark:bg-accent-950/60 dark:text-accent-300">
                          <Shield size={11} /> Directeur
                        </Badge>
                      ) : (
                        <Badge className="bg-brand-100 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
                          Agent
                        </Badge>
                      )}
                    </td>

                    <td>
                      {u.active ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <CheckCircle2 size={11} /> Actif
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300">
                          <XCircle size={11} /> Désactivé
                        </Badge>
                      )}
                    </td>

                    <td className="text-xs text-slate-500 whitespace-nowrap">
                      {formatDate(u.created_at)}
                    </td>

                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(u)} title="Modifier">
                          <Edit size={14} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setUserToReset(u); setResetOpen(true); }} title="Mot de passe">
                          <KeyRound size={14} />
                        </Button>
                        {u.id !== currentUser?.id && (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => handleToggleActive(u)} title={u.active ? 'Désactiver' : 'Activer'}>
                              <Power size={14} className={u.active ? 'text-amber-600' : 'text-emerald-600'} />
                            </Button>
                            {u.role !== 'admin' && (
                              <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30" onClick={() => { setUserToDelete(u); setDeleteOpen(true); }} title="Supprimer">
                                <Trash2 size={14} />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editUser ? 'Modifier le compte' : 'Nouveau compte'} size="md">
        <div className="space-y-3">
          <Input
            label="Nom complet *"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
          <Input
            label="Téléphone *"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Select
            label="Rôle *"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
          >
            <option value="">— Choisir un rôle —</option>
            <option value="agent">Agent</option>
            <option value="admin">Directeur</option>
          </Select>
          <Input
            label={editUser ? 'Nouveau mot de passe (optionnel)' : 'Mot de passe *'}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!editUser}
          />
          {editUser && (
            <Select
              label="Statut"
              value={form.active ? 'true' : 'false'}
              onChange={(e) => setForm({ ...form, active: e.target.value === 'true' })}
            >
              <option value="true">Actif</option>
              <option value="false">Désactivé</option>
            </Select>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Annuler</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              <Save size={16} /> {editUser ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Réinitialiser le mot de passe" size="sm">
        <div className="space-y-3">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Nouveau mot de passe pour <span className="font-semibold">{userToReset?.full_name}</span>
          </p>
          <Input
            label="Nouveau mot de passe"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setResetOpen(false)} className="btn-secondary">Annuler</button>
            <button onClick={handleResetPassword} className="btn-primary">Enregistrer</button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Supprimer l'agent"
        message={`Êtes-vous sûr de vouloir supprimer ${userToDelete?.full_name} ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
      />
    </div>
  );
}
