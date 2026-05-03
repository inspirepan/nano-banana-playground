import { useI18n } from '../../../i18n'

type Props = {
  batchCount: number
  setBatchCount: (n: number) => void
  maxBatchCount: number
}

export function EditBatchCount({ batchCount, setBatchCount, maxBatchCount }: Props) {
  const { t } = useI18n()

  return (
    <div className="mb-[18px]">
      <div className="label mb-1.5">{t('imageDetail.meta.quantity')}</div>
      <div className="grid gap-1.5 tabular-nums" style={{ gridTemplateColumns: `repeat(${maxBatchCount}, 1fr)` }}>
        {Array.from({ length: maxBatchCount }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            className="chip justify-center"
            data-active={batchCount === n}
            onClick={() => setBatchCount(n)}
          >
            <span>×{n}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
