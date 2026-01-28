"use client";

import { Layout } from '@/components/layout/Layout';
import { BreadcrumbOmnia } from '@/components/ui/breadcrumb-omnia';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus } from 'lucide-react';

export default function RescissoesPage() {
  return (
    <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia 
          items={[
            { label: "Rescisões", isActive: true }
          ]} 
        />
        
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Rescisões</h1>
            <p className="text-muted-foreground">
              Gerencie o processo de rescisões contratuais
            </p>
          </div>
          
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nova Rescisão
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Rescisões</CardTitle>
            <CardDescription>
              Acompanhe todas as rescisões em andamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg mb-2">Nenhuma rescisão cadastrada ainda</p>
              <p className="text-sm">Clique em "Nova Rescisão" para começar</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
