import { HereMap } from "@/components/here-map"

export default function TestMap() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">HERE Map Smoke Test</h1>
      <HereMap center={{ lat: 45.4215, lng: -75.6972 }} markers={[{ lat: 45.4215, lng: -75.6972, label: "Ottawa" }]} />
    </div>
  )
}
