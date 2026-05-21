import { Text, View } from "@react-pdf/renderer";
import { BaseDocument, PartyBlock, SignatureLine, VehicleTable, type BaseDocumentData } from "../shared/BaseDocument";
import { styles } from "../shared/styles";
import { brlFromReais, formatDate, pickStr } from "@/lib/pdf";

const PAYMENT_LABELS: Record<string, string> = {
  dinheiro:       "em dinheiro",
  pix:            "via PIX",
  transferencia:  "via transferência bancária",
  cartao:         "no cartão",
  cheque:         "por cheque",
};

export function ReciboSinalPDF({ data }: { data: BaseDocumentData }) {
  const { tenant, vehicle, formData } = data;
  if (!vehicle) return <BaseDocument title="Recibo de Sinal" data={data}><Text>—</Text></BaseDocument>;

  const buyerName  = pickStr(formData, "buyer_name", "______________________________");
  const buyerCpf   = pickStr(formData, "buyer_cpf", "___.___.___-__");
  const buyerPhone = pickStr(formData, "buyer_phone");
  const signal     = pickStr(formData, "signal_value");
  const total      = pickStr(formData, "sale_price");
  const paymentRaw = pickStr(formData, "payment_form");
  const payment    = PAYMENT_LABELS[paymentRaw] ?? "";
  const city       = pickStr(formData, "city", tenant.city ?? "______________");
  const signedDate = formatDate(pickStr(formData, "signed_date"));

  return (
    <BaseDocument title="Recibo de Sinal" data={data}>
      <PartyBlock
        label="Recebedora"
        lines={[tenant.name, tenant.city, [tenant.contact_email, tenant.whatsapp_number].filter(Boolean).join(" · ") || undefined]}
      />
      <PartyBlock
        label="Pagador"
        lines={[buyerName, `CPF: ${buyerCpf}`, buyerPhone || undefined]}
      />

      <Text style={[styles.paragraph, { marginTop: 12 }]}>
        Recebemos do(a) Sr.(a) <Text style={styles.bold}>{buyerName}</Text>, portador(a) do
        CPF nº {buyerCpf}, a quantia de <Text style={styles.bold}>{brlFromReais(signal)}</Text>
        {payment ? " " + payment : ""}, a título de <Text style={styles.bold}>sinal e
        princípio de pagamento</Text> referente à futura aquisição do veículo abaixo descrito,
        cujo preço total acordado é de <Text style={styles.bold}>{brlFromReais(total)}</Text>.
      </Text>

      <VehicleTable vehicle={vehicle} />

      <Text style={styles.paragraph}>
        Este recibo será automaticamente convertido em contrato de compra e venda no ato
        da quitação do saldo remanescente. Em caso de desistência por parte do(a)
        pagador(a), o valor aqui recebido poderá ser retido a título de perdas e danos,
        conforme negociação acordada entre as partes.
      </Text>

      <Text style={[styles.paragraph, { textAlign: "right", marginTop: 16 }]}>
        {city}, {signedDate}.
      </Text>

      <View style={styles.signatures} wrap={false}>
        <SignatureLine name={tenant.name} role="Recebedora" />
        <SignatureLine name={buyerName} role="Pagador" />
      </View>
    </BaseDocument>
  );
}
