import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles } from "./styles";
import type { TenantRow } from "@/lib/schema";
import type { Vehicle } from "@/types/vehicle";

export interface BaseDocumentData {
  tenant: Pick<TenantRow, "name" | "city" | "whatsapp_number" | "contact_email" | "accent_color" | "primary_color">;
  vehicle: Vehicle | null;
  formData: Record<string, string | number | boolean | null | undefined>;
}

export function DocHeader({ tenant, title }: { tenant: BaseDocumentData["tenant"]; title: string }) {
  return (
    <View style={styles.header} fixed>
      <View style={styles.headerLeft}>
        <Text style={styles.brandName}>{tenant.name}</Text>
        <Text style={styles.brandMeta}>
          {[tenant.city, tenant.contact_email, tenant.whatsapp_number].filter(Boolean).join(" · ")}
        </Text>
        <View
          style={[
            styles.accentBar,
            tenant.accent_color ? { backgroundColor: tenant.accent_color } : {},
          ]}
        />
      </View>
      <View>
        <Text style={[styles.brandMeta, { textAlign: "right" }]}>{title}</Text>
      </View>
    </View>
  );
}

export function DocFooter({ tenant }: { tenant: BaseDocumentData["tenant"] }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{tenant.name}</Text>
      <Text
        render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
          `${pageNumber} / ${totalPages}`
        }
      />
    </View>
  );
}

export function PartyBlock({
  label,
  lines,
}: {
  label: string;
  lines: Array<string | null | undefined>;
}) {
  return (
    <View style={styles.partyBlock} wrap={false}>
      <Text style={styles.partyLabel}>{label}</Text>
      {lines.filter(Boolean).map((line, idx) => (
        <Text key={idx}>{line}</Text>
      ))}
    </View>
  );
}

export function KeyValue({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <View style={styles.tableRow}>
      <Text style={styles.tableLabel}>{label}</Text>
      <Text style={styles.tableValue}>{value || "—"}</Text>
    </View>
  );
}

export function VehicleTable({ vehicle }: { vehicle: Vehicle }) {
  return (
    <View style={styles.table}>
      <KeyValue
        label="Veículo"
        value={`${vehicle.brand} ${vehicle.model}${vehicle.version ? " · " + vehicle.version : ""}`}
      />
      <KeyValue
        label="Ano"
        value={`${vehicle.year_manufacture ?? vehicle.year}/${vehicle.year}`}
      />
      <KeyValue label="Cor" value={vehicle.color} />
      <KeyValue label="Combustível" value={vehicle.fuel} />
      <KeyValue label="Quilometragem" value={`${vehicle.km.toLocaleString("pt-BR")} km`} />
      <View style={styles.tableRowLast}>
        <Text style={styles.tableLabel}>Chassi</Text>
        <Text style={styles.tableValue}>—</Text>
      </View>
    </View>
  );
}

export function SignatureLine({ name, role }: { name: string; role: string }) {
  return (
    <View style={styles.signatureBlock} wrap={false}>
      <View style={styles.signatureLine}>
        <Text style={styles.signatureName}>{name || "_________________________________"}</Text>
        <Text style={styles.signatureRole}>{role}</Text>
      </View>
    </View>
  );
}

export function BaseDocument({
  title,
  data,
  children,
}: {
  title: string;
  data: BaseDocumentData;
  children: React.ReactNode;
}) {
  return (
    <Document title={title} author={data.tenant.name} producer="AutoStand">
      <Page size="A4" style={styles.page}>
        <DocHeader tenant={data.tenant} title={title} />
        <Text style={styles.documentTitle}>{title}</Text>
        {children}
        <DocFooter tenant={data.tenant} />
      </Page>
    </Document>
  );
}
