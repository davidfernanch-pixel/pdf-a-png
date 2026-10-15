# PDF → PNG Converter

Web app para convertir cada página de un PDF en una imagen PNG, descargarla individualmente (o en ZIP) y compartirla por WhatsApp.

## Características

- **Subir PDF** por drag & drop o selección manual
- **Convertir cada página a PNG** — renderizado 100% en el navegador con [`pdfjs-dist`](https://github.com/mozilla/pdf.js) (el PDF nunca se sube a un servidor)
- **Selector de calidad** — escala de 1× (borrador) a 4× (máxima)
- **Descargar PNG individual** con un clic
- **Descargar todas las páginas en un ZIP** (implementación propia store-only, sin dependencias)
- **Compartir por WhatsApp**:
  - En móvil: usa la hoja nativa de compartir (Web Share API con archivos) → abre WhatsApp con la imagen adjunta
  - En escritorio: descarga el PNG y abre WhatsApp Web para que lo adjuntes manualmente
- **Barra de progreso** durante la conversión + botón cancelar
- **Diseño responsive** mobile-first con tema esmeralda

## Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Estilos**: Tailwind CSS 4 + shadcn/ui
- **PDF**: `pdfjs-dist` (worker servido desde `/public/pdf.worker.min.mjs`)
- **Otras**: `react-dropzone`, `sonner`, `lucide-react`

## Estructura

```
src/
├── app/
│   ├── layout.tsx        # Layout + metadata + Sonner toaster
│   └── page.tsx          # UI principal (dropzone + grid de resultados)
├── lib/
│   └── pdf-utils.ts      # renderPdfToPngs, downloadBlob, sharePngViaWhatsApp, createZipFromPngs
└── components/ui/        # Componentes shadcn/ui
public/
└── pdf.worker.min.mjs    # Worker de pdfjs
```

## Desarrollo

```bash
bun install
bun run dev      # http://localhost:3000
bun run lint     # ESLint
```

## Cómo funciona

1. El usuario arrastra un PDF al dropzone
2. `pdfjs-dist` carga el PDF en memoria y renderiza cada página a un `<canvas>` oculto con la escala elegida
3. Cada canvas se convierte en:
   - Un `dataURL` PNG (para la miniatura en la tarjeta)
   - Un `Blob` PNG (para descarga y compartir)
4. Los botones de cada tarjeta permiten:
   - **PNG**: descargar el Blob como `nombre_pag_N.png`
   - **WhatsApp**: usar `navigator.share({ files: [File] })` en móvil, o descargar + abrir `web.whatsapp.com` en escritorio
5. Los botones globales empaquetan todos los PNGs en un ZIP (encoder store-only con CRC32 propio) y aplican el mismo flujo de descarga/compartir

## Privacidad

**El PDF nunca sale del navegador.** Todo el procesamiento ocurre en cliente usando Web Workers y Canvas. No hay backend ni almacenamiento.

## Licencia

MIT
