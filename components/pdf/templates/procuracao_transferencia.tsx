import { Text, View } from "@react-pdf/renderer";
import { BaseDocument, SignatureLine, VehicleTable, type BaseDocumentData } from "../shared/BaseDocument";
import { styles } from "../shared/styles";
import { formatDate, pickStr } from "@/lib/pdf";

export function ProcuracaoPDF({ data }: { data: BaseDocumentData }) {
  const { tenant, vehicle, formData } = data;
  if (!vehicle) return <BaseDocument title="Procuração" data={data}><Text>—</Text></BaseDocument>;

  const grantorName        = pickStr(formData, "grantor_name", "______________________________");
  const grantorCpf         = pickStr(formData, "grantor_cpf", "___.___.___-__");
  const grantorRg          = pickStr(formData, "grantor_rg");
  const grantorNationality = pickStr(formData, "grantor_nationality", "brasileiro(a)");
  const grantorMarital     = pickStr(formData, "grantor_marital");
  const grantorProfession  = pickStr(formData, "grantor_profession");
  const grantorAddress     = pickStr(formData, "grantor_address");
  const city               = pickStr(formData, "city", tenant.city ?? "______________");
  const signedDate         = formatDate(pickStr(formData, "signed_date"));

  return (
    <BaseDocument title="Procuração para Transferência" data={data}>
      <Text style={styles.sectionTitle}>Outorgante</Text>
      <Text style={styles.paragraph}>
        <Text style={styles.bold}>{grantorName}</Text>, {grantorNationality}
        {grantorMarital ? ", " + grantorMarital : ""}
        {grantorProfession ? ", " + grantorProfession : ""}, portador(a) da cédula de
        identidade RG nº {grantorRg || "____________"} e inscrito(a) no CPF/MF sob o nº{" "}
        {grantorCpf}, residente e domiciliado(a) em {grantorAddress || "____________"}.
      </Text>

      <Text style={styles.sectionTitle}>Outorgada</Text>
      <Text style={styles.paragraph}>
        <Text style={styles.bold}>{tenant.name}</Text>, com sede em {tenant.city || "____________"},
        neste ato representada por seu(sua) representante legal.
      </Text>

      <Text style={styles.sectionTitle}>Veículo</Text>
      <VehicleTable vehicle={vehicle} />

      <Text style={styles.sectionTitle}>Poderes</Text>
      <Text style={styles.paragraph}>
        Pelo presente instrumento particular de procuração, o(a) Outorgante nomeia e
        constitui a Outorgada como sua bastante procuradora, conferindo-lhe os mais amplos
        poderes para representá-lo(a) perante o <Text style={styles.bold}>Departamento
        Estadual de Trânsito (Detran)</Text>, Receita Federal, Polícia Federal, Polícia
        Civil, despachantes, seguradoras, prefeituras e demais órgãos públicos ou privados,
        podendo:
      </Text>

      <Text style={styles.paragraph}>
        a) Requerer e assinar a transferência de propriedade do veículo acima descrito;
        {"\n"}b) Solicitar a emissão de 2ª via do Certificado de Registro de Veículo (CRV)
        e do Certificado de Registro e Licenciamento de Veículo (CRLV);
        {"\n"}c) Reconhecer firma, pagar taxas, retirar documentos, prestar declarações,
        substabelecer com ou sem reserva de poderes;
        {"\n"}d) Praticar todos os demais atos necessários ao fiel cumprimento do presente
        mandato, especialmente aqueles relacionados à regularização cadastral do veículo
        em nome de seu novo proprietário.
      </Text>

      <Text style={styles.paragraph}>
        Este mandato é outorgado em caráter irrevogável e irretratável até que se conclua
        integralmente a transferência de propriedade do veículo descrito.
      </Text>

      <Text style={[styles.paragraph, { textAlign: "right", marginTop: 16 }]}>
        {city}, {signedDate}.
      </Text>

      <View style={[styles.signatures, { justifyContent: "center" }]} wrap={false}>
        <SignatureLine name={grantorName} role={`Outorgante · CPF ${grantorCpf}`} />
      </View>

      <Text style={[styles.smallNote, { textAlign: "center", marginTop: 12 }]}>
        Reconhecimento de firma exigido pelo Detran.
      </Text>
    </BaseDocument>
  );
}
