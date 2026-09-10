import React, { useEffect, useState } from 'react';
import { getPackages, getResidents, subscribeToDataChanges } from '../../db/localDb';
import { Package, Resident } from '../../types';
import { Package as PackageIcon, CheckCircle2, Clock, Users, UserCheck } from 'lucide-react';
import { isToday } from 'date-fns';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    delivered: 0,
    today: 0,
    residentsWithPackages: 0,
    totalResidents: 0
  });

  useEffect(() => {
    async function loadStats() {
      const [pkgs, residents] = await Promise.all([
        getPackages(),
        getResidents()
      ]);
      
      const pending = pkgs.filter(p => p.status === 'pending');
      const delivered = pkgs.filter(p => p.status === 'delivered');
      const today = pkgs.filter(p => isToday(p.registeredAt));
      
      // Count unique residents with pending packages
      const residentsWithPkgs = new Set(pending.map(p => p.residentId)).size;

      setStats({
        total: pkgs.length,
        pending: pending.length,
        delivered: delivered.length,
        today: today.length,
        residentsWithPackages: residentsWithPkgs,
        totalResidents: residents.length
      });
    }

    loadStats();
    const unsubscribe = subscribeToDataChanges(() => {
      loadStats();
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Painel Administrativo</h1>
        <p className="text-gray-500">Resumo do controle de encomendas</p>
      </div>

      {/* Ações Rápidas: no celular (mobile) fica logo abaixo do título (order-1), no desktop fica após as estatísticas (md:order-2) */}
      <div className="order-1 md:order-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Ações Rápidas</h2>
          <div className="hidden sm:flex gap-4 text-xs font-bold text-gray-400">
            <span>[F1] Registrar</span>
            <span>[F2] Entregar</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link to="/admin/register" className="flex items-center gap-4 p-4 rounded-xl border-2 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-50 transition group relative">
             <div className="absolute top-2 right-2 hidden sm:block">
                <span className="bg-emerald-100 text-emerald-700 text-[10px] px-1.5 py-0.5 rounded font-black">F1</span>
             </div>
             <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center group-hover:bg-emerald-500 group-hover:text-white transition">
                <PackageIcon size={24} className="text-emerald-700 group-hover:text-white" />
             </div>
             <div>
               <h3 className="font-bold text-gray-800 text-lg">Registrar Encomenda</h3>
               <p className="text-sm text-gray-500">Nova chegada na portaria</p>
             </div>
          </Link>
          <Link to="/admin/history" className="flex items-center gap-4 p-4 rounded-xl border-2 border-orange-100 hover:border-orange-500 hover:bg-orange-50 transition group relative">
             <div className="absolute top-2 right-2 hidden sm:block">
                <span className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5 rounded font-black">F2</span>
             </div>
             <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center group-hover:bg-orange-500 group-hover:text-white transition">
                <CheckCircle2 size={24} className="text-orange-700 group-hover:text-white" />
             </div>
             <div>
               <h3 className="font-bold text-gray-800 text-lg">Entregar Encomenda</h3>
               <p className="text-sm text-gray-500">Registrar retirada pelo morador</p>
             </div>
          </Link>
        </div>
      </div>

      {/* Cards de Estatísticas: no celular fica abaixo das ações rápidas (order-2), no desktop fica antes (md:order-1) */}
      <div className="order-2 md:order-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard 
          title="Total Registradas" 
          value={stats.total} 
          icon={<PackageIcon size={24} className="text-blue-600" />} 
          bg="bg-blue-50" 
        />
        <StatCard 
          title="Disponíveis (Pendentes)" 
          value={stats.pending} 
          icon={<Clock size={24} className="text-orange-600" />} 
          bg="bg-orange-50" 
        />
        <StatCard 
          title="Entregues" 
          value={stats.delivered} 
          icon={<CheckCircle2 size={24} className="text-emerald-600" />} 
          bg="bg-emerald-50" 
        />
        <StatCard 
          title="Moradores c/ Encomenda" 
          value={stats.residentsWithPackages} 
          icon={<Users size={24} className="text-purple-600" />} 
          bg="bg-purple-50" 
        />
        <StatCard 
          title="Moradores Cadastrados" 
          value={stats.totalResidents} 
          icon={<UserCheck size={24} className="text-teal-600" />} 
          bg="bg-teal-50"
          href="/admin/residents"
        />
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, bg, href }: { title: string, value: number, icon: React.ReactNode, bg: string, href?: string }) {
  const content = (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 h-full">
      <div className={`w-14 h-14 ${bg} rounded-2xl flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="text-3xl font-bold text-gray-800">{value}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link to={href} className="block transition transform hover:-translate-y-0.5">
        {content}
      </Link>
    );
  }

  return content;
}
