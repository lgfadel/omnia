import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface RechartsDonutChartProps {
  data: Array<{ name: string; value: number; color: string }>;
  title: string;
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: { name: string; value: number; color: string; totalValue: number };
  }>;
}

// Componente personalizado para o tooltip
const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const totalValue = payload[0].payload.totalValue;
    const percentage = ((data.value / totalValue) * 100).toFixed(2);
    
    return (
      <div className="custom-tooltip" style={{
        backgroundColor: 'white',
        padding: '12px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      }}>
        <p className="label" style={{ 
          fontWeight: 'bold', 
          marginBottom: '8px', 
          fontSize: '14px',
          color: data.color
        }}>
          {data.name}
        </p>
        <p style={{ marginBottom: '6px' }}>
          Quantidade: <strong>{data.value}</strong>
        </p>
        <p>
          Porcentagem: <strong>{percentage}%</strong>
        </p>
      </div>
    );
  }

  return null;
};

export function RechartsDonutChart({ data, title }: RechartsDonutChartProps) {
  // Calcular o total uma única vez
  const totalValue = data.reduce((sum, item) => sum + (item.value || 0), 0) || 1;
  
  // Adicionar o totalValue a cada item para cálculo de porcentagem no tooltip
  const enhancedData = data.map(item => ({
    ...item,
    totalValue
  }));

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4 text-center">ATAS - STATUS</h3>
      
      <div style={{ width: '100%', height: 400 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={enhancedData}
              cx="50%"
              cy="50%"
              labelLine={false}
              outerRadius={150}
              innerRadius={60}
              fill="#8884d8"
              dataKey="value"
              nameKey="name"
              paddingAngle={2}
            >
              {enhancedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip 
              content={<CustomTooltip />}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}