# Documentação de Componentes de Gráficos

## Histórico de Decisões

### Migração de @ant-design/plots para Recharts (Data: 10/11/2023)

#### Contexto
Os componentes de gráficos baseados na biblioteca `@ant-design/plots` apresentavam problemas de renderização, especialmente nos tooltips que exibiam "NULL" em vez dos valores corretos. Após tentativas de correção, foi decidido migrar para a biblioteca `recharts` que já estava disponível no projeto.

#### Decisão Técnica
Migrar todos os componentes de gráficos da biblioteca `@ant-design/plots` para `recharts` pelos seguintes motivos:

1. A biblioteca `recharts` já estava incluída como dependência no projeto
2. `recharts` oferece melhor estabilidade e compatibilidade com React
3. Melhor controle sobre a personalização de tooltips e elementos visuais
4. Documentação mais abrangente e comunidade ativa

#### Componentes Migrados

1. `AntPieChart.tsx` → `RechartsDonutChart.tsx`
   - Implementação de gráfico de pizza com formato donut
   - Tooltip personalizado com exibição de valores e porcentagens
   - Suporte a cores personalizadas por segmento

2. `AntBarChart.tsx` → `RechartsBarChart.tsx`
   - Implementação de gráfico de barras com suporte a orientação vertical e horizontal
   - Tooltip personalizado com exibição de valores
   - Suporte a cores personalizadas

#### Impacto

- Melhor experiência do usuário com tooltips funcionando corretamente
- Manutenção simplificada com uma única biblioteca de gráficos
- Redução de dependências externas

#### Próximos Passos

- Considerar a remoção da dependência `@ant-design/plots` se não for utilizada em outros componentes
- Avaliar a necessidade de componentes adicionais de visualização de dados