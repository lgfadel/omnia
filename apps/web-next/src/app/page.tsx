"use client";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardSectionHeader } from "@/components/dashboard/DashboardSectionHeader";
import { AtasStatusBoard } from "@/components/dashboard/AtasStatusBoard";
import { TarefasStatusBoard } from "@/components/dashboard/TarefasStatusBoard";
import { TarefasPriorityCard } from "@/components/dashboard/TarefasPriorityCard";
import { RechartsDonutChart } from "@/components/dashboard/RechartsDonutChart";
import { Layout } from "@/components/layout/Layout";
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia";
import { Card } from "@/components/ui/card";
import { useDashboardData } from "@/hooks/useDashboardData";
import { cn } from "@/lib/utils";
import {
  getOperationalBottlenecks,
  getTopAssignees,
  type AtasDashboardMetrics,
} from "@/utils/dashboardCalculations";
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-64 animate-pulse rounded-[36px] bg-[hsl(var(--surface-tint))]" />
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-60 animate-pulse rounded-[28px] bg-[hsl(var(--surface-tint))]" />
        ))}
      </div>
    </div>
  )
}

function DashboardError({ error }: { error: string }) {
  return (
    <Card className="rounded-[32px] border-[hsl(var(--critical)/0.2)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(254,242,242,0.95))] p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[hsl(var(--critical))]">
        Dashboard indisponível
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
        Não foi possível consolidar a visão executiva.
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{error}</p>
    </Card>
  )
}

export default function Index() {
  const dashboard = useDashboardData();
  const overview = dashboard.overview ?? {
    totalOpenItems: 0,
    totalCriticalItems: 0,
    totalOverdueItems: 0,
    completedLast30Days: 0,
    openByModule: [],
  };
  const atas: AtasDashboardMetrics = dashboard.atas ?? {
    open: 0,
    overdue: 0,
    approvedLast30Days: 0,
    statusDistribution: [],
    openItems: [],
  };
  const tarefas = dashboard.tarefas ?? {
    active: 0,
    overdue: 0,
    onTrack: 0,
    completedLast30Days: 0,
    statusDistribution: [],
    priorityDistribution: [],
    assigneeDistribution: [],
  };
  const admissoes = dashboard.admissoes ?? { open: 0, overdue: 0, urgent: 0, completedLast30Days: 0, statusDistribution: [] };
  const rescisoes = dashboard.rescisoes ?? { open: 0, overdue: 0, urgent: 0, completedLast30Days: 0, statusDistribution: [] };
  const balancetes = dashboard.balancetes ?? {
    onTrack: 0,
    attention: 0,
    overdue: 0,
    missing: 0,
    receivedLast30Days: 0,
    healthDistribution: [],
  };
  const highlights = dashboard.highlights ?? [];
  const loading = dashboard.loading;
  const error = dashboard.error;
  const lastUpdated = dashboard.lastUpdated;

  const topAssignees = getTopAssignees(tarefas);
  const bottlenecks = getOperationalBottlenecks({
    overview,
    atas,
    tarefas,
    admissoes,
    rescisoes,
    balancetes,
    highlights,
  });

  return (
    <ProtectedRoute>
      <Layout>
        <div className="dashboard-shell space-y-8">
          <BreadcrumbOmnia items={[{ label: "Dashboard", isActive: true }]} />

          {loading ? <DashboardSkeleton /> : null}
          {!loading && error ? <DashboardError error={error} /> : null}

          {!loading && !error ? (
            <>
              <DashboardHero lastUpdated={lastUpdated} />

              <section className="space-y-5">
                <DashboardSectionHeader
                  eyebrow="Fluxo aberto"
                  title="Abertos por status"
                />

                <div className="grid gap-4 xl:grid-cols-2">
                  <AtasStatusBoard
                    totalOpen={atas.open}
                    totalOperationallyOverdue={atas.overdue}
                    items={atas.openItems}
                  />
                  <TarefasStatusBoard
                    totalOpen={tarefas.active}
                    totalOverdue={tarefas.overdue}
                    items={tarefas.openItems}
                  />
                </div>
              </section>

              <section className="space-y-5">
                <DashboardSectionHeader
                  eyebrow="Leitura visual"
                  title="Distribuição da carga e gargalos"
                  description="Os gráficos ajudam a localizar onde a operação está concentrada e quais filas puxam o esforço."
                />

                <div className="grid gap-4 xl:grid-cols-2">
                  <TarefasPriorityCard items={tarefas.openItems} />
                  <RechartsDonutChart
                    data={balancetes.healthDistribution}
                    title="Saúde dos balancetes por condomínio"
                  />
                  <RechartsDonutChart
                    data={admissoes.statusDistribution}
                    title="Status das admissões em aberto"
                  />
                  <RechartsDonutChart
                    data={rescisoes.statusDistribution}
                    title="Status das rescisões em aberto"
                  />
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <Card className="rounded-[30px] border-white/70 bg-white/85 p-6 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.42)]">
                  <DashboardSectionHeader
                    eyebrow="Capacidade"
                    title="Responsáveis com maior carga"
                    description="Ranking das carteiras com maior volume de tarefas ativas."
                  />
                  <div className="mt-6 space-y-3">
                    {topAssignees.length ? (
                      topAssignees.map((item, index) => (
                        <div
                          key={item.name}
                          className="flex items-center justify-between rounded-2xl bg-[hsl(var(--surface-tint))] px-4 py-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-semibold text-primary">
                              {index + 1}
                            </div>
                            <span className="text-sm font-medium text-foreground">{item.name}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">{item.value} tarefas</span>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-2xl bg-[hsl(var(--surface-tint))] px-4 py-6 text-sm text-muted-foreground">
                        Nenhuma tarefa ativa com responsável atribuído.
                      </p>
                    )}
                  </div>
                </Card>

                <Card className="rounded-[30px] border-white/70 bg-white/85 p-6 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.42)]">
                  <DashboardSectionHeader
                    eyebrow="Pressão"
                    title="Onde está o gargalo"
                    description="Os maiores focos de tensão aparecem ordenados pela intensidade atual."
                  />
                  <div className="mt-6 space-y-3">
                    {bottlenecks.length ? (
                      bottlenecks.map((item, index) => (
                        <div
                          key={item.label}
                          className={cn(
                            "flex items-center justify-between rounded-2xl px-4 py-3 text-sm",
                            index === 0
                              ? "bg-[linear-gradient(135deg,rgba(254,242,242,1),rgba(255,237,213,0.96))] text-foreground"
                              : "bg-[hsl(var(--surface-tint))] text-foreground",
                          )}
                        >
                          <span className="font-medium">{item.label}</span>
                          <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-muted-foreground">
                            {item.value}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="rounded-2xl bg-[hsl(var(--surface-tint))] px-4 py-6 text-sm text-muted-foreground">
                        Nenhum gargalo relevante identificado agora.
                      </p>
                    )}
                  </div>
                </Card>
              </section>
            </>
          ) : null}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
