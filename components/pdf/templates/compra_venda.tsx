import { Text, View } from "@react-pdf/renderer";
import { BaseDocument, PartyBlock, SignatureLine, VehicleTable, type BaseDocumentData } from "../shared/BaseDocument";
import { styles } from "../shared/styles";
import { brlFromReais, formatDate, pickNum, pickStr } from "@/lib/pdf";

export function CompraVendaPDF({ data }: { data: BaseDocumentData }) {
  const { tenant, vehicle, formData } = data;
  if (!vehicle) return <BaseDocument title="Contrato de Compra e Venda" data={data}><Text>—</Text></BaseDocument>;

  const buyerName    = pickStr(formData, "buyer_name", "______________________________");
  const buyerCpf     = pickStr(formData, "buyer_cpf", "___.___.___-__");
  const buyerRg      = pickStr(formData, "buyer_rg");
  const buyerAddress = pickStr(formData, "buyer_address", "______________________________");
  const buyerPhone   = pickStr(formData, "buyer_phone");
  const buyerEmail   = pickStr(formData, "buyer_email");
  const salePrice    = pickStr(formData, "sale_price");
  const payment      = pickStr(formData, "payment_method", "a_vista");
  const downpayment  = pickStr(formData, "downpayment");
  const installments = pickNum(formData, "installments");
  const warrantyDays = pickNum(formData, "warranty_days", 90);
  const warrantyKm   = pickNum(formData, "warranty_km", 5000);
  const city         = pickStr(formData, "city", tenant.city ?? "______________");
  const signedDate   = formatDate(pickStr(formData, "signed_date"));

  const paymentLabel = payment === "a_vista"
    ? "à vista"
    : payment === "financiado"
      ? "via financiamento bancário"
      : "parcelado direto com a vendedora";

  return (
    <BaseDocument title="Contrato de Compra e Venda de Veículo" data={data}>
      <Text style={styles.sectionTitle}>Partes</Text>
      <PartyBlock
        label="Vendedora"
        lines={[
          tenant.name,
          tenant.city,
          [tenant.contact_email, tenant.whatsapp_number].filter(Boolean).join(" · ") || undefined,
        ]}
      />
      <PartyBlock
        label="Compradora"
        lines={[
          buyerName,
          `CPF: ${buyerCpf}${buyerRg ? "   RG: " + buyerRg : ""}`,
          buyerAddress,
          [buyerPhone, buyerEmail].filter(Boolean).join(" · ") || undefined,
        ]}
      />

      <Text style={styles.sectionTitle}>Objeto</Text>
      <VehicleTable vehicle={vehicle} />

      <Text style={styles.sectionTitle}>Cláusulas</Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>1ª — Do preço. </Text>
        Pelo presente instrumento, a Vendedora vende e a Compradora compra o veículo
        descrito acima pelo valor de {brlFromReais(salePrice)}, a ser pago {paymentLabel}
        {payment === "parcelado" && installments > 0 ? `, em ${installments} parcelas mensais` : ""}
        {downpayment && payment !== "a_vista" ? `, com entrada de ${brlFromReais(downpayment)}` : ""}.
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>2ª — Da entrega. </Text>
        A Compradora declara ter examinado, conferido e testado previamente o veículo,
        recebendo-o no estado em que se encontra, com os equipamentos e acessórios
        constantes no ato de entrega.
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>3ª — Da transferência. </Text>
        A Vendedora entrega à Compradora a documentação necessária à transferência junto ao
        Detran. A Compradora se compromete a registrar a transferência em até 30 (trinta)
        dias úteis, conforme art. 123 do CTB, isentando a Vendedora de débitos, multas e
        responsabilidades posteriores a esta data.
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>4ª — Da garantia. </Text>
        A Vendedora oferece garantia de {warrantyDays} dias ou {warrantyKm.toLocaleString("pt-BR")} km
        (o que ocorrer primeiro), nas condições descritas no Termo de Garantia próprio,
        considerado parte integrante deste contrato.
      </Text>

      <Text style={styles.paragraph}>
        <Text style={styles.bold}>5ª — Do foro. </Text>
        Fica eleito o foro da Comarca de {city || "____________"} para dirimir quaisquer
        dúvidas oriundas deste contrato.
      </Text>

      <Text style={[styles.paragraph, { marginTop: 16 }]}>
        E por estarem assim justos e contratados, firmam o presente em duas vias de igual
        teor.
      </Text>

      <Text style={[styles.paragraph, { textAlign: "right" }]}>
        {city || "____________"}, {signedDate}.
      </Text>

      <View style={styles.signatures} wrap={false}>
        <SignatureLine name={tenant.name} role="Vendedora" />
        <SignatureLine name={buyerName} role={`Compradora${buyerCpf ? " · CPF " + buyerCpf : ""}`} />
      </View>
    </BaseDocument>
  );
}
