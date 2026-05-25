import { useEffect, useRef } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  width?: number
  children: React.ReactNode
}

export function Modal({ isOpen, onClose, title, width = 400, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="horus-modal-overlay" onClick={onClose}>
      <div className="horus-modal" style={{ width }} onClick={(e) => e.stopPropagation()} ref={ref}>
        {title && (
          <div className="horus-modal-header">
            <span className="horus-modal-title">{title}</span>
            <button className="horus-modal-close" onClick={onClose}>&times;</button>
          </div>
        )}
        <div className="horus-modal-body">{children}</div>
      </div>
    </div>
  )
}
