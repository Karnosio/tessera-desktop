import type * as React from 'react';

export type IconName =
  | 'arrow-up-down' | 'check' | 'chevron-left' | 'chevron-right' | 'circle-check' | 'circle-x' | 'clipboard-paste'
  | 'ellipsis-vertical' | 'file-text' | 'gauge' | 'grip-vertical' | 'house' | 'info' | 'link' | 'loader-circle' | 'pencil' | 'plus' | 'power'
  | 'qr-code' | 'refresh-cw' | 'scan-line' | 'settings' | 'smartphone' | 'trash-2' | 'triangle-alert' | 'x';

export interface IconProps { name: IconName; size?: number; strokeWidth?: number; spin?: boolean; label?: string; className?: string }
export declare function Icon(props: IconProps): React.ReactElement;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'destructive' | 'destructive-solid' | 'link';
  size?: 'sm' | 'default' | 'lg' | 'icon' | 'icon-sm';
  block?: boolean;
  loading?: boolean;
  icon?: IconName;
  iconEnd?: IconName;
}
export declare function Button(props: ButtonProps): React.ReactElement;

export type ConnectionState = 'off' | 'connecting' | 'on' | 'error' | 'disabled';

export interface PowerButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  state?: ConnectionState;
  /** Подписи для экранного диктора по состояниям; по умолчанию русские. */
  labels?: Partial<Record<ConnectionState, string>>;
}
export declare function PowerButton(props: PowerButtonProps): React.ReactElement;

export interface ConnectionStatusProps { state?: ConnectionState; title?: string; detail?: React.ReactNode; className?: string }
export declare function ConnectionStatus(props: ConnectionStatusProps): React.ReactElement;

export interface SelectorRow { label: string; value: React.ReactNode; meta?: React.ReactNode; onClick?: () => void }
export interface SelectorCardProps { rows: SelectorRow[]; className?: string }
export declare function SelectorCard(props: SelectorCardProps): React.ReactElement;

export type LatencyState = 'good' | 'slow' | 'dead' | 'unknown' | 'testing';
export interface LatencyBadgeProps {
  state?: LatencyState;
  ms?: number;
  unit?: string;
  /** Без слова «Быстро» / «Медленно»: в строке, где рядом есть скорость. */
  compact?: boolean;
  labels?: Partial<Record<LatencyState, string>>;
  className?: string;
}
export declare function LatencyBadge(props: LatencyBadgeProps): React.ReactElement;

export type SpeedState = 'none' | 'testing' | 'done' | 'unavailable';
export interface SpeedBadgeProps { state?: SpeedState; mbps?: number; unit?: string; labels?: Partial<Record<'none' | 'testing' | 'unavailable', string>>; className?: string }
export declare function SpeedBadge(props: SpeedBadgeProps): React.ReactElement;

export interface EndpointRowProps {
  name: string;
  detail?: string;
  latency?: LatencyBadgeProps;
  /** Скорость канала; строка показывает её кнопкой, которая запускает замер. */
  speed?: SpeedBadgeProps;
  selected?: boolean;
  onClick?: () => void;
  onSpeedTest?: () => void;
  className?: string;
}
export declare function EndpointRow(props: EndpointRowProps): React.ReactElement;

export interface OptionRowProps { title: string; description?: string; selected?: boolean; onClick?: () => void; className?: string;
  /** Картинка варианта 48×48 после отметки — значок личины. */
  media?: React.ReactNode }
export declare function OptionRow(props: OptionRowProps): React.ReactElement;

export interface BadgeProps {
  variant?: 'default' | 'secondary' | 'outline' | 'accent' | 'success' | 'warning' | 'destructive' | 'muted';
  icon?: IconName;
  children?: React.ReactNode;
  className?: string;
}
export declare function Badge(props: BadgeProps): React.ReactElement;

export interface ProfileAction { label: string; icon?: IconName; destructive?: boolean; onClick?: () => void }
export interface ProfileRowProps {
  name: string;
  meta?: string;
  badges?: Array<BadgeProps & { text: string }>;
  selected?: boolean;
  reorderable?: boolean;
  /** Непустой список раскрывает строку действий под профилем (после долгого нажатия или кнопки меню). */
  actions?: ProfileAction[];
  menuLabel?: string;
  onClick?: () => void;
  onMenu?: () => void;
  className?: string;
}
export declare function ProfileRow(props: ProfileRowProps): React.ReactElement;

export interface ImportTileProps { icon: IconName; title: string; description?: string; emphasis?: boolean; onClick?: () => void; className?: string }
export declare function ImportTile(props: ImportTileProps): React.ReactElement;
export declare function ImportTileGrid(props: { children?: React.ReactNode; className?: string }): React.ReactElement;

export interface ListGroupProps { title?: string; children?: React.ReactNode; className?: string }
export declare function ListGroup(props: ListGroupProps): React.ReactElement;

export interface ListRowProps {
  title: string;
  description?: string;
  icon?: IconName;
  value?: string;
  /** Переключатель справа; aria-label берётся из title. */
  switch?: SwitchProps;
  trailing?: React.ReactNode;
  chevron?: boolean;
  destructive?: boolean;
  onClick?: () => void;
  className?: string;
}
export declare function ListRow(props: ListRowProps): React.ReactElement;

export interface SwitchProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> { checked?: boolean; onChange?: (checked: boolean) => void }
export declare function Switch(props: SwitchProps): React.ReactElement;

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> { invalid?: boolean }
export declare function Input(props: InputProps): React.ReactElement;

export interface FieldProps {
  id: string;
  label: string;
  description?: string;
  error?: string;
  /** Пропсы встроенного Input; игнорируются, если передан свой контрол в children. */
  input?: InputProps;
  children?: React.ReactNode;
  className?: string;
}
export declare function Field(props: FieldProps): React.ReactElement;

export interface CalloutProps { tone?: 'info' | 'success' | 'warning' | 'destructive'; title?: string; icon?: IconName; action?: React.ReactNode; children?: React.ReactNode; className?: string }
export declare function Callout(props: CalloutProps): React.ReactElement;

export interface ToastProps { tone?: 'info' | 'success' | 'destructive'; action?: { label: string; onClick?: () => void }; children?: React.ReactNode; className?: string }
export declare function Toast(props: ToastProps): React.ReactElement;

export interface SheetProps { id?: string; title?: string; description?: string; footer?: React.ReactNode; children?: React.ReactNode; className?: string }
export declare function Sheet(props: SheetProps): React.ReactElement;

export interface DialogProps { id?: string; title: string; description?: string; actions?: React.ReactNode; children?: React.ReactNode; className?: string }
export declare function Dialog(props: DialogProps): React.ReactElement;

export interface ScrimProps { center?: boolean; children?: React.ReactNode; className?: string }
export declare function Scrim(props: ScrimProps): React.ReactElement;

export interface TopBarProps { title?: string; onBack?: () => void; backLabel?: string; actions?: React.ReactNode; className?: string }
export declare function TopBar(props: TopBarProps): React.ReactElement;

export interface EmptyStateProps { icon?: IconName; title: string; description?: string; actions?: React.ReactNode; className?: string }
export declare function EmptyState(props: EmptyStateProps): React.ReactElement;

export interface ScreenProps {
  grid?: boolean;
  ground?: 'paper' | 'background';
  top?: React.ReactNode;
  overlay?: React.ReactNode;
  style?: React.CSSProperties;
  bodyStyle?: React.CSSProperties;
  children?: React.ReactNode;
  className?: string;
}
export declare function Screen(props: ScreenProps): React.ReactElement;

declare global {
  interface Window {
    Tessera: {
      Badge: typeof Badge; Button: typeof Button; Callout: typeof Callout; ConnectionStatus: typeof ConnectionStatus;
      Dialog: typeof Dialog; EmptyState: typeof EmptyState; EndpointRow: typeof EndpointRow; Field: typeof Field;
      Icon: typeof Icon; ImportTile: typeof ImportTile; ImportTileGrid: typeof ImportTileGrid; Input: typeof Input;
      LatencyBadge: typeof LatencyBadge; ListGroup: typeof ListGroup; ListRow: typeof ListRow; OptionRow: typeof OptionRow; PowerButton: typeof PowerButton;
      ProfileRow: typeof ProfileRow; Scrim: typeof Scrim; Screen: typeof Screen; SelectorCard: typeof SelectorCard;
      Sheet: typeof Sheet; SpeedBadge: typeof SpeedBadge; Switch: typeof Switch; Toast: typeof Toast; TopBar: typeof TopBar;
    };
  }
}
