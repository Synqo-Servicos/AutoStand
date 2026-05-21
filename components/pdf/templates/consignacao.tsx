import { Text, View } from "@react-pdf/renderer";
import { BaseDocument, KeyValue, PartyBlock, SignatureLine, type BaseDocumentData } from "../shared/BaseDocument";
import { styles } from "../shared/styles";
import { brlFromReais, formatDate, pickNum, pickStr } from "@/lib/pdf";

export function ConsignacaoPDF({ data }: { data: BaseDocumentData }) {
  const { tenant, formData } = data;

  const ownerName    = pickStr(formData, "owner_name", "______________________________");
  const ownerCpf     = pickStr(formData, "owner_cpf", "___.___.___-__");
  const ownerRg      = pickStr(formData, "owner_rg");
  const ownerAddress = pickStr(formData, "owner_address");
  const ownerPhone   = pickStr(formData, "owner_phone");
  const vehicleDesc  = pickStr(formData, "vehicle_description", "______________________________");
  const chassi       = pickStr(formData, "vehicle_chassi");
  const plate        = pickStr(formData, "vehicle_plate");
  const km           = pickStr(formData, "vehicle_km");
  const minPrice     = pickStr(formData, "min_sale_price");
  const days         = pickNum(formData, "days_term", 60);
  const commission   = pickNum(formData, "commission_pct", 8);
  const ownerPaysPrep= !!formData.owner_pays_prep;
  const city         = pickStr(formData, "city", tenant.city ?? "______________");
  const signedDate   = formatDate(pickStr(formData, "signed_date"));

  return (
    <BaseDocument title="Contrato de Consignação para Venda" data={data}>
      <Text style={styles.sectionTitle}>Partes</Text>
      <PartyBlock
        label="Consignante (proprietário do veículo)"
        lines={[
          ownerName,
          `CPF: ${ownerCpf}${ownerRg ? "   RG: " + ownerRg : ""}`,
          ownerAddress || undefined,
          ownerPhone || undefined,
        ]}
      />
      <PartyBlock
        label="Consignatária (loja)"
        lines={[tenant.name, tenant.city, [tenant.contact_email, tenant.whatsapp_number].filter(Boolean).join(" · ") || undefined]}
      />

      <Text style={styles.sectionTitle}>Objeto da consignação</Text>
      <View style={styles.table}>
        <KeyValue label="Veículo" value={vehicleDesc} />
        <KeyValue label="Chassi" value={chassi || "—"} />
        <KeyValue label="Placa" value={plate || "—"} />
        <KeyValue label="KM" value={km ? `${km} km` : "—"} />
      </View>

      <Text style={styles.sectionTitle}>Cláusulas</Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>1ª — Da consignação. </Text>
        O Consignante entrega à Consignatária, em consignação, o veículo descrito acima,
        para fins exclusivos de venda a terceiros, mantendo o Consignante a propriedade
        plena enquanto não realizada a venda.
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>2ª — Do valor. </Text>
        O Consignante autoriza a Consignatária a comercializar o veículo pelo valor mínimo
        líquido de <Text style={styles.bold}>{brlFromReais(minPrice)}</Text>. Qualquer valor
        que exceda esse montante poderá ser livremente acrescido pela Consignatária como
        sua margem de venda.
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>3ª — Da comissão. </Text>
        A Consignatária fará jus a uma comissão de {commission}% (
        {commission} por cento) sobre o valor da venda, ou ao montante excedente ao
        valor mínimo previsto na cláusula 2ª — o que for maior, salvo acordo em contrário.
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>4ª — Do prazo. </Text>
        Este contrato vigorará por {days} (
        {days < 20 ? "" : ""}{days}) dias contados desta data, podendo ser renovado por
        acordo entre as partes.
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>5ª — Da preparação. </Text>
        {ownerPaysPrep
          ? "Eventuais despesas com laudo cautelar, polimento, reparos e demais serviços de preparação são de responsabilidade do Consignante, mediante prévia autorização."
          : "Eventuais despesas com preparação, polimento e laudo cautelar correrão por conta da Consignatária, sem ônus para o Consignante."}
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>6ª — Da prestação de contas. </Text>
        Realizada a venda, a Consignatária repassará ao Consignante o valor líquido
        acordado em até 5 (cinco) dias úteis após a compensação do pagamento integral pelo
        comprador final.
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>7ª — Da rescisão. </Text>
        Qualquer das partes poderá rescindir este contrato mediante aviso prévio de 7
        (sete) dias, com a imediata devolução do veículo ao Consignante, desde que não
        haja venda em andamento.
      </Text>

      <Text style={[styles.paragraph, { textAlign: "right", marginTop: 16 }]}>
        {city}, {signedDate}.
      </Text>

      <View style={styles.signatures} wrap={false}>
        <SignatureLine name={ownerName} role={`Consignante · CPF ${ownerCpf}`} />
        <SignatureLine name={tenant.name} role="Consignatária" />
      </View>
    </BaseDocument>
  );
}
