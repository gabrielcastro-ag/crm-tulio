
import React from 'react';
import { Client, Stats } from '../types';
import { StatCard } from './StatCard';
import { Users, AlertTriangle, DollarSign, TrendingUp, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DashboardProps {
  clients: Client[];
}

export const Dashboard: React.FC<DashboardProps> = ({ clients }) => {
  // Calculate Stats
  const activeClients = clients.filter(c => c.status === 'active').length;
  const expiringSoon = clients.filter(c => c.status === 'expiring').length;
  const totalRevenue = clients
    .filter(c => c.status === 'active' || c.status === 'expiring')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const chartData = [
    { name: 'Jan', active: 10 },
    { name: 'Fev', active: 15 },
    { name: 'Mar', active: 12 },
    { name: 'Abr', active: 20 },
    { name: 'Mai', active: 25 },
    { name: 'Jun', active: 28 },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          label="Clientes Ativos"
          value={activeClients}
          icon={Users}
          trend="+12%"
          trendUp={true}
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
          trend="+5%"
          trendUp={true}
          colorClass="bg-emerald-500 text-emerald-500"
        />
        <StatCard
          label="Taxa de Retenção"
          value="94%"
          icon={TrendingUp}
          colorClass="bg-purple-500 text-purple-500"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart Section */}
        <div className="lg:col-span-2 bg-dark-800 p-6 rounded-2xl border border-gray-700 shadow-xl">
          <h3 className="text-xl font-bold text-white mb-6">Crescimento de Alunos</h3>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <XAxis dataKey="name" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '0.5rem', color: '#fff' }}
                />
                <Bar dataKey="active" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill="#3b82f6" />
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
            {clients.filter(c => c.status === 'expiring').length === 0 ? (
              <div className="text-gray-500 text-center py-8">Nenhuma renovação pendente.</div>
            ) : (
              clients.filter(c => c.status === 'expiring').map(client => (
                <div key={client.id} className="bg-dark-900/50 p-4 rounded-xl border border-amber-500/20 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img src={client.avatar_url || `https://ui-avatars.com/api/?name=${client.name}`} alt={client.name} className="w-10 h-10 rounded-full" />
                    <div>
                      <p className="font-semibold text-white">{client.name}</p>
                      <p className="text-xs text-amber-400">Vence em: {client.end_date ? new Date(client.end_date).toLocaleDateString() : '-'}</p>
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