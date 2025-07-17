import React from 'react'

interface TransitStep {
  name: string
  stationTypes: string[]
  lines: string[]
  departureTime?: string
  arrivalTime?: string
  location: {
    latitude: number
    longitude: number
  }
}

interface TransitRoute {
  steps: TransitStep[]
  label?: string
  color?: string
}

interface TransitRouteVisualizationProps {
  routes: TransitRoute[]
  width?: number
  height?: number
}

interface GeoBounds {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

function calculateGeoBounds(routes: TransitRoute[]): GeoBounds {
  const allSteps = routes.flatMap(route => route?.steps || [])
  
  if (allSteps.length === 0) {
    return { minLat: 0, maxLat: 0, minLng: 0, maxLng: 0 }
  }

  let minLat = allSteps[0].location.latitude
  let maxLat = allSteps[0].location.latitude
  let minLng = allSteps[0].location.longitude
  let maxLng = allSteps[0].location.longitude

  for (const step of allSteps) {
    minLat = Math.min(minLat, step.location.latitude)
    maxLat = Math.max(maxLat, step.location.latitude)
    minLng = Math.min(minLng, step.location.longitude)
    maxLng = Math.max(maxLng, step.location.longitude)
  }

  // Add some padding to the bounds to ensure all points are visible
  const latPadding = (maxLat - minLat) * 0.1 || 0.001
  const lngPadding = (maxLng - minLng) * 0.1 || 0.001

  return { 
    minLat: minLat - latPadding, 
    maxLat: maxLat + latPadding, 
    minLng: minLng - lngPadding, 
    maxLng: maxLng + lngPadding 
  }
}

function projectCoordinates(
  lat: number,
  lng: number,
  bounds: GeoBounds,
  svgWidth: number,
  svgHeight: number
): { x: number; y: number } {
  const padding = 20
  const usableWidth = svgWidth - 2 * padding
  const usableHeight = svgHeight - 2 * padding

  const latRange = bounds.maxLat - bounds.minLat
  const lngRange = bounds.maxLng - bounds.minLng

  let x, y

  if (lngRange === 0 || !isFinite(lngRange)) {
    x = svgWidth / 2
  } else {
    x = padding + ((lng - bounds.minLng) / lngRange) * usableWidth
  }

  if (latRange === 0 || !isFinite(latRange)) {
    y = svgHeight / 2
  } else {
    // Note: We flip Y coordinate because SVG Y increases downward, but latitude increases upward
    y = padding + ((bounds.maxLat - lat) / latRange) * usableHeight
  }

  // Ensure coordinates are within bounds
  x = Math.max(0, Math.min(svgWidth, x))
  y = Math.max(0, Math.min(svgHeight, y))

  return { x, y }
}

export function TransitRouteVisualization({
  routes,
  width = 400,
  height = 300
}: TransitRouteVisualizationProps) {
  if (!routes || routes.length === 0 || routes.every(route => !route || !route.steps || route.steps.length === 0)) {
    return (
      <div className="flex items-center justify-center p-8 text-gray-500">
        No transit routes to display
      </div>
    )
  }

  const bounds = calculateGeoBounds(routes)
  const defaultColors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#34495e']
  
  const getStationColor = (stationTypes: string[]) => {
    if (stationTypes.includes('Major Interchange')) return '#ff6b6b'
    if (stationTypes.includes('Tube Station')) return '#4ecdc4'
    if (stationTypes.includes('Bus Stop')) return '#45b7d1'
    return '#95a5a6'
  }

  return (
    <div className="border rounded-lg p-4 bg-white">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Route paths */}
        {routes.map((route, routeIndex) => {
          if (!route || !route.steps || route.steps.length === 0) return null
          
          const points = route.steps.map(step => 
            projectCoordinates(step.location.latitude, step.location.longitude, bounds, width, height)
          )
          
          const pathData = points.reduce((path: string, point: { x: number; y: number }, index: number) => {
            return index === 0 ? `M ${point.x} ${point.y}` : `${path} L ${point.x} ${point.y}`
          }, '')
          
          const routeColor = route.color || defaultColors[routeIndex % defaultColors.length]
          
          return (
            <path
              key={`route-${routeIndex}`}
              d={pathData}
              stroke={routeColor}
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.8"
            />
          )
        })}

        {/* Station markers */}
        {routes.map((route, routeIndex) => 
          (route?.steps || []).map((step: TransitStep, stepIndex: number) => {
            const point = projectCoordinates(step.location.latitude, step.location.longitude, bounds, width, height)
            const color = getStationColor(step.stationTypes)
            
            return (
              <g key={`station-${routeIndex}-${stepIndex}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="6"
                  fill={color}
                  stroke="white"
                  strokeWidth="2"
                />
                <text
                  x={point.x}
                  y={point.y - 10}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#2c3e50"
                  fontWeight="500"
                >
                  {step.name.length > 20 ? step.name.substring(0, 20) + '...' : step.name}
                </text>
              </g>
            )
          })
        )}
      </svg>

      {/* Legend */}
      <div className="mt-4 space-y-2">
        {/* Route legend */}
        {routes.length > 1 && (
          <div className="flex flex-wrap gap-4 text-xs">
            {routes.map((route, index) => {
              const routeColor = route.color || defaultColors[index % defaultColors.length]
              return (
                <div key={`route-legend-${index}`} className="flex items-center gap-1">
                  <div className="w-4 h-0.5" style={{ backgroundColor: routeColor }}></div>
                  <span>{route.label || `Route ${index + 1}`}</span>
                </div>
              )
            })}
          </div>
        )}
        
        {/* Station type legend */}
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span>Major Interchange</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-teal-500"></div>
            <span>Tube Station</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span>Bus Stop</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span>Other</span>
          </div>
        </div>
      </div>
    </div>
  )
}