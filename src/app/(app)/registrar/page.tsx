'use client';

import React, { useState } from 'react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from '@/components/ui/select';
import { Loader2, Save, Trash2 } from 'lucide-react';
import { produtosPorCodigo } from '@/lib/produtos';
import { useAuth } from '@/context/AuthContext';

// Tipos
type RegistroTemperatura = {
  turno: string;
  local: string;
  codigo: string;
  produto: string;
  tipo: string;
  estado: string;
  dataManual: string;
  horarioManual: string;
  temperaturas: {
    inicio: number;
    meio: number;
    fim: number;
  };
  data: Date;
  userId: string;
};

export default function RegistrarPage() {
  const { user } = useAuth();
  const [turno, setTurno] = useState('');
  const [local, setLocal] = useState('');
  const [codigo, setCodigo] = useState('');
  const [produto, setProduto] = useState('');
  const [tipo, setTipo] = useState('');
  const [estado, setEstado] = useState('');
  const [dataManual, setDataManual] = useState('');
  const [horarioManual, setHorarioManual] = useState('');
  const [tempInicio, setTempInicio] = useState('');
  const [tempMeio, setTempMeio] = useState('');
  const [tempFim, setTempFim] = useState('');

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
    }, 3000);
  };

  const handleCodigoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newCodigo = e.target.value.trim().toUpperCase();
    setCodigo(newCodigo);
    const dadosProduto = produtosPorCodigo[newCodigo];
    if (dadosProduto) {
      setProduto(dadosProduto.produto || '');
      setTipo(dadosProduto.tipo || '');
    }
  };

  const limparFormulario = () => {
    setTurno('');
    setLocal('');
    setCodigo('');
    setProduto('');
    setTipo('');
    setEstado('');
    setDataManual('');
    setHorarioManual('');
    setTempInicio('');
    setTempMeio('');
    setTempFim('');
  };

  const registrarTemperatura = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (!user) {
      showAlert('Usuário não autenticado. Faça login novamente.', 'error');
      setLoading(false);
      return;
    }

    const camposObrigatorios = {
      turno, local, produto, tipo, estado,
      dataManual, horarioManual, tempInicio, tempMeio, tempFim,
    };

    for (const [key, value] of Object.entries(camposObrigatorios)) {
      if (!value) {
        showAlert(`O campo ${key} é obrigatório.`, 'error');
        setLoading(false);
        return;
      }
    }
    
    try {
        const [ano, mes, dia] = dataManual.split('-').map(Number);
        const [hora, minuto] = horarioManual.split(':').map(Number);

        if (isNaN(ano) || isNaN(mes) || isNaN(dia) || isNaN(hora) || isNaN(minuto)) {
            showAlert('Data ou horário inválido!', 'error');
            setLoading(false);
            return;
        }

        const dataComHorario = new Date(ano, mes - 1, dia, hora, minuto);


      const novoRegistro: Omit<RegistroTemperatura, 'data'> & { data: Date } = {
        turno,
        local,
        codigo: codigo || 'N/A',
        produto,
        tipo,
        estado,
        dataManual,
        horarioManual,
        temperaturas: {
          inicio: parseFloat(tempInicio),
          meio: parseFloat(tempMeio),
          fim: parseFloat(tempFim),
        },
        data: dataComHorario,
        userId: user.uid,
      };

      await addDoc(collection(db, 'registros'), novoRegistro);

      showAlert('Temperatura registrada com sucesso!', 'success');
      limparFormulario();
    } catch (err) {
      console.error(err);
      showAlert('Erro ao registrar temperatura.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
       <h1 className="text-2xl font-bold text-primary">Registrar Temperaturas</h1>

        {success && <div className="p-4 bg-green-100 text-green-800 border border-green-300 rounded-md">{success}</div>}
        {error && <div className="p-4 bg-red-100 text-red-800 border border-red-300 rounded-md">{error}</div>}

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Novo Registro</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              registrarTemperatura();
            }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="turno">Turno *</Label>
                    <Select value={turno} onValueChange={setTurno} required>
                        <SelectTrigger id="turno">
                            <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="1">1º Turno</SelectItem>
                            <SelectItem value="2">2º Turno</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="local">Local *</Label>
                    <Select value={local} onValueChange={setLocal} required>
                        <SelectTrigger id="local">
                            <SelectValue placeholder="Selecione o local" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                            <SelectGroup>
                               <SelectLabel>Giros Freezer</SelectLabel>
                                <SelectItem value="Giro Freezer 1">Giro Freezer 1</SelectItem>
                                <SelectItem value="Giro Freezer 2">Giro Freezer 2</SelectItem>
                                <SelectItem value="Giro Freezer 3">Giro Freezer 3</SelectItem>
                                <SelectItem value="Giro Freezer 4">Giro Freezer 4</SelectItem>
                            </SelectGroup>
                            <SelectGroup>
                                <SelectLabel>Túneis</SelectLabel>
                                <SelectItem value="Túnel 1">Túnel 1</SelectItem>
                                <SelectItem value="Túnel 2">Túnel 2</SelectItem>
                                <SelectItem value="Túnel 3">Túnel 3</SelectItem>
                                <SelectItem value="Túnel 4">Túnel 4</SelectItem>
                            </SelectGroup>
                            <SelectGroup>
                                <SelectLabel>Cortes</SelectLabel>
                                <SelectItem value="Cortes 1">Cortes 1</SelectItem>
                                <SelectItem value="Cortes 2">Cortes 2</SelectItem>
                                <SelectItem value="Rependura Cortes 1">Rependura Cortes 1</SelectItem>
                                <SelectItem value="Rependura Cortes 2">Rependura Cortes 2</SelectItem>
                            </SelectGroup>
                             <SelectGroup>
                                <SelectLabel>Embalagem</SelectLabel>
                                <SelectItem value="Embalagem Secundária">Embalagem Secundária</SelectItem>
                            </SelectGroup>
                            <SelectGroup>
                                <SelectLabel>Expedição</SelectLabel>
                                <SelectItem value="Expedição 1">Expedição 1</SelectItem>
                                <SelectItem value="Expedição 2">Expedição 2</SelectItem>
                            </SelectGroup>
                             <SelectGroup>
                                <SelectLabel>Paletização</SelectLabel>
                                <SelectItem value="Paletização 1">Paletização 1</SelectItem>
                                <SelectItem value="Paletização 2">Paletização 2</SelectItem>
                            </SelectGroup>
                            <SelectGroup>
                                <SelectLabel>Outros</SelectLabel>
                                <SelectItem value="Miudos">Miudos</SelectItem>
                                <SelectItem value="Evisceração 1">Evisceração 1</SelectItem>
                                <SelectItem value="Evisceração 2">Evisceração 2</SelectItem>
                            </SelectGroup>
                            <SelectGroup>
                                <SelectLabel>Câmaras</SelectLabel>
                                <SelectItem value="Câmara A">Câmara A</SelectItem>
                                <SelectItem value="Câmara C">Câmara C</SelectItem>
                                <SelectItem value="Câmara D">Câmara D</SelectItem>
                                <SelectItem value="Câmara F">Câmara F</SelectItem>
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
            </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="codigo">Código do Produto</Label>
                    <Input id="codigo" value={codigo} onChange={handleCodigoChange} placeholder="Digite o código" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="produto">Produto *</Label>
                    <Input id="produto" value={produto} onChange={(e) => setProduto(e.target.value)} required placeholder="Nome do produto" />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="tipo">Tipo *</Label>
                    <Select value={tipo} onValueChange={setTipo} required>
                        <SelectTrigger id="tipo">
                            <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="MI">MI</SelectItem>
                            <SelectItem value="ME">ME</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="estado">Estado *</Label>
                    <Select value={estado} onValueChange={setEstado} required>
                        <SelectTrigger id="estado">
                            <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="Congelado">Congelado</SelectItem>
                            <SelectItem value="Resfriado">Resfriado</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="data-manual">Data *</Label>
                    <Input id="data-manual" type="date" value={dataManual} onChange={(e) => setDataManual(e.target.value)} required />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="horario-manual">Horário *</Label>
                    <Input id="horario-manual" type="time" value={horarioManual} onChange={(e) => setHorarioManual(e.target.value)} required />
                </div>
            </div>
            
            <div>
                 <h3 className="text-lg font-medium text-primary mb-2">Temperaturas (°C) *</h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     <div className="space-y-2">
                         <Label htmlFor="temp-inicio">Início</Label>
                         <Input id="temp-inicio" type="number" step="0.1" value={tempInicio} onChange={(e) => setTempInicio(e.target.value)} required placeholder="0.0"/>
                     </div>
                     <div className="space-y-2">
                         <Label htmlFor="temp-meio">Meio</Label>
                         <Input id="temp-meio" type="number" step="0.1" value={tempMeio} onChange={(e) => setTempMeio(e.target.value)} required placeholder="0.0"/>
                     </div>
                     <div className="space-y-2">
                         <Label htmlFor="temp-fim">Fim</Label>
                         <Input id="temp-fim" type="number" step="0.1" value={tempFim} onChange={(e) => setTempFim(e.target.value)} required placeholder="0.0"/>
                     </div>
                 </div>
            </div>

            <div className="flex space-x-4">
                <Button type="submit" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Registrar
                </Button>
                 <Button type="button" variant="outline" onClick={limparFormulario} disabled={loading}>
                     <Trash2 className="mr-2 h-4 w-4" />
                    Limpar
                </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
