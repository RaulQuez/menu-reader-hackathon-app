import { useEffect, useRef } from 'react'

// Behaviour for our bottom-sheet modal (AnswerSheet),
// built on the browser's <dialog>. showModal() gives us for free: focus stays
// inside the modal, the page behind can't be tapped or read by screen readers,
// and Esc closes it.
//
// const dialogProps = useModalDialog(open, onClose)
// <dialog {...dialogProps} className="answer-sheet">…</dialog>
export default function useModalDialog(open, onClose) {
  const ref = useRef(null)

  // keep the real <dialog> in sync with the `open` prop
  useEffect(() => {
    const d = ref.current
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  return {
    ref,
    // Esc key: let React close it, so our state stays in charge
    onCancel: (e) => { e.preventDefault(); onClose() },
    // a tap on the dim backdrop lands on the <dialog> itself, not its contents
    onClick: (e) => { if (e.target === ref.current) onClose() },
  }
}
