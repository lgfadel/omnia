// Um job em processamento publica sinal de vida a cada HEARTBEAT_SECONDS. Sem
// sinal por STALE_LEASE_MINUTES, o worker que o assumiu morreu — o Railway
// encerra o container sem aviso — e o job pode ser retomado.
export const HEARTBEAT_SECONDS = 60
export const STALE_LEASE_MINUTES = 5

// Tentativas totais, contando as que o usuário pede na tela. Um job que
// derruba o worker toda vez voltaria para a fila para sempre, e cada volta
// derrubaria junto os jobs que vêm depois dele.
export const MAX_JOB_ATTEMPTS = 3

export function reclaimDecision(attemptCount: number): 'requeue' | 'fail' {
  return attemptCount + 1 >= MAX_JOB_ATTEMPTS ? 'fail' : 'requeue'
}
