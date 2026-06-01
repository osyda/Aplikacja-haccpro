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
  page: { padding: 40, fontFamily: 'NotoSans', fontSize: 10, color: '#1a1a1a' },
  header: { marginBottom: 20, borderBottom: '2 solid #1B2E4B', paddingBottom: 10 },
  title: { fontSize: 18, fontWeight: 700, color: '#1B2E4B', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#666' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 700, color: '#1B2E4B', marginBottom: 6, backgroundColor: '#f0f4f8', padding: '4 8' },
  table: { width: '100%' },
  row: { flexDirection: 'row', borderBottom: '1 solid #e5e7eb', paddingVertical: 4 },
  headerRow: { flexDirection: 'row', backgroundColor: '#1B2E4B', paddingVertical: 5 },
  cell: { flex: 1, fontSize: 9, color: '#374151', paddingHorizontal: 4 },
  headerCell: { flex: 1, fontSize: 9, fontWeight: 700, color: '#ffffff', paddingHorizontal: 4 },
  footer: { marginTop: 20, borderTop: '1 solid #e5e7eb', paddingTop: 10, fontSize: 8, color: '#9ca3af', textAlign: 'center' },
  alertRow: { flexDirection: 'row', backgroundColor: '#fef2f2', borderBottom: '1 solid #e5e7eb', paddingVertical: 4 },
})

function isOk(temp: number, min: number, max: number) {
  return temp >= min && temp <= max
}

interface TempLog { id: string; device_name: string; temperature: number; min_ok: number; max_ok: number; measured_at: string }
interface DeliveryLog { id: string; supplier: string; product: string; quantity: string; temp_at_delivery: number | null; quality_ok: boolean; received_at: string }
interface CleaningLog { id: string; area: string; agent: string; concentration: string | null; cleaned_at: string }
interface TrainingLog { id: string; topic: string; trainer: string; trained_at: string; attendees: string[] }
interface NonconformityLog { id: string; description: string; corrective_action: string | null; status: string; created_at: string }
interface DddLog { id: string; area: string; result: string; action_taken: string | null; inspector: string; inspected_at: string }

interface HacppPdfDocumentProps {
  monthName: string
  year: number
  locationName: string
  locationAddress: string
  moduleIds: string[]
  data: {
    temperatury?: TempLog[]
    dostawy?: DeliveryLog[]
    mycie?: CleaningLog[]
    szkolenia?: TrainingLog[]
    niezgodnosci?: NonconformityLog[]
    ddd?: DddLog[]
  }
}

export function HacppPdfDocument({
  monthName, year, locationName, locationAddress, moduleIds, data,
}: HacppPdfDocumentProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>Raport HACCP — {monthName} {year}</Text>
          <Text style={styles.subtitle}>{locationName} | {locationAddress}</Text>
          <Text style={styles.subtitle}>Wygenerowano: {formatDateTime(new Date().toISOString())}</Text>
        </View>

        {moduleIds.includes('temperatury') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rejestr temperatur ({data.temperatury?.length ?? 0} wpisów)</Text>
            <View style={styles.table}>
              <View style={styles.headerRow}>
                <Text style={[styles.headerCell, { flex: 2 }]}>Urządzenie</Text>
                <Text style={styles.headerCell}>Temperatura</Text>
                <Text style={styles.headerCell}>Norma</Text>
                <Text style={styles.headerCell}>Status</Text>
                <Text style={[styles.headerCell, { flex: 2 }]}>Data i godzina</Text>
              </View>
              {(data.temperatury ?? []).map((log) => {
                const ok = isOk(log.temperature, log.min_ok, log.max_ok)
                return (
                  <View key={log.id} style={ok ? styles.row : styles.alertRow}>
                    <Text style={[styles.cell, { flex: 2 }]}>{log.device_name}</Text>
                    <Text style={styles.cell}>{log.temperature}°C</Text>
                    <Text style={styles.cell}>{log.min_ok}–{log.max_ok}°C</Text>
                    <Text style={styles.cell}>{ok ? 'OK' : 'ALARM'}</Text>
                    <Text style={[styles.cell, { flex: 2 }]}>{formatDateTime(log.measured_at)}</Text>
                  </View>
                )
              })}
              {!data.temperatury?.length && <Text style={styles.cell}>Brak wpisów w tym okresie</Text>}
            </View>
          </View>
        )}

        {moduleIds.includes('dostawy') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Przyjęcie dostaw ({data.dostawy?.length ?? 0} wpisów)</Text>
            <View style={styles.table}>
              <View style={styles.headerRow}>
                <Text style={[styles.headerCell, { flex: 2 }]}>Produkt</Text>
                <Text style={[styles.headerCell, { flex: 2 }]}>Dostawca</Text>
                <Text style={styles.headerCell}>Ilość</Text>
                <Text style={styles.headerCell}>Jakość</Text>
                <Text style={[styles.headerCell, { flex: 2 }]}>Data</Text>
              </View>
              {(data.dostawy ?? []).map((log) => (
                <View key={log.id} style={styles.row}>
                  <Text style={[styles.cell, { flex: 2 }]}>{log.product}</Text>
                  <Text style={[styles.cell, { flex: 2 }]}>{log.supplier}</Text>
                  <Text style={styles.cell}>{log.quantity}</Text>
                  <Text style={styles.cell}>{log.quality_ok ? 'OK' : 'NIEZG.'}</Text>
                  <Text style={[styles.cell, { flex: 2 }]}>{formatDateTime(log.received_at)}</Text>
                </View>
              ))}
              {!data.dostawy?.length && <Text style={styles.cell}>Brak wpisów w tym okresie</Text>}
            </View>
          </View>
        )}

        {moduleIds.includes('mycie') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Mycie i dezynfekcja ({data.mycie?.length ?? 0} wpisów)</Text>
            <View style={styles.table}>
              <View style={styles.headerRow}>
                <Text style={[styles.headerCell, { flex: 2 }]}>Obszar</Text>
                <Text style={[styles.headerCell, { flex: 2 }]}>Środek</Text>
                <Text style={styles.headerCell}>Stężenie</Text>
                <Text style={[styles.headerCell, { flex: 2 }]}>Data</Text>
              </View>
              {(data.mycie ?? []).map((log) => (
                <View key={log.id} style={styles.row}>
                  <Text style={[styles.cell, { flex: 2 }]}>{log.area}</Text>
                  <Text style={[styles.cell, { flex: 2 }]}>{log.agent}</Text>
                  <Text style={styles.cell}>{log.concentration ?? '—'}</Text>
                  <Text style={[styles.cell, { flex: 2 }]}>{formatDateTime(log.cleaned_at)}</Text>
                </View>
              ))}
              {!data.mycie?.length && <Text style={styles.cell}>Brak wpisów w tym okresie</Text>}
            </View>
          </View>
        )}

        {moduleIds.includes('niezgodnosci') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Niezgodności ({data.niezgodnosci?.length ?? 0} wpisów)</Text>
            {(data.niezgodnosci ?? []).map((log) => (
              <View key={log.id} style={styles.row}>
                <Text style={[styles.cell, { flex: 3 }]}>{log.description}</Text>
                <Text style={[styles.cell, { flex: 3 }]}>{log.corrective_action ?? '—'}</Text>
                <Text style={styles.cell}>{log.status === 'resolved' ? 'Zamknięta' : 'Otwarta'}</Text>
                <Text style={[styles.cell, { flex: 2 }]}>{formatDateTime(log.created_at)}</Text>
              </View>
            ))}
            {!data.niezgodnosci?.length && <Text style={styles.cell}>Brak niezgodności w tym okresie</Text>}
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
