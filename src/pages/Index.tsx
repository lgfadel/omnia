import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line } from "recharts";
import { FileText, Users, Clock, CheckCircle, AlertTriangle, Target, UserCheck } from "lucide-react";
import { useDashboardData } from "@/hooks/useDashboardData";
import { MetricCard, AtasMetricCard, TarefasMetricCard, TaxaConclusaoCard } from "@/components/dashboard/MetricCard";
import { RechartsDonutChart } from "@/components/dashboard/RechartsDonutChart";
import RechartsBarChart from "@/components/dashboard/RechartsBarChart";
// Dados mockados mantidos como fallback
const fallbackStatusData = [{
  name: "Não Iniciado",
  value: 12,
  color: "hsl(var(--chart-1))"
}, {
  name: "Em Andamento",
  value: 8,
  color: "hsl(var(--chart-2))"
}, {
  name: "Concluído",
  value: 15,
  color: "hsl(var(--chart-3))"
}, {
  name: "Cancelado",
  value: 3,
  color: "hsl(var(--chart-4))"
}];
const fallbackMonthlyData = [{
  mes: "Jan",
  atas: 4,
  participantes: 120
}, {
  mes: "Fev",
  atas: 6,
  participantes: 180
}, {
  mes: "Mar",
  atas: 8,
  participantes: 240
}, {
  mes: "Abr",
  atas: 5,
  participantes: 150
}, {
  mes: "Mai",
  atas: 7,
  participantes: 210
}, {
  mes: "Jun",
  atas: 9,
  participantes: 270
}];
const chartConfig = {
  atas: {
    label: "Atas",
    color: "hsl(var(--chart-1))"
  },
  participantes: {
    label: "Participantes",
    color: "hsl(var(--chart-2))"
  }
};
const Index = () => {
  const { atasMetrics, tarefasMetrics, loading, error } = useDashboardData()
  return <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia items={[{
        label: "Dashboard",
        isActive: true
      }]} />
        


        {/* Cards de Métricas - Atas */}
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">ATAS</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <AtasMetricCard
                title="Total de Atas Abertas"
                value={atasMetrics.total}
                icon={FileText}
                loading={loading}
              />
              
              <AtasMetricCard
                title="Atas Atrasadas"
                value={atasMetrics.atasAtrasadas}
                total={atasMetrics.total}
                icon={AlertTriangle}
                iconColor="text-red-600"
                loading={loading}
              />
              

              
              <MetricCard
                title="Status Mais Comum"
                value={atasMetrics.distribuicaoPorStatus[0]?.name || "N/A"}
                subtitle={`${atasMetrics.distribuicaoPorStatus[0]?.value || 0} atas`}
                icon={Target}
                loading={loading}
              />
            </div>
          </div>
          
          {/* Cards de Métricas - Tarefas */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">TAREFAS</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <TarefasMetricCard
                title="Tarefas Ativas"
                value={tarefasMetrics.totalAtivas}
                icon={Users}
                loading={loading}
              />
              
              <TarefasMetricCard
                title="Tarefas Vencidas"
                value={tarefasMetrics.tarefasVencidas}
                total={tarefasMetrics.totalAtivas}
                icon={Clock}
                iconColor="text-red-600"
                loading={loading}
              />
              
              <TarefasMetricCard
                title="Tarefas no Prazo"
                value={tarefasMetrics.tarefasNoPrazo}
                total={tarefasMetrics.totalAtivas}
                icon={CheckCircle}
                iconColor="text-green-600"
                loading={loading}
              />
              
              <TaxaConclusaoCard
                taxa={tarefasMetrics.taxaConclusao}
                label="Taxa de Conclusão - Tarefas"
                icon={UserCheck}
                loading={loading}
              />
            </div>
          </div>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RechartsDonutChart
            data={atasMetrics.distribuicaoPorStatus}
            title="DISTRIBUIÇÃO POR STATUS"
          />

          <RechartsDonutChart
            data={tarefasMetrics.distribuicaoPorPrioridade}
            title="TAREFAS - PRIORIDADE"
          />
        </div>
        
        {/* Gráfico de Barras */}
        <div className="grid grid-cols-1 gap-6">
          {/* Gráfico de Barras - Tarefas por Responsável */}
          <RechartsBarChart
            data={tarefasMetrics.distribuicaoPorResponsavel.map(item => ({ category: item.name, value: item.value }))}
            title="TAREFAS POR RESPONSÁVEL"
            height={300}
            color="#10b981"
            horizontal={true}
          />
        </div>
      </div>
    </Layout>;
};
export default Index;