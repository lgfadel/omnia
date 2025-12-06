import React from 'react';
import { Column, Bar } from '@ant-design/plots';

interface AntBarChartProps {
  data: Array<{
    category: string;
    value: number;
  }>;
  title: string;
  height?: number;
  colors?: string[];
  horizontal?: boolean;
}

const AntBarChart: React.FC<AntBarChartProps> = ({ 
  data, 
  title, 
  height = 300, 
  colors = ['#5B8FF9', '#5AD8A6', '#5D7092', '#F6BD16', '#E86452'],
  horizontal = false 
}) => {
  const config = {
    data,
    xField: horizontal ? 'value' : 'category',
    yField: horizontal ? 'category' : 'value',
    height,
    color: ({ category }: { category: string }) => {
      const index = data.findIndex(item => item.category === category);
      return colors[index % colors.length];
    },
    label: {
      position: horizontal ? 'right' as const : 'top' as const,
      style: {
        fill: '#666',
        fontSize: 12,
      },
    },
    meta: {
      value: {
        alias: 'Quantidade',
      },
      category: {
        alias: 'Categoria',
      },
    },
    interactions: [
      {
        type: 'element-active',
      },
    ],
    animation: {
      appear: {
        animation: 'scale-in-y',
        duration: 1000,
      },
    },
  };

  const ChartComponent = horizontal ? Bar : Column;

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      </div>
      <ChartComponent {...config} />
    </div>
  );
};

export default AntBarChart;