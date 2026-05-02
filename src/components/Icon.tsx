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
  HelpCircle,
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
import { useId, type SVGProps } from 'react'

import type { ProviderBrandIconName } from '../config/providers'

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
  | 'help_circle'
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

export type BrandIconName = ProviderBrandIconName

type BrandIconProps = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: BrandIconName
  size?: number
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
  help_circle: HelpCircle,
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

const BRAND_ICONS = {
  openai: {
    viewBox: '0 0 158.7128 157.296',
    path: 'M60.8734,57.2556v-14.9432c0-1.2586.4722-2.2029,1.5728-2.8314l30.0443-17.3023c4.0899-2.3593,8.9662-3.4599,13.9988-3.4599,18.8759,0,30.8307,14.6289,30.8307,30.2006,0,1.1007,0,2.3593-.158,3.6178l-31.1446-18.2467c-1.8872-1.1006-3.7754-1.1006-5.6629,0l-39.4812,22.9651ZM131.0276,115.4561v-35.7074c0-2.2028-.9446-3.7756-2.8318-4.8763l-39.481-22.9651,12.8982-7.3934c1.1007-.6285,2.0453-.6285,3.1458,0l30.0441,17.3024c8.6523,5.0341,14.4708,15.7296,14.4708,26.1107,0,11.9539-7.0769,22.965-18.2461,27.527v.0021ZM51.593,83.9964l-12.8982-7.5497c-1.1007-.6285-1.5728-1.5728-1.5728-2.8314v-34.6048c0-16.8303,12.8982-29.5722,30.3585-29.5722,6.607,0,12.7403,2.2029,17.9324,6.1349l-30.987,17.9324c-1.8871,1.1007-2.8314,2.6735-2.8314,4.8764v45.6159l-.0014-.0015ZM79.3562,100.0403l-18.4829-10.3811v-22.0209l18.4829-10.3811,18.4812,10.3811v22.0209l-18.4812,10.3811ZM91.2319,147.8591c-6.607,0-12.7403-2.2031-17.9324-6.1344l30.9866-17.9333c1.8872-1.1005,2.8318-2.6728,2.8318-4.8759v-45.616l13.0564,7.5498c1.1005.6285,1.5723,1.5728,1.5723,2.8314v34.6051c0,16.8297-13.0564,29.5723-30.5147,29.5723v.001ZM53.9522,112.7822l-30.0443-17.3024c-8.652-5.0343-14.471-15.7296-14.471-26.1107,0-12.1119,7.2356-22.9652,18.403-27.5272v35.8634c0,2.2028.9443,3.7756,2.8314,4.8763l39.3248,22.8068-12.8982,7.3938c-1.1007.6287-2.045.6287-3.1456,0ZM52.2229,138.5791c-17.7745,0-30.8306-13.3713-30.8306-29.8871,0-1.2585.1578-2.5169.3143-3.7754l30.987,17.9323c1.8871,1.1005,3.7757,1.1005,5.6628,0l39.4811-22.807v14.9435c0,1.2585-.4721,2.2021-1.5728,2.8308l-30.0443,17.3025c-4.0898,2.359-8.9662,3.4605-13.9989,3.4605h.0014ZM91.2319,157.296c19.0327,0,34.9188-13.5272,38.5383-31.4594,17.6164-4.562,28.9425-21.0779,28.9425-37.908,0-11.0112-4.719-21.7066-13.2133-29.4143.7867-3.3035,1.2595-6.607,1.2595-9.909,0-22.4929-18.2471-39.3247-39.3251-39.3247-4.2461,0-8.3363.6285-12.4262,2.045-7.0792-6.9213-16.8318-11.3254-27.5271-11.3254-19.0331,0-34.9191,13.5268-38.5384,31.4591C11.3255,36.0212,0,52.5373,0,69.3675c0,11.0112,4.7184,21.7065,13.2125,29.4142-.7865,3.3035-1.2586,6.6067-1.2586,9.9092,0,22.4923,18.2466,39.3241,39.3248,39.3241,4.2462,0,8.3362-.6277,12.426-2.0441,7.0776,6.921,16.8302,11.3251,27.5271,11.3251Z',
  },
} satisfies Record<Exclude<BrandIconName, 'gemini'>, { viewBox: string; path: string }>

const GEMINI_ICON_PATH =
  'M32.447 0c.68 0 1.273.465 1.439 1.125a38.904 38.904 0 001.999 5.905c2.152 5 5.105 9.376 8.854 13.125 3.751 3.75 8.126 6.703 13.125 8.855a38.98 38.98 0 005.906 1.999c.66.166 1.124.758 1.124 1.438 0 .68-.464 1.273-1.125 1.439a38.902 38.902 0 00-5.905 1.999c-5 2.152-9.375 5.105-13.125 8.854-3.749 3.751-6.702 8.126-8.854 13.125a38.973 38.973 0 00-2 5.906 1.485 1.485 0 01-1.438 1.124c-.68 0-1.272-.464-1.438-1.125a38.913 38.913 0 00-2-5.905c-2.151-5-5.103-9.375-8.854-13.125-3.75-3.749-8.125-6.702-13.125-8.854a38.973 38.973 0 00-5.905-2A1.485 1.485 0 010 32.448c0-.68.465-1.272 1.125-1.438a38.903 38.903 0 005.905-2c5-2.151 9.376-5.104 13.125-8.854 3.75-3.749 6.703-8.125 8.855-13.125a38.972 38.972 0 001.999-5.905A1.485 1.485 0 0132.447 0z'

export function BrandIcon({ name, size = 14, className, style, ...props }: BrandIconProps) {
  const gradientId = useId()
  if (name === 'gemini') {
    return (
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox="0 0 65 65"
        fill="none"
        className={className}
        style={{ flexShrink: 0, ...style }}
        {...props}
      >
        <path d={GEMINI_ICON_PATH} fill={`url(#${gradientId})`} />
        <defs>
          <linearGradient id={gradientId} x1="0" y1="65" x2="65" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#439DDF" />
            <stop offset="0.45" stopColor="#4F87ED" />
            <stop offset="0.68" stopColor="#9476C5" />
            <stop offset="0.84" stopColor="#BC688E" />
            <stop offset="1" stopColor="#D6645D" />
          </linearGradient>
        </defs>
      </svg>
    )
  }

  const icon = BRAND_ICONS[name]
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox={icon.viewBox}
      fill="currentColor"
      className={className}
      style={{ flexShrink: 0, ...style }}
      {...props}
    >
      <path d={icon.path} />
    </svg>
  )
}
