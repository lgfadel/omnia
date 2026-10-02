import { createRoot } from 'react-dom/client'
import { AtaMinutaPanel } from '@/components/atas/AtaMinutaPanel'
import '../../apps/web-next/src/app/globals.css'

createRoot(document.getElementById('root')!).render(
  <main className="mx-auto min-w-0 max-w-[1360px] px-4 py-6 sm:px-8 sm:py-10">
    <AtaMinutaPanel ataId="fixture-ata" ataTitle="Assembleia Geral Ordinária — Condomínio Jardim das Palmeiras" onOpenTranscription={() => undefined} />
  </main>,
)
