import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { formatDateTime } from '@/lib/utils'
import { NOTO_SANS_REGULAR, NOTO_SANS_BOLD } from './fonts'

Font.register({
  family: 'NotoSans',
  fonts: [
    { src: NOTO_SANS_REGULAR, fontWeight: 400 },
    { src: NOTO_SANS_BOLD, fontWeight: 700 },
  ],
})

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: 'NotoSans', fontSize: 9, color: '#1a1a1a' },
  header: { marginBottom: 18, borderBottom: '2 solid #1B2E4B', paddingBottom: 10 },
  title: { fontSize: 16, fontWeight: 700, color: '#1B2E4B', marginBottom: 4 },
  subtitle: { fontSize: 9, color: '#666' },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: '#1B2E4B', marginBottom: 5, backgroundColor: '#f0f4f8', padding: '4 8' },
  table: { width: '100%' },
  row: { flexDirection: 'row', borderBottom: '1 solid #e5e7eb', paddingVertical: 3 },
  rowAlt: { flexDirection: 'row', borderBottom: '1 solid #e5e7eb', paddingVertical: 3, backgroundColor: '#fafafa' },
  headerRow: { flexDirection: 'row', backgroundColor: '#1B2E4B', paddingVertical: 5 },
  cell: { flex: 1, fontSize: 8, color: '#374151', paddingHorizontal: 4 },
  headerCell: { flex: 1, fontSize: 8, fontWeight: 700, color: '#ffffff', paddingHorizontal: 4 },
  footer: { marginTop: 20, borderTop: '1 solid #e5e7eb', paddingTop: 10, fontSize: 8, color: '#9ca3af', textAlign: 'center' },
  alertRow: { flexDirection: 'row', backgroundColor: '#fef2f2', borderBottom: '1 solid #e5e7eb', paddingVertical: 3 },
  noteRow: { flexDirection: 'row', borderBottom: '1 solid #f3f4f6', paddingVertical: 2, paddingHorizontal: 4, backgroundColor: '#fafafa' },
  noteText: { fontSize: 7, color: '#6b7280', fontStyle: 'italic' },
})

function isOk(temp: number, min: number, max: number) {
  return temp >= min && temp <= max
}

interface TempLog { id: string; device_name: string; temperature: number; min_ok: number; max_ok: number; measured_at: string; recorded_by: string | null; notes: string | null }
interface DeliveryLog { id: string; supplier: string; product: string; quantity: string; temp_at_delivery: number | null; quality_ok: boolean; received_at: string; recorded_by: string | null; notes: string | null }
interface CleaningLog { id: string; area: string; agent: string; concentration: string | null; cleaned_at: string; recorded_by: string | null; performed_by: string | null; notes: string | null }
interface TrainingLog { id: string; topic: string; trainer: string; trained_at: string; attendees: string[] }
interface NonconformityLog { id: string; description: string; corrective_action: string | null; resolve_comment: string | null; status: string; created_at: string; reported_by: string | null; resolved_by: string | null }
interface DddLog { id: string; area: string; result: string; action_taken: string | null; inspector: string; inspected_at: string }

interface HacppPdfDocumentProps {
  monthName: string
  year: number
  locationName: string
  locationAddress: string
  moduleIds: string[]
  profilesMap: Record<string, string>
  data: {
    temperatury?: TempLog[]
    dostawy?: DeliveryLog[]
    mycie?: CleaningLog[]
    szkolenia?: TrainingLog[]
    niezgodnosci?: NonconformityLog[]
    ddd?: DddLog[]
  }
}

function name(profilesMap: Record<string, string>, id: string | null | undefined): string {
  if (!id) return '—'
  return profilesMap[id] || '—'
}

export function HacppPdfDocument({
  monthName, year, locationName, locationAddress, moduleIds, data, profilesMap,
}: HacppPdfDocumentProps) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Raport HACCP — {monthName} {year}</Text>
          <Text style={styles.subtitle}>{locationName} | {locationAddress}</Text>
          <Text style={styles.subtitle}>Wygenerowano: {formatDateTime(new Date().toISOString())}</Text>
        </View>

        {/* TEMPERATURE */}
        {moduleIds.includes('temperatury') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rejestr temperatur ({data.temperatury?.length ?? 0} wpisów)</Text>
            <View style={styles.table}>
              <View style={styles.headerRow}>
                <Text style={[styles.headerCell, { flex: 2 }]}>Urządzenie</Text>
                <Text style={[styles.headerCell, { flex: 1.2 }]}>Temperatura</Text>
                <Text style={[styles.headerCell, { flex: 1 }]}>Norma</Text>
                <Text style={[styles.headerCell, { flex: 0.8 }]}>Status</Text>
                <Text style={[styles.headerCell, { flex: 2 }]}>Data i godzina</Text>
                <Text style={[styles.headerCell, { flex: 2 }]}>Pracownik</Text>
                <Text style={[styles.headerCell, { flex: 2.5 }]}>Uwagi</Text>
              </View>
              {(data.temperatury ?? []).map((log, i) => {
                const ok = isOk(log.temperature, log.min_ok, log.max_ok)
                const rowStyle = ok ? (i % 2 === 0 ? styles.row : styles.rowAlt) : styles.alertRow
                return (
                  <View key={log.id} style={rowStyle}>
                    <Text style={[styles.cell, { flex: 2 }]}>{log.device_name}</Text>
                    <Text style={[styles.cell, { flex: 1.2, fontWeight: ok ? 400 : 700, color: ok ? '#374151' : '#dc2626' }]}>{log.temperature}°C</Text>
                    <Text style={[styles.cell, { flex: 1 }]}>{log.min_ok}–{log.max_ok}°C</Text>
                    <Text style={[styles.cell, { flex: 0.8, fontWeight: 700, color: ok ? '#16a34a' : '#dc2626' }]}>{ok ? 'OK' : 'ALARM'}</Text>
                    <Text style={[styles.cell, { flex: 2 }]}>{formatDateTime(log.measured_at)}</Text>
                    <Text style={[styles.cell, { flex: 2 }]}>{name(profilesMap, log.recorded_by)}</Text>
                    <Text style={[styles.cell, { flex: 2.5 }]}>{log.notes ?? '—'}</Text>
                  </View>
                )
              })}
              {!data.temperatury?.length && <Text style={[styles.cell, { padding: 8 }]}>Brak wpisów w tym okresie</Text>}
            </View>
          </View>
        )}

        {/* DELIVERIES */}
        {moduleIds.includes('dostawy') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Przyjęcie dostaw ({data.dostawy?.length ?? 0} wpisów)</Text>
            <View style={styles.table}>
              <View style={styles.headerRow}>
                <Text style={[styles.headerCell, { flex: 2.5 }]}>Produkt</Text>
                <Text style={[styles.headerCell, { flex: 2 }]}>Dostawca</Text>
                <Text style={[styles.headerCell, { flex: 1 }]}>Ilość</Text>
                <Text style={[styles.headerCell, { flex: 1 }]}>Temp.</Text>
                <Text style={[styles.headerCell, { flex: 0.8 }]}>Jakość</Text>
                <Text style={[styles.headerCell, { flex: 2 }]}>Data</Text>
                <Text style={[styles.headerCell, { flex: 2 }]}>Pracownik</Text>
              </View>
              {(data.dostawy ?? []).map((log, i) => (
                <View key={log.id} style={i % 2 === 0 ? styles.row : styles.rowAlt}>
                  <Text style={[styles.cell, { flex: 2.5 }]}>{log.product}</Text>
                  <Text style={[styles.cell, { flex: 2 }]}>{log.supplier}</Text>
                  <Text style={[styles.cell, { flex: 1 }]}>{log.quantity}</Text>
                  <Text style={[styles.cell, { flex: 1 }]}>{log.temp_at_delivery !== null ? `${log.temp_at_delivery}°C` : '—'}</Text>
                  <Text style={[styles.cell, { flex: 0.8, fontWeight: 700, color: log.quality_ok ? '#16a34a' : '#dc2626' }]}>{log.quality_ok ? 'OK' : 'NIEZG.'}</Text>
                  <Text style={[styles.cell, { flex: 2 }]}>{formatDateTime(log.received_at)}</Text>
                  <Text style={[styles.cell, { flex: 2 }]}>{name(profilesMap, log.recorded_by)}</Text>
                </View>
              ))}
              {!data.dostawy?.length && <Text style={[styles.cell, { padding: 8 }]}>Brak wpisów w tym okresie</Text>}
            </View>
          </View>
        )}

        {/* CLEANING */}
        {moduleIds.includes('mycie') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mycie i dezynfekcja ({data.mycie?.length ?? 0} wpisów)</Text>
            <View style={styles.table}>
              <View style={styles.headerRow}>
                <Text style={[styles.headerCell, { flex: 2.5 }]}>Obszar</Text>
                <Text style={[styles.headerCell, { flex: 2 }]}>Środek</Text>
                <Text style={[styles.headerCell, { flex: 1 }]}>Stężenie</Text>
                <Text style={[styles.headerCell, { flex: 2 }]}>Data</Text>
                <Text style={[styles.headerCell, { flex: 2 }]}>Pracownik</Text>
              </View>
              {(data.mycie ?? []).map((log, i) => (
                <View key={log.id} style={i % 2 === 0 ? styles.row : styles.rowAlt}>
                  <Text style={[styles.cell, { flex: 2.5 }]}>{log.area}</Text>
                  <Text style={[styles.cell, { flex: 2 }]}>{log.agent}</Text>
                  <Text style={[styles.cell, { flex: 1 }]}>{log.concentration ?? '—'}</Text>
                  <Text style={[styles.cell, { flex: 2 }]}>{formatDateTime(log.cleaned_at)}</Text>
                  <Text style={[styles.cell, { flex: 2 }]}>{log.performed_by || name(profilesMap, log.recorded_by)}</Text>
                </View>
              ))}
              {!data.mycie?.length && <Text style={[styles.cell, { padding: 8 }]}>Brak wpisów w tym okresie</Text>}
            </View>
          </View>
        )}

        {/* TRAINING */}
        {moduleIds.includes('szkolenia') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Szkolenia ({data.szkolenia?.length ?? 0} wpisów)</Text>
            <View style={styles.table}>
              <View style={styles.headerRow}>
                <Text style={[styles.headerCell, { flex: 3 }]}>Temat</Text>
                <Text style={[styles.headerCell, { flex: 2 }]}>Prowadzący</Text>
                <Text style={[styles.headerCell, { flex: 2 }]}>Data</Text>
                <Text style={[styles.headerCell, { flex: 3 }]}>Uczestnicy</Text>
              </View>
              {(data.szkolenia ?? []).map((log, i) => (
                <View key={log.id} style={i % 2 === 0 ? styles.row : styles.rowAlt}>
                  <Text style={[styles.cell, { flex: 3 }]}>{log.topic}</Text>
                  <Text style={[styles.cell, { flex: 2 }]}>{log.trainer}</Text>
                  <Text style={[styles.cell, { flex: 2 }]}>{formatDateTime(log.trained_at)}</Text>
                  <Text style={[styles.cell, { flex: 3 }]}>{(log.attendees ?? []).join(', ')}</Text>
                </View>
              ))}
              {!data.szkolenia?.length && <Text style={[styles.cell, { padding: 8 }]}>Brak wpisów w tym okresie</Text>}
            </View>
          </View>
        )}

        {/* NONCONFORMITIES */}
        {moduleIds.includes('niezgodnosci') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Niezgodności ({data.niezgodnosci?.length ?? 0} wpisów)</Text>
            <View style={styles.table}>
              <View style={styles.headerRow}>
                <Text style={[styles.headerCell, { flex: 3 }]}>Opis</Text>
                <Text style={[styles.headerCell, { flex: 2.5 }]}>Działanie korygujące</Text>
                <Text style={[styles.headerCell, { flex: 0.8 }]}>Status</Text>
                <Text style={[styles.headerCell, { flex: 2 }]}>Data</Text>
                <Text style={[styles.headerCell, { flex: 2 }]}>Zgłosił/a</Text>
                <Text style={[styles.headerCell, { flex: 2 }]}>Zamknął/a</Text>
              </View>
              {(data.niezgodnosci ?? []).map((log, i) => (
                <View key={log.id} style={i % 2 === 0 ? styles.row : styles.rowAlt}>
                  <Text style={[styles.cell, { flex: 3 }]}>{log.description}</Text>
                  <Text style={[styles.cell, { flex: 2.5 }]}>{log.corrective_action ?? log.resolve_comment ?? '—'}</Text>
                  <Text style={[styles.cell, { flex: 0.8, fontWeight: 700, color: log.status === 'resolved' ? '#16a34a' : '#d97706' }]}>{log.status === 'resolved' ? 'Zamknięta' : 'Otwarta'}</Text>
                  <Text style={[styles.cell, { flex: 2 }]}>{formatDateTime(log.created_at)}</Text>
                  <Text style={[styles.cell, { flex: 2 }]}>{name(profilesMap, log.reported_by)}</Text>
                  <Text style={[styles.cell, { flex: 2 }]}>{name(profilesMap, log.resolved_by)}</Text>
                </View>
              ))}
              {!data.niezgodnosci?.length && <Text style={[styles.cell, { padding: 8 }]}>Brak niezgodności w tym okresie</Text>}
            </View>
          </View>
        )}

        {/* DDD */}
        {moduleIds.includes('ddd') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Kontrola DDD ({data.ddd?.length ?? 0} wpisów)</Text>
            <View style={styles.table}>
              <View style={styles.headerRow}>
                <Text style={[styles.headerCell, { flex: 2 }]}>Obszar</Text>
                <Text style={[styles.headerCell, { flex: 1.2 }]}>Wynik</Text>
                <Text style={[styles.headerCell, { flex: 2.5 }]}>Działanie</Text>
                <Text style={[styles.headerCell, { flex: 2 }]}>Data</Text>
                <Text style={[styles.headerCell, { flex: 2 }]}>Inspektor</Text>
              </View>
              {(data.ddd ?? []).map((log, i) => (
                <View key={log.id} style={i % 2 === 0 ? styles.row : styles.rowAlt}>
                  <Text style={[styles.cell, { flex: 2 }]}>{log.area}</Text>
                  <Text style={[styles.cell, { flex: 1.2 }]}>{log.result}</Text>
                  <Text style={[styles.cell, { flex: 2.5 }]}>{log.action_taken ?? '—'}</Text>
                  <Text style={[styles.cell, { flex: 2 }]}>{formatDateTime(log.inspected_at)}</Text>
                  <Text style={[styles.cell, { flex: 2 }]}>{log.inspector}</Text>
                </View>
              ))}
              {!data.ddd?.length && <Text style={[styles.cell, { padding: 8 }]}>Brak wpisów w tym okresie</Text>}
            </View>
          </View>
        )}

        <View style={styles.footer}>
          <Text>Raport wygenerowany przez HACCPro.pl — system elektronicznych rejestrów HACCP</Text>
          <Text>Dokument jest zgodny z wymogami rozporządzenia (WE) nr 852/2004</Text>
        </View>
      </Page>
    </Document>
  )
}
