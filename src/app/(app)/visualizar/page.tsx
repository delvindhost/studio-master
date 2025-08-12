

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp, doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Loader2, Filter, FileDown, FileText, MapPin, Barcode, Clock, Thermometer, Snowflake, Tag, Play, Pause, StopCircle, Trash2, ChevronsUpDown, Check, ChevronDown, LayoutGrid, Rows3 } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useAuth } from '@/context/AuthContext';
import { produtosPorCodigo } from '@/lib/produtos';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";


// Tipos
type Registro = {
  id: string;
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
  data: Timestamp;
  userId: string;
};

type jsPDFWithAutoTable = jsPDF & { autoTable: (options: any) => void };

// Componente principal da página
export default function VisualizarPage() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { userProfile } = useAuth();


  const hoje = new Date().toISOString().split('T')[0];
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);
  const [local, setLocal] = useState('todos');
  const [turno, setTurno] = useState('todos');
  const [tipo, setTipo] = useState('todos');
  const [produtoCodigo, setProdutoCodigo] = useState('todos');
  const [estado, setEstado] = useState('todos');
  const [success, setSuccess] = useState<string | null>(null);
  
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');


  // --- Combobox state ---
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("");

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
  
  const carregarRegistros = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setIsFilterVisible(false); // Recolhe o filtro
    try {
      const inicio = new Date(`${dataInicio}T00:00:00`);
      const fim = new Date(`${dataFim}T23:59:59`);

      let q = query(
        collection(db, 'registros'),
        where('data', '>=', Timestamp.fromDate(inicio)),
        where('data', '<=', Timestamp.fromDate(fim)),
        orderBy('data', 'desc')
      );

      if (local && local !== 'todos') q = query(q, where('local', '==', local));
      if (turno && turno !== 'todos') q = query(q, where('turno', '==', turno));
      if (tipo && tipo !== 'todos') q = query(q, where('tipo', '==', tipo));
      if (produtoCodigo !== 'todos') q = query(q, where('codigo', '==', produtoCodigo));
      if (estado !== 'todos') q = query(q, where('estado', '==', estado));


      const querySnapshot = await getDocs(q);
      const dados: Registro[] = [];
      querySnapshot.forEach((doc) => {
        dados.push({ id: doc.id, ...doc.data() } as Registro);
      });
      
      setRegistros(dados);

      if (dados.length === 0) {
        setError('Nenhum registro encontrado para os filtros selecionados.');
      }

    } catch (err) {
      console.error(err);
      setError('Erro ao carregar registros. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, local, turno, tipo, produtoCodigo, estado]);
  
  const handleDeleteRegistro = async (id: string) => {
    try {
      await deleteDoc(doc(db, "registros", id));
      showAlert("Registro excluído com sucesso!", "success");
      // Recarrega a lista para refletir a exclusão
      await carregarRegistros(); 
    } catch (error) {
      showAlert("Erro ao excluir o registro.", "error");
      console.error("Erro ao excluir registro: ", error);
    }
  };


  useEffect(() => {
    carregarRegistros();
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const produtosOptions = useMemo(() => {
    const options = Object.entries(produtosPorCodigo).map(([codigo, { produto }]) => ({
      value: codigo,
      label: `${codigo} - ${produto}`,
    }));

    if (!searchValue) {
       return [{ value: 'todos', label: 'Todos os Produtos' }, ...options];
    }
    
    const lowercasedSearch = searchValue.toLowerCase();

    const filtered = options.filter(({ label }) =>
      label.toLowerCase().includes(lowercasedSearch)
    );

    // Prioritize exact code match
    filtered.sort((a, b) => {
        const aIsExact = a.value === searchValue;
        const bIsExact = b.value === searchValue;
        if (aIsExact && !bIsExact) return -1;
        if (!aIsExact && bIsExact) return 1;
        return a.label.localeCompare(b.label);
    });

    return [{ value: 'todos', label: 'Todos os Produtos' }, ...filtered];
  }, [searchValue]);

  const canDeleteRecords = useMemo(() => {
    if (!userProfile) return false;
    return userProfile.role === 'admin' || (userProfile.permissions && userProfile.permissions.includes('delete_records'));
  }, [userProfile]);

  const exportarPDF = () => {
    if (registros.length === 0) {
        alert("Não há dados para exportar.");
        return;
    }
    const doc = new jsPDF({ orientation: 'landscape' }) as jsPDFWithAutoTable;
    doc.text("Relatório de Temperaturas", 14, 16);
    doc.autoTable({
        head: [['Data', 'Hora', 'Turno', 'Local', 'Produto', 'Tipo', 'Estado', 'T. Início', 'T. Meio', 'T. Fim']],
        body: registros.map(reg => [
            reg.dataManual,
            reg.horarioManual,
            reg.turno,
            reg.local,
            reg.produto,
            reg.tipo,
            reg.estado,
            reg.temperaturas.inicio.toFixed(1),
            reg.temperaturas.meio.toFixed(1),
            reg.temperaturas.fim.toFixed(1),
        ]),
        startY: 20,
        headStyles: {
            fillColor: [75, 0, 130] // Cor primária (Deep Indigo)
        }
    });
    doc.save('relatorio_temperaturas.pdf');
  };

  const exportarExcel = () => {
      if (registros.length === 0) {
        alert("Não há dados para exportar.");
        return;
      }
      const dadosParaExportar = registros.map(reg => ({
        'Data': reg.dataManual,
        'Hora': reg.horarioManual,
        'Turno': reg.turno,
        'Local': reg.local,
        'Código': reg.codigo,
        'Produto': reg.produto,
        'Tipo': reg.tipo,
        'Estado': reg.estado,
        'Temp. Início (°C)': reg.temperaturas.inicio.toFixed(1),
        'Temp. Meio (°C)': reg.temperaturas.meio.toFixed(1),
        'Temp. Fim (°C)': reg.temperaturas.fim.toFixed(1),
      }));

      const ws = XLSX.utils.json_to_sheet(dadosParaExportar);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Registros");
      XLSX.writeFile(wb, "relatorio_temperaturas.xlsx");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Visualizar Registros</h1>
      
      <Card>
        <Collapsible open={isFilterVisible} onOpenChange={setIsFilterVisible}>
          <CardHeader>
             <CollapsibleTrigger asChild>
                <div className='flex items-center justify-between cursor-pointer'>
                  <CardTitle>Filtros</CardTitle>
                   <Button variant="ghost" size="sm" className="w-auto">
                      <Filter className="mr-2 h-4 w-4" />
                       {isFilterVisible ? 'Ocultar Filtros' : 'Exibir Filtros'}
                       <ChevronDown className={cn("ml-2 h-4 w-4 transition-transform", isFilterVisible && "rotate-180")} />
                    </Button>
                </div>
            </CollapsibleTrigger>
          </CardHeader>
           <CollapsibleContent>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 items-end">
                  <div className="space-y-2">
                    <Label htmlFor="data-inicio">Data Inicial</Label>
                    <Input id="data-inicio" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="data-fim">Data Final</Label>
                    <Input id="data-fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="filtro-local">Local</Label>
                    <Select value={local} onValueChange={setLocal}>
                      <SelectTrigger id="filtro-local"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        <SelectItem value="todos">Todos os locais</SelectItem>
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
                  <div className="space-y-2">
                    <Label htmlFor="filtro-turno">Turno</Label>
                    <Select value={turno} onValueChange={setTurno}>
                      <SelectTrigger id="filtro-turno"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="1">1º Turno</SelectItem>
                        <SelectItem value="2">2º Turno</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="filtro-tipo">Mercado</Label>
                    <Select value={tipo} onValueChange={setTipo}>
                      <SelectTrigger id="filtro-tipo"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="MI">MI</SelectItem>
                        <SelectItem value="ME">ME</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="filtro-produto">Produto</Label>
                      <Popover open={open} onOpenChange={setOpen}>
                          <PopoverTrigger asChild>
                              <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={open}
                              className="w-full justify-between"
                              >
                              {produtoCodigo === "todos"
                                  ? "Todos os Produtos"
                                  : produtosOptions.find((p) => p.value === produtoCodigo)?.label}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0">
                              <Command>
                                <CommandInput 
                                  placeholder="Buscar produto..." 
                                  value={searchValue}
                                  onValueChange={setSearchValue}
                                />
                              <CommandList>
                                  <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                                  <CommandGroup>
                                      {produtosOptions.map((p) => (
                                      <CommandItem
                                          key={p.value}
                                          value={p.label}
                                          onSelect={(currentValue) => {
                                            const allOptions = Object.entries(produtosPorCodigo).map(([codigo, { produto }]) => ({ value: codigo, label: `${codigo} - ${produto}` }));
                                            const selectedOption = allOptions.find(opt => opt.label.toLowerCase() === currentValue.toLowerCase());
                                            setProdutoCodigo(selectedOption ? selectedOption.value : "todos")
                                            setOpen(false)
                                          }}
                                      >
                                          <Check
                                          className={cn(
                                              "mr-2 h-4 w-4",
                                              produtoCodigo === p.value ? "opacity-100" : "opacity-0"
                                          )}
                                          />
                                          {p.label}
                                      </CommandItem>
                                      ))}
                                  </CommandGroup>
                              </CommandList>
                              </Command>
                          </PopoverContent>
                      </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="filtro-estado">Estado</Label>
                    <Select value={estado} onValueChange={setEstado}>
                      <SelectTrigger id="filtro-estado"><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="Congelado">Congelado</SelectItem>
                        <SelectItem value="Resfriado">Resfriado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
           </CollapsibleContent>
         </Collapsible>
         <CardContent>
            <div className="flex flex-wrap items-center gap-4 pt-4 border-t">
                <div className='flex-grow'>
                    <Button onClick={carregarRegistros} disabled={loading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Filter className="mr-2 h-4 w-4" />}
                        Filtrar
                    </Button>
                </div>
                <div className='flex items-center gap-2'>
                    <Button variant={viewMode === 'cards' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('cards')} disabled={loading}>
                        <LayoutGrid className="h-4 w-4" />
                    </Button>
                     <Button variant={viewMode === 'table' ? 'secondary' : 'ghost'} size="icon" onClick={() => setViewMode('table')} disabled={loading}>
                        <Rows3 className="h-4 w-4" />
                    </Button>
                </div>
                <div className='flex items-center gap-2'>
                    <Button variant="outline" onClick={exportarExcel} disabled={loading || registros.length === 0}>
                        <FileDown className="mr-2 h-4 w-4" /> Excel
                    </Button>
                    <Button variant="outline" onClick={exportarPDF} disabled={loading || registros.length === 0}>
                        <FileText className="mr-2 h-4 w-4" /> PDF
                    </Button>
                </div>
            </div>
         </CardContent>
      </Card>
      
      {loading && <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
      {error && !loading && <p className="text-center text-red-500 py-4">{error}</p>}
      {success && !loading && <p className="text-center text-green-500 py-4">{success}</p>}
      
      {!loading && !error && registros.length > 0 && viewMode === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {registros.map((reg) => (
            <Card key={reg.id} className="shadow-lg flex flex-col">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg text-primary truncate">
                  {reg.produto}
                </CardTitle>
                <p className="text-sm text-muted-foreground pt-1 flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> 
                  {reg.local}
                </p>
              </CardHeader>
              <CardContent className="flex-grow text-sm space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Barcode className="h-4 w-4" />
                  <span><strong>Código:</strong> {reg.codigo || 'N/A'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                   <span><strong>Turno:</strong> {reg.turno}º</span>
                </div>
                 <div className="flex items-center gap-2 text-muted-foreground">
                   <Tag className="h-4 w-4" /> 
                   <span><strong>Tipo:</strong> {reg.tipo}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Snowflake className="h-4 w-4" />
                  <span><strong>Estado:</strong> {reg.estado}</span>
                </div>

                <div className="pt-3 space-y-2">
                  <h4 className="font-semibold text-primary flex items-center gap-2"><Thermometer className="h-4 w-4" />Temperaturas</h4>
                  <div className="flex items-center gap-2">
                    <Play className="h-4 w-4 text-green-600"/>
                    <span>Início: <strong>{reg.temperaturas.inicio.toFixed(1).replace('.', ',')}°C</strong></span>
                  </div>
                   <div className="flex items-center gap-2">
                    <Pause className="h-4 w-4 text-yellow-600"/>
                    <span>Meio: <strong>{reg.temperaturas.meio.toFixed(1).replace('.', ',')}°C</strong></span>
                  </div>
                   <div className="flex items-center gap-2">
                    <StopCircle className="h-4 w-4 text-red-600"/>
                    <span>Fim: <strong>{reg.temperaturas.fim.toFixed(1).replace('.', ',')}°C</strong></span>
                  </div>
                </div>
              </CardContent>
              <div className="p-6 pt-0 mt-auto text-xs text-muted-foreground flex justify-between items-center">
                  <div className='flex-grow'>
                    <p><strong>Data:</strong> {reg.dataManual}</p>
                    <p><strong>Horário:</strong> {reg.horarioManual}</p>
                  </div>
                   {canDeleteRecords && (
                     <AlertDialog>
                      <AlertDialogTrigger asChild>
                         <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Essa ação não pode ser desfeita. Isso excluirá permanentemente este registro.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteRegistro(reg.id)}
                            className='bg-destructive hover:bg-destructive/90'
                          >
                            Sim, excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && !error && registros.length > 0 && viewMode === 'table' && (
        <Card>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Data/Hora</TableHead>
                                <TableHead>Local</TableHead>
                                <TableHead>Produto</TableHead>
                                <TableHead>Turno</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">T. Início (°C)</TableHead>
                                <TableHead className="text-right">T. Meio (°C)</TableHead>
                                <TableHead className="text-right">T. Fim (°C)</TableHead>
                                {canDeleteRecords && <TableHead className="text-center">Ações</TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {registros.map((reg) => (
                                <TableRow key={reg.id}>
                                    <TableCell>
                                        <div className="font-medium">{reg.dataManual}</div>
                                        <div className="text-xs text-muted-foreground">{reg.horarioManual}</div>
                                    </TableCell>
                                    <TableCell>{reg.local}</TableCell>
                                    <TableCell>
                                        <div className="font-medium">{reg.produto}</div>
                                        <div className="text-xs text-muted-foreground">Cód: {reg.codigo || 'N/A'}</div>
                                    </TableCell>
                                    <TableCell>{reg.turno}</TableCell>
                                    <TableCell>{reg.tipo}</TableCell>
                                    <TableCell>{reg.estado}</TableCell>
                                    <TableCell className="text-right">{reg.temperaturas.inicio.toFixed(1)}</TableCell>
                                    <TableCell className="text-right">{reg.temperaturas.meio.toFixed(1)}</TableCell>
                                    <TableCell className="text-right">{reg.temperaturas.fim.toFixed(1)}</TableCell>
                                    {canDeleteRecords && (
                                      <TableCell className="text-center">
                                          <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon">
                                                  <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                              <AlertDialogHeader>
                                                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                  Essa ação não pode ser desfeita. Isso excluirá permanentemente este registro.
                                                </AlertDialogDescription>
                                              </AlertDialogHeader>
                                              <AlertDialogFooter>
                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                <AlertDialogAction
                                                  onClick={() => handleDeleteRegistro(reg.id)}
                                                  className='bg-destructive hover:bg-destructive/90'
                                                >
                                                  Sim, excluir
                                                </AlertDialogAction>
                                              </AlertDialogFooter>
                                            </AlertDialogContent>
                                          </AlertDialog>
                                      </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
      )}

    </div>
  );
}
