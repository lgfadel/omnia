import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface RechartsBarChartProps {
  data: Array<{
    category: string;
    value: number;
  }>;
  title: string;
  height?: number;
  color?: string;
  horizontal?: boolean;
}

export default function RechartsBarChart({ 
  data, 
  title, 
  height = 300, 
  color = '#5B8FF9',
  horizontal = false 
}: RechartsBarChartProps) {
  // Preparar dados para o gráfico
  const chartData = data.map(item => ({
    name: item.category,
    value: item.value
  }));

  // Componente personalizado para o tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
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
            color: color
          }}>
            {label}
          </p>
          <p>
            Quantidade: <strong>{payload[0].value}</strong>
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-center">{title}</h3>
      </div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          {horizontal ? (
            <BarChart
              layout="vertical"
              data={chartData}
              margin={{
                top: 5,
                right: 30,
                left: 80,
                bottom: 5,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill={color} name="Quantidade" />
            </BarChart>
          ) : (
            <BarChart
              data={chartData}
              margin={{
                top: 5,
                right: 30,
                left: 20,
                bottom: 30,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill={color} name="Quantidade" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};