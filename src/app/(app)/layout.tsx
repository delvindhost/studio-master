
"use client";
import React, { useEffect } from "react";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userProfile, loading } = useAuth();
  const router = useRouter();
  const [isSidebarOpen, setSidebarOpen] = React.useState(false);

  useEffect(() => {
    // Apenas redireciona se o carregamento terminou e não há perfil
    if (!loading && !userProfile) {
      router.replace("/login");
    }
  }, [userProfile, loading, router]);

  // Enquanto a autenticação estiver sendo verificada, mostre um loader.
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Se o carregamento terminou e temos um perfil de usuário, renderize a aplicação.
  // O useEffect acima já terá tratado o caso de não haver perfil.
  if (userProfile) {
    return (
      <div className="flex min-h-screen w-full bg-background">
        <Sidebar isSidebarOpen={isSidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="flex flex-1 flex-col md:ml-64">
          <Header setSidebarOpen={setSidebarOpen} userProfile={userProfile} />
          <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto">
              {children}
          </main>
        </div>
      </div>
    );
  }

  // Se o carregamento terminou e não há perfil, o useEffect já está redirecionando.
  // Renderize um loader para evitar um flash de tela em branco durante o redirecionamento.
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
