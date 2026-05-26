/**
 * Camadas 1+2 do design system AutoStand.
 * Ver docs/SPEC-design-system.md §5 para variantes e regras.
 *
 * Não usar `slate-*`, `gray-*`, ou hex hardcoded ao consumir esses componentes —
 * passe className só com tokens (`n*`, `ink`, `signal`, `success`, etc.).
 */

// — Camada 1: fundação —
export { Button, type ButtonProps } from "./Button";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
  type CardProps,
} from "./Card";
export {
  Input,
  Textarea,
  Field,
  type InputProps,
  type TextareaProps,
  type FieldProps,
} from "./Input";
export { Skeleton, SkeletonText, type SkeletonProps } from "./Skeleton";
export { Badge, type BadgeProps } from "./Badge";

// — Camada 2: composição (Radix) —
export { Select, type SelectProps, type SelectOption } from "./Select";
export { Modal, ModalSection, type ModalProps } from "./Modal";
export { Drawer, type DrawerProps } from "./Drawer";
export { ToastProvider, toast } from "./Toast";
export { EmptyState, type EmptyStateProps } from "./EmptyState";
