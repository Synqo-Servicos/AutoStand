"use client";

import { useRef, useState } from "react";
import { GripVertical, Plus, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Modal, toast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ABOUT_ICON_MAP, iconForSlug } from "@/lib/about-icons";
import { ABOUT_ICONS, type AboutIcon } from "@/lib/schemas";
import type { TenantAboutItemRow } from "@/lib/schema";

const MAX_ITEMS = 6;
const TITLE_MAX = 60;
const DESC_MAX = 280;

type EditState =
  | { mode: "closed" }
  | { mode: "new" }
  | { mode: "edit"; item: TenantAboutItemRow };

const inputClass =
  "w-full rounded-lg border border-n200 bg-white px-3 py-2 text-body text-ink " +
  "placeholder-n400 outline-none focus:border-signal focus:ring-2 focus:ring-signal/30";
const labelClass = "block text-body-s font-medium text-ink";

interface Props {
  initialItems: TenantAboutItemRow[];
}

export function AboutEditor({ initialItems }: Props) {
  const [items, setItems] = useState<TenantAboutItemRow[]>(initialItems);
  const [editState, setEditState] = useState<EditState>({ mode: "closed" });
  const [confirmDelete, setConfirmDelete] = useState<TenantAboutItemRow | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // distance:8 evita drag acidental ao clicar nos botões inline;
  // TouchSensor com delay pra coexistir com scroll vertical no mobile.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const prev = items;
    const next = arrayMove(items, oldIndex, newIndex);
    setItems(next);
    try {
      const res = await fetch("/api/about", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next.map((i) => i.id) }),
      });
      if (!res.ok) throw new Error("Falha ao reordenar.");
    } catch (err) {
      setItems(prev);
      toast.error((err as Error).message || "Não foi possível reordenar.");
    }
  }

  async function handleSave(input: { icon_slug: AboutIcon; title: string; description: string }) {
    if (editState.mode === "new") {
      try {
        const res = await fetch("/api/about", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Não foi possível criar.");
        setItems((prev) => [...prev, data as TenantAboutItemRow]);
        setEditState({ mode: "closed" });
        toast.success("Item adicionado.");
      } catch (err) {
        toast.error((err as Error).message);
      }
      return;
    }
    if (editState.mode === "edit") {
      const id = editState.item.id;
      try {
        const res = await fetch(`/api/about/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar.");
        setItems((prev) =>
          prev.map((i) => (i.id === id ? (data as TenantAboutItemRow) : i)),
        );
        setEditState({ mode: "closed" });
        toast.success("Alterações salvas.");
      } catch (err) {
        toast.error((err as Error).message);
      }
    }
  }

  async function performDelete(item: TenantAboutItemRow) {
    setBusyId(item.id);
    const prev = items;
    setItems((cur) => cur.filter((i) => i.id !== item.id));
    try {
      const res = await fetch(`/api/about/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Falha ao excluir.");
      setConfirmDelete(null);
      toast.success("Item removido.");
    } catch (err) {
      setItems(prev);
      toast.error((err as Error).message || "Não foi possível excluir.");
    } finally {
      setBusyId(null);
    }
  }

  const canAdd = items.length < MAX_ITEMS;

  return (
    <div className="space-y-3">
      <p className="text-body-s text-n600">
        Cards que aparecem na seção <strong>“Por que {`{nome da loja}`}?”</strong>
        {" "}do seu site. Até {MAX_ITEMS} itens — arraste para reordenar.
      </p>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-n200 px-6 py-10 text-center">
          <Sparkles className="mx-auto mb-2 h-7 w-7 text-n400" aria-hidden />
          <p className="text-body-s text-n600">
            Sem itens personalizados ainda — seu site mostra os 4 padrões.
          </p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2">
              {items.map((item) => (
                <SortableRow
                  key={item.id}
                  item={item}
                  busy={busyId === item.id}
                  onEdit={() => setEditState({ mode: "edit", item })}
                  onAskDelete={() => setConfirmDelete(item)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <Button
        variant="ghost"
        size="md"
        onClick={() => setEditState({ mode: "new" })}
        disabled={!canAdd}
        leadingIcon={<Plus className="h-4 w-4" />}
      >
        {canAdd
          ? "Adicionar item"
          : `Limite de ${MAX_ITEMS} itens atingido`}
      </Button>

      <ItemEditorModal
        state={editState}
        onClose={() => setEditState({ mode: "closed" })}
        onSave={handleSave}
      />

      <Modal
        open={confirmDelete !== null}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        size="sm"
        title="Excluir este item?"
        description="A ação é permanente — o card sai do seu site."
        footer={
          <>
            <Button
              variant="ghost"
              size="md"
              onClick={() => setConfirmDelete(null)}
              disabled={busyId !== null}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="md"
              loading={busyId !== null}
              onClick={() => confirmDelete && performDelete(confirmDelete)}
            >
              Excluir
            </Button>
          </>
        }
      >
        {confirmDelete && (
          <p className="text-body-s text-n700">
            Você está removendo <strong>{confirmDelete.title}</strong>.
          </p>
        )}
      </Modal>
    </div>
  );
}

// ---------- Sortable row ----------

interface SortableRowProps {
  item: TenantAboutItemRow;
  busy: boolean;
  onEdit: () => void;
  onAskDelete: () => void;
}

function SortableRow({ item, busy, onEdit, onAskDelete }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const Icon = iconForSlug(item.icon_slug);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-start gap-3 rounded-lg border border-n200 bg-white p-3",
        isDragging && "ring-2 ring-signal/40 shadow-lg",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Arrastar"
        className="mt-0.5 cursor-grab touch-none rounded p-1 text-n500 hover:bg-n100 hover:text-ink active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-signal/10 text-signal-dark">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-s font-medium text-ink">{item.title}</p>
        <p className="line-clamp-2 text-body-s text-n600">{item.description}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" size="sm" onClick={onEdit} disabled={busy}>
          Editar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAskDelete}
          disabled={busy}
          aria-label="Excluir"
        >
          <Trash2 className="h-4 w-4 text-danger" />
        </Button>
      </div>
    </li>
  );
}

// ---------- Editor modal ----------

interface EditorModalProps {
  state: EditState;
  onClose: () => void;
  onSave: (input: { icon_slug: AboutIcon; title: string; description: string }) => Promise<void>;
}

function ItemEditorModal({ state, onClose, onSave }: EditorModalProps) {
  const editing = state.mode === "edit" ? state.item : null;
  const isOpen = state.mode !== "closed";

  // Estado vive no Modal pra que o footer (renderizado fora do body scrollável)
  // tenha acesso direto ao canSubmit e handleSubmit.
  const [iconSlug, setIconSlug] = useState<AboutIcon>("ShieldCheck");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  // Re-hidrata ao abrir/trocar de item — evita valores stale entre edits.
  const initKey = state.mode === "edit" ? state.item.id : state.mode;
  useResetOnChange(initKey, () => {
    setIconSlug((editing?.icon_slug as AboutIcon) ?? "ShieldCheck");
    setTitle(editing?.title ?? "");
    setDescription(editing?.description ?? "");
    setSaving(false);
  });

  const titleTooLong = title.length > TITLE_MAX;
  const descTooLong = description.length > DESC_MAX;
  const canSubmit =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    !titleTooLong &&
    !descTooLong &&
    !saving;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSaving(true);
    await onSave({ icon_slug: iconSlug, title: title.trim(), description: description.trim() });
    setSaving(false);
  }

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title={editing ? "Editar item" : "Novo item da seção Sobre"}
      description="Mostre uma vantagem real da sua loja — confiança, atendimento, agilidade."
      footer={
        <>
          <Button variant="ghost" size="md" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={!canSubmit} loading={saving}>
            {editing ? "Salvar alterações" : "Adicionar"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Icon palette */}
        <div>
          <span className={labelClass}>Ícone</span>
          <div className="mt-2 grid grid-cols-6 gap-2 sm:grid-cols-9">
            {ABOUT_ICONS.map((slug) => {
              const Icon = ABOUT_ICON_MAP[slug];
              const selected = iconSlug === slug;
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => setIconSlug(slug)}
                  aria-label={slug}
                  aria-pressed={selected}
                  className={cn(
                    "flex h-10 items-center justify-center rounded-lg border transition-colors",
                    selected
                      ? "border-signal bg-signal/10 text-signal-dark"
                      : "border-n200 bg-white text-n600 hover:border-n400 hover:text-ink",
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="about-title" className={labelClass}>
            Título
          </label>
          <input
            id="about-title"
            className={`mt-1 ${inputClass}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Procedência garantida"
            maxLength={TITLE_MAX + 20}
          />
          <p className={cn("mt-1 text-body-s", titleTooLong ? "text-danger" : "text-n500")}>
            {title.length} / {TITLE_MAX}
          </p>
        </div>

        <div>
          <label htmlFor="about-desc" className={labelClass}>
            Descrição
          </label>
          <textarea
            id="about-desc"
            className={`mt-1 ${inputClass} resize-none`}
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Todos os carros revisados, com histórico e documentação em dia."
            maxLength={DESC_MAX + 40}
          />
          <p className={cn("mt-1 text-body-s", descTooLong ? "text-danger" : "text-n500")}>
            {description.length} / {DESC_MAX}
          </p>
        </div>
      </div>
    </Modal>
  );
}

// Re-roda o reset sempre que `key` muda — equivalente a remount sem dropar
// o Modal (que precisa permanecer aberto pra animação).
function useResetOnChange(key: unknown, reset: () => void) {
  const last = useRef(key);
  if (last.current !== key) {
    last.current = key;
    reset();
  }
}
