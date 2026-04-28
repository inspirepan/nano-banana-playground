import {
  Brush,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  CircleCheck,
  Copy,
  Download,
  Eraser,
  GripVertical,
  ImagePlus,
  ImageIcon,
  KeyRound,
  Lock,
  Maximize2,
  MapPin,
  MoreHorizontal,
  Monitor,
  Moon,
  MousePointer2,
  Paperclip,
  Plus,
  Redo2,
  RefreshCw,
  Search,
  SendHorizontal,
  Settings,
  Sparkles,
  Square,
  CircleStop,
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
  | 'alert_circle'
  | 'brush'
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
  | 'eraser'
  | 'expand_more'
  | 'image'
  | 'key'
  | 'keyboard_arrow_up'
  | 'light_mode'
  | 'lock'
  | 'maximize'
  | 'map_pin'
  | 'more'
  | 'mouse_pointer'
  | 'paperclip'
  | 'plus'
  | 'redo'
  | 'refresh'
  | 'search'
  | 'send'
  | 'settings'
  | 'sparkles'
  | 'square'
  | 'stop_circle'
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
  alert_circle: CircleAlert,
  brush: Brush,
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
  eraser: Eraser,
  expand_more: ChevronDown,
  image: ImageIcon,
  key: KeyRound,
  keyboard_arrow_up: ChevronUp,
  light_mode: Sun,
  lock: Lock,
  maximize: Maximize2,
  map_pin: MapPin,
  more: MoreHorizontal,
  mouse_pointer: MousePointer2,
  paperclip: Paperclip,
  plus: Plus,
  redo: Redo2,
  refresh: RefreshCw,
  search: Search,
  send: SendHorizontal,
  settings: Settings,
  sparkles: Sparkles,
  square: Square,
  stop_circle: CircleStop,
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
