import HereMap from "@/components/here-map"

export default function TestMap() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">HERE Map Smoke Test</h1>
      <HereMap points={[{ lat: 45.4215, lng: -75.6972 }]} />
    </div>
  )
}
