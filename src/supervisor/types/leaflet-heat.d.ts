import * as L from "leaflet";

declare module "leaflet" {
  export interface HeatMapOptions {
    minOpacity?: number;
    maxZoom?: number;
    max?: number;
    radius?: number;
    blur?: number;
    gradient?: { [key: number]: string };
  }

  export function heatLayer(
    latlngs: Array<[number, number, number] | [number, number] | L.LatLng>,
    options?: HeatMapOptions,
  ): L.Layer;
}
