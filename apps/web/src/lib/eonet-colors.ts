const palette: Record<string, string> = {
  severeStorms: '#7CA7B7', wildfires: '#D48B60', volcanoes: '#C45C50',
  floods: '#6A9CAC', landslides: '#AE9C73', seaLakeIce: '#B6CBD0',
  earthquakes: '#B9A0C2', snow: '#D8D8D0', dustHaze: '#B8A181',
  drought: '#C8B276', temperatureExtremes: '#D39A77',
};
export function eonetColor(categoryId: string) { return palette[categoryId] ?? '#A8B0B4'; }
