import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

function decodePolyline(encoded) {
    const inv = 1.0 / 1e5
    const decoded = []
    let previous = [0, 0]
    let i = 0

    while (i < encoded.length) {
        let ll = [0, 0]
        for (let j = 0; j < 2; j++) {
            let shift = 0
            let result = 0
            let byte = 0
            do {
                byte = encoded.charCodeAt(i++) - 63
                result |= (byte & 0x1f) << shift
                shift += 5
            } while (byte >= 0x20)
            ll[j] = previous[j] + (result & 1 ? ~(result >> 1) : result >> 1)
            previous[j] = ll[j]
        }
        decoded.push([ll[1], ll[0]]) // [lat, lng]
    }
    return decoded
}

// Calculate distance in miles between two lat/lng points (Haversine formula)
function getDistanceMiles(lat1, lng1, lat2, lng2) {
    const R = 3959 // Earth's radius in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

// Calculate cumulative distance along a polyline and find coordinate at a specific distance
function findCoordinateAtDistance(polylineCoords, targetMiles) {
    let cumulativeDistance = 0
    
    for (let i = 0; i < polylineCoords.length - 1; i++) {
        const [lat1, lng1] = polylineCoords[i]
        const [lat2, lng2] = polylineCoords[i + 1]
        const segmentDistance = getDistanceMiles(lat1, lng1, lat2, lng2)
        
        if (cumulativeDistance + segmentDistance >= targetMiles) {
            // interpolate within this segment
            const remaining = targetMiles - cumulativeDistance
            const ratio = segmentDistance > 0 ? remaining / segmentDistance : 0
            const lat = lat1 + (lat2 - lat1) * ratio
            const lng = lng1 + (lng2 - lng1) * ratio
            return [lat, lng]
        }
        
        cumulativeDistance += segmentDistance
    }
    
    // if target is beyond the route, return the last coordinate
    return polylineCoords[polylineCoords.length - 1]
}

function RouteMap({ trip: tripProp }) {
    const mapRef = useRef(null)
    const mapInstanceRef = useRef(null)

    useEffect(() => {
        const tripData = tripProp || (() => {
            try {
                return JSON.parse(sessionStorage.getItem('currentTrip'))
            } catch (e) {
                return null
            }
        })()

        if (!tripData || !mapRef.current) return

        // avoid double init
        if (mapInstanceRef.current) return

        try {
            const routeCoordinates = decodePolyline(tripData.route.geometry)
            console.debug('RouteMap - decoded coordinates:', routeCoordinates.length, 'points')
            console.debug('RouteMap - waypoints:', tripData.route.waypoints)
            console.debug('RouteMap - fuel stops:', tripData.fuel_stops)

            const map = L.map(mapRef.current).setView(routeCoordinates[0], 6)

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19,
            }).addTo(map)

            // Draw route
            L.polyline(routeCoordinates, {
                color: '#1976d2',
                weight: 3,
                opacity: 0.8,
                smoothFactor: 1,
            }).addTo(map)

            // Waypoint markers (Start, Pickup(s), End)
            if (tripData.route.waypoints && tripData.route.waypoints.length > 0) {
                tripData.route.waypoints.forEach((wp, idx) => {
                    let iconUrl
                    let label

                    if (idx === 0) {
                        // Start - green
                        iconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png'
                        label = 'Start'
                    } else if (idx === tripData.route.waypoints.length - 1) {
                        // End - red
                        iconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png'
                        label = 'End'
                    } else {
                        // Pickup - blue
                        iconUrl = 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png'
                        label = 'Pickup'
                    }

                    const icon = L.icon({
                        iconUrl,
                        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
                        iconSize: [25, 41],
                        iconAnchor: [12, 41],
                        popupAnchor: [1, -34],
                        shadowSize: [41, 41],
                    })

                    const [lon, lat] = wp.coordinates
                    L.marker([lat, lon], { icon })
                        .addTo(map)
                        .bindPopup(`<b>${label}</b><br/>${wp.name || ''}`)
                })
            }

            // Fuel stop markers - calculate coordinates along the polyline
            if (tripData.fuel_stops && tripData.fuel_stops.length > 0) {
                tripData.fuel_stops.forEach((stop, idx) => {
                    // Find coordinate at this mile marker along the polyline
                    const [lat, lng] = findCoordinateAtDistance(routeCoordinates, stop.mile_marker)

                    // Use orange circle markers for fuel stops
                    L.circleMarker([lat, lng], {
                        radius: 8,
                        fillColor: '#ff8c00',
                        color: '#fff',
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.95,
                    })
                        .addTo(map)
                        .bindPopup(`<b>Fuel Stop ${idx + 1}</b><br/>Mile: ${stop.mile_marker}`)
                })
            }

            // Fit map to bounds
            const bounds = L.latLngBounds(routeCoordinates)
            map.fitBounds(bounds, { padding: [50, 50] })

            mapInstanceRef.current = map
        } catch (error) {
            // fail silently in UI; log for debugging
            // eslint-disable-next-line no-console
            console.error('RouteMap init error', error)
        }

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove()
                mapInstanceRef.current = null
            }
        }
    }, [tripProp])

    return (
        <div style={{ width: '100%' }}>
            <div ref={mapRef} style={{ height: 500, borderRadius: 6, border: '1px solid #e0e0e0' }} />
        </div>
    )
}

export default RouteMap