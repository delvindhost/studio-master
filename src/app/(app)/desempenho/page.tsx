
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Loader2, Filter, FileText, Users, Award, LineChart as LineChartIcon, Percent } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Tipos
type Registro = {
  id: string;
  userId: string;
  data: Timestamp;
};

type UserProfile = {
  id: string;
  nome: string;
  turno: '1' | '2' | '3';
  role: 'admin' | 'user';
};

type DesempenhoUsuario = {
  userId: string;
  nome: string;
  turno: string;
  registros: number;
};

type DesempenhoTurno = {
  name: string;
  'Total de Registros': number;
  'Usuários Ativos': number;
  'Média por Usuário': number;
};

export default function DesempenhoPage() {
  const { userProfile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [registros, setRegistros] = useState<Registro[]>([]);
  const [usuarios, setUsuarios] = useState<UserProfile[]>([]);

  const hoje = new Date();
  const primeiroDiaDoMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split('T')[0];
  const [dataInicio, setDataInicio] = useState(primeiroDiaDoMes);
  const [dataFim, setDataFim] = useState(hoje.toISOString().split('T')[0]);
  
  const relatorioRef = useRef<HTMLDivElement>(null);


  const carregarDados = useCallback(async () => {
    if (userProfile?.role !== 'admin') return;

    setLoading(true);
    setError(null);
    try {
      const inicio = new Date(`${dataInicio}T00:00:00`);
      const fim = new Date(`${dataFim}T23:59:59`);

      // Carregar registros
      const registrosQuery = query(
        collection(db, 'registros'),
        where('data', '>=', Timestamp.fromDate(inicio)),
        where('data', '<=', Timestamp.fromDate(fim)),
        orderBy('data', 'desc')
      );
      const registrosSnapshot = await getDocs(registrosQuery);
      const dadosRegistros: Registro[] = [];
      registrosSnapshot.forEach((doc) => {
        dadosRegistros.push({ id: doc.id, ...doc.data() } as Registro);
      });
      setRegistros(dadosRegistros);

      // Carregar usuários
      const usuariosQuery = query(collection(db, 'users'), where('role', '==', 'user'));
      const usuariosSnapshot = await getDocs(usuariosQuery);
      const dadosUsuarios: UserProfile[] = [];
      usuariosSnapshot.forEach((doc) => {
        dadosUsuarios.push({ id: doc.id, ...doc.data() } as UserProfile);
      });
      setUsuarios(dadosUsuarios);

      if (dadosRegistros.length === 0) {
        setError("Nenhum registro de temperatura encontrado para o período selecionado.");
      }

    } catch (err) {
      console.error(err);
      setError('Erro ao carregar dados de desempenho. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim, userProfile]);

  useEffect(() => {
    if (!authLoading) {
      if (userProfile?.role !== 'admin') {
        router.replace('/');
      } else {
        carregarDados();
      }
    }
  }, [userProfile, authLoading, router, carregarDados]);


  const desempenhoData = useMemo(() => {
    if (registros.length === 0 || usuarios.length === 0) {
      return { ranking: [], porTurno: [] };
    }

    const desempenhoPorUsuario: DesempenhoUsuario[] = usuarios.map(u => ({
      userId: u.id,
      nome: u.nome,
      turno: `${u.turno}º Turno`,
      registros: registros.filter(r => r.userId === u.id).length
    }));

    const ranking = [...desempenhoPorUsuario].sort((a, b) => b.registros - a.registros);

    const turnos = ['1', '2', '3'];
    const porTurno: DesempenhoTurno[] = turnos.map(turno => {
      const nomeTurno = `${turno}º Turno`;
      const usuariosDoTurno = usuarios.filter(u => u.turno === turno);
      const registrosDoTurno = desempenhoPorUsuario
        .filter(d => d.turno === nomeTurno)
        .reduce((acc, curr) => acc + curr.registros, 0);
      
      const usuariosAtivos = usuariosDoTurno.filter(u => 
        desempenhoPorUsuario.some(d => d.userId === u.id && d.registros > 0)
      ).length;

      const mediaPorUsuario = usuariosAtivos > 0 ? (registrosDoTurno / usuariosAtivos) : 0;

      return {
        name: nomeTurno,
        'Total de Registros': registrosDoTurno,
        'Usuários Ativos': usuariosAtivos,
        'Média por Usuário': parseFloat(mediaPorUsuario.toFixed(2)),
      };
    });

    return { ranking, porTurno };
  }, [registros, usuarios]);
  
  const kpis = useMemo(() => {
    const totalRegistros = registros.length;
    const usuariosAtivos = new Set(registros.map(r => r.userId)).size;
    const turnoMaisProdutivo = [...desempenhoData.porTurno].sort((a,b) => b['Total de Registros'] - a['Total de Registros'])[0];
    
    return {
      totalRegistros,
      usuariosAtivos,
      turnoMaisProdutivo: turnoMaisProdutivo ? turnoMaisProdutivo.name : 'N/A'
    };
  }, [registros, desempenhoData.porTurno]);

 const exportarRelatorioPDF = async () => {
    if (!relatorioRef.current) return;
    setLoading(true);
    
    const doc = new jsPDF('p', 'mm', 'a4');
    const content = relatorioRef.current;
    
    // Adicionar um fundo branco temporário para a captura
    content.style.backgroundColor = 'white';

    try {
        const canvas = await html2canvas(content, { 
            scale: 2, 
            useCORS: true,
            backgroundColor: '#ffffff'
        });

        // Remover o fundo branco após a captura
        content.style.backgroundColor = '';

        const imgData = canvas.toDataURL('image/png');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const imageMargin = 10;
        const imageWidth = pageWidth - imageMargin * 2;
        const imageHeight = (canvas.height * imageWidth) / canvas.width;
        
        let heightLeft = imageHeight;
        let position = 0;

        doc.addImage(imgData, 'PNG', imageMargin, position, imageWidth, imageHeight);
        heightLeft -= (pageHeight - imageMargin * 2);

        while (heightLeft > 0) {
            position -= (pageHeight - imageMargin * 2);
            doc.addPage();
            doc.addImage(imgData, 'PNG', imageMargin, position, imageWidth, imageHeight);
            heightLeft -= (pageHeight - imageMargin * 2);
        }
        
        doc.save(`relatorio_desempenho_${dataInicio}_a_${dataFim}.pdf`);

    } catch (error) {
        console.error("Erro ao exportar PDF:", error);
        setError("Ocorreu um erro ao gerar o PDF do relatório.");
    } finally {
        setLoading(false);
        // Garante a remoção do fundo em caso de erro também
        content.style.backgroundColor = '';
    }
  };


  if (authLoading || (!userProfile && !error)) {
    return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  
  if (userProfile?.role !== 'admin') {
      return (
        <div className="flex h-full w-full items-center justify-center">
            <p className="text-red-500">Acesso negado. Esta página é restrita a gestores.</p>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-primary">Desempenho da Equipe</h1>
        <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
                <Label htmlFor="data-inicio">De:</Label>
                <Input id="data-inicio" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-auto" disabled={loading}/>
            </div>
            <div className="flex items-center gap-2">
                <Label htmlFor="data-fim">Até:</Label>
                <Input id="data-fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-auto" disabled={loading}/>
            </div>
             <Button onClick={carregarDados} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Filter className="mr-2 h-4 w-4" />}
                  Filtrar
              </Button>
              <Button variant="outline" onClick={exportarRelatorioPDF} disabled={loading || registros.length === 0}>
                <FileText className="mr-2 h-4 w-4" /> Exportar PDF
            </Button>
        </div>
      </div>
      
      {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : error ? (
          <p className="text-center text-red-500 py-8">{error}</p>
      ) : (
        <div ref={relatorioRef} className="space-y-6 bg-background p-4 rounded-lg">
            {/* Cards de KPIs */}
            <div className="grid gap-6 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Registros</CardTitle>
                        <LineChartIcon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpis.totalRegistros}</div>
                        <p className="text-xs text-muted-foreground">no período selecionado</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpis.usuariosAtivos}</div>
                        <p className="text-xs text-muted-foreground">colaboradores com registros</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Turno Destaque</CardTitle>
                        <Award className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{kpis.turnoMaisProdutivo}</div>
                        <p className="text-xs text-muted-foreground">com mais registros no período</p>
                    </CardContent>
                </Card>
            </div>
            
            {/* Gráficos e Tabelas */}
            <div className="grid gap-6 lg:grid-cols-5">
                <Card className="lg:col-span-3">
                   <CardHeader>
                       <CardTitle>Análise Comparativa por Turno</CardTitle>
                       <CardDescription>Desempenho geral de cada turno no período.</CardDescription>
                   </CardHeader>
                   <CardContent className='h-[350px]'>
                       <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={desempenhoData.porTurno}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="Total de Registros" fill="#4B0082" />
                              <Bar dataKey="Média por Usuário" fill="#8A2BE2" />
                          </BarChart>
                      </ResponsiveContainer>
                   </CardContent>
                </Card>
                
                 <Card className="lg:col-span-2">
                   <CardHeader>
                       <CardTitle>Ranking de Colaboradores</CardTitle>
                       <CardDescription>Top 10 usuários com mais registros.</CardDescription>
                   </CardHeader>
                   <CardContent>
                       <Table>
                           <TableHeader>
                               <TableRow>
                                   <TableHead>Colaborador</TableHead>
                                   <TableHead>Turno</TableHead>
                                   <TableHead className="text-right">Registros</TableHead>
                               </TableRow>
                           </TableHeader>
                           <TableBody>
                               {desempenhoData.ranking.slice(0, 10).map(u => (
                                   <TableRow key={u.userId}>
                                       <TableCell className="font-medium">{u.nome}</TableCell>
                                       <TableCell>{u.turno}</TableCell>
                                       <TableCell className="text-right font-bold">{u.registros}</TableCell>
                                   </TableRow>
                               ))}
                           </TableBody>
                       </Table>
                   </CardContent>
                </Card>
            </div>
        </div>
      )}
    </div>
  );
}
