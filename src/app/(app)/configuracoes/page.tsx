
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';
import { Loader2, Save } from 'lucide-react';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

export default function ConfiguracoesPage() {
  const { user, userProfile } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
        
        // Reautentica o usuário para confirmar a identidade
        await reauthenticateWithCredential(user, credential);
        
        // Se a reautenticação for bem-sucedida, atualize a senha
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Configurações</h1>

      {success && <div className="p-4 bg-green-100 text-green-800 border border-green-300 rounded-md">{success}</div>}
      {error && <div className="p-4 bg-red-100 text-red-800 border border-red-300 rounded-md">{error}</div>}

      {userProfile?.role === 'admin' && (
        <Card className="max-w-2xl">
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
              className="space-y-6"
            >
              <div className="space-y-2">
                <Label htmlFor="current-password">Senha Atual</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">Nova Senha</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <Button type="submit" disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar Nova Senha
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {userProfile?.role !== 'admin' && (
         <Card className="max-w-2xl">
            <CardHeader>
                <CardTitle>Configurações Gerais</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">No momento, não há configurações disponíveis para o seu nível de acesso. Para alterar sua senha, entre em contato com um administrador.</p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
