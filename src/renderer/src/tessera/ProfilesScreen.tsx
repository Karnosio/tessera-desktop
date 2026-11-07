import { useEffect, useState } from "react";

import type { DesktopHost, DesktopProfile } from "@dashboard/app/desktop";

import type { ProfileAction } from "./ui/bundle.js";
import { ago, plural, t } from "./i18n";
import { downloadFailed } from "./importProfile";
import { message } from "./MainScreen";
import { Modal } from "./Modal";

/** Подписка, которая должна обновляться сама, а не обновлялась столько дней, — значит, обновление не проходит. */
const STALE_DAYS = 3;

export interface Notice {
  text: string;
  tone?: "info" | "success" | "destructive";
  action?: { label: string; onClick: () => void };
}

interface ProfilesScreenProps {
  host: DesktopHost;
  profiles: DesktopProfile[];
  selectedId: string | null;
  onBack: () => void;
  onAdd: () => void;
  onDelete: (profile: DesktopProfile) => void;
  notify: (notice: Notice) => void;
}

function meta(profile: DesktopProfile, now: number): string {
  const source =
    profile.type !== "remote"
      ? t("ts_profile_local")
      : profile.autoUpdate
        ? t("ts_profile_auto_update")
        : t("ts_profile_manual_update");
  if (profile.type !== "remote" || profile.lastUpdated === undefined) {
    return source;
  }
  return `${source} · ${ago(profile.lastUpdated, now)}`;
}

function staleDays(profile: DesktopProfile, now: number): number | null {
  if (profile.type !== "remote" || !profile.autoUpdate || profile.lastUpdated === undefined) {
    return null;
  }
  const days = Math.floor((now - profile.lastUpdated) / 86_400_000);
  return days >= STALE_DAYS ? days : null;
}

export function ProfilesScreen(props: ProfilesScreenProps) {
  const T = window.Tessera;
  const { host, profiles } = props;
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<DesktopProfile | null>(null);
  const now = Date.now();

  useEffect(() => {
    if (menuId !== null && !profiles.some((profile) => profile.id === menuId)) {
      setMenuId(null);
    }
  }, [menuId, profiles]);

  const move = (index: number, offset: number) => {
    const ids = profiles.map((profile) => profile.id);
    [ids[index], ids[index + offset]] = [ids[index + offset], ids[index]];
    void host.profiles.reorder(ids).catch((error: unknown) => props.notify({ text: message(error), tone: "destructive" }));
  };

  const update = (profile: DesktopProfile) => {
    host.profiles
      .updateRemote(profile.id)
      .then(() => props.notify({ text: t("ts_profile_updated", profile.name), tone: "success" }))
      .catch((error: unknown) => {
        const key = downloadFailed(message(error)) ? "ts_profile_download_failed" : "ts_profile_rejected";
        props.notify({ text: t(key, profile.name), tone: "destructive" });
      });
  };

  const actions = (profile: DesktopProfile, index: number): ProfileAction[] => {
    const close = (run: () => void) => () => {
      setMenuId(null);
      run();
    };
    const list: ProfileAction[] = [];
    if (profile.type === "remote") {
      list.push({ label: t("ts_profile_update"), icon: "refresh-cw", onClick: close(() => update(profile)) });
    }
    list.push({ label: t("ts_profile_rename"), icon: "pencil", onClick: close(() => setRenaming(profile)) });
    if (index > 0) {
      list.push({ label: t("ts_move_up"), onClick: close(() => move(index, -1)) });
    }
    if (index < profiles.length - 1) {
      list.push({ label: t("ts_move_down"), onClick: close(() => move(index, 1)) });
    }
    list.push({ label: t("ts_profile_delete"), icon: "trash-2", destructive: true, onClick: close(() => props.onDelete(profile)) });
    return list;
  };

  return (
    <T.Screen
      ground="background"
      className="slate-screen"
      top={
        <T.TopBar
          title={t("ts_profiles")}
          onBack={props.onBack}
          backLabel={t("ts_back")}
          actions={<T.Button variant="ghost" size="icon" icon="plus" aria-label={t("ts_add_profile")} onClick={props.onAdd} />}
        />
      }
      overlay={
        renaming === null ? undefined : (
          <RenameDialog
            profile={renaming}
            onClose={() => setRenaming(null)}
            onSave={(name) => {
              setRenaming(null);
              void host.profiles
                .updateMetadata(renaming.id, { name })
                .catch((error: unknown) => props.notify({ text: message(error), tone: "destructive" }));
            }}
          />
        )
      }
    >
      <div className="slate-stack" role="radiogroup" aria-label={t("ts_profile")}>
        {profiles.map((profile, index) => {
          const days = staleDays(profile, now);
          return (
            <T.ProfileRow
              key={profile.id}
              name={profile.name}
              meta={meta(profile, now)}
              badges={days === null ? undefined : [{ text: t("ts_profile_stale", plural("ts_days", days)), variant: "warning" }]}
              selected={profile.id === props.selectedId}
              actions={menuId === profile.id ? actions(profile, index) : undefined}
              menuLabel={t("ts_profile_actions", profile.name)}
              onClick={() => void host.profiles.select(profile.id).catch((error: unknown) => props.notify({ text: message(error), tone: "destructive" }))}
              onMenu={() => setMenuId(menuId === profile.id ? null : profile.id)}
            />
          );
        })}
      </div>
    </T.Screen>
  );
}

function RenameDialog(props: { profile: DesktopProfile; onClose: () => void; onSave: (name: string) => void }) {
  const T = window.Tessera;
  const [name, setName] = useState(props.profile.name);
  const trimmed = name.trim();
  return (
    <Modal center onClose={props.onClose}>
      <T.Dialog
        id="rename"
        title={t("ts_rename_profile")}
        actions={
          <>
            <T.Button variant="ghost" onClick={props.onClose}>
              {t("ts_cancel")}
            </T.Button>
            <T.Button disabled={trimmed === ""} onClick={() => props.onSave(trimmed)}>
              {t("ts_save")}
            </T.Button>
          </>
        }
      >
        <T.Field
          id="rename-name"
          label={t("ts_profile_name")}
          input={{
            value: name,
            autoFocus: true,
            onChange: (event) => setName(event.target.value),
            onKeyDown: (event) => {
              if (event.key === "Enter" && trimmed !== "") {
                props.onSave(trimmed);
              }
            },
          }}
        />
      </T.Dialog>
    </Modal>
  );
}
