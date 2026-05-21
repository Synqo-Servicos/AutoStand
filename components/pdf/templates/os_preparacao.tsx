import { Text, View } from "@react-pdf/renderer";
import { BaseDocument, KeyValue, SignatureLine, VehicleTable, type BaseDocumentData } from "../shared/BaseDocument";
import { styles } from "../shared/styles";
import { brlFromReais, formatDate, pickStr } from "@/lib/pdf";

interface ServiceLine { description: string; cost: string }

function parseServices(raw: string): ServiceLine[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // Procura R$ ou valor no fim. Aceita "—" como separador.
      const m = line.match(/^(.*?)[\s—-]+(?:R\$\s*)?([\d.,]+)$/);
      if (m) return { description: m[1].trim(), cost: m[2] };
      return { description: line, cost: "" };
    });
}

function sumCosts(items: ServiceLine[]): number {
  return items.reduce((sum, it) => {
    if (!it.cost) return sum;
    const n = parseFloat(it.cost.replace(/\./g, "").replace(",", "."));
    return Number.isNaN(n) ? sum : sum + n;
  }, 0);
}

export function OsPreparacaoPDF({ data }: { data: BaseDocumentData }) {
  const { tenant, vehicle, formData } = data;
  if (!vehicle) return <BaseDocument title="OS de Preparação" data={data}><Text>—</Text></BaseDocument>;

  const responsible = pickStr(formData, "responsible");
  const estimated   = formatDate(pickStr(formData, "estimated_date"), "");
  const servicesRaw = pickStr(formData, "services");
  const notes       = pickStr(formData, "notes");
  const signedDate  = formatDate(pickStr(formData, "signed_date"));

  const items = parseServices(servicesRaw);
  const total = sumCosts(items);

  return (
    <BaseDocument title="Ordem de Serviço de Preparação" data={data}>
      <Text style={styles.sectionTitle}>Identificação</Text>
      <View style={styles.table}>
        <KeyValue label="Loja" value={tenant.name} />
        <KeyValue label="Responsável" value={responsible || "—"} />
        <KeyValue label="Abertura" value={signedDate} />
        <KeyValue label="Previsão de conclusão" value={estimated || "—"} />
      </View>

      <Text style={styles.sectionTitle}>Veículo</Text>
      <VehicleTable vehicle={vehicle} />

      <Text style={styles.sectionTitle}>Serviços a executar</Text>
      <View style={styles.table}>
        <View style={styles.tableRow}>
          <Text style={[styles.tableLabel, { width: "65%" }]}>Descrição</Text>
          <Text style={[styles.tableLabel, { borderRightWidth: 0 }]}>Custo</Text>
        </View>
        {items.length === 0 ? (
          <View style={styles.tableRowLast}>
            <Text style={[styles.tableValue, { color: "#9CA3AF" }]}>Nenhum serviço informado.</Text>
          </View>
        ) : (
          items.map((it, idx) => (
            <View key={idx} style={idx === items.length - 1 ? styles.tableRowLast : styles.tableRow}>
              <Text style={[styles.tableValue, { width: "65%", borderRightWidth: 1, borderRightColor: "#E5E7EB" }]}>{it.description}</Text>
              <Text style={[styles.tableValue, { textAlign: "right" }]}>{it.cost ? brlFromReais(it.cost) : "—"}</Text>
            </View>
          ))
        )}
        {total > 0 && (
          <View style={[styles.tableRow, { backgroundColor: "#F9FAFB", borderTopWidth: 1, borderTopColor: "#E5E7EB" }]}>
            <Text style={[styles.tableLabel, { width: "65%", backgroundColor: "transparent" }]}>Total</Text>
            <Text style={[styles.tableValue, { textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{brlFromReais(total)}</Text>
          </View>
        )}
      </View>

      {notes && (
        <>
          <Text style={styles.sectionTitle}>Observações</Text>
          <Text style={styles.paragraph}>{notes}</Text>
        </>
      )}

      <View style={[styles.signatures, { marginTop: 30 }]} wrap={false}>
        <SignatureLine name={responsible || ""} role="Responsável técnico" />
        <SignatureLine name={tenant.name} role="Gerência" />
      </View>
    </BaseDocument>
  );
}
