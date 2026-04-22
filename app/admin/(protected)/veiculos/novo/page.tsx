import { VehicleForm } from "@/components/admin/VehicleForm";

export default function NovoVeiculoPage() {
  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Novo veículo</h1>
        <p className="text-sm text-slate-500 mt-1">Preencha os dados. Fotos podem ser adicionadas após salvar.</p>
      </div>
      <VehicleForm />
    </div>
  );
}
