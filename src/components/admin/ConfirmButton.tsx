"use client"

import { useState, type CSSProperties, type ReactNode } from "react"

export default function ConfirmButton({
  onClick,
  disabled,
  style,
  children,
  confirmText = "ARE YOU SURE?",
}: {
  onClick: () => void
  disabled?: boolean
  style?: CSSProperties
  children: ReactNode
  confirmText?: string
}) {
  const [confirming, setConfirming] = useState(false)

  const handleClick = () => {
    if (confirming) {
      onClick()
      setConfirming(false)
    } else {
      setConfirming(true)
      setTimeout(() => setConfirming(false), 3000)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      style={{
        ...style,
        background: confirming ? "#ff6b6b" : style?.background,
        color: confirming ? "#000" : style?.color,
        borderColor: confirming ? "#ff6b6b" : style?.borderColor,
        transition: "all 0.2s ease",
      }}
    >
      {confirming ? confirmText : children}
    </button>
  )
}
