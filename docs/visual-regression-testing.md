# Visual Regression Testing - OMNIA

## Visão Geral

O sistema de **Visual Regression Testing** do OMNIA foi implementado para detectar automaticamente mudanças visuais não intencionais na interface do usuário. Este sistema captura screenshots de componentes e páginas, comparando-os com versões de referência (baseline) para identificar diferenças.

## Arquitetura

### Configuração
- **Arquivo principal**: `playwright.visual.config.ts`
- **Testes**: `tests/visual-regression.spec.ts`
- **Screenshots**: `tests/visual-regression-screenshots/`
- **Relatórios**: `playwright-report-visual/`

### Tecnologias Utilizadas
- **Playwright**: Framework de testes E2E com suporte nativo a visual testing
- **Múltiplos viewports**: Desktop (1920x1080), Tablet (768x1024), Mobile (375x667)
- **Threshold configurável**: 0.2 (20% de diferença permitida)

## Scripts Disponíveis

```bash
# Executar testes de regressão visual
npm run test:visual

# Atualizar screenshots de baseline
npm run test:visual:update

# Visualizar relatório HTML
npx playwright show-report playwright-report-visual
```

## Cenários de Teste Implementados

### 1. Página Inicial Completa
- Captura screenshot da página inteira
- Desabilita animações para consistência
- Arquivo: `homepage-full.png`

### 2. Responsividade
- Testa 3 viewports diferentes:
  - Desktop: `homepage-desktop.png`
  - Tablet: `homepage-tablet.png`
  - Mobile: `homepage-mobile.png`

### 3. Componentes Principais
- Header/Navegação: `component-header.png`
- Sidebar: `component-sidebar.png`
- Área principal: `component-main.png`

### 4. Elementos Interativos
- Formulários: `component-form.png`
- Botões: `component-buttons.png`

### 5. Modo Escuro (se disponível)
- Detecta automaticamente toggle de tema
- Captura: `homepage-dark-mode.png`

### 6. Baseline de Detecção
- Screenshot com máscaras para elementos dinâmicos
- Arquivo: `visual-baseline.png`

## Configurações Avançadas

### Threshold de Comparação
```typescript
expect: {
  toHaveScreenshot: {
    threshold: 0.2 // 20% de diferença permitida
  }
}
```

### Máscaras para Elementos Dinâmicos
```typescript
mask: [
  page.locator('[data-testid*="timestamp"]'),
  page.locator('.timestamp'),
  page.locator('[data-testid*="date"]')
]
```

### Configurações de Screenshot
```typescript
{
  fullPage: true,           // Página completa
  animations: 'disabled',   // Desabilita animações
  caret: 'hide'            // Esconde cursor
}
```

## Fluxo de Trabalho

### 1. Primeira Execução
```bash
# Gera screenshots de baseline
npm run test:visual:update
```

### 2. Execução Regular
```bash
# Compara com baseline existente
npm run test:visual
```

### 3. Quando Mudanças São Intencionais
```bash
# Atualiza baseline com novas mudanças
npm run test:visual:update
```

## Integração com CI/CD

O sistema está integrado ao workflow do GitHub Actions:

```yaml
- name: Run Visual Regression Tests
  run: |
    npm run test:visual
    
- name: Upload Visual Test Results
  uses: actions/upload-artifact@v4
  if: failure()
  with:
    name: visual-test-results
    path: |
      playwright-report-visual/
      test-results-visual/
```

## Boas Práticas

### 1. Estabilidade
- Aguarde elementos carregarem antes de capturar
- Desabilite animações e transições
- Use `waitForTimeout()` quando necessário

### 2. Consistência
- Mantenha viewports padronizados
- Use máscaras para elementos dinâmicos
- Configure threshold apropriado

### 3. Manutenção
- Atualize baselines após mudanças intencionais
- Revise falhas para identificar regressões reais
- Mantenha screenshots organizados

## Resolução de Problemas

### Screenshots Diferentes em Ambientes
- **Causa**: Diferenças de fonte/renderização entre sistemas
- **Solução**: Execute testes em ambiente containerizado

### Muitas Falhas Após Mudanças
- **Causa**: Mudanças legítimas na interface
- **Solução**: Execute `npm run test:visual:update`

### Testes Instáveis
- **Causa**: Elementos dinâmicos ou animações
- **Solução**: Adicione máscaras ou aguarde estabilização

## Estrutura de Arquivos

```
omnia/
├── tests/
│   ├── visual-regression.spec.ts
│   └── visual-regression-screenshots/
│       └── visual-regression.spec.ts-snapshots/
│           ├── homepage-full-chromium-desktop-darwin.png
│           ├── homepage-desktop-chromium-desktop-darwin.png
│           └── ...
├── playwright.visual.config.ts
├── playwright-report-visual/
└── test-results-visual/
```

## Próximos Passos

1. **Expandir Cobertura**: Adicionar mais componentes específicos
2. **Otimização**: Reduzir tempo de execução
3. **Integração**: Conectar com ferramentas de design (Figma)
4. **Automação**: Executar em diferentes branches automaticamente

---

**Documentação atualizada em**: Janeiro 2025  
**Versão**: 1.0  
**Responsável**: Agente OMNIA