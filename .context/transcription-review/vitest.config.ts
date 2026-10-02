import original from '../../apps/web-next/vitest.config'

export default {
  ...original,
  test: {
    ...original.test,
    include: ['../../.context/transcription-review/*.test.tsx'],
  },
}
