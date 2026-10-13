// Shared shapes for the renderer. Content is plain GeoJSON/JSON (see README); kept loose on purpose.
export type Feature = { type: 'Feature'; properties: Record<string, any>; geometry: { type: string; coordinates: any } };
export type FC = { type: 'FeatureCollection'; features: Feature[] };
export interface Ctx {
  layout: any; colors: Record<string, string>; courses: { order: string[]; colors: Record<string, string>; courses: Record<string, any> };
  stations: { order: string[]; stations: Record<string, any> }; cutoffs: Record<string, { station: string; mile: number; cutoff: string }[]>;
  network: FC; park: FC; pois: FC; zoom: FC; arrows: FC; labels: FC; areaLabels: FC; timeline: any; stationLabels: FC; poiLabels: FC;
  courseGeo: Record<string, FC>; profiles: Record<string, any>;
}
/** one section of the single-page site; files in site/sections/ render in filename order */
export interface Section { meta: { id: string; title: string; /** opt out of the print/PDF pages (default: printed) */ print?: boolean }; render(c: Ctx): string }
