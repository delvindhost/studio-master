
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Bar, LineChart, Line, ResponsiveContainer, Legend } from 'recharts';
import { Loader2, Filter, ChevronsUpDown, Check, FileText, ChevronDown } from 'lucide-react';
import { produtosPorCodigo } from '@/lib/produtos';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

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

const CHART_PAGE_SIZE = 45;

// Componente principal da página
export default function GraficosPage() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hoje = new Date().toISOString().split('T')[0];
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);
  const [local, setLocal] = useState('todos');
  const [tipo, setTipo] = useState('todos');
  const [produtoCodigo, setProdutoCodigo] = useState('todos');
  const [turno, setTurno] = useState('todos');
  const [estado, setEstado] = useState('todos');

  const [isFilterVisible, setIsFilterVisible] = useState(false);

  // Refs for charts
  const graficoContainerRef = useRef<HTMLDivElement>(null);


  // --- Combobox state ---
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("");

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


  const carregarDados = async () => {
    setLoading(true);
    setError(null);
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

      if (local !== 'todos') q = query(q, where('local', '==', local));
      if (tipo !== 'todos') q = query(q, where('tipo', '==', tipo));
      if (produtoCodigo !== 'todos') q = query(q, where('codigo', '==', produtoCodigo));
      if (turno !== 'todos') q = query(q, where('turno', '==', turno));
      if (estado !== 'todos') q = query(q, where('estado', '==', estado));
      

      const querySnapshot = await getDocs(q);
      const dados: Registro[] = [];
      querySnapshot.forEach((doc) => {
        const docData = doc.data();
        dados.push({ 
            id: doc.id, 
            ...docData,
            data: docData.data, // Mantém o timestamp
        } as Registro);
      });
      
      setRegistros(dados);

      if (dados.length === 0) {
        setError('Nenhum dado encontrado para os filtros selecionados.');
      }

    } catch (err) {
      console.error(err);
      setError('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
 const exportarGraficosPDF = async () => {
    if (!graficoContainerRef.current) {
        setError("Não foi possível encontrar a área dos gráficos para exportar.");
        return;
    }
    setLoading(true);
    
    const doc = new jsPDF('p', 'mm', 'a4');
    const chartElements = Array.from(graficoContainerRef.current.querySelectorAll('.chart-card-export'));

    try {
        for (let i = 0; i < chartElements.length; i++) {
            const element = chartElements[i] as HTMLElement;
            
            const canvas = await html2canvas(element, { 
                scale: 2, 
                useCORS: true,
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const imageMargin = 15;
            const imageWidth = pageWidth - imageMargin * 2;
            const imageHeight = (canvas.height * imageWidth) / canvas.width;

            if (i > 0) {
                doc.addPage();
            }

            doc.addImage(imgData, 'PNG', imageMargin, imageMargin, imageWidth, imageHeight);
        }
        
        doc.save('relatorio_graficos.pdf');
    } catch (error) {
        console.error("Erro ao exportar PDF:", error);
        setError("Ocorreu um erro ao gerar o PDF dos gráficos.");
    } finally {
        setLoading(false);
    }
};


  const dadosGraficoProduto = useMemo(() => {
    const data = registros.reduce((acc, reg) => {
        const key = reg.produto || 'N/A';
        if(!acc[key]) {
            acc[key] = { name: key, total: 0, count: 0 };
        }
        const tempSum = reg.temperaturas.inicio + reg.temperaturas.meio + reg.temperaturas.fim;
        acc[key].total += tempSum;
        acc[key].count += 3;
        return acc;
    }, {} as Record<string, {name: string, total: number, count: number}>);

    return Object.values(data).map(item => ({
        name: item.name,
        'Temperatura Média': parseFloat((item.total / item.count).toFixed(2))
    })).sort((a,b) => a.name.localeCompare(b.name));
  }, [registros]);

  const paginatedDadosGraficoProduto = useMemo(() => {
    if (dadosGraficoProduto.length === 0) return [];
    
    const chunks = [];
    for (let i = 0; i < dadosGraficoProduto.length; i += CHART_PAGE_SIZE) {
        chunks.push(dadosGraficoProduto.slice(i, i + CHART_PAGE_SIZE));
    }
    return chunks;
  }, [dadosGraficoProduto]);

  const dadosGraficoLocal = useMemo(() => {
      const data = registros.reduce((acc, reg) => {
          const key = reg.local || 'N/A';
          if(!acc[key]) {
              acc[key] = { name: key, inicio: 0, meio: 0, fim: 0, count: 0};
          }
          acc[key].inicio += reg.temperaturas.inicio;
          acc[key].meio += reg.temperaturas.meio;
          acc[key].fim += reg.temperaturas.fim;
          acc[key].count += 1;
          return acc;
      }, {} as Record<string, {name: string, inicio: number, meio: number, fim: number, count: number}>);

      return Object.values(data).map(item => ({
          name: item.name,
          'Início': parseFloat((item.inicio / item.count).toFixed(2)),
          'Meio': parseFloat((item.meio / item.count).toFixed(2)),
          'Fim': parseFloat((item.fim / item.count).toFixed(2)),
      }));
  }, [registros]);

  const dadosGraficoVariacao = useMemo(() => {
      // Ordena por data para o gráfico de linhas
      const sortedRegistros = [...registros].sort((a, b) => a.data.toMillis() - b.data.toMillis());
      return sortedRegistros.map(reg => ({
          name: `${reg.data.toDate().toLocaleDateString('pt-BR')} ${reg.data.toDate().toLocaleTimeString('pt-BR')}`,
          'Início': reg.temperaturas.inicio,
          'Meio': reg.temperaturas.meio,
          'Fim': reg.temperaturas.fim,
      }));
  }, [registros]);


  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary">Análise de Temperaturas</h1>
      
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
           <CardContent>
              <div className="flex flex-wrap gap-4 pt-4 border-t">
                  <Button onClick={carregarDados} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Filter className="mr-2 h-4 w-4" />}
                  Atualizar Gráficos
                  </Button>
                  <Button variant="outline" onClick={exportarGraficosPDF} disabled={loading || registros.length === 0}>
                      <FileText className="mr-2 h-4 w-4" /> Exportar PDF
                  </Button>
              </div>
           </CardContent>
        </Collapsible>
      </Card>
      
        {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : error ? (
            <p className="text-center text-red-500 py-8">{error}</p>
        ) : (
        <div className='space-y-6' id="graficos-container" ref={graficoContainerRef}>
            {paginatedDadosGraficoProduto.map((dataChunk, index) => (
              <Card key={`produto-chart-${index}`} className="chart-card-export">
                  <CardHeader>
                      <CardTitle>
                          Temperatura Média por Produto
                          {paginatedDadosGraficoProduto.length > 1 && ` (Parte ${index + 1} de ${paginatedDadosGraficoProduto.length})`}
                      </CardTitle>
                  </CardHeader>
                  <CardContent className='h-[500px]'>
                       <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={dataChunk} margin={{ top: 5, right: 30, left: 20, bottom: 150 }}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} tick={{ fontSize: 12 }} />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="Temperatura Média" fill="hsl(var(--primary))" />
                          </BarChart>
                      </ResponsiveContainer>
                  </CardContent>
              </Card>
            ))}

            <Card className="chart-card-export">
                <CardHeader>
                    <CardTitle>Média de Temperaturas por Local</CardTitle>
                </CardHeader>
                <CardContent className='h-[400px]'>
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dadosGraficoLocal}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="Início" fill="#4B0082" />
                            <Bar dataKey="Meio" fill="#DC2626" />
                            <Bar dataKey="Fim" fill="#FBBF24" />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

             <Card className="chart-card-export">
                <CardHeader>
                    <CardTitle>Variação de Temperaturas no Período</CardTitle>
                </CardHeader>
                <CardContent className='h-[400px]'>
                     <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={dadosGraficoVariacao}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" angle={-20} textAnchor="end" height={60} interval={'preserveStartEnd'}/>
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="Início" stroke="#4B0082" activeDot={{ r: 8 }} />
                            <Line type="monotone" dataKey="Meio" stroke="#DC2626" />
                            <Line type="monotone" dataKey="Fim" stroke="#FBBF24" />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
      )}
    </div>
  );
}
