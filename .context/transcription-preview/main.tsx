import { createRoot } from 'react-dom/client'
import { AtaTranscriptionPanel } from '@/components/atas/AtaTranscriptionPanel'
import '../../apps/web-next/src/app/globals.css'

createRoot(document.getElementById('root')!).render(
  <main className="mx-auto min-w-0 max-w-[1440px] px-4 py-6 sm:px-9 sm:py-10">
    <AtaTranscriptionPanel ataId="fixture-ata" onGenerateMinuta={() => { document.documentElement.dataset.minutaPrepared = 'true' }} />
  </main>,
)
