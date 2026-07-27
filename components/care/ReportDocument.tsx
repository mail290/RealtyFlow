// =====================================================================
// Keyholding report — @react-pdf/renderer document. Renders in the browser
// (importmap) in the OWNER's locale. Layout follows the calm, documentary
// look of care.zenecohomes.com: a report should read like an insurance
// document, not a brochure.
// =====================================================================

import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { ReportSnapshot } from '../../lib/care/reports/types';
import { formatDate, formatDateTime, formatNumber, localeToBcp47 } from '../../lib/care/reports/format';

const C = {
  ink: '#1f2937', sub: '#6b7280', line: '#e5e7eb', brand: '#0e7490',
  dev: '#b45309', devBg: '#fffbeb', anomaly: '#b91c1c', anomalyBg: '#fef2f2',
  ok: '#047857', panel: '#f9fafb',
};

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 54, paddingHorizontal: 40, fontSize: 9, color: C.ink, fontFamily: 'Helvetica' },
  h1: { fontSize: 16, fontFamily: 'Helvetica-Bold' },
  muted: { color: C.sub },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 10, marginBottom: 12 },
  ref: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: C.brand },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginTop: 14, marginBottom: 6 },
  row: { flexDirection: 'row' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { width: '31%', backgroundColor: C.panel, borderRadius: 4, padding: 8 },
  statLabel: { color: C.sub, fontSize: 7, textTransform: 'uppercase' },
  statValue: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  table: { borderWidth: 1, borderColor: C.line, borderRadius: 4 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.line },
  th: { fontFamily: 'Helvetica-Bold', backgroundColor: C.panel },
  cell: { padding: 5, flexGrow: 1, flexBasis: 0 },
  checkCol: { width: '48%' },
  checkItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  badge: { fontSize: 7, paddingVertical: 1, paddingHorizontal: 4, borderRadius: 3 },
  photoWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  photo: { width: '23%', height: 70, objectFit: 'cover', borderRadius: 3, borderWidth: 1, borderColor: C.line },
  photoPh: { width: '23%', height: 70, borderRadius: 3, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7, color: C.sub },
});

const T: Record<string, Record<string, string>> = {
  no: { summary: 'Sammendrag', checked: 'Kontrollert', deviations: 'Avvik', photos: 'Bilder', gps: 'GPS', meters: 'Målere', prev: 'Forrige', now: 'Ny', delta: 'Diff', perDay: 'Per døgn', checklist: 'Sjekkliste', gallery: 'Bilder', issues: 'Åpne avvik', comment: 'Forvalterens kommentar', opened: 'Åpnet', next: 'Neste tilsyn', inspector: 'Forvalter', of: 'av', translatedFrom: 'Skrevet på', status_ok: 'OK', status_deviation: 'Avvik', status_not_applicable: 'Ikke relevant', status_not_checked: 'Ikke sjekket' },
  en: { summary: 'Summary', checked: 'Checked', deviations: 'Deviations', photos: 'Photos', gps: 'GPS', meters: 'Meters', prev: 'Previous', now: 'New', delta: 'Diff', perDay: 'Per day', checklist: 'Checklist', gallery: 'Photos', issues: 'Open issues', comment: "Manager's comment", opened: 'Opened', next: 'Next inspection', inspector: 'Manager', of: 'of', translatedFrom: 'Written in', status_ok: 'OK', status_deviation: 'Deviation', status_not_applicable: 'N/A', status_not_checked: 'Not checked' },
  es: { summary: 'Resumen', checked: 'Revisado', deviations: 'Incidencias', photos: 'Fotos', gps: 'GPS', meters: 'Contadores', prev: 'Anterior', now: 'Nueva', delta: 'Dif', perDay: 'Por día', checklist: 'Lista de control', gallery: 'Fotos', issues: 'Incidencias abiertas', comment: 'Comentario del gestor', opened: 'Abierta', next: 'Próxima inspección', inspector: 'Gestor', of: 'de', translatedFrom: 'Escrito en', status_ok: 'OK', status_deviation: 'Incidencia', status_not_applicable: 'N/A', status_not_checked: 'Sin revisar' },
  de: { summary: 'Zusammenfassung', checked: 'Geprüft', deviations: 'Abweichungen', photos: 'Fotos', gps: 'GPS', meters: 'Zähler', prev: 'Vorher', now: 'Neu', delta: 'Diff.', perDay: 'Pro Tag', checklist: 'Prüfliste', gallery: 'Fotos', issues: 'Offene Mängel', comment: 'Kommentar des Verwalters', opened: 'Eröffnet', next: 'Nächste Prüfung', inspector: 'Verwalter', of: 'von', translatedFrom: 'Verfasst auf', status_ok: 'OK', status_deviation: 'Abweichung', status_not_applicable: 'N/z', status_not_checked: 'Nicht geprüft' },
};

const sevColor: Record<string, string> = { info: C.sub, low: C.ok, medium: C.dev, high: C.anomaly, urgent: C.anomaly };
const statusColor = (st: string) => (st === 'deviation' ? C.dev : st === 'ok' ? C.ok : C.sub);

export interface ReportDocumentProps {
  snapshot: ReportSnapshot;
  contentHash: string;
  /** storage_path -> resolved (signed / object) image URL */
  photoUrls: Record<string, string>;
}

const ReportDocument: React.FC<ReportDocumentProps> = ({ snapshot: r, contentHash, photoUrls }) => {
  const loc = localeToBcp47(r.locale);
  const t = T[r.locale] ?? T.en;
  const categories = Array.from(new Set(r.checklist.map((c) => c.category)));
  const half = Math.ceil(categories.length / 2);
  const cols = [categories.slice(0, half), categories.slice(half)];

  return (
    <Document
      title={r.reference}
      author={r.org_name}
      creator={r.org_name}
      producer="RealtyFlow Care"
      creationDate={new Date(r.completed_at)}
    >
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.headRow}>
          <View>
            <Text style={s.ref}>{r.reference}</Text>
            <Text style={s.h1}>{r.property_name}</Text>
            <Text style={s.muted}>{r.property_reference} · {r.address}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{r.brand_name || r.org_name}</Text>
            <Text style={s.muted}>{formatDateTime(r.completed_at, loc, r.timezone)}</Text>
            <Text style={s.muted}>{t.inspector}: {r.inspector_name}</Text>
          </View>
        </View>

        {/* Summary */}
        <Text style={s.sectionTitle}>{t.summary}</Text>
        <View style={s.summaryGrid}>
          <View style={s.stat}><Text style={s.statLabel}>{t.checked}</Text><Text style={s.statValue}>{r.summary.checked} {t.of} {r.summary.total}</Text></View>
          <View style={s.stat}><Text style={s.statLabel}>{t.deviations}</Text><Text style={[s.statValue, { color: r.summary.deviations ? C.dev : C.ink }]}>{r.summary.deviations}</Text></View>
          <View style={s.stat}><Text style={s.statLabel}>{t.photos}</Text><Text style={s.statValue}>{r.summary.photo_count}</Text></View>
          <View style={s.stat}><Text style={s.statLabel}>{t.gps}</Text><Text style={[s.statValue, { fontSize: 10, color: r.gps_status === 'ok' ? C.ok : C.dev }]}>{r.gps_status}</Text></View>
          {r.next_inspection_at && (
            <View style={s.stat}><Text style={s.statLabel}>{t.next}</Text><Text style={[s.statValue, { fontSize: 10 }]}>{formatDate(r.next_inspection_at, loc)}</Text></View>
          )}
        </View>

        {/* Meter table */}
        {r.meters.length > 0 && (
          <>
            <Text style={s.sectionTitle}>{t.meters}</Text>
            <View style={s.table}>
              <View style={[s.tr, s.th]}>
                <Text style={s.cell}>{t.meters}</Text>
                <Text style={s.cell}>{t.prev}</Text>
                <Text style={s.cell}>{t.now}</Text>
                <Text style={s.cell}>{t.delta}</Text>
                <Text style={s.cell}>{t.perDay}</Text>
              </View>
              {r.meters.map((m, i) => (
                <View key={i} style={[s.tr, m.is_anomaly ? { backgroundColor: C.anomalyBg } : {}]}>
                  <Text style={s.cell}>{m.meter_type}</Text>
                  <Text style={s.cell}>{m.previous != null ? formatNumber(m.previous, loc, 0) : '—'}</Text>
                  <Text style={s.cell}>{formatNumber(m.current, loc, 0)} {m.unit}</Text>
                  <Text style={s.cell}>{m.delta != null ? formatNumber(m.delta, loc, 0) : '—'}</Text>
                  <Text style={[s.cell, m.is_anomaly ? { color: C.anomaly, fontFamily: 'Helvetica-Bold' } : {}]}>{m.per_day != null ? formatNumber(m.per_day, loc, 1) : '—'}</Text>
                </View>
              ))}
            </View>
            {r.meters.filter((m) => m.is_anomaly && m.anomaly_note).map((m, i) => (
              <Text key={i} style={{ color: C.anomaly, marginTop: 4 }}>⚠ {m.meter_type}: {m.anomaly_note}</Text>
            ))}
          </>
        )}

        {/* Checklist (two columns) */}
        <Text style={s.sectionTitle}>{t.checklist}</Text>
        <View style={s.row}>
          {cols.map((catList, ci) => (
            <View key={ci} style={s.checkCol}>
              {catList.map((cat) => (
                <View key={cat} style={{ marginBottom: 6, marginRight: ci === 0 ? 8 : 0 }}>
                  <Text style={{ color: C.brand, fontSize: 8, textTransform: 'uppercase', marginBottom: 2 }}>{cat.replace(/_/g, ' ')}</Text>
                  {r.checklist.filter((c) => c.category === cat).map((c) => (
                    <View key={c.code} style={s.checkItem}>
                      <Text style={{ flex: 1, paddingRight: 4 }}>{c.sort_order}. {c.title}{c.value != null ? `  (${formatNumber(c.value, loc, 1)} ${c.value_unit ?? ''})` : ''}</Text>
                      <Text style={{ color: statusColor(c.status), fontFamily: 'Helvetica-Bold' }}>{t[`status_${c.status}`]}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* Photo gallery */}
        {r.photos.length > 0 && (
          <>
            <Text style={s.sectionTitle}>{t.gallery}</Text>
            <View style={s.photoWrap}>
              {r.photos.map((p, i) => {
                const url = photoUrls[p.storage_path];
                return url ? (
                  <View key={i} style={{ width: '23%' }}>
                    <Image src={url} style={s.photo} />
                    <Text style={{ fontSize: 6, color: p.is_deviation ? C.dev : C.sub }}>{p.item_code ?? ''}{p.is_deviation ? ' ⚠' : ''}</Text>
                  </View>
                ) : (
                  <View key={i} style={{ width: '23%' }}>
                    <View style={s.photoPh}><Text style={{ fontSize: 6, color: C.sub }}>{p.caption ?? p.item_code ?? ''}</Text></View>
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* Open issues */}
        {r.issues.length > 0 && (
          <>
            <Text style={s.sectionTitle}>{t.issues}</Text>
            {r.issues.map((iss, i) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, borderBottomWidth: 1, borderBottomColor: C.line }}>
                <Text style={{ flex: 1 }}>{iss.title}{iss.work_order_ref ? `  (${iss.work_order_ref})` : ''}</Text>
                <Text style={s.muted}>{t.opened} {formatDate(iss.opened_at, loc)}</Text>
                <Text style={[s.badge, { color: sevColor[iss.severity], marginLeft: 6 }]}>{iss.severity}</Text>
              </View>
            ))}
          </>
        )}

        {/* Comment */}
        {r.comment ? (
          <>
            <Text style={s.sectionTitle}>{t.comment}</Text>
            {!r.comment_is_source_language && (
              <Text style={{ fontSize: 7, color: C.sub, marginBottom: 2 }}>{t.translatedFrom}: {r.comment_source_locale}</Text>
            )}
            <Text>{r.comment}</Text>
          </>
        ) : null}

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text>{r.summary.checked}/{r.summary.total} · {r.reference}</Text>
          <Text>sha256: {contentHash.slice(0, 24)}…</Text>
          {r.next_inspection_at ? <Text>{t.next}: {formatDate(r.next_inspection_at, loc)}</Text> : <Text> </Text>}
        </View>
      </Page>
    </Document>
  );
};

export default ReportDocument;
