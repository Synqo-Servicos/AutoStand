import { Text, View } from "@react-pdf/renderer";
import { BaseDocument, PartyBlock, SignatureLine, VehicleTable, type BaseDocumentData } from "../shared/BaseDocument";
import { styles } from "../shared/styles";
import { formatDate, pickNum, pickStr } from "@/lib/pdf";

export function TestDrivePDF({ data }: { data: BaseDocumentData }) {
  const { tenant, vehicle, formData } = data;
  if (!vehicle) return <BaseDocument title="Termo de Test Drive" data={data}><Text>—</Text></BaseDocument>;

  const driverName  = pickStr(formData, "driver_name", "______________________________");
  const driverCpf   = pickStr(formData, "driver_cpf", "___.___.___-__");
  const driverCnh   = pickStr(formData, "driver_cnh", "______________");
  const driverPhone = pickStr(formData, "driver_phone");
  const duration    = pickNum(formData, "duration_minutes", 30);
  const city        = pickStr(formData, "city", tenant.city ?? "______________");
  const signedDate  = formatDate(pickStr(formData, "signed_date"));

  return (
    <BaseDocument title="Termo de Test Drive" data={data}>
      <PartyBlock
        label="Concedente"
        lines={[tenant.name, tenant.city]}
      />
      <PartyBlock
        label="Condutor"
        lines={[
          driverName,
          `CPF: ${driverCpf}    CNH: ${driverCnh}`,
          driverPhone || undefined,
        ]}
      />

      <Text style={styles.sectionTitle}>Veículo</Text>
      <VehicleTable vehicle={vehicle} />

      <Text style={styles.sectionTitle}>Cláusulas</Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>1ª. </Text>
        O Condutor está autorizado a realizar uma experimentação ("test drive") do veículo
        acima descrito pelo período aproximado de {duration} minutos, em vias públicas, na
        condição de motorista único.
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>2ª. </Text>
        O Condutor declara possuir Carteira Nacional de Habilitação válida e na categoria
        compatível com o veículo, comprometendo-se a respeitar integralmente as leis de
        trânsito e os limites de velocidade durante todo o trajeto.
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>3ª. </Text>
        O Condutor assume integralmente a responsabilidade civil, criminal e administrativa
        por quaisquer ocorrências durante o test drive, incluindo multas, sinistros, danos
        a terceiros, danos ao próprio veículo e custos de franquia de seguro.
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>4ª. </Text>
        Em caso de envolvimento em acidente, o Condutor compromete-se a comunicar
        imediatamente a Concedente, lavrar boletim de ocorrência junto à autoridade
        competente e arcar com todos os custos decorrentes.
      </Text>

      <Text style={[styles.paragraph, { textAlign: "right", marginTop: 16 }]}>
        {city}, {signedDate}.
      </Text>

      <View style={styles.signatures} wrap={false}>
        <SignatureLine name={driverName} role={`Condutor · CPF ${driverCpf}`} />
        <SignatureLine name={tenant.name} role="Concedente" />
      </View>
    </BaseDocument>
  );
}
