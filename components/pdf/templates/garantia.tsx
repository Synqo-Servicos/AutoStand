import { Text, View } from "@react-pdf/renderer";
import { BaseDocument, PartyBlock, SignatureLine, VehicleTable, type BaseDocumentData } from "../shared/BaseDocument";
import { styles } from "../shared/styles";
import { formatDate, pickNum, pickStr } from "@/lib/pdf";

export function GarantiaPDF({ data }: { data: BaseDocumentData }) {
  const { tenant, vehicle, formData } = data;
  if (!vehicle) return <BaseDocument title="Termo de Garantia" data={data}><Text>—</Text></BaseDocument>;

  const buyerName  = pickStr(formData, "buyer_name", "______________________________");
  const buyerCpf   = pickStr(formData, "buyer_cpf", "___.___.___-__");
  const days       = pickNum(formData, "warranty_days", 90);
  const km         = pickNum(formData, "warranty_km", 5000);
  const covered    = pickStr(formData, "covered_items");
  const excluded   = pickStr(formData, "excluded_items");
  const city       = pickStr(formData, "city", tenant.city ?? "______________");
  const signedDate = formatDate(pickStr(formData, "signed_date"));

  return (
    <BaseDocument title="Termo de Garantia" data={data}>
      <PartyBlock
        label="Concedente"
        lines={[tenant.name, tenant.city, [tenant.contact_email, tenant.whatsapp_number].filter(Boolean).join(" · ") || undefined]}
      />
      <PartyBlock
        label="Beneficiário"
        lines={[buyerName, `CPF: ${buyerCpf}`]}
      />

      <Text style={styles.sectionTitle}>Veículo abrangido</Text>
      <VehicleTable vehicle={vehicle} />

      <Text style={styles.sectionTitle}>Condições</Text>

      <Text style={styles.paragraph}>
        A <Text style={styles.bold}>{tenant.name}</Text> concede ao beneficiário acima
        qualificado garantia pelo prazo de <Text style={styles.bold}>{days} dias</Text> ou{" "}
        <Text style={styles.bold}>{km.toLocaleString("pt-BR")} km</Text> rodados, o que
        ocorrer primeiro, contados a partir da data de entrega do veículo.
      </Text>

      <Text style={[styles.clauseTitle]}>Itens cobertos</Text>
      <Text style={styles.paragraph}>
        {covered || "—"}
      </Text>

      <Text style={[styles.clauseTitle]}>Itens NÃO cobertos</Text>
      <Text style={styles.paragraph}>
        {excluded || "—"}
      </Text>

      <Text style={[styles.clauseTitle]}>Procedimento em caso de acionamento</Text>
      <Text style={styles.paragraph}>
        O beneficiário se compromete a comunicar a Concedente em até 48 horas após a
        identificação do problema, dirigindo o veículo a oficina indicada pela loja, sob
        pena de perda da cobertura. A garantia é intransferível em caso de revenda do
        veículo antes do término do prazo aqui estipulado.
      </Text>

      <Text style={[styles.paragraph, { textAlign: "right", marginTop: 16 }]}>
        {city}, {signedDate}.
      </Text>

      <View style={styles.signatures} wrap={false}>
        <SignatureLine name={tenant.name} role="Concedente" />
        <SignatureLine name={buyerName} role={`Beneficiário · CPF ${buyerCpf}`} />
      </View>
    </BaseDocument>
  );
}
