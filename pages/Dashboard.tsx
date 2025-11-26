import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sale, SaleStatus, UserRole } from '../types';
import { getSales } from '../services/mockBackend';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DollarSign, ShoppingBag, AlertCircle, Clock } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSales = async () => {
      const data = await getSales();
      setSales(data);
      setLoading(false);
    };
    fetchSales();
  }, []);

  if (loading) return <div className="text-center p-10 text-gray-500 dark:text-gray-400">Carregando indicadores...</div>;

  // KPIs
  const totalRevenue = sales
    .filter(s => s.status === SaleStatus.COMPLETED)
    .reduce((acc, curr) => acc + curr.totalValue, 0);

  const completedCount = sales.filter(s => s.status === SaleStatus.COMPLETED).length;
  const pendingCount = sales.filter(s => s.status === SaleStatus.PENDING).length;
  const cancelledCount = sales.filter(s => s.status === SaleStatus.CANCELLED).length;

  // Chart Data Preparation (Last 7 sales or grouped by date - simplistic for demo)
  const chartData = sales
    .filter(s => s.status === SaleStatus.COMPLETED)
    .slice(-10)
    .map(s => ({
      name: new Date(s.finishedAt!).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
      valor: s.totalValue
    }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Bem-vindo, {user?.name}</h1>
      <p className="text-gray-600 dark:text-gray-400">Aqui está o resumo da operação hoje.</p>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Receita Total</p>
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white mt-1">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalRevenue)}
              </h3>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full text-green-600 dark:text-green-400">
              <DollarSign size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Vendas Concluídas</p>
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{completedCount}</h3>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400">
              <ShoppingBag size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Aguardando Caixa</p>
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{pendingCount}</h3>
            </div>
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-full text-orange-600 dark:text-orange-400">
              <Clock size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Canceladas</p>
              <h3 className="text-2xl font-bold text-gray-800 dark:text-white mt-1">{cancelledCount}</h3>
            </div>
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 dark:text-red-400">
              <AlertCircle size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Conditional Chart for Manager */}
      {user?.role === UserRole.MANAGER && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 mt-8 transition-colors">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-6">Últimas Vendas Realizadas</h2>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                <XAxis dataKey="name" tick={{fontSize: 12, fill: '#9ca3af'}} />
                <YAxis tick={{fontSize: 12, fill: '#9ca3af'}} />
                <Tooltip 
                  formatter={(value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)}
                  contentStyle={{
                    borderRadius: '8px', 
                    border: 'none', 
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    backgroundColor: '#1f2937',
                    color: '#f3f4f6'
                  }}
                />
                <Legend />
                <Bar dataKey="valor" name="Valor da Venda" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      
       {/* Help Section */}
      <div className="mt-8 bg-blue-50 dark:bg-blue-900/10 p-6 rounded-xl border border-blue-100 dark:border-blue-900/30">
        <h2 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-2">Guia Rápido do Sistema</h2>
        <div className="grid md:grid-cols-3 gap-6 text-sm text-blue-900 dark:text-blue-200">
          <div>
            <span className="font-bold block mb-1">Vendedor</span>
            Vá para "Vendas" &gt; "Nova Venda" para iniciar um pedido. Selecione produtos e envie. O status ficará como "Pendente".
          </div>
          <div>
            <span className="font-bold block mb-1">Caixa</span>
            Vá para "Vendas" &gt; "Frente de Caixa" para ver pedidos pendentes. Confira os itens e clique em "Finalizar Venda" para baixar estoque.
          </div>
          <div>
            <span className="font-bold block mb-1">Gerente</span>
            Gerencie "Usuários" e "Produtos". No histórico de vendas, é possível cancelar pedidos indevidos.
          </div>
        </div>
      </div>
    </div>
  );
};