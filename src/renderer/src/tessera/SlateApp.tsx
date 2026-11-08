import { useEffect, useMemo, useRef, useState } from "react";

import { DaemonApi } from "@dashboard/api/daemon";
import { useStream } from "@dashboard/api/stream";
import type { Server } from "@dashboard/api/config";
import { useDaemonConnection, useDesktopProfiles } from "@dashboard/app/desktop";
import { ServiceStatus_Type } from "@dashboard/gen/daemon/started_service_pb";
import type { DesktopHost, DesktopProfile } from "@dashboard/app/desktop";

import { AddProfileSheet } from "./AddProfileSheet";
import type { AddJob } from "./AddProfileSheet";
import { language, t } from "./i18n";
import { importFile, importRemote } from "./importProfile";
import { MainScreen, message } from "./MainScreen";
import { ProfilesScreen } from "./ProfilesScreen";
import type { Notice } from "./ProfilesScreen";
import { AboutScreen, LicenseScreen, SettingsScreen } from "./SettingsScreen";
import type { License } from "./SettingsScreen";

const LOCAL_SERVER: Server = { id: "slate", name: "Slate", url: "", secret: "" };

// Тост с действием держится дольше: за 4 секунды «Вернуть» не успевают нажать
const NOTICE_MILLISECONDS = 4_000;
const NOTICE_WITH_ACTION_MILLISECONDS = 10_000;

export function SlateApp(props: { host: DesktopHost }) {
  const T = window.Tessera;
  const { host } = props;
  const connection = useDaemonConnection(host);
  const { selectedId, profiles } = useDesktopProfiles(host);
  const api = useMemo(() => new DaemonApi(LOCAL_SERVER, language, host.transport), [host]);
  const serviceStatus = useStream(api.serviceStatus);
  const running = serviceStatus.data.status?.status === ServiceStatus_Type.STARTED;
  const [screen, setScreen] = useState<"main" | "profiles" | "settings" | "about" | License>("main");
  const [adding, setAdding] = useState<{ job?: AddJob } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [deleting, setDeleting] = useState<DesktopProfile | null>(null);
  const deleteTimer = useRef<number | undefined>(undefined);
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;

  useEffect(
    () =>
      host.onImportRemoteProfile((request) =>
        setAdding({ job: () => importRemote(host, profilesRef.current, request) }),
      ),
    [host],
  );
  useEffect(
    () => host.onImportProfileFile((file) => setAdding({ job: () => importFile(host, profilesRef.current, file) })),
    [host],
  );

  useEffect(() => {
    if (notice === null) {
      return;
    }
    const timer = setTimeout(
      () => setNotice(null),
      notice.action === undefined ? NOTICE_MILLISECONDS : NOTICE_WITH_ACTION_MILLISECONDS,
    );
    return () => clearTimeout(timer);
  }, [notice]);

  const remove = (profile: DesktopProfile) => {
    void host.profiles.remove(profile.id).catch((error: unknown) => setNotice({ text: message(error), tone: "destructive" }));
  };

  // Профиль пропадает из списка сразу, а стирается, только если за 10 секунд не нажали «Вернуть»
  const deleteLater = (profile: DesktopProfile) => {
    if (deleting !== null) {
      clearTimeout(deleteTimer.current);
      remove(deleting);
    }
    setDeleting(profile);
    deleteTimer.current = window.setTimeout(() => {
      remove(profile);
      setDeleting(null);
    }, NOTICE_WITH_ACTION_MILLISECONDS);
    setNotice({
      text: t("ts_profile_deleted", profile.name),
      action: {
        label: t("ts_undo"),
        onClick: () => {
          clearTimeout(deleteTimer.current);
          setDeleting(null);
          setNotice(null);
        },
      },
    });
  };

  // Новый профиль upstream делает выбранным, но работающее ядро не перезапускает — переводим туннель на него сами
  const reload = () => {
    host.service
      .start()
      .catch((error: unknown) => setNotice({ text: t("ts_failure_other", message(error)), tone: "destructive" }))
      .finally(() => api.serviceStatus.reconnectNow());
  };

  const enable = () => {
    setAdding(null);
    setScreen("main");
    host.service
      .start()
      .catch((error: unknown) => setNotice({ text: t("ts_failure_other", message(error)), tone: "destructive" }))
      .finally(() => api.serviceStatus.reconnectNow());
  };

  const visible = profiles.filter((profile) => profile.id !== deleting?.id);
  const selected = visible.find((profile) => profile.id === selectedId) ?? null;

  let content;
  switch (screen) {
    case "main":
      content = (
        <MainScreen
          host={host}
          api={api}
          connection={connection}
          profileId={selected?.id ?? null}
          profileName={selected?.name ?? null}
          onProfiles={() => setScreen("profiles")}
          onSettings={() => setScreen("settings")}
          onAdd={() => setAdding({})}
        />
      );
      break;
    case "profiles":
      content = (
        <ProfilesScreen
          host={host}
          profiles={visible}
          selectedId={selectedId}
          onBack={() => setScreen("main")}
          onAdd={() => setAdding({})}
          onDelete={deleteLater}
          notify={setNotice}
        />
      );
      break;
    case "settings":
      content = <SettingsScreen host={host} onBack={() => setScreen("main")} onAbout={() => setScreen("about")} />;
      break;
    case "about":
      content = <AboutScreen host={host} onBack={() => setScreen("settings")} onLicense={setScreen} />;
      break;
    default:
      content = <LicenseScreen license={screen} onBack={() => setScreen("about")} />;
      break;
  }

  return (
    <>
      {content}
      {adding !== null && (
        <AddProfileSheet
          host={host}
          profiles={profiles}
          job={adding.job}
          running={running}
          onAdded={reload}
          onClose={() => setAdding(null)}
          onEnable={enable}
        />
      )}
      {notice !== null && (
        <div className="slate-toast">
          <T.Toast tone={notice.tone} action={notice.action}>
            {notice.text}
          </T.Toast>
        </div>
      )}
    </>
  );
}
