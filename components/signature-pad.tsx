"use client"

import type React from "react"

import { useRef, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { X, Check } from "lucide-react"

interface SignaturePadProps {
  onSave: (dataUrl: string) => void
  onCancel: () => void
}

export function SignaturePad({ onSave, onCancel }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Set canvas size
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    // Set drawing styles
    ctx.strokeStyle = "#000"
    ctx.lineWidth = 2
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
  }, [])

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if ("touches" in e) {
      e.preventDefault()
    }

    setIsDrawing(true)
    setIsEmpty(false)
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top

    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return

    if ("touches" in e) {
      e.preventDefault()
    }

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clear = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setIsEmpty(true)
  }

  const save = () => {
    const canvas = canvasRef.current
    if (!canvas || isEmpty) return

    try {
      const dataUrl = canvas.toDataURL("image/png")
      if (!dataUrl || !dataUrl.startsWith("data:image/png")) {
        console.error("[v0] Invalid canvas data URL generated")
        alert("Failed to save signature. Please try again.")
        return
      }
      console.log("[v0] Signature saved successfully")
      onSave(dataUrl)
    } catch (error) {
      console.error("[v0] Error saving signature:", error)
      alert("Failed to save signature. Please try again.")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <canvas
        ref={canvasRef}
        className="w-full h-48 border-2 border-border rounded-lg touch-none bg-white"
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
      />
      <div className="flex gap-2">
        <Button onClick={clear} variant="outline" className="flex-1 bg-transparent">
          Clear
        </Button>
        <Button onClick={onCancel} variant="outline" size="icon">
          <X className="h-4 w-4" />
        </Button>
        <Button onClick={save} disabled={isEmpty} className="flex-1">
          <Check className="h-4 w-4 mr-2" />
          Save Signature
        </Button>
      </div>
    </div>
  )
}
