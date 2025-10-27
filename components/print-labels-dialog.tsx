"use client"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"
import { ShippingLabel } from "./shipping-label"
import { useState } from "react"

interface PrintLabelsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orders: any[]
  routeName?: string
}

export function PrintLabelsDialog({ open, onOpenChange, orders, routeName }: PrintLabelsDialogProps) {
  const [isPrinting, setIsPrinting] = useState(false)

  const handlePrint = () => {
    setIsPrinting(true)
    setTimeout(() => {
      window.print()
      setIsPrinting(false)
    }, 500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="no-print">
          <DialogTitle>Print Shipping Labels</DialogTitle>
          <DialogDescription>
            Preview and print labels for {orders.length} order{orders.length !== 1 ? "s" : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button onClick={handlePrint} className="w-full no-print" disabled={isPrinting}>
            <Printer className="h-4 w-4 mr-2" />
            {isPrinting ? "Preparing..." : "Print All Labels"}
          </Button>

          {/* Print Preview */}
          <div className="border rounded-lg p-4 bg-gray-50 no-print">
            <div className="text-sm text-muted-foreground mb-4">Preview:</div>
            <div className="space-y-4 max-h-[500px] overflow-y-auto">
              {orders.map((order) => (
                <div key={order.id} className="border-2 border-dashed border-gray-300 inline-block">
                  <ShippingLabel order={order} routeName={routeName} />
                </div>
              ))}
            </div>
          </div>

          <div className="print-labels hidden">
            {orders.map((order) => (
              <ShippingLabel key={order.id} order={order} routeName={routeName} />
            ))}
          </div>
        </div>
      </DialogContent>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          
          .print-labels,
          .print-labels * {
            visibility: visible !important;
          }
          
          .print-labels {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            display: block !important;
          }
          
          .no-print {
            display: none !important;
          }
          
          @page {
            size: 4in 6in;
            margin: 0;
          }
        }
      `}</style>
    </Dialog>
  )
}
