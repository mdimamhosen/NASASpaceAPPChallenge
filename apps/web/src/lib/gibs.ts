/** NASA GIBS true-colour Earth from VIIRS on NOAA-20 (Suomi-NPP ends 1 Nov 2026). GIBS needs an explicit date, not "current". */
export const GIBS_LAYER = 'VIIRS_NOAA20_CorrectedReflectance_TrueColor';
export const gibsDate = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
export const gibsTileUrl = (date = gibsDate()) => `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${GIBS_LAYER}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
