import type { Profile } from '../core/models'
import type { StageProps } from './types'

const HELP: Record<string, string> = {
  SLA: 'Service Level — % of contacts answered within target wait time.',
  Shrinkage: 'Time agents are unavailable (breaks, training).',
  AHT: 'Average Handle Time in seconds.',
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="form-field">
      <label title={help ? HELP[help] : undefined} className={help ? 'help' : ''}>{label}</label>
      {children}
    </div>
  )
}

export function ProfileStage({ state, update, onNext }: StageProps) {
  const p = state.profile
  const set = (patch: Partial<Profile>) => update({ profile: { ...p, ...patch } })

  return (
    <div className="stage">
      <h2>Planning Profile</h2>
      <div className="card form-grid">
        <Field label="Profile Name">
          <input value={p.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <Field label="SLA Target (%)" help="SLA">
          <input type="number" value={p.slaTargetPct} onChange={(e) => set({ slaTargetPct: +e.target.value })} />
        </Field>
        <Field label="SLA Time (sec)" help="SLA">
          <input type="number" value={p.slaTimeSeconds} onChange={(e) => set({ slaTimeSeconds: +e.target.value })} />
        </Field>
        <Field label="AHT (sec)" help="AHT">
          <input type="number" value={p.ahtSeconds} onChange={(e) => set({ ahtSeconds: +e.target.value })} />
        </Field>
        <Field label="Shrinkage (%)" help="Shrinkage">
          <input type="number" value={p.shrinkagePct} onChange={(e) => set({ shrinkagePct: +e.target.value })} />
        </Field>
        <Field label="Occupancy Target (%)">
          <input type="number" value={p.occupancyTargetPct} onChange={(e) => set({ occupancyTargetPct: +e.target.value })} />
        </Field>
        <Field label="Patience (sec)">
          <input type="number" value={p.patienceSeconds} onChange={(e) => set({ patienceSeconds: +e.target.value })} />
        </Field>
        <Field label="Erlang Model">
          <select value={p.erlangModel} onChange={(e) => set({ erlangModel: e.target.value as Profile['erlangModel'] })}>
            <option value="erlang_c">Erlang C (0% abandon)</option>
            <option value="erlang_a">Erlang A (with abandon)</option>
            <option value="erlang_b">Erlang B (blocking)</option>
          </select>
        </Field>
      </div>
      <div className="stage-actions">
        <button className="btn-primary" onClick={onNext}>Next →</button>
      </div>
    </div>
  )
}
