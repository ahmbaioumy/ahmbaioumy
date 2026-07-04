import type { PipelineState } from '../core/models'

export interface StageProps {
  state: PipelineState
  update: (patch: Partial<PipelineState>) => void
  onNext: () => void
}
