import { useEffect } from 'react'

/**
 * Hook para capturar a tecla ESC e executar uma função de callback
 * @param callback - Função a ser executada quando ESC for pressionado
 * @param isActive - Se o hook deve estar ativo (padrão: true)
 */
export function useEscapeKey(callback: () => void, isActive: boolean = true) {
  useEffect(() => {
    if (!isActive) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        callback()
      }
    }

    // Adiciona o listener ao document para capturar globalmente
    document.addEventListener('keydown', handleEscape, true)

    // Cleanup: remove o listener quando o componente desmonta ou isActive muda
    return () => {
      document.removeEventListener('keydown', handleEscape, true)
    }
  }, [callback, isActive])
}