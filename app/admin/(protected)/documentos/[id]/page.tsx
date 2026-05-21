import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { listVehicles } from "@/lib/db";
import { getAdminTenant } from "@/lib/tenant";
import { getTemplate, type TemplateId } from "@/lib/document-templates";
import { DocumentGeneratorForm } from "@/components/admin/DocumentGeneratorForm";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export default async function DocumentoTemplatePage({ params }: Params) {
  const { id } = await params;
  const template = getTemplate(id);
  if (!template) notFound();

  const tenant = await getAdminTenant();
  const vehicles = template.requiresVehicle
    ? await listVehicles(tenant.id)
    : [];

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <Link
        href="/admin/documentos"
        className="inline-flex items-center gap-1 text-sm text-n500 hover:text-ink mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        Voltar para a biblioteca
      </Link>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-ink">{template.name}</h1>
        <p className="text-sm text-n600 mt-1">{template.description}</p>
      </div>
      <DocumentGeneratorForm
        templateId={template.id as TemplateId}
        templateName={template.name}
        fields={template.fields}
        requiresVehicle={template.requiresVehicle}
        vehicles={vehicles.map((v) => ({
          id: v.id,
          label: `${v.brand} ${v.model}${v.version ? " · " + v.version : ""} (${v.year})`,
        }))}
      />
    </div>
  );
}
