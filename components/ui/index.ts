/**
 * Camada 1 do design system AutoStand.
 * Ver docs/SPEC-design-system.md §5.1 para variantes e regras.
 *
 * Não usar `slate-*`, `gray-*`, ou hex hardcoded ao consumir esses componentes —
 * passe className só com tokens (`n*`, `ink`, `signal`, `success`, etc.).
 */
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
