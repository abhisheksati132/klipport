export type ClipType = "text" | "code" | "file" | "image";

export interface ClipboardItem {
  id: string;
  user_id: string;
  type: ClipType;
  title?: string | null;
  content?: string | null;
  file_url?: string | null;
  is_encrypted?: boolean;
  enc_version?: number;
  workspace_id?: string | null;
  self_destruct?: boolean;
  expires_at?: string | null;
  created_at?: string;
  file_size?: number | null;
  is_deleted?: boolean;
  deleted_at?: string | null;
  is_pinned?: boolean;
}

export interface OfflineClip extends Omit<ClipboardItem, "id"> {
  id: number;
  isOffline?: boolean;
}

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at?: string;
}

export interface CliToken {
  id: string;
  user_id: string;
  token_hash: string;
  name: string;
  created_at?: string;
}

export interface PresenceEntry {
  user_id: string;
  email: string;
  device: string;
}

export interface LinkPreview {
  title: string;
  description: string;
  image: string;
  url: string;
}

export interface SharedLinkItem {
  id: string;
  type: ClipType;
  title?: string | null;
  content?: string | null;
  file_url?: string | null;
  created_at?: string;
}
