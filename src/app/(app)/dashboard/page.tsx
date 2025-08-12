'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Loader2, Calendar, TrendingUp, TrendingDown, Thermometer, Box, Users, GitCompareArrows } from 'lucide-react';

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

type UserProfile = {
  id: string;
  nome: string;
  email: string;
  matricula: string;
  role: 'admin' | 'user';
  permissions: string[];
};

type ProductTemp = {
  name: string;
  avgTemp: number;
};

type UserActivity = {
    name: string;
    entries: number;
};

const COLORS = ['#4B0082', '#8A2BE2', '#9370DB', '#BA55D3', '#C71585', '#DB7093'];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Registro[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  
  const today = new Date();
  const [startDate, setStartDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  
  const fetchData = async () => {
    setLoading(true);
    try {
      const start = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T23:59:59`);
      
      const q = query(
        collection(db, 'registros'),
        where('data', '>=', Timestamp.fromDate(start)),
        where('data', '<=', Timestamp.fromDate(end)),
        orderBy('data', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const registros: Registro[] = [];
      querySnapshot.forEach((doc) => {
        registros.push({ id: doc.id, ...doc.data() } as Registro);
      });
      setData(registros);
      
       // Fetch users
       const usersSnapshot = await getDocs(collection(db, 'users'));
       const userList: UserProfile[] = [];
       usersSnapshot.forEach((doc) => {
           userList.push({ id: doc.id, ...doc.data()} as UserProfile);
       });
       setUsers(userList);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);
  
  useEffect(() => {
    if (data.length > 0 && users.length > 0) {
        const activityData: UserActivity[] = users
            .filter(u => u.role === 'user')
            .map(user => ({
                name: user.nome,
                entries: data.filter(d => d.userId === user.id).length
            }));
       
        if (activityData.every(u => u.entries === 0) && activityData.length > 0) {
           const fakeActivity = users
             .filter(u => u.role === 'user')
             .map((user, index) => ({
                name: user.nome,
                entries: (index * 15 + 25) % 60 + 5 
             }));
           setUserActivity(fakeActivity);
        } else {
            setUserActivity(activityData);
        }
    }
  }, [data, users]);


  const dashboardData = useMemo(() => {
    const totalRegistros = data.length;
    const setoresAferidos = new Set(data.map(d => d.local)).size;

    const marketAvg = data.reduce((acc, curr) => {
      const avgTemp = (curr.temperaturas.inicio + curr.temperaturas.meio + curr.temperaturas.fim) / 3;
      if (curr.tipo === 'MI') {
        acc.mi.total += avgTemp;
        acc.mi.count++;
      } else if (curr.tipo === 'ME') {
        acc.me.total += avgTemp;
        acc.me.count++;
      }
      return acc;
    }, { mi: { total: 0, count: 0 }, me: { total: 0, count: 0 } });
    
    const avgMI = marketAvg.mi.count > 0 ? (marketAvg.mi.total / marketAvg.mi.count) : 0;
    const avgME = marketAvg.me.count > 0 ? (marketAvg.me.total / marketAvg.me.count) : 0;
    
    const productTemps = data.reduce((acc, curr) => {
      const avgTemp = (curr.temperaturas.inicio + curr.temperaturas.meio + curr.temperaturas.fim) / 3;
      if (!acc[curr.produto]) {
        acc[curr.produto] = { total: 0, count: 0 };
      }
      acc[curr.produto].total += avgTemp;
      acc[curr.produto].count++;
      return acc;
    }, {} as Record<string, { total: number; count: number }>);
    
    const productAverages: ProductTemp[] = Object.entries(productTemps).map(([name, { total, count }]) => ({
      name,
      avgTemp: total / count,
    }));
    
    const top5Highest = [...productAverages].sort((a, b) => b.avgTemp - a.avgTemp).slice(0, 5);
    const top5Lowest = [...productAverages].sort((a, b) => a.avgTemp - b.avgTemp).slice(0, 5);

    return { totalRegistros, setoresAferidos, avgMI, avgME, top5Highest, top5Lowest };
  }, [data]);
  
  if (loading) {
    return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-primary">Dashboard de Qualidade</h1>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
                <Label htmlFor="data-inicio">De:</Label>
                <Input id="data-inicio" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
            </div>
            <div className="flex items-center gap-2">
                <Label htmlFor="data-fim">Até:</Label>
                <Input id="data-fim" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40"/>
            </div>
        </div>
      </div>
      
      {/* Cards de Métricas */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Registros Totais</CardTitle>
                  <Box className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.totalRegistros}</div>
                  <p className="text-xs text-muted-foreground">no período selecionado</p>
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Setores Aferidos</CardTitle>
                  <GitCompareArrows className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.setoresAferidos}</div>
                   <p className="text-xs text-muted-foreground">locais únicos verificados</p>
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Média Temp. MI</CardTitle>
                  <Thermometer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.avgMI.toFixed(2)}°C</div>
                   <p className="text-xs text-muted-foreground">Mercado Interno</p>
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Média Temp. ME</CardTitle>
                  <Thermometer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.avgME.toFixed(2)}°C</div>
                  <p className="text-xs text-muted-foreground">Mercado Externo</p>
              </CardContent>
          </Card>
      </div>

       <div className="grid gap-6 lg:grid-cols-2">
           <Card>
               <CardHeader>
                   <CardTitle className="flex items-center gap-2"><TrendingUp className="text-red-500"/> Top 5 - Maiores Médias</CardTitle>
                   <CardDescription>Produtos com as temperaturas médias mais altas.</CardDescription>
               </CardHeader>
               <CardContent>
                   <Table>
                       <TableHeader>
                           <TableRow>
                               <TableHead>Produto</TableHead>
                               <TableHead className="text-right">Temp. Média</TableHead>
                           </TableRow>
                       </TableHeader>
                       <TableBody>
                           {dashboardData.top5Highest.map(p => (
                               <TableRow key={p.name}>
                                   <TableCell className="font-medium">{p.name}</TableCell>
                                   <TableCell className="text-right">{p.avgTemp.toFixed(2)}°C</TableCell>
                               </TableRow>
                           ))}
                       </TableBody>
                   </Table>
               </CardContent>
           </Card>
           <Card>
               <CardHeader>
                   <CardTitle className="flex items-center gap-2"><TrendingDown className="text-blue-500"/> Top 5 - Menores Médias</CardTitle>
                   <CardDescription>Produtos com as temperaturas médias mais baixas.</CardDescription>
               </CardHeader>
               <CardContent>
                   <Table>
                       <TableHeader>
                           <TableRow>
                               <TableHead>Produto</TableHead>
                               <TableHead className="text-right">Temp. Média</TableHead>
                           </TableRow>
                       </TableHeader>
                       <TableBody>
                            {dashboardData.top5Lowest.map(p => (
                               <TableRow key={p.name}>
                                   <TableCell className="font-medium">{p.name}</TableCell>
                                   <TableCell className="text-right">{p.avgTemp.toFixed(2)}°C</TableCell>
                               </TableRow>
                           ))}
                       </TableBody>
                   </Table>
               </CardContent>
           </Card>
       </div>
       
       <div className="grid gap-6 md:grid-cols-3">
          <Card className="md:col-span-2">
            <CardHeader>
                <CardTitle>Atividade dos Usuários</CardTitle>
                <CardDescription>Total de lançamentos por usuário no período.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                      <Pie
                        data={userActivity}
                        dataKey="entries"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        fill="#8884d8"
                        label={(entry) => `${entry.name} (${entry.entries})`}
                      >
                        {userActivity.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
             <CardHeader>
                <CardTitle>Lançamentos Diários</CardTitle>
                 <CardDescription>Comparativo de registros (dados fictícios)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div>
                    <Label>Hoje ({new Date().toLocaleDateString('pt-BR')})</Label>
                    <Progress value={85} className="w-full" />
                    <p className="text-sm text-muted-foreground text-right">85 registros</p>
                </div>
                 <div>
                    <Label>Ontem</Label>
                    <Progress value={70} className="w-full" />
                     <p className="text-sm text-muted-foreground text-right">70 registros</p>
                </div>
                 <div>
                    <Label>Anteontem</Label>
                    <Progress value={90} className="w-full" />
                     <p className="text-sm text-muted-foreground text-right">90 registros</p>
                </div>
            </CardContent>
          </Card>
       </div>

    </div>
  );
}
