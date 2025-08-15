'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { Loader2, TrendingUp, TrendingDown, Thermometer, Box, Users, GitCompareArrows, AlertTriangle, User, MapPin } from 'lucide-react';

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

type DailyEntry = {
    date: string;
    'Lançamentos': number;
}

type TemperatureAlert = {
    id: string;
    produto: string;
    local: string;
    temperaturas: { inicio: number; meio: number; fim: number };
    userName: string;
};

const COLORS = ['#4B0082', '#8A2BE2', '#9370DB', '#BA55D3', '#C71585', '#DB7093'];

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Registro[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [userActivity, setUserActivity] = useState<UserActivity[]>([]);
  const [temperatureAlerts, setTemperatureAlerts] = useState<TemperatureAlert[]>([]);
  
  const today = new Date();
  const [startDate, setStartDate] = useState(today.toISOString().split('T')[0]);
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
       
        setUserActivity(activityData);

        // Processar Alertas de Temperatura
        const alerts: TemperatureAlert[] = [];
        data.forEach(reg => {
            if (reg.tipo === 'ME' && reg.estado === 'Congelado') {
                const { inicio, meio, fim } = reg.temperaturas;
                if (inicio > -18 || meio > -18 || fim > -18) {
                    const user = users.find(u => u.id === reg.userId);
                    alerts.push({
                        id: reg.id,
                        produto: reg.produto,
                        local: reg.local,
                        temperaturas: reg.temperaturas,
                        userName: user ? user.nome : 'Usuário desconhecido'
                    });
                }
            }
        });
        setTemperatureAlerts(alerts);
    } else {
        setUserActivity([]);
        setTemperatureAlerts([]);
    }
  }, [data, users]);


  const { dashboardData, dailyEntriesData } = useMemo(() => {
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
      const key = curr.produto || 'N/A';
      const avgTemp = (curr.temperaturas.inicio + curr.temperaturas.meio + curr.temperaturas.fim) / 3;
      if (!acc[key]) {
        acc[key] = { total: 0, count: 0 };
      }
      acc[key].total += avgTemp;
      acc[key].count++;
      return acc;
    }, {} as Record<string, { total: number; count: number }>);
    
    const productAverages: ProductTemp[] = Object.entries(productTemps).map(([name, { total, count }]) => ({
      name,
      avgTemp: total / count,
    }));
    
    const top5Highest = [...productAverages].sort((a, b) => b.avgTemp - a.avgTemp).slice(0, 5);
    const top5Lowest = [...productAverages].sort((a, b) => a.avgTemp - b.avgTemp).slice(0, 5);
    
    const dailyCounts = data.reduce((acc, curr) => {
        const date = curr.data.toDate().toLocaleDateString('pt-BR');
        if(!acc[date]) {
            acc[date] = 0;
        }
        acc[date]++;
        return acc;
    }, {} as Record<string, number>);

    const dailyEntries: DailyEntry[] = Object.entries(dailyCounts)
        .map(([date, count]) => ({ date, 'Lançamentos': count }))
        .sort((a,b) => new Date(a.date.split('/').reverse().join('-')).getTime() - new Date(b.date.split('/').reverse().join('-')).getTime());


    return { 
        dashboardData: { totalRegistros, setoresAferidos, avgMI, avgME, top5Highest, top5Lowest },
        dailyEntriesData: dailyEntries,
    };
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
      
       {/* Alertas de Temperatura Crítica */}
      {temperatureAlerts.length > 0 && (
        <Card className="border-destructive bg-destructive/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle /> Alerta de Temperatura Crítica
            </CardTitle>
            <CardDescription className="text-destructive/80">
              Os seguintes produtos congelados (ME) estão com temperatura acima do limite de -18°C. Ação imediata necessária.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {temperatureAlerts.map(alert => (
                <div key={alert.id} className="p-3 rounded-md border border-destructive/30 bg-background/50">
                  <p className="font-bold text-primary">{alert.produto}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 text-sm mt-1">
                      <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground"/> <strong>Local:</strong> {alert.local}</p>
                      <p className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground"/> <strong>Usuário:</strong> {alert.userName}</p>
                  </div>
                  <div className="mt-2 text-sm">
                      <p><strong>Temperaturas Medidas (Ideal: ≤ -18,0°C):</strong></p>
                      <div className="flex gap-4">
                          <span className={alert.temperaturas.inicio > -18 ? 'text-destructive font-bold' : ''}>Início: {alert.temperaturas.inicio.toFixed(1).replace('.',',')}°C</span>
                          <span className={alert.temperaturas.meio > -18 ? 'text-destructive font-bold' : ''}>Meio: {alert.temperaturas.meio.toFixed(1).replace('.',',')}°C</span>
                          <span className={alert.temperaturas.fim > -18 ? 'text-destructive font-bold' : ''}>Fim: {alert.temperaturas.fim.toFixed(1).replace('.',',')}°C</span>
                      </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
                  <div className="text-2xl font-bold">{dashboardData.avgMI.toFixed(2).replace('.',',')}°C</div>
                   <p className="text-xs text-muted-foreground">Mercado Interno</p>
              </CardContent>
          </Card>
          <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Média Temp. ME</CardTitle>
                  <Thermometer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                  <div className="text-2xl font-bold">{dashboardData.avgME.toFixed(2).replace('.',',')}°C</div>
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
                   {dashboardData.top5Highest.length > 0 ? (
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
                                       <TableCell className="text-right">{p.avgTemp.toFixed(2).replace('.',',')}°C</TableCell>
                                   </TableRow>
                               ))}
                           </TableBody>
                       </Table>
                   ) : <p className="text-sm text-muted-foreground text-center py-4">Sem dados para exibir.</p>}
               </CardContent>
           </Card>
           <Card>
               <CardHeader>
                   <CardTitle className="flex items-center gap-2"><TrendingDown className="text-blue-500"/> Top 5 - Menores Médias</CardTitle>
                   <CardDescription>Produtos com as temperaturas médias mais baixas.</CardDescription>
               </CardHeader>
               <CardContent>
                   {dashboardData.top5Lowest.length > 0 ? (
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
                                       <TableCell className="text-right">{p.avgTemp.toFixed(2).replace('.',',')}°C</TableCell>
                                   </TableRow>
                               ))}
                           </TableBody>
                       </Table>
                    ) : <p className="text-sm text-muted-foreground text-center py-4">Sem dados para exibir.</p>}
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
                {userActivity.length > 0 && userActivity.some(u => u.entries > 0) ? (
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie
                            data={userActivity.filter(u => u.entries > 0)}
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
                ) : <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Nenhuma atividade de usuário registrada no período.</p></div>}
            </CardContent>
          </Card>

          <Card>
             <CardHeader>
                <CardTitle>Lançamentos Diários</CardTitle>
                 <CardDescription>Total de registros por dia no período.</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
                {dailyEntriesData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyEntriesData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="Lançamentos" fill="#8A2BE2" />
                        </BarChart>
                    </ResponsiveContainer>
                ) : <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Nenhum lançamento no período.</p></div>}
            </CardContent>
          </Card>
       </div>

    </div>
  );
}

