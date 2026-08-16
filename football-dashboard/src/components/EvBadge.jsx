/**
 * Badge visual para el Índice de Valor (EV)
 */
export default function EvBadge({ ev }) {
  const value = parseFloat(ev)

  if (value >= 5) {
    return (
      <span className="ev-badge ev-positive">
        <span>▲</span>
        <span>+{value.toFixed(2)}%</span>
      </span>
    )
  }
  if (value >= 0) {
    return (
      <span className="ev-badge ev-neutral">
        <span>◆</span>
        <span>+{value.toFixed(2)}%</span>
      </span>
    )
  }
  return (
    <span className="ev-badge ev-negative">
      <span>▼</span>
      <span>{value.toFixed(2)}%</span>
    </span>
  )
}
