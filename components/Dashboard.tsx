
import React, { useState, useEffect } from 'react';
import { Client, ServiceType } from '../types';
import { StatCard } from './StatCard';
import { CustomSelect } from './CustomSelect';
import { Users, AlertTriangle, DollarSign, TrendingUp, Calendar, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { supabase } from '../services/supabase';

interface DashboardProps {
  clients: Client[];
}

export const Dashboard: React.FC<DashboardProps> = ({ clients }) => {
  const [selectedServiceType, setSelectedServiceType] = useState<string>('');
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);

  useEffect(() => {
    fetchServiceTypes();
  }, []);

  const fetchServiceTypes = async () => {
    const { data } = await supabase.from('service_types').select('*').order('name');
    if (data) setServiceTypes(data);
  };

  const filteredClients = selectedServiceType
    ? clients.filter(c => c.service_type === selectedServiceType)
    : clients;

  // Calculate Stats based on filtered inputs
  const activeClients = filteredClients.filter(c => c.status === 'active' || c.status === 'expiring').length;
  const expiringSoon = filteredClients.filter(c => c.status === 'expiring').length;
  const totalRevenue = filteredClients
    .filter(c => c.status === 'active' || c.status === 'expiring')
    .reduce((acc, curr) => acc + curr.amount, 0);

  /* Chart Logic */
  const [timeRange, setTimeRange] = useState<number>(6); // Default 6 months
  const [chartMetric, setChartMetric] = useState<'clients' | 'revenue'>('clients');

  const generateChartData = () => {
    const data = [];
    const today = new Date();

    // Iterate backwards from current month
    for (let i = timeRange - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthName = d.toLocaleString('pt-BR', { month: 'short' });

      // Define month range
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);

      // Filter active clients in this specific month
      const activeInMonth = filteredClients.filter(c => {
        if (!c.start_date || !c.end_date) return false;
        // Parse as UTC to avoid timezone issues
        const startParts = c.start_date.split('-');
        const start = new Date(Date.UTC(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2])));

        const endParts = c.end_date.split('-');
        const end = new Date(Date.UTC(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2])));

        const mStart = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1));
        const mEnd = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0));

        return start <= mEnd && end >= mStart;
      });

      // Count expirations in this month (for Renewal Trend)
      const expiringInMonth = filteredClients.filter(c => {
        if (!c.end_date) return false;
        const endParts = c.end_date.split('-');
        const end = new Date(Date.UTC(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2])));

        const mStart = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1));
        const mEnd = new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0));

        return end >= mStart && end <= mEnd;
      }).length;

      const count = activeInMonth.length;
      const revenue = activeInMonth.reduce((acc, curr) => acc + (curr.amount || 0), 0);

      data.push({
        name: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        active: count,
        revenue: revenue,
        expiring: expiringInMonth
      });
    }
    return data;
  };

  const chartData = generateChartData();

  // Calculate Trends
  const currentMonthData = chartData[chartData.length - 1] || { active: 0, revenue: 0, expiring: 0 };
  const prevMonthData = chartData[chartData.length - 2] || { active: 0, revenue: 0, expiring: 0 };

  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? "+100%" : "0%";
    const diff = ((current - previous) / previous) * 100;
    return `${diff > 0 ? '+' : ''}${diff.toFixed(1)}%`;
  };

  const clientsTrend = calculateTrend(currentMonthData.active, prevMonthData.active);
  const clientsTrendUp = currentMonthData.active >= prevMonthData.active;

  const revenueTrend = calculateTrend(currentMonthData.revenue, prevMonthData.revenue);
  const revenueTrendUp = currentMonthData.revenue >= prevMonthData.revenue;

  const renewalsTrend = calculateTrend(currentMonthData.expiring, prevMonthData.expiring);
  // For renewals, "Up" might be considered bad (more work/risk) or good (opportunity)? 
  // Usually usually high renewals volume is neutral, but let's keep green for "more opportunities to renew".
  // Or maybe validly neutral. Let's assume green = trend up.
  const renewalsTrendUp = currentMonthData.expiring >= prevMonthData.expiring;

  // Retention Rate: Active / (Active + Expired *Total All Time? Or recent?*)
  // Standard retention is usually over a period.
  // Simple view: Current Active / (Current Active + Current Expired in DB)
  // This gives a snapshot of "How many people stayed vs left".
  const expiredCount = filteredClients.filter(c => c.status === 'expired').length;
  const totalConsidered = activeClients + expiredCount;
  const retentionRate = totalConsidered > 0 ? ((activeClients / totalConsidered) * 100).toFixed(1) : '100';


  return (
    <div className="space-y-8 animate-fade-in">

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row justify-between items-end md:items-center mb-[-20px] relative z-20 gap-4">

        {/* Chart Filter (Left side in desktop, but we want it right aligned with service filter?) 
             Actually, let's put it next to the service filter or above chart. 
             The layout has the service filter on top right. Let's group them if possible or put chart settings near chart?
             The prompt asked for option to view months. Let's put it nicely aligned.
         */}
        <div />

        <div className="flex gap-4">
          {/* Service Filter */}
          <div className="relative w-48">
            <CustomSelect
              icon={Filter}
              options={[
                { value: '', label: 'Todos os Serviços' },
                ...serviceTypes.map(t => ({ label: t.name, value: t.name }))
              ]}
              value={selectedServiceType}
              onChange={(val) => setSelectedServiceType(val)}
              placeholder="Todos os Serviços"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
        <StatCard
          label="Clientes Ativos"
          value={activeClients}
          icon={Users}
          trend={selectedServiceType ? undefined : clientsTrend}
          trendUp={clientsTrendUp}
          colorClass="bg-blue-500 text-blue-500"
        />
        <StatCard
          label="Renovações Pendentes"
          value={expiringSoon}
          icon={AlertTriangle}
          colorClass="bg-amber-500 text-amber-500"
        />
        <StatCard
          label="Receita Mensal Est."
          value={`R$ ${totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          trend={selectedServiceType ? undefined : revenueTrend}
          trendUp={revenueTrendUp}
          colorClass="bg-emerald-500 text-emerald-500"
        />
        <StatCard
          label="Taxa de Retenção"
          value={`${retentionRate}%`}
          icon={TrendingUp}
          colorClass="bg-purple-500 text-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Section */}
        <div className="lg:col-span-2 bg-dark-800 p-6 rounded-2xl border border-gray-700 shadow-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h3 className="text-xl font-bold text-white">
                {chartMetric === 'clients' ? 'Crescimento de Alunos' : 'Receita Recorrente'}
              </h3>
              <div className="flex space-x-4 mt-2">
                <button
                  onClick={() => setChartMetric('clients')}
                  className={`text-xs font-medium border-b-2 transition-colors pb-1 ${chartMetric === 'clients' ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                  Alunos Ativos
                </button>
                <button
                  onClick={() => setChartMetric('revenue')}
                  className={`text-xs font-medium border-b-2 transition-colors pb-1 ${chartMetric === 'revenue' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                >
                  Financeiro
                </button>
              </div>
            </div>

            <div className="flex bg-dark-900 rounded-lg p-1 border border-gray-700">
              {[3, 6, 12].map(months => (
                <button
                  key={months}
                  onClick={() => setTimeRange(months)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${timeRange === months ? 'bg-primary-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                >
                  {months}m
                </button>
              ))}
            </div>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip
                  cursor={{ fill: '#374151', opacity: 0.4 }}
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '0.5rem', color: '#fff' }}
                  itemStyle={{ color: '#E5E7EB' }}
                  formatter={(value: number) => [
                    chartMetric === 'clients' ? value : `R$ ${value.toLocaleString()}`,
                    chartMetric === 'clients' ? 'Ativos' : 'Receita'
                  ]}
                />
                <Bar dataKey={chartMetric === 'clients' ? 'active' : 'revenue'} radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={chartMetric === 'clients' ? "#3b82f6" : "#10b981"}
                      className="transition-all duration-300 hover:opacity-80"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Activity / Renewals */}
        <div className="bg-dark-800 p-6 rounded-2xl border border-gray-700 shadow-xl">
          <h3 className="text-xl font-bold text-white mb-6 flex items-center">
            <AlertTriangle className="w-5 h-5 text-amber-500 mr-2" />
            Atenção Necessária
          </h3>
          <div className="space-y-4">
            {filteredClients.filter(c => c.status === 'expiring').length === 0 ? (
              <div className="text-gray-500 text-center py-8">Nenhuma renovação pendente.</div>
            ) : (
              filteredClients.filter(c => c.status === 'expiring').map(client => (
                <div key={client.id} className="bg-dark-900/50 p-4 rounded-xl border border-amber-500/20 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img src={client.avatar_url || `https://ui-avatars.com/api/?name=${client.name}`} alt={client.name} className="w-10 h-10 rounded-full" />
                    <div>
                      <p className="font-semibold text-white">{client.name}</p>
                      <p className="text-xs text-amber-400">Vence em: {client.end_date ? client.end_date.split('-').reverse().join('/') : '-'}</p>
                    </div>
                  </div>
                  <button className="text-xs bg-amber-500/10 text-amber-400 px-3 py-1 rounded-full hover:bg-amber-500/20 transition-colors">
                    Renovar
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};