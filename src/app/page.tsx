'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  FileText,
  Loader2,
  Download,
  Share2,
  Trash2,
  Upload,
  ImageIcon,
  AlertCircle,
  Package,
  MessageSquare,
  Eraser,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  renderPdfToPngs,
  downloadBlob,
  sharePngViaWhatsApp,
  createZipFromPngs,
  type RenderedPage,
} from '@/lib/pdf-utils'

interface ProcessedPdf {
  fileName: string
  baseName: string
  pages: RenderedPage[]
}

function sanitizeBaseName(name: string): string {
  return name.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_-]+/g, '_') || 'pagina'
}

const MESSAGE_STORAGE_KEY = 'pdf-to-png:whatsapp-message'

export default function Home() {
  const [pdf, setPdf] = useState<ProcessedPdf | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [scale, setScale] = useState(2)
  const [error, setError] = useState<string | null>(null)
  const [whatsappMessage, setWhatsappMessage] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  // Load saved message from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MESSAGE_STORAGE_KEY)
      if (saved !== null) {
        setWhatsappMessage(saved)
      }
    } catch {
      /* localStorage may be unavailable */
    }
  }, [])

  // Persist message to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(MESSAGE_STORAGE_KEY, whatsappMessage)
    } catch {
      /* ignore */
    }
  }, [whatsappMessage])

  // Listen for the clipboard-copied hint dispatched by sharePngViaWhatsApp
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.message) {
        toast.info('Mensaje copiado al portapapeles. Pégalo en WhatsApp con Ctrl+V.')
      }
    }
    window.addEventListener('whatsapp-message-copied', handler)
    return () => window.removeEventListener('whatsapp-message-copied', handler)
  }, [])

  const processFile = useCallback(
    async (file: File, renderScale: number) => {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setError('El archivo seleccionado no es un PDF.')
        return
      }

      setIsProcessing(true)
      setError(null)
      setProgress(0)
      setPdf(null)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const pages = await renderPdfToPngs(file, {
          scale: renderScale,
          signal: controller.signal,
          onProgress: (current, total) => {
            setProgress(Math.round((current / total) * 100))
          },
        })

        setPdf({
          fileName: file.name,
          baseName: sanitizeBaseName(file.name),
          pages,
        })
        toast.success(`${pages.length} página(s) convertida(s) a PNG`)
      } catch (err: any) {
        if (err?.message === 'aborted') {
          toast.info('Conversión cancelada')
        } else {
          console.error(err)
          setError(
            err?.message ||
              'No se pudo procesar el PDF. Verifica que el archivo no esté dañado.',
          )
        }
      } finally {
        setIsProcessing(false)
        abortRef.current = null
      }
    },
    [],
  )

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length > 0) {
        processFile(accepted[0], scale)
      }
    },
    [processFile, scale],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
  })

  const handleCancel = () => {
    abortRef.current?.abort()
  }

  const handleReset = () => {
    setPdf(null)
    setProgress(0)
    setError(null)
  }

  const handleDownload = (page: RenderedPage) => {
    const filename = `${pdf!.baseName}_pag_${page.pageNumber}.png`
    downloadBlob(page.blob, filename)
    toast.success(`Descargando ${filename}`)
  }

  const handleWhatsApp = async (page: RenderedPage) => {
    const filename = `${pdf!.baseName}_pag_${page.pageNumber}.png`
    const result = await sharePngViaWhatsApp(page.blob, filename, whatsappMessage)
    if (result === 'shared') {
      toast.success('Abriendo WhatsApp…')
    } else {
      toast.info('Imagen descargada. Adjúntala en WhatsApp Web.')
    }
  }

  const handleDownloadAll = async () => {
    if (!pdf) return
    toast.info('Generando ZIP con todas las imágenes…')
    const zip = await createZipFromPngs(
      pdf.pages.map((p) => ({
        blob: p.blob,
        filename: `${pdf.baseName}_pag_${p.pageNumber}.png`,
      })),
    )
    downloadBlob(zip, `${pdf.baseName}_png.zip`)
    toast.success('ZIP descargado')
  }

  const handleShareAll = async () => {
    if (!pdf) return
    toast.info('Generando ZIP para compartir…')
    const zip = await createZipFromPngs(
      pdf.pages.map((p) => ({
        blob: p.blob,
        filename: `${pdf.baseName}_pag_${p.pageNumber}.png`,
      })),
    )
    const result = await sharePngViaWhatsApp(zip, `${pdf.baseName}_png.zip`, whatsappMessage)
    if (result === 'shared') {
      toast.success('Abriendo WhatsApp…')
    } else {
      toast.info('ZIP descargado. Adjúntalo en WhatsApp Web.')
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-50/40 via-white to-white dark:from-emerald-950/20 dark:via-background dark:to-background">
      {/* Header */}
      <header className="border-b border-border/60 bg-white/80 dark:bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                PDF → PNG Converter
              </h1>
              <p className="text-xs text-muted-foreground">
                Convierte, descarga y comparte por WhatsApp
              </p>
            </div>
          </div>
          {pdf && (
            <Button variant="outline" size="sm" onClick={handleReset}>
              <Trash2 className="w-4 h-4 mr-2" />
              Limpiar
            </Button>
          )}
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        {!pdf && !isProcessing && (
          <>
            {/* Dropzone */}
            <div
              {...getRootProps()}
              className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer p-12 md:p-20 text-center
                ${
                  isDragActive
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30'
                    : 'border-border hover:border-emerald-400 hover:bg-emerald-50/30 dark:hover:bg-emerald-950/10'
                }`}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-lg font-medium">
                    {isDragActive
                      ? 'Suelta tu PDF aquí…'
                      : 'Arrastra tu PDF o haz clic para seleccionar'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Solo archivos .pdf · El procesamiento ocurre 100% en tu navegador
                  </p>
                </div>
              </div>
            </div>

            {/* Quality selector */}
            <Card className="mt-6">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center gap-6">
                  <div className="flex-1">
                    <Label className="text-sm font-medium">
                      Calidad de imagen
                    </Label>
                    <div className="mt-3 flex items-center gap-4">
                      <Slider
                        value={[scale]}
                        onValueChange={(v) => setScale(v[0])}
                        min={1}
                        max={4}
                        step={0.5}
                        className="flex-1"
                      />
                      <Badge variant="secondary" className="font-mono">
                        {scale}×
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Mayor escala = mejor calidad pero archivos más grandes. 2× es un buen equilibrio.
                    </p>
                  </div>
                  <div className="md:w-px md:h-12 md:bg-border" />
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => setScale(1)}
                    >
                      Borrador (1×)
                    </Badge>
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => setScale(2)}
                    >
                      Estándar (2×)
                    </Badge>
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => setScale(3)}
                    >
                      Alta (3×)
                    </Badge>
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => setScale(4)}
                    >
                      Máxima (4×)
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {error && (
              <div className="mt-4 flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900">
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div className="text-sm">{error}</div>
              </div>
            )}

            {/* Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-10">
              {[
                {
                  icon: ImageIcon,
                  title: 'Renderizado en cliente',
                  desc: 'Tu PDF nunca sale de tu dispositivo. Cero servidores, cero esperas.',
                },
                {
                  icon: Download,
                  title: 'Descarga individual o ZIP',
                  desc: 'Baja cada PNG por separado o todas las páginas en un único ZIP.',
                },
                {
                  icon: Share2,
                  title: 'Comparte por WhatsApp',
                  desc: 'Usa la hoja de compartir nativa en móvil o WhatsApp Web en escritorio.',
                },
              ].map((f, i) => (
                <Card key={i} className="border-border/60">
                  <CardContent className="p-5">
                    <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mb-3">
                      <f.icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="font-medium text-sm">{f.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {f.desc}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Processing state */}
        {isProcessing && (
          <Card>
            <CardContent className="p-8">
              <div className="flex flex-col items-center gap-6">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <Loader2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400 animate-spin" />
                </div>
                <div className="text-center w-full max-w-md">
                  <p className="font-medium">Convirtiendo PDF a PNG…</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Renderizando cada página. Esto puede tardar según el número de páginas.
                  </p>
                  <div className="mt-4">
                    <Progress value={progress} className="h-2" />
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      {progress}%
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {pdf && !isProcessing && (
          <div>
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">
                  {pdf.fileName}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {pdf.pages.length} página(s) convertida(s) a PNG
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handleDownloadAll}>
                  <Package className="w-4 h-4 mr-2" />
                  Descargar ZIP
                </Button>
                <Button
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                  onClick={handleShareAll}
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Compartir ZIP por WhatsApp
                </Button>
              </div>
            </div>

            {/* Reusable WhatsApp message */}
            <Card className="mb-6 border-emerald-200/60 dark:border-emerald-900/40">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <Label htmlFor="wa-message" className="text-sm font-medium">
                        Mensaje para WhatsApp
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Se copia al portapapeles y se rellena en WhatsApp. Se guarda en este navegador para usos futuros.
                      </p>
                    </div>
                  </div>
                  {whatsappMessage && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => setWhatsappMessage('')}
                    >
                      <Eraser className="w-3.5 h-3.5 mr-1" />
                      Borrar
                    </Button>
                  )}
                </div>
                <Textarea
                  id="wa-message"
                  value={whatsappMessage}
                  onChange={(e) => setWhatsappMessage(e.target.value)}
                  placeholder="Ej: Hola, te adjunto las páginas del documento solicitado."
                  className="min-h-[80px] resize-y"
                  rows={3}
                />
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <span>
                    {whatsappMessage.trim()
                      ? `Se enviará junto con cada imagen / ZIP (${whatsappMessage.trim().length} caracteres)`
                      : 'Sin mensaje — solo se compartirán las imágenes'}
                  </span>
                  <span className="hidden sm:inline">
                    💡 Tip: escribe el mensaje una vez y reutilízalo en cada conversación
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {pdf.pages.map((page) => (
                <Card
                  key={page.pageNumber}
                  className="overflow-hidden border-border/60 hover:shadow-md transition-shadow"
                >
                  <div className="relative aspect-[3/4] bg-muted/30 flex items-center justify-center overflow-hidden">
                    <img
                      src={page.dataUrl}
                      alt={`Página ${page.pageNumber}`}
                      className="max-w-full max-h-full object-contain"
                    />
                    <Badge
                      className="absolute top-2 left-2 bg-black/70 text-white hover:bg-black/70"
                      variant="secondary"
                    >
                      Pág. {page.pageNumber}
                    </Badge>
                  </div>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                      <span>
                        {page.width}×{page.height}px
                      </span>
                      <span>{(page.blob.size / 1024).toFixed(0)} KB</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleDownload(page)}
                      >
                        <Download className="w-4 h-4 mr-1.5" />
                        PNG
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                        onClick={() => handleWhatsApp(page)}
                      >
                        <Share2 className="w-4 h-4 mr-1.5" />
                        WhatsApp
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border/60 mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-xs text-muted-foreground">
          PDF → PNG · 100% en el navegador · Tus archivos nunca se suben a un servidor
        </div>
      </footer>
    </div>
  )
}
