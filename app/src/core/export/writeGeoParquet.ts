export async function toGeoParquet(fc: GeoJSON.FeatureCollection): Promise<ArrayBuffer> {
  const { parquetWriteBuffer } = await import('hyparquet-writer')
  const features = fc.features
  const columnNames = [...new Set(features.flatMap((f) => Object.keys(f.properties ?? {})))]
  const geometryTypes = [...new Set(features.map((f) => f.geometry?.type).filter(Boolean))]

  const propertyColumns = columnNames.map((key) => {
    const values = features.map((f) => f.properties?.[key] ?? null)
    // readers reject a duplicate `geometry` column
    const name = key === 'geometry' ? 'geometry_attr' : key
    const present = values.filter((v) => v !== null)
    // INT64 only for safe integers, bigger whole numbers go DOUBLE
    if (present.length > 0 && present.every((v) => Number.isSafeInteger(v))) {
      return { name, type: 'INT64' as const, data: values.map((v) => (v === null ? null : BigInt(v))) }
    }
    if (present.length > 0 && present.every((v) => typeof v === 'number')) {
      return { name, type: 'DOUBLE' as const, data: values }
    }
    if (present.length > 0 && present.every((v) => typeof v === 'boolean')) {
      return { name, type: 'BOOLEAN' as const, data: values }
    }
    return {
      name,
      type: 'STRING' as const,
      data: values.map((v) => (v === null ? null : typeof v === 'object' ? JSON.stringify(v) : String(v))),
    }
  })

  return parquetWriteBuffer({
    columnData: [
      ...propertyColumns,
      { name: 'geometry', type: 'GEOMETRY' as const, data: features.map((f) => f.geometry) },
    ],
    kvMetadata: [
      {
        key: 'geo',
        value: JSON.stringify({
          version: '1.1.0',
          primary_column: 'geometry',
          columns: { geometry: { encoding: 'WKB', geometry_types: geometryTypes } },
        }),
      },
    ],
  })
}
