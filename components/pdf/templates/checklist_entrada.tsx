import { Text, View } from "@react-pdf/renderer";
import { BaseDocument, KeyValue, SignatureLine, VehicleTable, type BaseDocumentData } from "../shared/BaseDocument";
import { styles } from "../shared/styles";
import { formatDate, pickStr } from "@/lib/pdf";

const FUEL_LABEL: Record<string, string> = {
  reserva: "Na reserva",
  "1_4":   "1/4",
  "1_2":   "1/2",
  "3_4":   "3/4",
  cheio:   "Tanque cheio",
};

export function ChecklistEntradaPDF({ data }: { data: BaseDocumentData }) {
  const { tenant, vehicle, formData } = data;
  if (!vehicle) return <BaseDocument title="Checklist" data={data}><Text>—</Text></BaseDocument>;

  const entryKm     = pickStr(formData, "entry_km");
  const fuelRaw     = pickStr(formData, "fuel_level");
  const fuel        = FUEL_LABEL[fuelRaw] ?? fuelRaw ?? "—";
  const keysCount   = pickStr(formData, "keys_count", "1");
  const hasManual   = !!formData.has_manual;
  const hasCrlv     = !!formData.has_crlv;
  const tires       = pickStr(formData, "tires");
  const bodywork    = pickStr(formData, "bodywork");
  const interior    = pickStr(formData, "interior");
  const electronics = pickStr(formData, "electronics");
  const notes       = pickStr(formData, "notes");
  const inspector   = pickStr(formData, "inspector");
  const signedDate  = formatDate(pickStr(formData, "signed_date"));

  return (
    <BaseDocument title="Checklist de Entrada do Veículo" data={data}>
      <Text style={styles.sectionTitle}>Veículo</Text>
      <VehicleTable vehicle={vehicle} />

      <Text style={styles.sectionTitle}>Dados da entrada</Text>
      <View style={styles.table}>
        <KeyValue label="KM de entrada" value={entryKm ? `${Number(entryKm).toLocaleString("pt-BR")} km` : "—"} />
        <KeyValue label="Combustível"   value={fuel} />
        <KeyValue label="Chaves"        value={`${keysCount} ${Number(keysCount) > 1 ? "chaves" : "chave"}`} />
        <KeyValue label="Manual recebido"   value={hasManual ? "Sim" : "Não"} />
        <View style={styles.tableRowLast}>
          <Text style={styles.tableLabel}>CRLV em mãos</Text>
          <Text style={styles.tableValue}>{hasCrlv ? "Sim" : "Não"}</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Condições</Text>
      <View style={styles.table}>
        <View style={styles.tableRow}>
          <Text style={styles.tableLabel}>Pneus</Text>
          <Text style={styles.tableValue}>{tires || "—"}</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableLabel}>Lataria</Text>
          <Text style={styles.tableValue}>{bodywork || "—"}</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableLabel}>Interior</Text>
          <Text style={styles.tableValue}>{interior || "—"}</Text>
        </View>
        <View style={styles.tableRowLast}>
          <Text style={styles.tableLabel}>Eletrônica</Text>
          <Text style={styles.tableValue}>{electronics || "—"}</Text>
        </View>
      </View>

      {notes && (
        <>
          <Text style={styles.sectionTitle}>Observações</Text>
          <Text style={styles.paragraph}>{notes}</Text>
        </>
      )}

      <Text style={[styles.paragraph, { textAlign: "right", marginTop: 16 }]}>
        {tenant.city || "____________"}, {signedDate}.
      </Text>

      <View style={styles.signatures} wrap={false}>
        <SignatureLine name={inspector} role="Avaliação interna" />
        <SignatureLine name="" role="Conferência (segunda assinatura)" />
      </View>
    </BaseDocument>
  );
}
