import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, X, FileText } from "lucide-react"
import { Attachment } from "@/data/fixtures"

interface MockUploaderProps {
  onUpload: (attachment: Omit<Attachment, 'id' | 'createdAt'>) => void
  loading?: boolean
  accept?: string
  maxSizeMB?: number
}

export function MockUploader({ 
  onUpload, 
  loading, 
  accept = "*/*", 
  maxSizeMB = 10 
}: MockUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (files: FileList | null) => {
    if (!files) return
    
    const validFiles = Array.from(files).filter(file => {
      if (file.size > maxSizeMB * 1024 * 1024) {
        alert(`Arquivo ${file.name} é muito grande. Máximo: ${maxSizeMB}MB`)
        return false
      }
      return true
    })
    
    setSelectedFiles(prev => [...prev, ...validFiles])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFileSelect(e.dataTransfer.files)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const removeFile = (index: number) => {
    setSelectedFiles(files => files.filter((_, i) => i !== index))
  }

  const uploadFiles = async () => {
    const readFileAsDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    for (const file of selectedFiles) {
      // Generate a data URL so downloads work without backend storage in this mock
      const dataUrl = await readFileAsDataUrl(file)

      const attachment: Omit<Attachment, 'id' | 'createdAt'> = {
        name: file.name,
        url: dataUrl,
        sizeKB: Math.round(file.size / 1024),
        mime: file.type || 'application/octet-stream'
      }

      onUpload(attachment)
    }

    setSelectedFiles([])
  }

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <Card
        className={`border-2 border-dashed transition-colors cursor-pointer ${
          isDragOver 
            ? 'border-primary bg-primary/5' 
            : 'border-muted-foreground/25 hover:border-muted-foreground/50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <CardContent className="pt-6 pb-6 text-center">
          <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-1">
            Arraste arquivos aqui ou clique para selecionar
          </p>
          <p className="text-xs text-muted-foreground">
            Máximo: {maxSizeMB}MB por arquivo
          </p>
        </CardContent>
      </Card>

      <Input
        ref={fileInputRef}
        type="file"
        multiple
        accept={accept}
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
      />

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Arquivos selecionados:</h4>
          {selectedFiles.map((file, index) => (
            <Card key={index}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round(file.size / 1024)} KB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeFile(index)
                    }}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          
          <Button 
            onClick={uploadFiles} 
            disabled={loading || selectedFiles.length === 0}
            className="w-full"
          >
            {loading ? "Enviando..." : `Enviar ${selectedFiles.length} arquivo(s)`}
          </Button>
        </div>
      )}
    </div>
  )
}