import { VehicleForm } from "@/components/admin/VehicleForm";

export default function NovoVeiculoPage() {
  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="font-display text-h2 font-semibold text-ink">Novo veículo</h1>
        <p className="text-sm text-n600 mt-1">Preencha os dados. Fotos podem ser adicionadas após salvar.</p>
      </div>
      <VehicleForm />
    </div>
  );
}
