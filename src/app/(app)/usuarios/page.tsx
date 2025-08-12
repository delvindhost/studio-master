'use client';

import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { db, auth as mainAuth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, UserPlus, Users, ShieldCheck, KeyRound, User, Trash2, MoreVertical, Edit, Mail } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

// Tipos
type UserProfile = {
  id: string;
  nome: string;
  email: string;
  matricula: string;
  role: 'admin' | 'user';
  permissions: string[];
};

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/registrar", label: "Registrar" },
  { href: "/visualizar", label: "Visualizar" },
  { href: "/graficos", label: "Gráficos" },
];

const specialPermissions = [
    { id: 'delete_records', label: 'Pode Excluir Registros' }
];


export default function UsuariosPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // State for the dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  
  // Form state
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (!authLoading) {
      if (userProfile?.role !== 'admin') {
        router.replace('/');
      } else {
        fetchUsers();
      }
    }
  }, [userProfile, authLoading, router]);


  const fetchUsers = async () => {
    setLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const userList: UserProfile[] = [];
      querySnapshot.forEach((doc) => {
        if (doc.data().role !== 'admin') {
            userList.push({ id: doc.id, ...doc.data() } as UserProfile);
        }
      });
      setUsers(userList);
    } catch (err) {
      console.error(err);
      setError('Falha ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleMatriculaChange = (value: string) => {
      const newMatricula = value.trim();
      setMatricula(newMatricula);
      if (newMatricula) {
        setEmail(`${newMatricula}@ind.com.br`);
      } else {
        setEmail('');
      }
  }


  const showAlert = (message: string, type: 'success' | 'error') => {
    if (type === 'success') {
      setSuccess(message);
      setError(null);
    } else {
      setError(message);
      setSuccess(null);
    }
    setTimeout(() => {
      setSuccess(null);
      setError(null);
    }, 4000);
  };

  const handlePermissionChange = (permission: string) => {
    setPermissions(prev =>
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };
  
  const resetForm = () => {
    setNome('');
    setEmail('');
    setMatricula('');
    setSenha('');
    setPermissions([]);
    setEditingUser(null);
    setIsSubmitting(false);
    setIsDialogOpen(false);
  };

  const openEditDialog = (user: UserProfile) => {
    setEditingUser(user);
    setNome(user.nome);
    setMatricula(user.matricula);
    setEmail(user.email);
    setPermissions(user.permissions || []);
    setSenha(''); // Senha não é preenchida por segurança
    setIsDialogOpen(true);
  };

  const openAddDialog = () => {
    resetForm();
    setEditingUser(null);
    setIsDialogOpen(true);
  }

  const handleFormSubmit = async () => {
    if (editingUser) {
      await handleUpdateUser();
    } else {
      await handleAddUser();
    }
  }

  const handleAddUser = async () => {
    if (!nome || !matricula || !senha || !email) {
      showAlert('Por favor, preencha nome, matrícula e senha.', 'error');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const userCredential = await createUserWithEmailAndPassword(mainAuth, email, senha);
      const user = userCredential.user;

      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        nome,
        matricula,
        email,
        role: 'user',
        permissions,
      });

      showAlert('Usuário adicionado com sucesso!', 'success');
      resetForm();
      fetchUsers();
    } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
            showAlert('Erro: A matrícula informada já está em uso.', 'error');
        } else if (err.code === 'auth/weak-password') {
            showAlert('Erro: A senha deve ter no mínimo 6 caracteres.', 'error');
        } else {
            showAlert('Erro ao criar usuário. Verifique os dados e tente novamente.', 'error');
        }
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUser = async () => {
     if (!editingUser || !nome || !matricula) {
      showAlert('Por favor, preencha nome e matrícula.', 'error');
      return;
    }
     if (senha && senha.length < 6) {
      showAlert('A nova senha deve ter no mínimo 6 caracteres.', 'error');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);
    
    try {
        const userDocRef = doc(db, 'users', editingUser.id);
        
        await updateDoc(userDocRef, {
            nome,
            permissions,
        });

        let successMsg = 'Dados do usuário atualizados com sucesso!';
        if (senha) {
           successMsg += ' A alteração de senha por aqui não é suportada, peça ao usuário para redefini-la.'
        }
        
        showAlert(successMsg, 'success');
        resetForm();
        fetchUsers();

    } catch (err) {
        console.error(err);
        showAlert('Erro ao atualizar usuário.', 'error');
    } finally {
        setIsSubmitting(false);
    }
  }
  
  const handleDeleteUser = async (userIdToDelete: string) => {
    try {
      await deleteDoc(doc(db, 'users', userIdToDelete));
      showAlert('Usuário removido da base de dados! (A autenticação precisa ser removida manually no console do Firebase)', 'success');
      fetchUsers();
    } catch (error) {
        showAlert('Erro ao remover usuário.', 'error');
        console.error("Error deleting user: ", error);
    }
  }

  const getPermissionLabel = (p: string) => {
    const navItem = navItems.find(n => n.href === p);
    if(navItem) return navItem.label;
    const specialPerm = specialPermissions.find(sp => sp.id === p);
    if(specialPerm) return specialPerm.label;
    return p;
  }

  if (authLoading || loading) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
   if (userProfile?.role !== 'admin') {
    return (
        <div className="flex h-full w-full items-center justify-center">
            <p className="text-red-500">Acesso negado.</p>
        </div>
    );
  }


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">Gerenciamento de Usuários</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openAddDialog}>
              <UserPlus className="mr-2 h-4 w-4" /> Adicionar Usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" onInteractOutside={(e) => {
              if (isSubmitting) e.preventDefault();
          }}>
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome Completo</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do colaborador" disabled={isSubmitting} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="matricula">Matrícula</Label>
                <Input id="matricula" value={matricula} onChange={(e) => handleMatriculaChange(e.target.value)} placeholder="Matrícula de identificação" disabled={isSubmitting || !!editingUser}/>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail de Login (automático)</Label>
                <Input id="email" value={email} readOnly disabled placeholder="Será gerado a partir da matrícula" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="senha">Senha</Label>
                <Input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder={editingUser ? "Deixe em branco para não alterar" : "Mínimo de 6 caracteres"} disabled={isSubmitting}/>
              </div>
              <div className="space-y-3">
                 <Label>Permissões de Acesso às Páginas</Label>
                 <div className='space-y-2'>
                    {navItems.map((item) => (
                        <div key={item.href} className="flex items-center space-x-2">
                            <Checkbox 
                                id={`perm-${item.href}`} 
                                checked={permissions.includes(item.href)}
                                onCheckedChange={() => handlePermissionChange(item.href)}
                                disabled={isSubmitting}
                            />
                            <label
                                htmlFor={`perm-${item.href}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                {item.label}
                            </label>
                        </div>
                    ))}
                 </div>
              </div>
               <div className="space-y-3 pt-4 border-t">
                 <Label>Permissões Especiais</Label>
                 <div className='space-y-2'>
                    {specialPermissions.map((item) => (
                        <div key={item.id} className="flex items-center space-x-2">
                            <Checkbox 
                                id={`perm-${item.id}`} 
                                checked={permissions.includes(item.id)}
                                onCheckedChange={() => handlePermissionChange(item.id)}
                                disabled={isSubmitting}
                            />
                            <label
                                htmlFor={`perm-${item.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                                {item.label}
                            </label>
                        </div>
                    ))}
                 </div>
              </div>
            </div>
            <DialogFooter>
               <DialogClose asChild>
                <Button type="button" variant="outline" onClick={resetForm} disabled={isSubmitting}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button onClick={handleFormSubmit} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingUser ? 'Salvar Alterações' : 'Criar Usuário'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

       {success && <div className="p-4 bg-green-100 text-green-800 border border-green-300 rounded-md">{success}</div>}
       {error && <div className="p-4 bg-red-100 text-red-800 border border-red-300 rounded-md">{error}</div>}

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'><Users className='h-5 w-5'/> Usuários Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
           {users.length > 0 ? (
            <div className="space-y-4">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between rounded-lg border p-4">
                    <div className='space-y-1'>
                        <p className="font-semibold flex items-center gap-2"><User className='h-4 w-4 text-primary'/> {user.nome}</p>
                         <p className="text-sm text-muted-foreground flex items-center gap-2"><Mail className='h-4 w-4'/> E-mail: {user.email}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-2"><KeyRound className='h-4 w-4'/> Matrícula: {user.matricula}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-2"><ShieldCheck className='h-4 w-4'/> Permissões: {user.permissions.map(p => getPermissionLabel(p)).join(', ')}</p>
                    </div>

                    <AlertDialog>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                              </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(user)}>
                                <Edit className="mr-2 h-4 w-4" />
                                <span>Editar</span>
                              </DropdownMenuItem>
                              <AlertDialogTrigger asChild>
                                <DropdownMenuItem className='text-destructive focus:text-destructive focus:bg-destructive/10'>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    <span>Excluir</span>
                                </DropdownMenuItem>
                               </AlertDialogTrigger>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Essa ação não pode ser desfeita. Isso excluirá permanentemente o usuário da base de dados, mas a conta de autenticação precisará ser removida manualmente no console do Firebase.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => handleDeleteUser(user.id)}
                                className='bg-destructive hover:bg-destructive/90'
                            >
                                Sim, excluir
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">Nenhum usuário cadastrado ainda.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
