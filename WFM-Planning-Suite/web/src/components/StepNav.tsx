interface Props {
  stages: readonly string[]
  current: number
  completed: Set<number>
  onSelect: (i: number) => void
}

export function StepNav({ stages, current, completed, onSelect }: Props) {
  return (
    <nav className="step-nav">
      {stages.map((name, i) => {
        const done = completed.has(i)
        const locked = i > 0 && !completed.has(i - 1) && i !== current
        return (
          <button
            key={name}
            className={[current === i ? 'active' : '', done ? 'done' : ''].join(' ')}
            disabled={locked}
            onClick={() => !locked && onSelect(i)}
          >
            {done ? '✓ ' : ''}{name}
          </button>
        )
      })}
    </nav>
  )
}
