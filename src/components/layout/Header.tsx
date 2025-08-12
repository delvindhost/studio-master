
"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import type { UserProfile } from "@/context/AuthContext";

type HeaderProps = {
  setSidebarOpen: (open: boolean) => void;
  userProfile: UserProfile | null;
};

export default function Header({ setSidebarOpen, userProfile }: HeaderProps) {
    const [greeting, setGreeting] = useState("");

    useEffect(() => {
        const getGreeting = () => {
            const hour = new Date().getHours();
            if (hour < 12) return "Bom dia";
            if (hour < 18) return "Boa tarde";
            return "Boa noite";
        };
        setGreeting(getGreeting());
    }, []);


    const getGreetingMessage = () => {
        if (!userProfile) return `Controle de Qualidade`;

        const salutation = `Olá,`;
        const timeGreeting = `, ${greeting}`;

        if (userProfile.role === 'admin') {
            return `${salutation} Gestores de Qualidade${timeGreeting}`;
        }
        return `${salutation} ${userProfile.nome}${timeGreeting}`;
    }


  return (
    <header className="flex h-16 items-center shrink-0 border-b bg-card px-4">
       <Button
        variant="ghost"
        size="icon"
        onClick={() => setSidebarOpen(true)}
        className="md:hidden"
      >
        <Menu className="h-6 w-6" />
        <span className="sr-only">Abrir menu</span>
      </Button>
      <div className="flex-1 text-center md:text-left md:pl-4">
        <h1 className="text-md font-semibold text-primary">{getGreetingMessage()}</h1>
      </div>
    </header>
  );
}
