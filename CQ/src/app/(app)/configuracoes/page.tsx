
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useAuth } from '@/context/AuthContext';
import { Loader2, Save, Trash2, ShieldAlert, User, Database } from 'lucide-react';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, Timestamp, writeBatch } from 'firebase/firestore';


export default function ConfiguracoesPage() {
  const { user, userProfile } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [retentionDays, setRetentionDays] = useState('30');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
    }, 5000);
  };

  const handleChangePassword = async () => {
    setError(null);
    setSuccess(null);

    if (!user) {
      showAlert('Usuário não autenticado.', 'error');
      return;
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      showAlert('Por favor, preencha todos os campos.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showAlert('A nova senha e a confirmação não correspondem.', 'error');
      return;
    }

    if (newPassword.length < 6) {
      showAlert('A nova senha deve ter pelo menos 6 caracteres.', 'error');
      return;
    }

    setLoading(true);

    try {
      if(user.email) {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        
        showAlert('Senha alterada com sucesso!', 'success');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
         showAlert('E-mail do usuário não encontrado para reautenticação.', 'error');
      }

    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        showAlert('A senha atual está incorreta.', 'error');
      } else {
        showAlert('Ocorreu um erro ao alterar a senha. Tente novamente.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleCleanOldData = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
        const days = parseInt(retentionDays, 10);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

        const q = query(collection(db, 'registros'), where('data', '<', cutoffTimestamp));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            showAlert('Nenhum registro antigo para limpar.', 'success');
            setLoading(false);
            return;
        }

        const batch = writeBatch(db);
        querySnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        showAlert(`${querySnapshot.size} registro(s) antigo(s) foram excluídos com sucesso.`, 'success');

    } catch (err) {
        console.error(err);
        showAlert('Erro ao limpar dados antigos.', 'error');
    } finally {
        setLoading(false);
    }
  };
  
  const handleResetSystem = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const q = query(collection(db, 'registros'));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        showAlert('O sistema já não possui registros.', 'success');
        setLoading(false);
        return;
      }
      
      const batch = writeBatch(db);
      querySnapshot.forEach(docSnapshot => {
        batch.delete(docSnapshot.ref);
      });
      await batch.commit();

      showAlert(`Reset completo. ${querySnapshot.size} registros foram excluídos.`, 'success');

    } catch (err) {
        console.error(err);
        showAlert('Erro ao resetar o sistema.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Configurações</h1>

      {success && <div className="p-4 bg-green-100 text-green-800 border border-green-300 rounded-md">{success}</div>}
      {error && <div className="p-4 bg-red-100 text-red-800 border border-red-300 rounded-md">{error}</div>}

       <Tabs defaultValue="conta" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="conta" disabled={userProfile?.role !== 'admin'}>
                <User className="mr-2 h-4 w-4" /> Conta
            </TabsTrigger>
            <TabsTrigger value="dados" disabled={userProfile?.role !== 'admin'}>
                <Database className="mr-2 h-4 w-4" /> Dados
            </TabsTrigger>
        </TabsList>
        <TabsContent value="conta">
            {userProfile?.role === 'admin' ? (
                 <Card>
                    <CardHeader>
                        <CardTitle>Alterar Senha de Administrador</CardTitle>
                        <CardDescription>
                        Altere a senha da sua conta de administrador. Por segurança, você precisará informar sua senha atual.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleChangePassword();
                        }}
                        className="space-y-6 max-w-lg"
                        >
                        <div className="space-y-2">
                            <Label htmlFor="current-password">Senha Atual</Label>
                            <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required disabled={loading} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-password">Nova Senha</Label>
                            <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required disabled={loading}/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                            <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={loading} />
                        </div>
                        <Button type="submit" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Salvar Nova Senha
                        </Button>
                        </form>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Configurações de Conta</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">No momento, não há configurações disponíveis para o seu nível de acesso. Para alterar sua senha, entre em contato com um administrador.</p>
                    </CardContent>
                </Card>
            )}
        </TabsContent>
        <TabsContent value="dados">
             {userProfile?.role === 'admin' ? (
                <Card>
                    <CardHeader>
                        <CardTitle>Manutenção de Dados</CardTitle>
                        <CardDescription>
                        Gerencie os dados de registros para manter o sistema otimizado.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        <div className="space-y-4 p-4 border rounded-lg">
                            <Label className='text-md font-semibold'>Limpeza de Dados Antigos</Label>
                            <p className='text-sm text-muted-foreground'>
                                Exclua todos os registros de temperatura mais antigos que o período selecionado. Esta ação não pode ser desfeita.
                            </p>
                            <div className="flex items-center gap-4">
                                <Select value={retentionDays} onValueChange={setRetentionDays} disabled={loading}>
                                    <SelectTrigger className="w-[220px]">
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="30">Manter últimos 30 dias</SelectItem>
                                        <SelectItem value="60">Manter últimos 60 dias</SelectItem>
                                        <SelectItem value="90">Manter últimos 90 dias</SelectItem>
                                        <SelectItem value="180">Manter últimos 180 dias</SelectItem>
                                        <SelectItem value="365">Manter último 1 ano</SelectItem>
                                    </SelectContent>
                                </Select>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" disabled={loading}>
                                            <Trash2 className="mr-2 h-4 w-4" /> Limpar Dados
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Esta ação é irreversível. Todos os registros com mais de {retentionDays} dias serão permanentemente excluídos.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleCleanOldData} disabled={loading}>
                                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Sim, excluir'}
                                        </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>

                        <div className="space-y-4 p-4 border border-destructive/50 rounded-lg">
                            <Label className='text-md font-semibold text-destructive flex items-center gap-2'><ShieldAlert className='h-5 w-5' />Reset Completo do Sistema</Label>
                            <p className='text-sm text-muted-foreground'>
                                Exclua **todos** os registros de temperatura do sistema. Use com extrema cautela.
                            </p>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={loading}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Resetar Sistema
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Atenção! Ação Perigosa!</AlertDialogTitle>
                                    <AlertDialogDescription>
                                    Você está prestes a apagar **TODA** a base de dados de registros. Esta ação não pode ser desfeita e todos os dados serão perdidos. Deseja continuar?
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={handleResetSystem}
                                        className='bg-destructive hover:bg-destructive/90'
                                        disabled={loading}
                                    >
                                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Sim, eu entendo, resetar tudo'}
                                    </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </CardContent>
                </Card>
              ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Configurações de Dados</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground">Acesso negado. Apenas administradores podem gerenciar os dados do sistema.</p>
                    </CardContent>
                </Card>
              )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
