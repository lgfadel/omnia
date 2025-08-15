import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line } from "recharts";
import { FileText, Users, Clock, CheckCircle } from "lucide-react";
const statusData = [{
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
const monthlyData = [{
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
  const totalAtas = 38;
  const totalParticipantes = 1170;
  const mediaParticipantes = Math.round(totalParticipantes / totalAtas);
  const totalDocumentos = 94;
  return <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia items={[{
        label: "Dashboard",
        isActive: true
      }]} />
        
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Dashboard</h1>
          
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Atas</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAtas}</div>
              <p className="text-xs text-muted-foreground">
                +12% em relação ao mês anterior
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Participantes</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalParticipantes}</div>
              <p className="text-xs text-muted-foreground">
                Média de {mediaParticipantes} por ata
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Documentos</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalDocumentos}</div>
              <p className="text-xs text-muted-foreground">
                Média de 2.5 por ata
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taxa de Conclusão</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">79%</div>
              <p className="text-xs text-muted-foreground">
                15 de 19 atas concluídas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Atas por Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                      {statusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evolução Mensal</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData}>
                    <XAxis dataKey="mes" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="atas" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{
                    fill: "hsl(var(--chart-1))"
                  }} />
                    <Line type="monotone" dataKey="participantes" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{
                    fill: "hsl(var(--chart-2))"
                  }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de Barras - Participantes por Mês */}
        <Card>
          <CardHeader>
            <CardTitle>Participantes por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="participantes" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </Layout>;
};
export default Index;