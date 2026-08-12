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

  const filtered = users.filter(
    (u) =>
      !search ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.phone.toLowerCase().includes(search.toLowerCase())
  );

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Agents</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{users.length} comptes</p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <Plus size={18} />
          Nouvel agent
        </Button>
      </div>

      <Card className="p-4">
        <Input
          placeholder="Rechercher par nom ou téléphone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon={<Search size={18} />}
        />
      </Card>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserCog size={32} />}
            title="Aucun utilisateur trouvé"
            action={<Button onClick={openCreate}><Plus size={18} /> Nouvel agent</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((u) => (
            <Card key={u.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center font-semibold flex-shrink-0 ${u.role === 'admin' ? 'bg-accent-100 dark:bg-accent-900/40 text-accent-700 dark:text-accent-300' : 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300'}`}>
                  {u.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-slate-900 dark:text-white truncate">{u.full_name}</p>
                    {u.role === 'admin' && (
                      <Badge className="bg-accent-100 text-accent-700 dark:bg-accent-900/40 dark:text-accent-300">
                        <Shield size={12} /> Directeur
                      </Badge>
                    )}
                  </div>
                  <div className="mt-1 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {u.phone && <p className="flex items-center gap-1.5"><Phone size={12} /> {u.phone}</p>}
                    <p>Créé le {formatDate(u.created_at)}</p>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {u.active ? (
                      <Badge className="bg-success-100 text-success-700 dark:bg-success-900/40 dark:text-success-300">
                        <CheckCircle2 size={12} /> Actif
                      </Badge>
                    ) : (
                      <Badge className="bg-error-100 text-error-700 dark:bg-error-900/40 dark:text-error-300">
                        <XCircle size={12} /> Désactivé
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                  <Edit size={14} /> Modifier
                </Button>
                <Button variant="ghost" size="sm" onClick={() => { setUserToReset(u); setResetOpen(true); }}>
                  <KeyRound size={14} /> Mot de passe
                </Button>
                {u.id !== currentUser?.id && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => handleToggleActive(u)}>
                      <Power size={14} /> {u.active ? 'Désactiver' : 'Activer'}
                    </Button>
                    {u.role !== 'admin' && (
                      <Button variant="ghost" size="sm" className="text-error-600 dark:text-error-400" onClick={() => { setUserToDelete(u); setDeleteOpen(true); }}>
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editUser ? 'Modifier le compte' : 'Nouveau compte'} size="md">
        <div className="space-y-4">
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
            label={editUser ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe *'}
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
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setModalOpen(false)} className="btn-secondary">Annuler</button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              <Save size={18} /> {editUser ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title="Réinitialiser le mot de passe" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Définissez un nouveau mot de passe pour <span className="font-semibold">{userToReset?.full_name}</span>
          </p>
          <Input
            label="Nouveau mot de passe"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <div className="flex justify-end gap-3">
            <button onClick={() => setResetOpen(false)} className="btn-secondary">Annuler</button>
            <button onClick={handleResetPassword} className="btn-primary">Réinitialiser</button>
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
