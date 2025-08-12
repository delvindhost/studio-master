
'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [matricula, setMatricula] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!matricula.trim()) {
        setError('Por favor, insira sua matrícula ou e-mail.');
        setLoading(false);
        return;
    }

    try {
      const loginInput = matricula.trim();
      const isAdminLogin = loginInput.toLowerCase() === 'admin';
      const emailToLogin = isAdminLogin ? 'cq.uia@ind.com.br' : (loginInput.includes('@') ? loginInput : `${loginInput}@ind.com.br`);
      
      await signInWithEmailAndPassword(auth, emailToLogin, password);
      router.push('/');

    } catch (err: any) {
      // Se for o login de admin e o usuário não existir, crie-o.
      const isAdminLogin = matricula.trim().toLowerCase() === 'admin';
      if (isAdminLogin && err.code === 'auth/user-not-found') {
        try {
          // Cria o usuário admin com a senha digitada
          await createUserWithEmailAndPassword(auth, 'cq.uia@ind.com.br', password);
          // Tenta logar novamente
          await signInWithEmailAndPassword(auth, 'cq.uia@ind.com.br', password);
          router.push('/');
        } catch (creationError: any) {
          setError('Falha ao criar usuário admin. Senha deve ter 6+ caracteres.');
          console.error("Admin creation error:", creationError);
        }
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-email') {
        setError('Falha no login. Verifique suas credenciais.');
      } else {
        setError('Ocorreu um erro inesperado. Tente novamente.');
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-sm mx-4">
        <CardHeader>
          <CardTitle className="text-2xl text-center text-primary">Controle de Qualidade</CardTitle>
          <CardDescription className="text-center">
            Entre com sua matrícula ou e-mail e senha.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="matricula">Matrícula ou E-mail</Label>
              <Input
                id="matricula"
                type="text"
                placeholder="Sua matrícula ou 'admin'"
                required
                value={matricula}
                onChange={(e) => setMatricula(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                placeholder="******"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Entrar'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
