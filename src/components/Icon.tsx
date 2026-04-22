import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  ImagePlus,
  KeyRound,
  Monitor,
  Moon,
  Sun,
  X,
  ZoomIn,
  ZoomOut,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react'

export type IconName =
  | 'add_photo_alternate'
  | 'check'
  | 'check_circle'
  | 'chevron_left'
  | 'chevron_right'
  | 'close'
  | 'contrast'
  | 'dark_mode'
  | 'expand_more'
  | 'key'
  | 'keyboard_arrow_up'
  | 'light_mode'
  | 'zoom_in'
  | 'zoom_out_map'

type Props = LucideProps & {
  name: IconName
}

const ICONS = {
  add_photo_alternate: ImagePlus,
  check: Check,
  check_circle: CircleCheck,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  close: X,
  contrast: Monitor,
  dark_mode: Moon,
  expand_more: ChevronDown,
  key: KeyRound,
  keyboard_arrow_up: ChevronUp,
  light_mode: Sun,
  zoom_in: ZoomIn,
  zoom_out_map: ZoomOut,
} satisfies Record<IconName, LucideIcon>

export function Icon({ name, className, ...props }: Props) {
  const Component = ICONS[name]
  return <Component aria-hidden="true" strokeWidth={1.9} className={className} {...props} />
}