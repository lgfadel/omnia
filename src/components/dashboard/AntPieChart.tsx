import { Pie } from '@ant-design/plots'
import { useEffect, useState } from 'react'

interface AntPieChartProps {
  data: Array<{ name: string; value: number; color: string }>
  title: string
}

export function AntPieChart({ data, title }: AntPieChartProps) {
  // Estado para armazenar informações de debug
  const [debugInfo, setDebugInfo] = useState<any>(null);
  
  // Exibir dados recebidos no console para debug
  useEffect(() => {
    console.log('AntPieChart recebeu dados:', data);
  }, [data]);
  
  // Calcular o total uma única vez fora da função de tooltip
  const totalValue = data.reduce((sum, item) => sum + (item.value || 0), 0) || 1;
  
  const config = {
    data,
    angleField: 'value',
    colorField: 'name',
    height: 400,
    radius: 0.9,
    label: false,
    legend: true, // Habilitando a legenda para melhor visualização
    tooltip: {
      // Configuração explícita para garantir que o tooltip seja exibido
      showTitle: false,
      showMarkers: false,
      customContent: (title: string, items: any[]) => {
        // Verificar se temos itens válidos
        if (!items || items.length === 0) {
          setDebugInfo(prev => ({ ...prev, customContentItems: 'Sem itens' }));
          return '';
        }
        
        // Obter o primeiro item (o que está sendo hover)
        const item = items[0];
        const datum = item?.data || {};
        
        // Armazenar dados do customContent para debug
        setDebugInfo({
          customContentTitle: title,
          customContentItems: items,
          customContentItem: item,
          customContentDatum: datum
        });
        
        // Extrair valores com fallbacks seguros
        const name = datum.name || 'Categoria';
        const value = typeof datum.value === 'number' ? datum.value : 0;
        
        // Calcular porcentagem
        const percentage = ((value / totalValue) * 100).toFixed(2);
        
        // Retornar HTML formatado
        return `
          <div style="padding: 12px; color: #333; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: white; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
            <div style="font-weight: bold; margin-bottom: 8px; font-size: 14px;">${name}</div>
            <div style="margin-bottom: 6px;">Quantidade: <strong>${value}</strong></div>
            <div>Porcentagem: <strong>${percentage}%</strong></div>
          </div>
        `;
      }
    },
    // Configuração explícita de interações para garantir que o tooltip funcione
    interactions: [
      {
        type: 'element-active',
      },
      {
        type: 'tooltip',
        cfg: {
          start: [{ trigger: 'element:mousemove', action: 'tooltip:show' }],
          end: [{ trigger: 'element:mouseleave', action: 'tooltip:hide' }],
        },
      },
    ],
  }

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>
      <Pie {...config} />
      
      {/* Painel de debug */}
      <div style={{ 
        marginTop: '20px', 
        padding: '10px', 
        border: '1px solid #ddd', 
        borderRadius: '4px',
        backgroundColor: '#f9f9f9',
        fontSize: '12px',
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap'
      }}>
        <h4 style={{ marginBottom: '10px', fontWeight: 'bold' }}>Debug do Tooltip:</h4>
        <div>
          <strong>Dados recebidos:</strong>
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
        <div style={{ marginTop: '10px' }}>
          <strong>Informações do tooltip:</strong>
          <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
        </div>
      </div>
    </div>
  )
}