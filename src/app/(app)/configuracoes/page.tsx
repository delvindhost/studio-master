
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Save, Trash2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { collection, query, where, getDocs, writeBatch, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

export default function ConfiguracoesPage() {
  const { user, userProfile } = useAuth();
  
  // State for password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  
  // State for data maintenance
  const [retentionDays, setRetentionDays] = useState('30');
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [docsToDelete, setDocsToDelete] = useState(0);
  const [isCheckDialogOpen, setIsCheckDialogOpen] = useState(false);

  // General state for alerts
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
      showAlert('Por favor, preencha todos os campos para alterar a senha.', 'error');
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

    setPasswordLoading(true);
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
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        showAlert('A senha atual está incorreta.', 'error');
      } else {
        showAlert('Ocorreu um erro ao alterar a senha. Tente novamente.', 'error');
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const checkDataToDelete = async () => {
    setMaintenanceLoading(true);
    setError(null);
    setSuccess(null);

    const days = parseInt(retentionDays, 10);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

    try {
      const q = query(collection(db, 'registros'), where('data', '<', cutoffTimestamp));
      const querySnapshot = await getDocs(q);
      setDocsToDelete(querySnapshot.size);
      setIsCheckDialogOpen(true); // Abre o diálogo de confirmação
    } catch (err) {
      console.error(err);
      showAlert('Erro ao verificar os dados para limpeza.', 'error');
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleCleanOldData = async () => {
    setMaintenanceLoading(true);
    setIsCheckDialogOpen(false); // Fecha o diálogo
    setError(null);

    const days = parseInt(retentionDays, 10);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffTimestamp = Timestamp.fromDate(cutoffDate);

    try {
      const q = query(collection(db, 'registros'), where('data', '<', cutoffTimestamp));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        showAlert('Nenhum registro antigo para limpar.', 'success');
        setMaintenanceLoading(false);
        return;
      }

      const batch = writeBatch(db);
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      showAlert(`${querySnapshot.size} registro(s) antigo(s) foram excluídos com sucesso!`, 'success');
    } catch (err) {
      console.error(err);
      showAlert('Erro ao limpar dados antigos.', 'error');
    } finally {
      setMaintenanceLoading(false);
      setDocsToDelete(0);
    }
  };
  
   const handleResetSystem = async () => {
    setResetLoading(true);
    setError(null);

    try {
        const querySnapshot = await getDocs(collection(db, 'registros'));
        const batch = writeBatch(db);
        querySnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });
        await batch.commit();
        showAlert(`Reset completo! ${querySnapshot.size} registros foram excluídos.`, 'success');
    } catch (err) {
        console.error(err);
        showAlert('Erro ao resetar o sistema.', 'error');
    } finally {
        setResetLoading(false);
    }
};


  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Configurações</h1>

      {success && <div className="p-4 bg-green-100 text-green-800 border border-green-300 rounded-md">{success}</div>}
      {error && <div className="p-4 bg-red-100 text-red-800 border border-red-300 rounded-md">{error}</div>}

      {userProfile?.role === 'admin' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Alterar Senha de Administrador</CardTitle>
              <CardDescription>
                Altere a senha da sua conta de administrador.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Senha Atual</Label>
                  <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required disabled={passwordLoading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Nova Senha</Label>
                  <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required disabled={passwordLoading} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                  <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={passwordLoading} />
                </div>
                <Button type="submit" disabled={passwordLoading}>
                  {passwordLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Salvar Nova Senha
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Manutenção de Dados</CardTitle>
              <CardDescription>
                Gerencie o ciclo de vida dos registros para otimizar o sistema.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4 p-4 border rounded-lg">
                <h4 className="font-semibold text-primary">Limpeza de Dados Antigos</h4>
                <p className="text-sm text-muted-foreground">Exclua registros mais antigos que o período selecionado para manter a base de dados leve e performática.</p>
                <div className="flex items-end gap-4">
                  <div className="space-y-2 flex-grow">
                    <Label htmlFor="retention-days">Manter dados dos últimos</Label>
                    <Select value={retentionDays} onValueChange={setRetentionDays} disabled={maintenanceLoading}>
                      <SelectTrigger id="retention-days"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 dias</SelectItem>
                        <SelectItem value="60">60 dias</SelectItem>
                        <SelectItem value="90">90 dias</SelectItem>
                        <SelectItem value="180">180 dias</SelectItem>
                        <SelectItem value="365">365 dias (1 ano)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <AlertDialog open={isCheckDialogOpen} onOpenChange={setIsCheckDialogOpen}>
                    <AlertDialogTrigger asChild>
                         <Button onClick={checkDataToDelete} disabled={maintenanceLoading}>
                            {maintenanceLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Executar Limpeza
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirmação de Limpeza</AlertDialogTitle>
                            <AlertDialogDescription>
                                {docsToDelete > 0 ? (
                                    <>
                                        Você está prestes a excluir permanentemente <strong className="text-destructive">{docsToDelete}</strong> registro(s) com mais de <strong className="text-destructive">{retentionDays}</strong> dias.
                                        Esta ação é <strong className="font-bold">IRREVERSÍVEL</strong>. Deseja continuar?
                                    </>
                                ) : (
                                    "Não foram encontrados registros com mais de " + retentionDays + " dias para limpar."
                                )}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setDocsToDelete(0)}>Cancelar</AlertDialogCancel>
                            {docsToDelete > 0 && (
                                <AlertDialogAction
                                    onClick={handleCleanOldData}
                                    className='bg-destructive hover:bg-destructive/90'
                                >
                                    Sim, excluir
                                </AlertDialogAction>
                            )}
                        </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              
              <div className="space-y-4 p-4 border border-destructive bg-destructive/5 rounded-lg">
                 <h4 className="font-semibold text-destructive flex items-center gap-2"><ShieldAlert /> Zona de Perigo</h4>
                 <p className="text-sm text-muted-foreground">Esta ação excluirá <strong className="text-destructive">TODOS</strong> os registros de temperatura do sistema, sem possibilidade de recuperação. Use com extrema cautela.</p>
                 
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" disabled={resetLoading}>
                            {resetLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
                            Resetar Sistema
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Você tem certeza absoluta?</AlertDialogTitle>
                            <AlertDialogDescription>
                                 Esta ação não pode ser desfeita. Isso excluirá permanentemente <strong className="font-bold text-destructive">TODOS</strong> os registros de temperatura do banco de dados.
                                 <br/><br/>
                                 Digite a palavra <strong className="font-bold">RESETAR</strong> no campo abaixo para confirmar.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                         <Input
                            id="confirm-reset"
                            type="text"
                            onChange={(e) => {
                                const confirmButton = (e.target.parentElement?.querySelector('#confirm-reset-button') as HTMLButtonElement);
                                if (confirmButton) {
                                    confirmButton.disabled = e.target.value.toUpperCase() !== 'RESETAR';
                                }
                            }}
                         />
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                                id="confirm-reset-button"
                                onClick={handleResetSystem}
                                disabled
                                className='bg-destructive hover:bg-destructive/90'
                            >
                                Eu entendo as consequências, resetar
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                 </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Configurações Gerais</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">No momento, não há configurações disponíveis para o seu nível de acesso. Para alterar sua senha ou gerenciar dados, entre em contato com um administrador.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
