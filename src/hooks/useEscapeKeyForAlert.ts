import { useEffect } from 'react'

/**
 * Hook para capturar a tecla ESC e fechar AlertDialogs
 * @param onClose - Função a ser executada quando ESC for pressionado
 * @param isOpen - Se o AlertDialog está aberto
 */
export function useEscapeKeyForAlert(onClose: () => void, isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }
    }

    // Adiciona o listener ao document para capturar globalmente
    document.addEventListener('keydown', handleEscape, true)

    // Cleanup: remove o listener quando o componente desmonta ou isOpen muda
    return () => {
      document.removeEventListener('keydown', handleEscape, true)
    }
  }, [onClose, isOpen])
}