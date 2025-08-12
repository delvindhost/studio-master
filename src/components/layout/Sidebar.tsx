
"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Thermometer,
  ClipboardList,
  BarChart3,
  Settings,
  Users,
  LogOut,
  X,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/registrar", icon: Thermometer, label: "Registrar" },
  { href: "/visualizar", icon: ClipboardList, label: "Visualizar" },
  { href: "/graficos", icon: BarChart3, label: "Gráficos" },
  { href: "/desempenho", icon: TrendingUp, label: "Desempenho", admin: true },
  { href: "/usuarios", icon: Users, label: "Usuários", admin: true },
  { href: "/configuracoes", icon: Settings, label: "Configurações" },
];

type SidebarProps = {
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
};

export default function Sidebar({ isSidebarOpen, setSidebarOpen }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { userProfile } = useAuth();


  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const hasPermission = (item: typeof navItems[0]) => {
    // Return false if userProfile is not loaded yet to prevent rendering errors
    if (!userProfile) return false;

    if (userProfile.role === 'admin') return true;
    if (item.admin) return false;
    
    // Ensure permissions array exists before checking
    if (!userProfile.permissions) return false;

    // Explicitly check for dashboard permission
    if (item.href === '/') {
        return userProfile.permissions.includes('/');
    }

    return userProfile.permissions.includes(item.href);
  }

  return (
    <>
      {/* Overlay for mobile */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/50 transition-opacity md:hidden",
          isSidebarOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 left-0 z-40 flex h-screen w-64 flex-col bg-primary text-primary-foreground transition-transform duration-300 ease-in-out md:translate-x-0",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between p-4 md:justify-center md:p-6">
          <h2 className="text-2xl font-bold text-center">Controle de Qualidade</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden"
          >
            <X className="h-6 w-6" />
            <span className="sr-only">Fechar menu</span>
          </Button>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navItems.filter(hasPermission).map((item) => (
            <Link key={item.label} href={item.href} passHref onClick={() => setSidebarOpen(false)}>
              <Button
                variant={pathname === item.href ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                <item.icon className="mr-3 h-5 w-5" />
                {item.label}
              </Button>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-primary-foreground/20">
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={handleLogout}
          >
            <LogOut className="mr-3 h-5 w-5" />
            Sair
          </Button>
        </div>
      </div>
    </>
  );
}

    