import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  Copy,
  Download,
  GripVertical,
  ImagePlus,
  ImageIcon,
  KeyRound,
  MoreHorizontal,
  Monitor,
  Moon,
  Plus,
  Redo2,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  Undo2,
  Upload,
  Wand2,
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
  | 'chevron_down'
  | 'chevron_left'
  | 'chevron_right'
  | 'close'
  | 'contrast'
  | 'copy'
  | 'dark_mode'
  | 'download'
  | 'drag'
  | 'expand_more'
  | 'image'
  | 'key'
  | 'keyboard_arrow_up'
  | 'light_mode'
  | 'more'
  | 'plus'
  | 'redo'
  | 'refresh'
  | 'search'
  | 'settings'
  | 'sparkles'
  | 'trash'
  | 'undo'
  | 'upload'
  | 'wand'
  | 'zoom_in'
  | 'zoom_out_map'

type Props = LucideProps & {
  name: IconName
}

const ICONS = {
  add_photo_alternate: ImagePlus,
  check: Check,
  check_circle: CircleCheck,
  chevron_down: ChevronDown,
  chevron_left: ChevronLeft,
  chevron_right: ChevronRight,
  close: X,
  contrast: Monitor,
  copy: Copy,
  dark_mode: Moon,
  download: Download,
  drag: GripVertical,
  expand_more: ChevronDown,
  image: ImageIcon,
  key: KeyRound,
  keyboard_arrow_up: ChevronUp,
  light_mode: Sun,
  more: MoreHorizontal,
  plus: Plus,
  redo: Redo2,
  refresh: RefreshCw,
  search: Search,
  settings: Settings,
  sparkles: Sparkles,
  trash: Trash2,
  undo: Undo2,
  upload: Upload,
  wand: Wand2,
  zoom_in: ZoomIn,
  zoom_out_map: ZoomOut,
} satisfies Record<IconName, LucideIcon>

export function Icon({ name, className, strokeWidth = 1.6, ...props }: Props) {
  const Component = ICONS[name]
  return <Component aria-hidden="true" strokeWidth={strokeWidth} className={className} {...props} />
}
