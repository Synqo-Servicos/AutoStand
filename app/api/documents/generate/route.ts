import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { addVehicleDocument, getTenantById, getVehicleWithPhotos } from "@/lib/db";
import { getTemplate, type TemplateId } from "@/lib/document-templates";
import { renderTemplate } from "@/lib/pdf";
import { s3Put, HAS_S3 } from "@/lib/s3";

// react-pdf precisa do runtime Node.js (deps nativas/fontes).
export const runtime = "nodejs";

interface Payload {
  templateId: TemplateId;
  vehicleId?: number | null;
  formData?: Record<string, string | number | boolean | null | undefined>;
  /** Se true, salva o PDF como vehicle_document anexado ao veículo. */
  attachToVehicle?: boolean;
}

function safeFileName(template: string, vehicleSuffix: string): string {
  const ts = new Date().toISOString().slice(0, 10);
  return `${template}-${vehicleSuffix}-${ts}.pdf`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "tenant_admin" || !session.user.tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenantId = session.user.tenantId;
  const userId = session.user.id ? Number(session.user.id) : null;

  const body = (await req.json()) as Payload;
  const template = getTemplate(body.templateId);
  if (!template) {
    return NextResponse.json({ error: "Template inválido" }, { status: 400 });
  }

  const tenant = await getTenantById(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
  }

  let vehicle = null;
  if (body.vehicleId) {
    vehicle = await getVehicleWithPhotos(tenantId, Number(body.vehicleId));
  }
  if (template.requiresVehicle && !vehicle) {
    return NextResponse.json(
      { error: `O template "${template.name}" requer um veículo.` },
      { status: 400 },
    );
  }

  let pdf: Buffer;
  try {
    pdf = await renderTemplate(template.id, {
      tenant,
      vehicle,
      formData: body.formData ?? {},
    });
  } catch (err) {
    console.error("erro renderizando PDF", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Falha ao gerar PDF" },
      { status: 500 },
    );
  }

  const suffix = vehicle ? `${vehicle.brand}-${vehicle.model}-${vehicle.id}` : `${tenantId}`;
  const fileName = safeFileName(template.id, suffix.toLowerCase().replace(/[^a-z0-9-]+/g, "-"));

  // Se anexar ao veículo: sobe no Blob e cria registro em vehicle_documents.
  if (body.attachToVehicle && vehicle) {
    const key = `tenants/${tenantId}/vehicles/${vehicle.id}/docs/${Date.now()}-${fileName}`;
    let url: string;
    if (HAS_S3) {
      url = await s3Put(key, Buffer.from(pdf), "application/pdf");
    } else if (process.env.NODE_ENV === "production") {
      throw new Error("AWS_S3_BUCKET ausente em produção — configure o S3.");
    } else {
      // Dev: devolve o PDF inline sem persistir
      url = `/api/documents/generate?dev-preview=${encodeURIComponent(fileName)}`;
    }
    const row = await addVehicleDocument({
      tenantId,
      vehicleId: vehicle.id,
      name: template.name,
      category: "contrato",
      url,
      size: pdf.length,
      mimeType: "application/pdf",
      uploadedBy: userId,
    });
    return NextResponse.json({ document: row, url });
  }

  // Caso default: devolve o PDF inline (download).
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
