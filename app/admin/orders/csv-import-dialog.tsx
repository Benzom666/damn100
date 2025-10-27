"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { importOrdersFromCSV } from "./actions"
import { useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, AlertTriangle } from "lucide-react"

interface CSVImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CSVImportDialog({ open, onOpenChange }: CSVImportDialogProps) {
  const [csvData, setCsvData] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null)

  async function handleImport() {
    setIsLoading(true)
    setResult(null)

    try {
      const importResult = await importOrdersFromCSV(csvData)
      setResult(importResult)
      if (importResult.errors.length === 0) {
        setCsvData("")
        setTimeout(() => onOpenChange(false), 2000)
      }
    } catch (error) {
      console.error("Import error:", error)
      setResult({ imported: 0, errors: ["Failed to import orders"] })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Orders from CSV</DialogTitle>
          <DialogDescription>
            Paste your CSV data below. Required columns: customer_name, address, customer_email. Optional: city, state,
            zip, phone, notes
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-md bg-muted p-3 text-xs font-mono">
            customer_name,address,city,state,zip,phone,notes,customer_email
            <br />
            John Doe,123 Main St,Springfield,IL,62701,555-0100,Leave at door,john@example.com
          </div>
          <Textarea
            placeholder="Paste CSV data here..."
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
            rows={10}
            className="font-mono text-xs"
          />
          {result && (
            <div className="space-y-2">
              {result.imported > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Success</AlertTitle>
                  <AlertDescription>Successfully imported {result.imported} order(s).</AlertDescription>
                </Alert>
              )}
              {result.errors.length > 0 && (
                <Alert variant={result.imported === 0 ? "destructive" : "default"}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Warnings</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside space-y-1 mt-2">
                      {result.errors.map((error, i) => (
                        <li key={i} className="text-sm">
                          {error}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={isLoading || !csvData.trim()}>
            {isLoading ? "Importing..." : "Import Orders"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
