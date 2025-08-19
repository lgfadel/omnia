import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, X, ZoomIn, ZoomOut, RotateCw } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

interface ImagePreviewModalProps {
  isOpen: boolean
  onClose: () => void
  imageUrl: string
  imageName: string
  onDownload?: () => void
}

export function ImagePreviewModal({
  isOpen,
  onClose,
  imageUrl,
  imageName,
  onDownload
}: ImagePreviewModalProps) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [isClosing, setIsClosing] = useState(false)

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.25))
  }

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360)
  }

  const handleReset = () => {
    setZoom(1)
    setRotation(0)
  }

  const handleImageLoad = () => {
    setImageLoaded(true)
    setImageError(false)
  }

  const handleImageError = () => {
    // Don't show error toast if modal is closing or URL is empty
    if (isClosing || !imageUrl || imageUrl.trim() === '') {
      return
    }
    
    setImageError(true)
    setImageLoaded(false)
    toast({
      title: 'Erro ao carregar imagem',
      description: 'Não foi possível carregar a imagem para preview.',
      variant: 'destructive',
    })
  }

  const handleDownload = () => {
    if (onDownload) {
      onDownload()
    }
  }

  // Reset states when modal opens/closes
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setIsClosing(true)
      onClose()
      // Reset states after a short delay to avoid visual glitches
      setTimeout(() => {
        setZoom(1)
        setRotation(0)
        setImageLoaded(false)
        setImageError(false)
        setIsClosing(false)
      }, 200)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-4 pb-2">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-medium truncate pr-4">
              {imageName}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {/* Zoom Controls */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 0.25}
                title="Diminuir zoom"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground min-w-[3rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                title="Aumentar zoom"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              
              {/* Rotate */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRotate}
                title="Girar imagem"
              >
                <RotateCw className="w-4 h-4" />
              </Button>
              
              {/* Reset */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                title="Resetar zoom e rotação"
              >
                Reset
              </Button>
              
              {/* Download */}
              {onDownload && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  title="Baixar imagem"
                >
                  <Download className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden bg-muted/30">
          <div className="h-[70vh] flex items-center justify-center p-4">
            {imageError ? (
              <div className="text-center text-muted-foreground">
                <div className="text-4xl mb-2">🖼️</div>
                <p>Não foi possível carregar a imagem</p>
                <p className="text-sm mt-1">Verifique se o arquivo ainda existe</p>
              </div>
            ) : (
              <div className="relative max-w-full max-h-full overflow-auto">
                <img
                  src={imageUrl}
                  alt={imageName}
                  className="max-w-none transition-transform duration-200 ease-in-out"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: 'center',
                  }}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                  draggable={false}
                />
                
                {!imageLoaded && !imageError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                    <div className="text-center text-muted-foreground">
                      <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                      <p className="text-sm">Carregando imagem...</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Footer with keyboard shortcuts info */}
        <div className="p-4 pt-2 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground text-center">
            Use os controles acima para navegar • ESC para fechar
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}