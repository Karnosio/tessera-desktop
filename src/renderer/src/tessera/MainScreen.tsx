import { useEffect, useState } from "react";

import type { DaemonApi } from "@dashboard/api/daemon";
import { useStream } from "@dashboard/api/stream";
import type { DaemonConnectionState, DesktopHost } from "@dashboard/app/desktop";
import { ServiceStatus_Type } from "@dashboard/gen/daemon/started_service_pb";

import type { ConnectionState } from "./ui/bundle.js";
import { plural, t } from "./i18n";
import { latencyLabels } from "./labels";
import { useAuto } from "./auto";
import { MethodsSheet, speedBadge } from "./MethodsSheet";
import { useMethods } from "./useMethods";
import type { MethodSummary } from "./useMethods";

export function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const powerLabels = {
  off: t("ts_power_title_off"),
  connecting: t("ts_power_label_connecting"),
  on: t("ts_power_title_on"),
  error: t("ts_power_title_error"),
  disabled: t("ts_power_label_disabled"),
};

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function useStartedAt(api: DaemonApi, started: boolean): number | null {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  useEffect(() => {
    if (!started) {
      setStartedAt(null);
      return;
    }
    let cancelled = false;
    api
      .getStartedAt()
      .then((value) => {
        if (!cancelled) {
          setStartedAt(value);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [api, started]);
  return startedAt;
}

function onFor(startedAt: number, now: number): string | undefined {
  const minutes = Math.floor((now - startedAt) / 60_000);
  if (minutes < 1) {
    return undefined;
  }
  return t(
    "ts_power_detail_on_for",
    minutes < 60 ? plural("ts_minutes", minutes) : plural("ts_hours", Math.floor(minutes / 60)),
  );
}

function methodText(summary: MethodSummary): string {
  if (summary.fixed) {
    return t("ts_method_fixed");
  }
  if (!summary.auto) {
    return summary.name ?? t("ts_method_fixed");
  }
  return summary.name === null ? t("ts_method_auto") : t("ts_method_auto_with", summary.name);
}

interface MainScreenProps {
  host: DesktopHost;
  api: DaemonApi;
  connection: DaemonConnectionState;
  profileId: string | null;
  profileName: string | null;
  onProfiles: () => void;
  onSettings: () => void;
  onAdd: () => void;
}

export function MainScreen(props: MainScreenProps) {
  const T = window.Tessera;
  const top = (
    <T.TopBar
      actions={
        <T.Button
          variant="ghost"
          size="icon"
          icon="settings"
          aria-label={t("ts_settings")}
          title={t("ts_settings")}
          onClick={props.onSettings}
        />
      }
    />
  );
  let body;
  if (props.connection.phase !== "connected") {
    body = <ServiceProblem host={props.host} connection={props.connection} />;
  } else if (props.profileName === null) {
    body = (
      <div className="slate-center">
        <T.EmptyState
          title={t("ts_empty_title")}
          description={t("ts_empty_description")}
          actions={
            <T.Button size="lg" block onClick={props.onAdd}>
              {t("ts_paste_link_or_file")}
            </T.Button>
          }
        />
      </div>
    );
  } else {
    body = <Power {...props} profileName={props.profileName} />;
  }
  return (
    <T.Screen grid className="slate-screen" top={top}>
      {body}
    </T.Screen>
  );
}

function Power(props: MainScreenProps & { profileName: string }) {
  const T = window.Tessera;
  const { host, api } = props;
  const serviceStatus = useStream(api.serviceStatus);
  const groups = useStream(api.groups);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const status = serviceStatus.data.status?.status ?? ServiceStatus_Type.IDLE;
  const started = status === ServiceStatus_Type.STARTED;
  const auto = useAuto();
  const model = useMethods(api, groups.data, started, props.profileId, auto);
  const startedAt = useStartedAt(api, started);
  const now = useNow(30_000);

  useEffect(() => {
    if (started) {
      api.groups.retryNow();
    }
  }, [api, started]);

  let state: ConnectionState;
  let detail: string | undefined;
  if (failure !== null || status === ServiceStatus_Type.FATAL) {
    state = "error";
    detail = t("ts_failure_other", failure ?? serviceStatus.data.status?.errorMessage ?? "");
  } else if (status === ServiceStatus_Type.STARTING || (pending && !started)) {
    state = "connecting";
  } else if (started || status === ServiceStatus_Type.STOPPING) {
    state = "on";
    detail = startedAt === null ? undefined : onFor(startedAt, now);
  } else {
    state = "off";
  }

  const run = (stop: boolean) => {
    setPending(true);
    setFailure(null);
    (stop ? host.service.stop() : host.service.start())
      .catch((error: unknown) => setFailure(message(error)))
      .finally(() => {
        setPending(false);
        api.serviceStatus.reconnectNow();
      });
  };
  const toggle = () => run(state === "on" || state === "connecting");

  const openMethods = () => {
    setSheetOpen(true);
    model.pingOnOpen();
  };
  const { ping, speed } = model.summary;
  let meta;
  if (speed !== undefined) {
    meta = <T.SpeedBadge {...speedBadge(speed, false)} />;
  } else if (ping !== undefined) {
    meta = <T.LatencyBadge {...ping} labels={latencyLabels} />;
  }

  return (
    <div className="slate-main">
      <div className="slate-power">
        <T.PowerButton
          state={state}
          labels={powerLabels}
          disabled={status === ServiceStatus_Type.STOPPING || (pending && state !== "connecting")}
          onClick={toggle}
        />
        <T.ConnectionStatus
          state={state}
          title={t(`ts_power_title_${state}`)}
          detail={detail ?? t(`ts_power_detail_${state}`)}
        />
      </div>
      <T.SelectorCard
        rows={[
          { label: t("ts_profile"), value: props.profileName, onClick: props.onProfiles },
          {
            label: t("ts_method"),
            value: methodText(model.summary),
            meta,
            onClick: openMethods,
          },
        ]}
      />
      {sheetOpen && (
        <MethodsSheet
          model={model}
          profileName={props.profileName}
          started={started}
          connecting={state === "connecting"}
          onEnable={() => run(false)}
          onClose={() => setSheetOpen(false)}
        />
      )}
    </div>
  );
}

function ServiceProblem(props: { host: DesktopHost; connection: DaemonConnectionState }) {
  const T = window.Tessera;
  const { host, connection } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    action()
      .catch((reason: unknown) => setError(message(reason)))
      .finally(() => {
        setBusy(false);
        host.daemon.retryConnection();
      });
  };
  if (connection.phase === "connecting") {
    return (
      <div className="slate-center">
        <T.EmptyState icon="loader-circle" title={t("tsd_service_connecting")} />
      </div>
    );
  }
  let title: string;
  let description = t("tsd_service_description");
  let action = (
    <T.Button size="lg" block loading={busy} disabled={busy} onClick={() => run(host.setup.repairInstall)}>
      {t("tsd_repair")}
    </T.Button>
  );
  switch (connection.phase) {
    case "not-installed":
      title = t("tsd_service_not_installed");
      break;
    case "version-mismatch":
      title = t("tsd_service_version");
      break;
    case "not-running":
      title = t("tsd_service_not_running");
      action = (
        <T.Button size="lg" block loading={busy} disabled={busy} onClick={() => run(host.setup.repairStart)}>
          {t("tsd_repair")}
        </T.Button>
      );
      break;
    case "owned-by-other-user":
      title = t("tsd_service_other_user");
      description = t("tsd_service_other_user_description");
      action = (
        <T.Button size="lg" block variant="outline" loading={busy} disabled={busy} onClick={() => run(host.service.takeOver)}>
          {t("tsd_take_over")}
        </T.Button>
      );
      break;
    default:
      title = t("tsd_service_unavailable");
      action = (
        <T.Button size="lg" block disabled={busy} onClick={() => host.daemon.retryConnection()}>
          {t("ts_retry")}
        </T.Button>
      );
      break;
  }
  const detail = error ?? connection.errorMessage;
  return (
    <div className="slate-center">
      <T.EmptyState
        icon="triangle-alert"
        title={title}
        description={description}
        actions={
          <>
            {action}
            {detail !== undefined && <p className="slate-detail t-caption">{t("ts_import_detail", detail)}</p>}
          </>
        }
      />
    </div>
  );
}
